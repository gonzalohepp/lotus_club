-- ==============================================================================
-- REPONER EL TRIGGER DE ALTA DE USUARIOS
-- ==============================================================================
-- `public.handle_new_user()` sobrevivió al restore (vive en `public`), pero el
-- trigger que la dispara, `on_auth_user_created`, está definido sobre
-- `auth.users` — schema que no se restauró. Sin él:
--
--   login con Google → se crea la fila en auth.users → NO se crea el profile
--                    → el panel no encuentra perfil y te rebota
--
-- Este archivo repone la función y el trigger, y aprovecha para completar
-- nombre y avatar desde los metadatos de Google, que antes se perdían.
--
-- Lo que NO hace: asignar un dojo. En multi-tenant no hay forma de adivinar a
-- qué sede pertenece alguien que recién se registra, así que la fila en
-- `dojo_members` la crea un admin (o vos desde /superadmin). Hasta entonces la
-- persona existe pero no ve ningún dojo — que es el comportamiento correcto.
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.profiles (user_id, email, first_name, last_name, avatar_url)
    values (
        new.id,
        new.email,
        -- Google manda el nombre en raw_user_meta_data; si no viene, queda null
        -- y lo completa el admin al dar de alta a la persona en su dojo.
        nullif(split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1), ''),
        nullif(
            substr(
                coalesce(new.raw_user_meta_data->>'full_name', ''),
                length(split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2
            ),
            ''
        ),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (user_id) do update
        set email      = coalesce(excluded.email, public.profiles.email),
            avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- Backfill de usuarios que ya entraron sin trigger
-- ------------------------------------------------------------------------------
-- Si alguien se logueó en la ventana en que el trigger no existía, quedó con
-- auth.users pero sin profile. Esto los repara.
insert into public.profiles (user_id, email)
select u.id, u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Debe devolver 0: ningún usuario sin perfil.
--
--   select count(*) from auth.users u
--   where not exists (select 1 from public.profiles p where p.user_id = u.id);
