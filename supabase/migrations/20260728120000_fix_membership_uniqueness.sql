-- ==============================================================================
-- FIX — la membresía debe ser única POR DOJO, no globalmente
-- ==============================================================================
-- El schema heredado traía `memberships_member_id_unique UNIQUE (member_id)`:
-- una sola membresía por persona en toda la base. Tenía sentido en
-- single-tenant, pero rompe el caso central del multi-tenant:
--
--   "puedo tener un alumno que va los lunes a Lotus Lanús y los viernes a
--    Lotus Avellaneda"
--
-- Con la constraint global, cargarle la membresía en la segunda sede falla con
-- 23505 unique_violation. La migración 20260727120100 agregó `dojo_id` a la
-- tabla pero no tocó esta constraint — este archivo completa ese cambio.
--
-- Mismo problema en class_enrollments: ya tiene el índice correcto por dojo
-- (creado en 20260727120100), pero si sobrevivió una PK vieja sobre
-- (user_id, class_id) hay que sacarla también.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. memberships: una membresía vigente por (dojo, persona)
-- ------------------------------------------------------------------------------
alter table public.memberships
    drop constraint if exists memberships_member_id_unique;

-- El upsert de /api/members/create usa onConflict (dojo_id, member_id), así que
-- necesita una constraint real, no sólo un índice único.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'memberships_dojo_member_unique'
          and conrelid = 'public.memberships'::regclass
    ) then
        alter table public.memberships
            add constraint memberships_dojo_member_unique unique (dojo_id, member_id);
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. class_enrollments: limpiar restos de la PK global
-- ------------------------------------------------------------------------------
-- La unicidad correcta (dojo_id, user_id, class_id) ya la crea
-- `class_enrollments_unique` en 20260727120100. Si además quedó una PK o
-- constraint vieja sobre (user_id, class_id), impide que la misma persona se
-- inscriba a clases homónimas en dos sedes.
do $$
declare
    c record;
begin
    for c in
        select con.conname
        from pg_constraint con
        where con.conrelid = 'public.class_enrollments'::regclass
          and con.contype in ('p', 'u')
          -- exactamente (user_id, class_id), sin dojo_id.
          -- `attname` es de tipo `name`, así que hay que castear a text: sin el
          -- cast, comparar name[] con text[] falla con 42883.
          and (
              select array_agg(att.attname::text order by att.attname::text)
              from unnest(con.conkey) k
              join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
          ) = array['class_id', 'user_id']::text[]
    loop
        execute format('alter table public.class_enrollments drop constraint %I', c.conname);
        raise notice 'Constraint global eliminada de class_enrollments: %', c.conname;
    end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 3. Verificación
-- ------------------------------------------------------------------------------
-- Debe listar memberships_dojo_member_unique con (dojo_id, member_id):
--
--   select con.conname,
--          (select string_agg(att.attname::text, ', ' order by att.attnum)
--           from unnest(con.conkey) k
--           join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k) as columnas
--   from pg_constraint con
--   where con.conrelid in ('public.memberships'::regclass, 'public.class_enrollments'::regclass)
--     and con.contype in ('p','u')
--   order by 1;
