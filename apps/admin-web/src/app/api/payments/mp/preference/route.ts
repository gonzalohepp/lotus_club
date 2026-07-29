import { NextResponse } from "next/server";
import MercadoPagoConfig, { Preference } from "mercadopago";
import { requireMercadoPago } from "@/lib/requireAdmin";
import { requireDojo } from "@/lib/tenant/server";
import { serviceClient } from "@/lib/tenant/admin";
import { evaluateBilling } from "@/lib/billing";

/**
 * Crea la preferencia de pago de Mercado Pago para el alumno logueado.
 *
 * Todo se resuelve contra LA SEDE ACTIVA:
 *   · Las clases que se cobran tienen que ser de ese dojo.
 *   · El recargo sale de `dojos.billing` de esa sede, no de la config por
 *     defecto: una sede con 10% cobraba 20% antes de este cambio.
 *   · El `dojo_id` viaja en el `external_reference` porque el webhook llega
 *     desde Mercado Pago SIN SESIÓN — no hay dojo activo del que leerlo, y
 *     `payments.dojo_id` es NOT NULL.
 */

type ClassRow = {
    id: number
    name: string
    price_principal: number | null
    price_additional: number | null
}

export async function POST(req: Request) {
    const guard = await requireDojo();
    if (guard.error) return guard.error;

    const { ctx, dojoId } = guard;
    const dojo = ctx.activeDojo!;

    const featureGuard = await requireMercadoPago();
    if (featureGuard.error) return featureGuard.error;

    try {
        const { principal_id, additional_ids } = await req.json();

        const principalId = Number(principal_id);
        if (!principalId) {
            return NextResponse.json({ error: "principal_id is required" }, { status: 400 });
        }

        const additionalIds: number[] = Array.isArray(additional_ids)
            ? Array.from(new Set(additional_ids.map(Number).filter((n: number) => Number.isFinite(n) && n !== principalId)))
            : [];

        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            console.error("MP_ACCESS_TOKEN is missing");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Precios y estado de mora SIEMPRE se recalculan en el servidor:
        // nunca confiamos en el precio que venga del cliente.
        const supabase = serviceClient();

        const classIds = [principalId, ...additionalIds];
        const { data: classesData, error: classesError } = await supabase
            .from("classes")
            .select("id, name, price_principal, price_additional")
            .eq("dojo_id", dojoId)
            .in("id", classIds);

        if (classesError) throw classesError;

        const classes = (classesData || []) as ClassRow[];
        const principalClass = classes.find((c) => c.id === principalId);

        if (!principalClass) {
            // Puede ser un id inexistente o una clase de OTRA sede. Misma
            // respuesta en ambos casos, para no filtrar qué existe en los demás
            // dojos.
            return NextResponse.json({ error: "Invalid principal_id" }, { status: 400 });
        }

        const { data: statusData } = await supabase
            .from("members_with_status")
            .select("is_new_member, next_payment_due, role")
            .eq("dojo_id", dojoId)
            .eq("user_id", ctx.userId)
            .maybeSingle();

        const { multiplier } = evaluateBilling(dojo.billing, {
            endDate: statusData?.next_payment_due ?? null,
            isNewMember: !!statusData?.is_new_member,
            role: statusData?.role ?? null,
            timezone: dojo.timezone,
        });

        const items = [
            {
                id: String(principalClass.id),
                title: `Clase Principal: ${principalClass.name}${multiplier > 1 ? " (Con Recargo)" : ""}`,
                unit_price: Math.round(Number(principalClass.price_principal || 0) * multiplier),
                quantity: 1,
                currency_id: "ARS",
            },
            ...additionalIds
                .map((id) => classes.find((c) => c.id === id))
                .filter((c): c is ClassRow => !!c)
                .map((c) => ({
                    id: String(c.id),
                    title: `Adicional: ${c.name}${multiplier > 1 ? " (Con Recargo)" : ""}`,
                    unit_price: Math.round(Number(c.price_additional ?? c.price_principal ?? 0) * multiplier),
                    quantity: 1,
                    currency_id: "ARS",
                })),
        ];

        if (items.some((i) => !i.unit_price || i.unit_price <= 0)) {
            return NextResponse.json({ error: "Invalid price computed for selected classes" }, { status: 400 });
        }

        const { data: payerProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("user_id", ctx.userId)
            .maybeSingle();

        const payerEmail = payerProfile?.email ?? undefined;

        const client = new MercadoPagoConfig({ accessToken });
        const preference = new Preference(client);

        const url = new URL(req.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        const result = await preference.create({
            body: {
                items,

                payer: payerEmail ? { email: payerEmail } : undefined,

                payment_methods: {
                    excluded_payment_methods: [],
                    excluded_payment_types: [],
                    installments: 12,
                },

                back_urls: {
                    success: `${baseUrl}/profile?payment_status=success`,
                    failure: `${baseUrl}/profile?payment_status=failure`,
                    pending: `${baseUrl}/profile?payment_status=pending`,
                },
                auto_return: "approved",

                // Guardamos metadata para el webhook. user_id sale de la sesión,
                // no del body, para que nadie pueda acreditarle el pago a otro user_id.
                external_reference: JSON.stringify({
                    user_id: ctx.userId,
                    dojo_id: dojoId,
                    principal_id: principalId,
                    additional_ids: additionalIds,
                }),
            },
        });

        // Normalizar respuesta según versión del SDK
        const created = (result as { response?: typeof result })?.response ?? result;

        if (!created?.init_point && !created?.sandbox_init_point) {
            console.error("MP response unexpected:", JSON.stringify(result, null, 2));
            return NextResponse.json(
                { error: "MP response missing init_point" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            id: created.id,
            init_point: created.init_point,
            sandbox_init_point: created.sandbox_init_point,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error creating preference";
        console.error("Error creating MP preference:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
