-- ==============================================================================
-- INVITACIONES POR SEDE — dar de alta dueños/admins antes de que se registren
-- ==============================================================================
-- Problema: el login es Google OAuth. No podés crear la cuenta de otra persona
-- (no tenés su contraseña, y Google es quien la autentica), así que hasta que el
-- futuro admin no entre por primera vez no existe su fila en `auth.users` y no
-- hay a quién asignarle un rol.
--
-- Solución: invitaciones pendientes por email. Vos cargás "juan@x.com va a ser
-- admin de Lotus Avellaneda" y queda esperando. Cuando Juan entra con Google por
-- primera vez, el trigger de alta consume la invitación y le crea la fila en
-- `dojo_members` con el rol correcto. Juan entra y ya está adentro de su sede,
-- sin que nadie tenga que correr SQL en el medio.
--
-- Si la persona YA existe (se registró antes), la UI no crea invitación: le
-- inserta el `dojo_members` directo.
-- ==============================================================================

create table if not exists public.dojo_invitations (
    id          uuid primary key default gen_random_uuid(),
    dojo_id     uuid not null references public.dojos(id) on delete cascade,
    -- Se guarda siempre en minúsculas: Google puede devolver el mail con otra
    -- capitalización y el match tiene que darse igual.
    email       text not null,
    role        public.dojo_role not null default 'admin',
    invited_by  uuid references auth.users(id) on delete set null,
    created_at  timestamptz not null default now(),
    accepted_at timestamptz,

    constraint dojo_invitations_email_lower check (email = lower(email))
);

create index if not exists dojo_invitations_email_idx
    on public.dojo_invitations (email) where accepted_at is null;

create index if not exists dojo_invitations_dojo_idx
    on public.dojo_invitations (dojo_id);

-- Una invitación pendiente por persona y sede. Las ya aceptadas quedan como
-- historial, por eso el índice es parcial.
create unique index if not exists dojo_invitations_pending_unique
    on public.dojo_invitations (dojo_id, email) where accepted_at is null;

-- ------------------------------------------------------------------------------
-- El trigger de alta ahora también consume invitaciones
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    full_name text;
begin
    full_name := coalesce(new.raw_user_meta_data->>'full_name', '');

    insert into public.profiles (user_id, email, first_name, last_name, avatar_url)
    values (
        new.id,
        new.email,
        nullif(split_part(full_name, ' ', 1), ''),
        nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (user_id) do update
        set email      = coalesce(excluded.email, public.profiles.email),
            avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

    -- Invitaciones pendientes para este email → pertenencia real.
    insert into public.dojo_members (dojo_id, user_id, role)
    select i.dojo_id, new.id, i.role
    from public.dojo_invitations i
    where i.email = lower(new.email)
      and i.accepted_at is null
    on conflict (dojo_id, user_id) do update
        set role = excluded.role,
            is_active = true;

    update public.dojo_invitations
    set accepted_at = now()
    where email = lower(new.email)
      and accepted_at is null;

    return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------------------
alter table public.dojo_invitations enable row level security;

drop policy if exists "invitations manage" on public.dojo_invitations;
create policy "invitations manage" on public.dojo_invitations
for all to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

grant select, insert, update, delete on public.dojo_invitations to authenticated;
grant all on public.dojo_invitations to service_role;

-- ------------------------------------------------------------------------------
-- Backfill: usuarios ya registrados con invitación pendiente
-- ------------------------------------------------------------------------------
-- Cubre el caso de cargar la invitación después de que la persona se registró.
-- La UI lo evita (asigna directo si el perfil existe), pero esto lo deja
-- consistente igual.
insert into public.dojo_members (dojo_id, user_id, role)
select i.dojo_id, p.user_id, i.role
from public.dojo_invitations i
join public.profiles p on lower(p.email) = i.email
where i.accepted_at is null
on conflict (dojo_id, user_id) do nothing;

update public.dojo_invitations i
set accepted_at = now()
where i.accepted_at is null
  and exists (select 1 from public.profiles p where lower(p.email) = i.email);
