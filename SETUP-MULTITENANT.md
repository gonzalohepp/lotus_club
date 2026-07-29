# Plataforma multi-tenant — estado y pendientes

Este proyecto convirtió el sistema single-tenant de Beleza (una instancia de
Vercel + Supabase por cliente) en una plataforma multi-marca: una sola instancia
que sirve a N organizaciones, cada una con N sedes, todas aisladas entre sí.

Beleza Dojo Access sigue intacto en su propio repo y su propia Supabase.

---

## 1. Modelo

```
Plataforma
└── Organización  "Lotus Club"        → plan, features, marca
    ├── Dojo      "Lotus Lanús"       → alumnos, clases, pagos, cobro propios
    └── Dojo      "Lotus Quilmes"
```

Una persona tiene **una** cuenta (`profiles`) y **N** pertenencias
(`dojo_members`), una por sede, cada una con su propio rol, membresía, pagos y
estado de cuota. El alumno que entrena lunes en Lanús y viernes en Avellaneda es
una sola cuenta con dos membresías independientes.

### Roles

| Rol | Tabla | Alcance | Academias | `/superadmin` |
|---|---|---|---|---|
| **Desarrollador** | `platform_admins` | Todas las organizaciones | Ve y edita | ✅ |
| **Superadmin** | `org_members` (`superadmin`) | Todas las sedes de *su* marca | Sólo ve | ❌ |
| **Administrador** | `dojo_members` (`admin`) | Su sede | No ve | ❌ |
| **Profesor** | `dojo_members` (`instructor`) | Alumnos y asistencia de su sede | No ve | ❌ |
| **Alumno** | `dojo_members` (`member` / `becado`) | Sólo perfil y validate | No ve | ❌ |

`becado` no es un nivel de permisos: es un alumno exento de cuota, que el motor
de cobro trata vía `exempt_roles`.

**No hay rol de dueño de sucursal.** La configuración de cada sede la define la
marca, salvo la lógica de cobro, que es exclusiva del desarrollador.

Dos ejes independientes que se aplican **juntos**:

- **Capacidades** (`capabilities()` en `lib/tenant/types.ts`) — qué puede hacer
  esta persona según su rol.
- **Features** (`resolveFeatures()` en `lib/features.ts`) — qué incluye el plan
  contratado por la organización.

Un administrador con plan Pro no ve "Academias" (le falta la capacidad); un
superadmin con plan Basic no ve "Pagos" (le falta la feature).

La herencia del superadmin vive en los helpers SQL (`my_dojo_ids()`,
`my_staff_dojo_ids()`, `my_manager_dojo_ids()`), que son los que consultan
**todas** las políticas RLS. Por eso alcanzó con redefinir esas tres funciones
para que la herencia aplique en toda la base, sin tocar una sola policy.

---

## 2. Qué ya está funcionando

### Aislamiento

RLS por `dojo_id` en todas las tablas de datos. Verificado con tokens reales de
cada usuario, no con service role (que bypassea RLS por definición):

```bash
python3 database/verify-tenant-isolation.py
```

Crea 4 usuarios de prueba (2 por sede) y comprueba que cada admin ve sólo su
padrón, que los alumnos se ven sólo a sí mismos, y que pedir explícitamente
`?dojo_id=eq.<otra sede>` devuelve vacío.

### Lógica de cobro configurable

`dojos.billing` es un JSON que interpretan **dos** motores con las mismas reglas:
`public.billing_eval()` (SQL, alimenta las vistas) y `src/lib/billing.ts`
(TypeScript, pinta el estado en el navegador).

```json
{
  "due_day": 10,
  "tiers": [
    { "from_day": 1,  "to_day": 10,   "surcharge_pct": 0,  "blocks_access": false, "label": "Sin recargo" },
    { "from_day": 11, "to_day": 19,   "surcharge_pct": 20, "blocks_access": false, "label": "Con recargo" },
    { "from_day": 20, "to_day": null, "surcharge_pct": 20, "blocks_access": true,  "label": "Bloqueado"  }
  ],
  "months_overdue_blocks": 2,
  "exempt_roles": ["admin", "instructor", "becado"],
  "new_member_exempt": true,
  "currency": "ARS",
  "rounding": 0
}
```

Ése es el criterio que había decidido el dueño de Beleza, ahora como default.
Otra sede puede poner "del 1 al 15 sin recargo, del 16 en adelante 10% y bloqueo
a los 3 meses" sin tocar una línea de código.

Después de modificar cualquiera de los dos motores:

```bash
psql "$DB" -f database/verify-billing-parity.sql
```

Chequea los casos borde (días 10/11/19/20, cruce de año, 2 meses de atraso,
roles exentos) y marca con ✗ lo que se haya desincronizado.

### Panel `/superadmin`

Organizaciones y sedes, plan Basic/Pro con toggles por feature, colores y logo,
editor visual de tramos de cobro con simulador que corre el motor real, alta de
superadmins de marca y equipo por sede con invitaciones.

Las invitaciones existen porque el login es Google OAuth y no se puede crear la
cuenta de otro: se carga el email, y el trigger `handle_new_user()` la consume la
primera vez que esa persona entra.

