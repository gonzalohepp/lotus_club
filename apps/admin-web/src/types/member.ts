export type MemberRow = {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    emergency_phone: string | null
    notes: string | null
    access_code: string | null
    membership_type: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null
    next_payment_due: string | null
    end_date?: string | null
    status?: 'activo' | 'inactivo'
    class_ids?: number[]
    class_names?: string[]
    avatar_url?: string | null
}

export type ClassRow = {
    id: number
    name: string
    is_principal?: boolean
    price_principal?: number
    price_additional?: number
}

export type MemberPayload = {
    full_name: string
    email: string
    phone?: string
    access_code?: string
    classes: { class_id: number; is_principal: boolean }[]
    membership_type: 'mensual' | 'trimestral' | 'semestral' | 'anual'
    last_payment_date?: string
    next_payment_due?: string
    emergency_contact?: string
    notes?: string
}

export type ClassOption = {
    id: number
    name: string
    price_principal: number | null
    price_additional: number | null
    color: string | null
}
