-- ==============================================================================
-- FKs A `profiles` — para poder embeber el perfil desde PostgREST
-- ==============================================================================
-- `dojo_members.user_id` y `org_members.user_id` apuntaban sólo a
-- `auth.users(id)`. Funciona para la integridad, pero PostgREST arma sus embeds
-- (`select=...,profiles!inner(email)`) leyendo las foreign keys del schema
-- `public`, y `auth` no es visible ahí. Resultado:
--
--   PGRST200: Could not find a relationship between 'org_members' and 'profiles'
--
-- Efecto visible: la lista de superadmins de una organización y la pestaña
-- "Equipo" de una sede aparecían VACÍAS aunque hubiera filas cargadas — la
-- query fallaba entera y la UI mostraba el estado "no hay nadie".
--
-- Se agrega la FK a `profiles(user_id)`, que es además el modelado correcto:
-- una pertenencia apunta a una PERSONA, y la persona en este schema es
-- `profiles`. La FK a `auth.users` se conserva; tener las dos no molesta y deja
-- la integridad atada también al borrado de la cuenta.
--
-- Requisito de orden: el perfil tiene que existir antes que la pertenencia. Lo
-- garantiza el trigger `handle_new_user()`, que crea el profile en el mismo
-- momento en que nace el `auth.users`.
-- ==============================================================================

-- Por las dudas: si quedó alguna pertenencia sin perfil (usuarios creados
-- mientras el trigger no existía), se completa antes de agregar la constraint.
insert into public.profiles (user_id, email)
select distinct dm.user_id, u.email
from public.dojo_members dm
join auth.users u on u.id = dm.user_id
where not exists (select 1 from public.profiles p where p.user_id = dm.user_id)
on conflict (user_id) do nothing;

insert into public.profiles (user_id, email)
select distinct om.user_id, u.email
from public.org_members om
join auth.users u on u.id = om.user_id
where not exists (select 1 from public.profiles p where p.user_id = om.user_id)
on conflict (user_id) do nothing;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'dojo_members_profile_fk'
          and conrelid = 'public.dojo_members'::regclass
    ) then
        alter table public.dojo_members
            add constraint dojo_members_profile_fk
            foreign key (user_id) references public.profiles(user_id) on delete cascade;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'org_members_profile_fk'
          and conrelid = 'public.org_members'::regclass
    ) then
        alter table public.org_members
            add constraint org_members_profile_fk
            foreign key (user_id) references public.profiles(user_id) on delete cascade;
    end if;

    if to_regclass('public.dojo_invitations') is not null
       and not exists (
        select 1 from pg_constraint
        where conname = 'dojo_invitations_invited_by_profile_fk'
          and conrelid = 'public.dojo_invitations'::regclass
    ) then
        -- `invited_by` puede quedar nulo si se borra a quien invitó.
        alter table public.dojo_invitations
            add constraint dojo_invitations_invited_by_profile_fk
            foreign key (invited_by) references public.profiles(user_id) on delete set null;
    end if;
end $$;

-- PostgREST cachea el schema; sin esto la relación nueva no se ve hasta el
-- próximo reinicio del servicio.
notify pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Debe devolver filas, no PGRST200:
--   curl '.../rest/v1/org_members?select=id,role,profiles!inner(email)' -H "apikey: ..."
