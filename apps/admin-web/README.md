# Beleza Dojo — Panel de administración

Panel web (Next.js + Supabase) para gestión de un dojo/gimnasio: control de
acceso por QR, alumnos, clases, pagos, métricas y notificaciones push.

Cada cliente corre su **propia instancia** (proyecto Vercel + proyecto
Supabase propios, mismo código de este repo). No es multi-tenant: no hay
aislamiento de datos por cliente dentro de una misma base.

## Planes (Basic / Pro)

La instancia se comporta como **Basic** o **Pro** según la env var
`NEXT_PUBLIC_PLAN`. La lógica vive en un solo lugar:
[`src/lib/features.ts`](src/lib/features.ts).

| | Basic | Pro |
|---|---|---|
| QR de Acceso / Validar Acceso | ✅ | ✅ |
| Miembros | ✅ | ✅ |
| Clases | ✅ | ✅ |
| Historial de Accesos | ✅ | ✅ |
| Academias (sedes) | 1 sede | Múltiples sedes |
| Graduaciones y cinturones | ❌ | ✅ |
| Pagos (Mercado Pago) | ❌ | ✅ |
| Métricas | ❌ | ✅ |
| Reportes | ❌ | ✅ |
| Asistencia en Vivo | ❌ | ✅ |
| Notificaciones (broadcast push) | ❌ | ✅ |

Las features apagadas se ocultan del nav, redirigen a `/admin` si se navega a
mano (tanto a nivel middleware/edge como en el cliente), y sus API routes
devuelven `404` (no `403`, para no revelar que la feature existe).

**Academias es un caso especial**: no se apaga por completo en Basic, porque
la landing pública (`/`) muestra un mapa que necesita al menos una sede activa
en la tabla `academies`. En vez de un flag on/off, `getAcademyLimit()` en
`lib/features.ts` devuelve un límite numérico (`1` en Basic, `null` = sin
límite en Pro). El admin de Basic puede ver/editar su única sede, pero el
botón "Nueva Academia" se deshabilita al llegar al límite (chequeado también
del lado del `insert` en `AcademyModal.tsx`, no solo en el botón).

**Graduaciones tampoco es una ruta propia**: vive embebida dentro de `/profile`
(vista del alumno) y dentro del modal de edición de miembro en `/members`, no
tiene una URL propia que gatear en middleware. Se oculta con `hasFeature(
'graduations')` directamente en `profile/page.tsx` (sección de escritorio +
botón del bottom sheet mobile) y en `MemberModal.tsx` (tab "Graduaciones").

**Botón "Actualizar a Pro"**: en instancias Basic aparece un botón en el
sidebar (solo para `role === 'admin'`) que abre `UpgradeModal.tsx` — una
comparativa Basic/Pro generada a partir de `FEATURES_BY_PLAN`, con un botón de
contacto. Ese botón usa un placeholder (`UPGRADE_CONTACT_URL` en
`components/plan/UpgradeModal.tsx`, marcado con `TODO`) — reemplazar por el
canal de contacto real antes de mostrarle esto a un cliente.

Si no se setea `NEXT_PUBLIC_PLAN`, la instancia se comporta como **Pro** (es
el default — no afecta el comportamiento de una instancia ya desplegada que
nunca configuró esta variable).

Las alertas de acceso denegado/fraude (push en tiempo real) y el resto del
control de acceso QR se consideran core y quedan siempre activas en ambos
planes, independientemente del flag de "Notificaciones".

## Variables de entorno

| Variable | Requerida | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase de esta instancia |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Anon key del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Service role key — solo se usa server-side |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL pública del deploy (para links en notificaciones, etc.) |
| `NEXT_PUBLIC_PLAN` | No | `basic` o `pro`. Default `pro` si no está seteada |
| `CRON_SECRET` | No | Secreto para disparar `notifications/reminders` desde un cron externo |
| `MP_ACCESS_TOKEN` | Solo Pro | Access token de Mercado Pago. Dejar vacío en Basic |
| `MP_WEBHOOK_SECRET` | Solo Pro | Secret para validar la firma del webhook de MP |
| `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Push notifications (VAPID) |
| `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PRIVATE_KEY` | No | Push notifications (VAPID) |
| `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_SUBJECT` | No | `mailto:` de contacto para VAPID |

## Levantar una instancia nueva para un cliente

1. **Supabase**: crear un proyecto nuevo → `supabase link --project-ref <ref>`
   → `supabase db push`. Se usan las mismas migraciones para todos los
   clientes (Basic incluido) — quedan tablas sin uso (ej. `payments`), es
   inofensivo y mantiene un solo schema para mantener.
2. **Primer admin**: no hay script de seed. Crear el usuario a mano desde el
   dashboard de Supabase Auth, y actualizar su fila en `profiles` para poner
   `role = 'admin'`.
2.b **Primera sede**: cargar la sede del cliente desde `/admin/academies` (o a
   mano en la tabla `academies`) antes de mostrar la landing pública — sin
   ninguna fila con `is_active = true` el mapa de "Dónde estamos" se ve vacío.
3. **Vercel**: crear un proyecto nuevo apuntando a este mismo repo, con root
   directory `apps/admin-web` (el monorepo ya lo soporta vía
   `next.config.mjs`).
4. **Env vars** del proyecto Vercel nuevo: todas las `NEXT_PUBLIC_SUPABASE_*` /
   `SUPABASE_SERVICE_ROLE_KEY` apuntando a la base del paso 1, más
   `NEXT_PUBLIC_PLAN=basic`. Dejar `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET`
   vacíos.
5. **Smoke test** post-deploy, logueado como el admin del paso 2:
   - El nav debe mostrar exactamente: Dashboard, QR de Acceso, Validar Acceso,
     Miembros, Clases, Historial de Accesos, Mi Perfil.
   - El dashboard debe mostrar 4 KPIs (sin "Ingresos del Mes") y sin panel de
     "Pagos recientes".
   - Navegar a mano a `/payments`, `/metricas`, `/reportes`,
     `/asistencia-vivo` o `/notificaciones` debe redirigir a `/admin`.
   - `/admin/academies` debe ser accesible y mostrar la sede ya cargada; el
     botón "Nueva Academia" debe estar deshabilitado si ya hay 1 sede creada.
   - En `/profile` no debe aparecer "Mis Graduaciones" (ni en desktop ni en el
     bottom sheet mobile), y el tab "Graduaciones" no debe aparecer al editar
     un miembro desde `/members`.
   - El sidebar debe mostrar el botón "Actualizar a Pro"; al hacer click debe
     abrir el comparativo Basic/Pro.

## Desarrollo local

```bash
pnpm --filter admin-web dev
```

Para probar el plan Basic en local, setear `NEXT_PUBLIC_PLAN=basic` en
`.env.local` antes de levantar el servidor (requiere reiniciar el dev server,
ya que Next.js solo lee `NEXT_PUBLIC_*` al bootear).
