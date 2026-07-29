-- ==============================================================================
-- DATOS PÚBLICOS DE LA SEDE — equipo, instructor y horarios
-- ==============================================================================
-- La red Lotus está formada por filiales afiliadas, cada una con su propio
-- equipo (Beleza Dojo, Kizuna Team, Bastión Jiu Jitsu...) y su instructor a
-- cargo. Ese dato es lo que el visitante busca en el mapa, y hoy no tenía dónde
-- guardarse: `dojos` sólo tenía nombre, dirección y coordenadas.
--
-- Por qué `schedules_text` es texto libre y no filas en `classes`:
-- `classes` modela la operación de una sede que USA el panel (precios,
-- inscripciones, asistencia, cobro). La mayoría de estas filiales sólo figuran
-- en el mapa, y sus horarios vienen como prosa irregular ("Lunes, miércoles y
-- viernes 12:00 y 19:00 (Gi); martes y jueves 19:30 (No-Gi)"). Parsear eso a
-- filas estructuradas produciría datos inventados con precisión falsa.
--
-- Cuando una filial empieza a usar el panel carga sus `classes` de verdad, y
-- este texto queda como descripción para la web. Son dos cosas distintas y
-- conviven bien.
-- ==============================================================================

alter table public.dojos add column if not exists team            text;
alter table public.dojos add column if not exists instructor      text;
alter table public.dojos add column if not exists instructor_rank text;
alter table public.dojos add column if not exists schedules_text  text;
alter table public.dojos add column if not exists maps_url        text;

comment on column public.dojos.team is
    'Equipo o academia afiliada (ej. "Beleza Dojo", "Kizuna Team Jiu Jitsu").';
comment on column public.dojos.instructor is
    'Instructor a cargo de la filial.';
comment on column public.dojos.instructor_rank is
    'Graduación del instructor (ej. "Faixa preta 3er grau").';
comment on column public.dojos.schedules_text is
    'Horarios en texto libre, para la web pública. No reemplaza a `classes`.';
comment on column public.dojos.maps_url is
    'Link a Google Maps de la filial, cuando lo informaron.';

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
--   select name, team, instructor, instructor_rank from public.dojos order by name;