### Cobro online

`/api/payments/mp/preference` y `/webhook` imputan el pago a la sede correcta:
el `dojo_id` viaja en el `external_reference`, porque el webhook llega desde
Mercado Pago sin sesión y no hay dojo activo del que leerlo.

Si una preferencia vieja no trae `dojo_id`, el webhook usa la única sede del
alumno; si tiene varias **no adivina** y corta con el error registrado —
acreditar plata a la sede equivocada es peor que no acreditarla.

### Pantallas segmentadas

Dashboard, miembros, clases, pagos, historial de accesos, asistencia en vivo,
métricas (+ payment-timing), reportes, QR, validate, notificaciones y perfil
filtran por la sede activa, y todas las escrituras mandan `dojo_id`.

Ninguna pantalla usa ya números de cobro fijos: `pricing.ts` fue eliminado y
todo pasa por `evaluateBilling(billing)` con las reglas de la sede.

---

## 3. Lo que falta

### 3.1 Mercado Pago es una sola cuenta

`MP_ACCESS_TOKEN` es una env var de la instancia, así que **todos los cobros de
todas las marcas caen en la misma cuenta de MP**. Para vender a un segundo
cliente hay que guardar el token por organización (cifrado, o en Supabase Vault)
y leerlo en las rutas `/api/payments/mp/*` según el dojo del pago.

### 3.2 Branding no cableado

Podés editar colores, logo y nombre en `/superadmin`, y se guardan en
`organizations.branding` / `dojos.branding`, pero el `AdminLayout` sigue con
"Beleza Dojo" y los colores hardcodeados. Falta consumir `useTenant().branding`.

### 3.3 `academies` sigue existiendo

La tabla heredada quedó en paralelo a `dojos`. El panel de Academias ya lee
`dojos`, pero la landing pública (`AcademiesMapSection`, `PublicMap`) sigue
leyendo `academies`, así que el mapa está vacío. Falta repuntarla y borrar la
tabla.

### 3.4 Login por email para testing

La app sólo soporta Google OAuth, así que los usuarios que crea
`verify-tenant-isolation.py` no pueden entrar por la UI. Agregar login por
email/password detrás de una env var (~20 líneas) permitiría navegar como ellos.

---

## 4. Setup de una instancia nueva

### 4.1 Proyecto Supabase

1. **New project** — región `South America (São Paulo)`.
2. De **Project Settings → API**: `Project URL`, `anon public` y `service_role`.
3. **Authentication → Providers → Google**: activar con el Client ID/Secret.
4. **Authentication → URL Configuration**:
   - Site URL: la URL de la app
   - Redirect URLs: `http://localhost:3001/auth/callback` y la de producción

> Las dos URLs de OAuth se confunden seguido:
> en **Google Cloud → Authorized redirect URIs** va
> `https://<proyecto>.supabase.co/auth/v1/callback`; en **Supabase → Redirect
> URLs** va `http://localhost:3001/auth/callback`. Google redirige a Supabase y
> Supabase a tu app. Invertirlas da `redirect_uri_mismatch`.

### 4.2 Buckets de Storage

| Bucket | Público | Para qué |
|---|---|---|
| `avatars` | Sí | Fotos de perfil |
| `branding` | Sí | Logos por organización/sede |

### 4.3 Variables de entorno

`apps/admin-web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role>

NEXT_PUBLIC_SITE_URL=http://localhost:3001

NEXT_PUBLIC_QR_CURRENT_URL=https://<proyecto>.supabase.co/functions/v1/qr-current
QR_SECRET=<openssl rand -hex 32>

NEXT_PUBLIC_VAPID_PUBLIC_KEY=<...>
VAPID_PRIVATE_KEY=<...>

MP_ACCESS_TOKEN=<...>
```

**Ya no existen** `NEXT_PUBLIC_PLAN` ni `NEXT_PUBLIC_MERCADOPAGO`: el plan salió
a `organizations.plan` y el toggle de MP a `dojos.billing.mercadopago_enabled`.

### 4.4 Cargar el schema

Las migraciones multi-tenant asumen que las tablas base ya existen (`profiles`,
`memberships`, `payments`, `classes`, `class_enrollments`, `access_logs`, …),
porque se crearon en su momento desde el Studio, no por migración.

```bash
pg_restore -d "postgresql://postgres:<PASSWORD>@db.<PROYECTO>.supabase.co:5432/postgres" \
  --no-owner \
  backup-supabase/supabase_backup_2026-01-21.dump

supabase db push --db-url "$DB"
```

> ⚠️ **No uses `--no-privileges`.** Descarta todos los `GRANT` del dump y las
> tablas quedan inaccesibles para `authenticated` y `service_role`, con un
> `42501 permission denied` que ocurre *antes* de evaluar RLS. Si ya restauraste
> así, `20260728093000_restore_grants.sql` lo repara.
>
> El dump incluye el schema `auth`. Si restaurás sólo `public`, vas a quedar con
> `profiles` poblada y `auth.users` vacía: los alumnos existen como filas pero
> nadie puede loguearse, y el backfill de `dojo_members` inserta 0 filas porque
> filtra por `auth.users`.

