-- ==============================================================================
-- INSTRUCTORES DE UNA CLASE — principal y secundario, por referencia
-- ==============================================================================
-- `classes.instructor` era texto libre: se tipeaba el nombre a mano. Eso impide
-- saber QUIÉN da la clase (no hay vínculo con el usuario), permite typos y deja
-- el dato huérfano si la persona cambia de apellido o se va.
--
-- Se agregan las referencias reales y un segundo instructor. La columna de texto
-- NO se elimina: la leen la búsqueda de clases, la tarjeta, el perfil del alumno
-- y el mapa público. Se mantiene sincronizada con el nombre del instructor
-- principal para que todo eso siga funcionando sin joins ni cambios.
-- ==============================================================================

alter table public.classes
    add column if not exists instructor_id uuid
        references public.profiles(user_id) on delete set null,
    add column if not exists secondary_instructor_id uuid
        references public.profiles(user_id) on delete set null,
    -- espejo de texto del secundario, por el mismo motivo que `instructor`
    add column if not exists secondary_instructor text;

comment on column public.classes.instructor_id is
    'Instructor principal. `classes.instructor` queda como espejo de texto del '
    'nombre, que es lo que leen la búsqueda, la tarjeta y el perfil del alumno.';
comment on column public.classes.secondary_instructor_id is
    'Instructor secundario. Opcional: no toda clase tiene dos.';

create index if not exists classes_instructor_id_idx
    on public.classes (instructor_id) where instructor_id is not null;
create index if not exists classes_secondary_instructor_id_idx
    on public.classes (secondary_instructor_id) where secondary_instructor_id is not null;

-- ------------------------------------------------------------------------------
-- Backfill: enlazar por nombre lo que ya estaba tipeado
-- ------------------------------------------------------------------------------
-- Sólo cuando el match es UNÍVOCO dentro de la misma sede. Si dos personas del
-- dojo tienen el mismo nombre, se deja en null a propósito: es preferible que el
-- admin lo elija a que quede mal enlazado y nadie se entere.
update public.classes c
set instructor_id = m.user_id
from (
    select dm.dojo_id,
           lower(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) as full_name,
           min(p.user_id::text)::uuid as user_id,
           count(*) as n
    from public.dojo_members dm
    join public.profiles p on p.user_id = dm.user_id
    where dm.is_active and dm.role in ('admin', 'instructor')
    group by dm.dojo_id, 2
) m
where c.instructor_id is null
  and c.instructor is not null
  and m.n = 1
  and m.dojo_id = c.dojo_id
  and lower(trim(c.instructor)) = m.full_name;
