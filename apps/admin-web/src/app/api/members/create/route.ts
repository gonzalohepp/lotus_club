import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            first_name,
            last_name,
            email,
            phone,
            emergency_phone,
            notes,
            access_code,
            membership_type,
            last_payment_date,
            next_payment_due,
            classes
        } = body

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Create Auth User (or retrieve if exists)
        let userId: string

        // Check if user exists by email first (to avoid invite spam if we just want to link)
        // Note: admin.createUser will return error if exists, which is fine, we handle it.
        const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true, // Auto confirm so they can login immediately if they reset password
            user_metadata: { first_name, last_name }
        })

        if (createError) {
            // If user already exists, try to find them
            if (createError.message.includes('already has been registered') || createError.status === 422) {
                // There isn't a direct "getUserByEmail" in admin api easily exposed without listUsers filtering, 
                // which is slow? actually listUsers can filter.
                const { data: listData } = await supabase.auth.admin.listUsers()
                const found = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
                if (found) {
                    userId = found.id
                } else {
                    throw new Error('User exists but could not be found via admin list')
                }
            } else {
                throw createError
            }
        } else {
            userId = createdUser.user.id
        }

        // 2. Create Profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                user_id: userId,
                role: 'member',
                first_name,
                last_name,
                email,
                phone: phone ?? null,
                emergency_phone: emergency_phone ?? null,
                notes: notes ?? null,
                access_code: access_code
            })

        if (profileError) {
            // If profile already exists (unique constraint), maybe update it? 
            // For now, let's throw if we can't create the profile as it implies data inconsistency if user existed but profile didn't?
            // Or if user existed AND profile existed, we probably shouldn't be in "CREATE" flow.
            throw new Error('Error creating profile: ' + profileError.message)
        }

        // 3. Create Membership
        const typeMap: Record<string, string> = {
            mensual: 'monthly',
            trimestral: 'quarterly',
            semestral: 'semiannual',
            anual: 'annual'
        }

        const { error: memErr } = await supabase
            .from('memberships')
            .upsert({
                member_id: userId,
                type: typeMap[membership_type] || 'monthly',
                start_date: last_payment_date ?? new Date().toISOString().slice(0, 10),
                end_date: next_payment_due ?? null
            },
                { onConflict: 'member_id' }
            )

        if (memErr) throw new Error('Error creating membership: ' + memErr.message)

        // 4. Create Class Enrollments
        if (classes && classes.length > 0) {
            const { error: classErr } = await supabase
                .from('class_enrollments')
                .insert(classes.map((c: any) => ({
                    user_id: userId,
                    class_id: c.class_id,
                    is_principal: c.is_principal
                })))

            if (classErr) throw new Error('Error enrolling classes: ' + classErr.message)
        }

        return NextResponse.json({ ok: true, userId })
    } catch (e: any) {
        console.error('Create Member Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
