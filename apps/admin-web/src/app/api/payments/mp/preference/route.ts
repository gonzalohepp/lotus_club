import { NextResponse } from "next/server";
import MercadoPagoConfig, { Preference } from "mercadopago";
import { createClient } from "@supabase/supabase-js";
import { requireUser, requireFeature } from "@/lib/requireAdmin";
import { getPaymentMultiplier } from "@/lib/pricing";

type ClassRow = {
    id: number
    name: string
    price_principal: number | null
    price_additional: number | null
}

export async function POST(req: Request) {
    const auth = await requireUser();
    if (auth.error) return auth.error;
    const user = auth.user;

    const featureGuard = requireFeature('payments');
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
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const classIds = [principalId, ...additionalIds];
        const { data: classesData, error: classesError } = await supabase
            .from("classes")
            .select("id, name, price_principal, price_additional")
            .in("id", classIds);

        if (classesError) throw classesError;

        const classes = (classesData || []) as ClassRow[];
        const principalClass = classes.find((c) => c.id === principalId);

        if (!principalClass) {
            return NextResponse.json({ error: "Invalid principal_id" }, { status: 400 });
        }

        const { data: statusData } = await supabase
            .from("members_with_status")
            .select("is_new_member, next_payment_due, role")
            .eq("user_id", user.id)
            .maybeSingle();

        const multiplier = getPaymentMultiplier(
            statusData?.next_payment_due ?? null,
            !!statusData?.is_new_member,
            statusData?.role ?? null
        );

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

        const client = new MercadoPagoConfig({ accessToken });
        const preference = new Preference(client);

        const url = new URL(req.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        const result = await preference.create({
            body: {
                items,

                payer: user.email ? { email: user.email } : undefined,

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
                    user_id: user.id,
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
