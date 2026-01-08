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
}
