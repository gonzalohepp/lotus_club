-- ==============================================================================
-- LA MARCA DEL CLIENTE VUELVE A SER LOTUS, NO KURO
-- ==============================================================================
-- Decisión de producto (Gonzalo, 29/07/2026), alineada con el informe de
-- evaluación: **Kuro es la plataforma, Lotus Club es la red del cliente.**
--
-- Habíamos renombrado la organización a "Kuro" para sacar "Lotus" de lo que ve
-- el cliente, y era al revés: la organización es el cliente. El síntoma visible
-- era la pantalla de sedes, que decía "Sedes de Kuro" donde tenía que decir
-- "Sedes de Lotus Club Argentina" — ese texto sale de `organizations.name`.
--
-- Kuro sigue siendo la marca de la plataforma y no se toca: el wordmark del
-- sidebar, el título de la pestaña y el favicon están fijos en el código
-- (`app/layout.tsx`), no salen de esta tabla.
--
-- Se hace por migración y no a mano —como se hizo el cambio original— para que
-- quede asentado por qué y para que un entorno nuevo arranque bien.
-- ==============================================================================

update public.organizations
set name = 'Lotus Club Argentina'
where slug = 'lotus';

-- ------------------------------------------------------------------------------
-- Las dos sedes de demo
-- ------------------------------------------------------------------------------
-- Mismo criterio: son academias de la red del cliente, así que llevan su marca.
--
-- OJO: el PDF de credenciales que ya se entregó dice "Kuro Demo Norte" y
-- "Kuro Demo Sur". Hay que reemitirlo o avisar del cambio de nombre; los
-- usuarios, contraseñas y slugs (`demo-norte`, `demo-sur`) no se tocan, así que
-- el acceso sigue funcionando igual.
update public.dojos d
set name = 'Lotus Demo Norte'
from public.organizations o
where d.org_id = o.id and o.slug = 'lotus' and d.slug = 'demo-norte';

update public.dojos d
set name = 'Lotus Demo Sur'
from public.organizations o
where d.org_id = o.id and o.slug = 'lotus' and d.slug = 'demo-sur';

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
--   select name from public.organizations where slug = 'lotus';
--     → Lotus Club Argentina
--   select slug, name from public.dojos where slug like 'demo-%';
--     → demo-norte | Lotus Demo Norte
--       demo-sur   | Lotus Demo Sur
