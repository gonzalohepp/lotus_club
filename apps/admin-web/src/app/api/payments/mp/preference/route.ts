import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Preference } from 'mercadopago'

// Initialize the client
// NOTE: Ideally this should be outside the handler, but we need to ensure env vars are loaded.
// It's safe to init here or lazily.

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { items, payer_email } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 })
        }

        const accessToken = process.env.MP_ACCESS_TOKEN
        if (!accessToken) {
            console.error('MP_ACCESS_TOKEN is missing')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const client = new MercadoPagoConfig({ accessToken: accessToken })
        const preference = new Preference(client)

        // Construct preference data
        // We add a back_url to redirect the user after payment
        // For local dev, this might need ngrok for "failure" or "pending" if we want real updates,
        // but for "success" redirect, localhost is fine for the browser.

        // We can assume the host from the request headers or hardcode for now.
        // Let's use origin from request if possible or fallback.
        const url = new URL(req.url)
        const baseUrl = `${url.protocol}//${url.host}`

        const result = await preference.create({
            body: {
                items: items.map((item: any) => ({
                    id: String(item.id),
                    title: item.title,
                    unit_price: Number(item.price),
                    quantity: 1,
                    currency_id: 'ARS',
                })),
                payer: {
                    // SANDBOX FIX: Forbidden to pay yourself. Using a dynamic test email.
                    email: process.env.NODE_ENV === 'development' || !payer_email
                        ? `test_user_${Math.floor(Math.random() * 10000)}@test.com`
                        : payer_email,
                },
                // EXPLICITLY ALLOW ALL PAYMENT METHODS FOR TESTING
                payment_methods: {
                    excluded_payment_methods: [],
                    excluded_payment_types: [],
                    installments: 12
                },
                back_urls: {
                    success: `${baseUrl}/profile?payment_status=success`,
                    failure: `${baseUrl}/profile?payment_status=failure`,
                    pending: `${baseUrl}/profile?payment_status=pending`,
                },
                auto_return: 'approved',
                statement_descriptor: 'BELEZA DOJO',
            }
        })

        console.log('Preference created:', result.id)
        console.log('Sandbox Init Point:', result.sandbox_init_point)

        return NextResponse.json({
            id: result.id,
            init_point: result.init_point,
            sandbox_init_point: result.sandbox_init_point
        })

    } catch (error: any) {
        console.error('Error creating MP preference:', error)
        return NextResponse.json({ error: error.message || 'Error creating preference' }, { status: 500 })
    }
}