Para arrancar con datos limpios en vez de importar Beleza:

```bash
psql "$DB" -f database/reset-staging-data.sql
```

### 4.5 Darte de alta como desarrollador

Sin esto `/superadmin` devuelve 404 (a propósito: no revela que existe).

```sql
insert into public.platform_admins (user_id, note)
select id, 'dev' from auth.users where email = 'tu@email.com';
```

Cerrá sesión y volvé a entrar.

### 4.6 Alta de un cliente

1. `/superadmin` → **+** → nombre de la organización
2. Plan Basic o Pro, y las features
3. Pestaña **Marca**: colores y logo
4. **Agregar sede** por cada dojo
5. Pestaña **Lógica de cobro** de cada sede: los tramos, con el simulador al lado
6. Sección **Superadmins**: quién administra la marca
7. Pestaña **Equipo** de cada sede: administradores y profesores

---

## 5. Verificación

```bash
# Ninguna tabla sin RLS → 0 filas
psql "$DB" -c "select c.relname from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1;"

# Políticas que dejan pasar todo → sólo academies y landing_events
psql "$DB" -c "select c.relname, p.polname from pg_policy p
  join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and pg_get_expr(p.polqual,p.polrelid)='true' order by 1,2;"

# authenticated puede leer todo lo que necesita → 0 filas
psql "$DB" -c "select c.relname from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
    and not has_table_privilege('authenticated', c.oid, 'SELECT') order by 1;"

# Motor de cobro → 16 filas en ✓
psql "$DB" -f database/verify-billing-parity.sql

# Aislamiento entre sedes
python3 database/verify-tenant-isolation.py
```

Y la prueba de fuego, sin sesión y con el anon key público:

```bash
curl 'https://<proyecto>.supabase.co/rest/v1/payments?select=*' -H 'apikey: <anon>'
```

Tiene que devolver `[]` o `42501`.

---

## 6. Orden de las migraciones

| Archivo | Qué hace |
|---|---|
| `20260727120000_multitenant_core` | organizations, dojos, dojo_members, platform_admins, helpers RLS |
| `20260727120100_multitenant_backfill` | `dojo_id` en las tablas de datos + migración de lo existente |
| `20260727120200_billing_engine` | `billing_eval()` + `members_with_status` y `dashboard_stats` por dojo |
| `20260727120300_multitenant_rls` | Políticas de aislamiento (limpia por catálogo, no por nombre) |
| `20260728093000_restore_grants` | Repara los `GRANT` que borró `--no-privileges` |
| `20260728094000_restore_new_user_trigger` | Repone `on_auth_user_created` (vivía en el schema `auth`) |
| `20260728110000_dojo_invitations` | Invitaciones por email + consumo en el trigger de alta |
| `20260728120000_fix_membership_uniqueness` | `unique (dojo_id, member_id)` — habilita el alumno multi-sede |
| `20260728130000_org_roles` | `org_members` + herencia del superadmin en los helpers |
| `20260728140000_remove_owner_role` | Elimina `owner` del enum y recrea las vistas |
| `20260728150000_billing_dev_only` | Trigger que restringe `dojos.billing` al desarrollador |
| `20260728160000_dojos_dev_only` | Limpia pertenencias redundantes y excluye al dev del padrón |
| `20260728170000_restore_org_dojo_management` | `org_members` escribible sólo por el dev |
| `20260728180000_member_profile_fks` | FKs a `profiles` para que PostgREST resuelva los embeds |
| `20260728190000_dojos_manage_dev_only` | Alta de sedes exclusiva del desarrollador |

---

## 7. Notas de diseño que conviene no perder

**RLS es el borde de seguridad; el filtro por dojo activo es de aplicación.**
Las políticas definen el máximo visible (todas las sedes a las que tenés
acceso); `.eq('dojo_id', activeDojo.id)` decide cuál estás mirando. Mezclar
ambos en RLS lleva a bugs de "no veo mis datos" difíciles de depurar.

**Las políticas RLS se combinan con OR.** Alcanza con que sobreviva una vieja
del tipo `USING (true)` para anular todo el aislamiento. Por eso
`20260727120300` limpia por catálogo (`pg_policy`) en vez de dropear por nombre
adivinado: la base heredada tenía políticas creadas a mano desde el Studio que
no figuraban en ninguna migración.

**Service role bypassea RLS.** Toda ruta que lo use tiene que scopear a mano:
ningún `user_id` que venga del cliente se toca sin pasar por
`assertMemberOfDojo()` (ver `lib/tenant/admin.ts`).

**El trigger de cobro restringe una COLUMNA, no una fila.** RLS no puede hacer
eso, y gracias a esa separación se puede abrir o cerrar el `UPDATE` sobre
`dojos` sin reabrir nunca la lógica de cobro.

**Los nombres de columna no son uniformes**: `memberships` usa `member_id`,
`member_grades` usa `user_id`, el resto usa `user_id`. Un search & replace ciego
entre ambos rompe las migraciones con "column does not exist".
