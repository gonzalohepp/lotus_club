-- ==============================================================================
-- MODO DEL QR POR SEDE
-- ==============================================================================
-- Cada sede decide si su QR rota o queda fijo, y esa decisión depende de su
-- realidad física:
--
--   · Con pantalla o tablet en la puerta → conviene ROTATIVO: el código cambia
--     cada 30 segundos, así que sacarle una foto y mandársela a un amigo no
--     sirve de nada.
--   · Sin pantalla (el caso de Beleza) → FIJO: se imprime una vez, se pega en
--     la pared y no se toca más.
--
-- Hasta ahora el modo vivía en `localStorage`, es decir POR NAVEGADOR. Eso tenía
-- dos problemas concretos:
--
--   1. La tablet de la puerta podía estar en fijo y la laptop del admin en
--      rotativo, para la MISMA sede. Cada dispositivo con su propia idea.
--   2. Al cambiar de sede con el switcher, el modo se arrastraba de una a otra,
--      aunque fueran realidades opuestas.
--
-- Con la columna acá, el modo es un atributo de la sede: se decide una vez y lo
-- respeta cualquier dispositivo que abra esa sede.
-- ==============================================================================

alter table public.dojos
    add column if not exists qr_fixed boolean not null default false;

comment on column public.dojos.qr_fixed is
    'true = QR impreso, no rota. false = rotativo cada 30s (requiere pantalla en la puerta).';

-- ------------------------------------------------------------------------------
-- Limpieza de tokens huérfanos
-- ------------------------------------------------------------------------------
-- Los tokens fijos se generaron sin `dojo_id` mientras el QR era single-tenant.
-- Sin sede no los valida nadie (el scanner filtra por dojo_id), así que sólo
-- ocupan lugar y confunden al depurar.
delete from public.qr_tokens where dojo_id is null;

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
--   select name, qr_fixed from public.dojos order by name;
