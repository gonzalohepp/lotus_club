# Reporte de testing — plataforma multi-tenant

Fecha: 29/07/2026 · Entorno: staging (`yutfaczmeodhpqxkdfxs`) · 34 sedes, 11 usuarios de prueba

---

## Resumen

| Área | Resultado |
|---|---|
| Compilación (`tsc` + `next build`) | ✅ limpio |
| Aislamiento entre sedes | ✅ sin fugas |
| Matriz de permisos por rol | ✅ correcta |
| Motor de cobro (paridad SQL↔TS) | ✅ 16/16 |
| Integridad de datos | ✅ sin huérfanos |
| Guards de API | ✅ 11/11 rutas |
| **Flujo de acceso QR** | **❌ estaba roto — corregido** |
| Validación de acceso | ✅ movida al servidor |
| Sedes con coordenadas | ✅ 34/34 |

**5 bugs encontrados y corregidos** —tres rompían por completo la funcionalidad
principal— **más 5 mejoras aplicadas**, incluida la que sacó la decisión de
acceso del navegador del alumno.

---

## Bugs críticos

### 1. El alumno no podía validar el QR de su propia sede

`qr_tokens` tenía una única policy con `can_read_dojo()`, que incluye sólo al
staff. Pero `/validate` corre **en el navegador del alumno**: al escanear busca
el token para verificarlo, y esa consulta devolvía vacío siempre.

**Síntoma:** *"El código QR ha expirado o no es válido"* con un código recién
generado.

**Alcance:** el flujo principal del producto no funcionaba para el único rol que
lo usa. Ningún alumno podía entrar a ningún dojo.

**Solución** — [`20260729090000`](supabase/migrations/20260729090000_fix_qr_tokens_member_read.sql):
se separó la policy única en dos. `SELECT` para cualquier miembro activo de la
sede (necesario para validar, y no expone nada: el token es justo lo que el
alumno acaba de escanear). `INSERT/UPDATE/DELETE` sigue siendo del staff.

### 2 y 3. El alumno no podía registrar su ingreso ni su asistencia

Misma causa en `access_logs` y `class_attendance`: el `INSERT` estaba limitado a
`can_read_dojo()`. Al confirmar la clase, `/validate` hace las dos escrituras y
**ambas devolvían 403**.

**Síntoma:** ninguno visible. El código ignora el resultado de esos inserts, así
que el alumno veía "acceso autorizado" y no quedaba registrado nada — ni su
asistencia ni su ingreso. Es el peor tipo de bug: falla en silencio y se descubre
cuando alguien pregunta por qué el historial está vacío.

**Solución** — [`20260729093000`](supabase/migrations/20260729093000_fix_member_self_checkin.sql):
policies separadas por actor. El alumno escribe **sólo sus propias filas y sólo
en sedes a las que pertenece**; el staff escribe cualquier fila de su sede
(alta manual, acceso de invitado con `user_id` nulo).

Verificado que un alumno no puede registrar el ingreso de otra persona ni en
otra sede: 403 en ambos casos.

---

## Bugs de impacto medio

### 4. El router post-login usaba el rol global heredado

`/app` decidía a dónde mandarte con `profiles.role`, el rol del sistema
single-tenant. Rompía en tres casos:

- El desarrollador y los superadmins de marca tienen `profiles.role = 'member'`
  (los crea el trigger de alta) → caían en `/validate` como alumnos.
- Un administrador de sede cuyo perfil global quedó en `'member'` —el caso normal
  ahora, porque el rol vive en `dojo_members`— tampoco llegaba a `/admin`.
- Alguien admin en una sede y alumno en otra recibía siempre el mismo destino,
  sin importar dónde estuviera parado.

**Solución:** [`app/page.tsx`](apps/admin-web/src/app/app/page.tsx) reescrito
sobre `getTenantContext()`. Decide con el rol **en la sede activa**, más los
niveles de plataforma y marca.

Efecto colateral: desapareció un `TypeError: controller[kState].transformAlgorithm`
recurrente que aparecía en cada redirect desde `/app`.

### 5. Las alertas de seguridad no llegaban a los admins de sede

El realtime de accesos denegados en `AdminLayout` filtraba por
`profile.role !== 'admin'` — el rol global otra vez. Un admin de sede con perfil
global `'member'` no recibía las alertas de su propio dojo.

**Solución:** usa el rol de la sede activa. De paso se quitó el fallback
`tenant.role || profile?.role`, que reintroducía el problema por otra vía, y se
subieron `role`/`isAdmin` arriba de los effects que los usan (estaban declarados
después, funcionando por casualidad).

---

## Falso positivo que conviene conocer

La primera corrida del audit reportó *"admin de sede puede cambiar la lógica de
cobro"*. Era un error **del test**, no del sistema.

PostgREST devuelve `204 No Content` tanto para un `UPDATE` que escribió como para
uno que RLS filtró a cero filas. El test miraba sólo el status.

Con `Prefer: return=representation` la diferencia se ve: bloqueado devuelve `[]`.
Verificado que el `billing` no se modificó.

**Está corregido en el script.** Vale la pena tenerlo presente: cualquier prueba
de permisos que mire sólo el código HTTP da falsos positivos en `UPDATE` y
`DELETE`.

---

## Recomendaciones aplicadas

### ✅ La validación de acceso pasó al servidor

**Era:** la decisión de *"acceso autorizado"* se tomaba en el navegador del
alumno, que después insertaba el log. Cualquiera con la consola abierta podía
marcarse autorizado sin escanear y con la cuota vencida.

**Ahora:** dos rutas nuevas —
[`/api/access/validate`](apps/admin-web/src/app/api/access/validate/route.ts) y
[`/api/access/checkin`](apps/admin-web/src/app/api/access/checkin/route.ts)—
verifican en el servidor token, sede, estado de cuota, cooldown e inscripción, y
escriben con service role. El alumno perdió el `INSERT` directo sobre
`access_logs` y `class_attendance` ([`20260729100000`](supabase/migrations/20260729100000_server_side_access_validation.sql)).

`checkin` re-verifica todo en vez de confiar en que `validate` salió bien: entre
una llamada y la otra el cliente podría saltearse el scan y llamar directo.

El staff conserva el insert directo, que lo necesita para el acceso de invitados
desde `/qr`.

Verificado: un alumno que intenta auto-autorizarse recibe 403; el staff sigue
registrando invitados.

### ✅ Versión de Node alineada

`.nvmrc` decía 20, `engines` pedía `<22.0.0` y el entorno corría v22.23.1 —las
tres en desacuerdo. Quedó `.nvmrc: 22` y `engines: >=20.0.0`, que admite las dos
LTS y coincide con lo que efectivamente se probó.

### ✅ `academies` eliminada

Era la última tabla con una policy `USING (true)` y la causa de que el panel
mostrara "no hay academias" con 34 sedes cargadas. Se borraron la tabla, sus
componentes (`AcademyList`, `AcademyModal`) y el helper `unaccent_fallback`
([`20260729110000`](supabase/migrations/20260729110000_drop_academies.sql)).

### ✅ `/api/push/send` devuelve 401

Sin `CRON_SECRET` respondía `500 Server misconfigured`, lo que confirmaba que la
ruta existe y filtraba estado de configuración. Ahora es 401 en los dos casos
—sin secreto y con secreto incorrecto—; la causa real queda en el log.

### ✅ Las 34 sedes tienen coordenadas

Las 6 que Nominatim no resolvía se geocodificaron con variantes de consulta
(calles numeradas de La Plata, gimnasios por nombre propio). Las coordenadas
quedaron fijadas en `lotus-filiales.json`, así que no dependen de que el
geocodificador vuelva a acertar.

## Recomendaciones pendientes

### Media — orden de deploy

Tres veces durante el desarrollo el mismo patrón rompió la app: **código nuevo
contra schema viejo**. El síntoma nunca se parece a la causa — la última vez, una
columna faltante se veía como "perdí todos mis permisos".

En Vercel, si el build sale antes que el `db push`, la app queda unos minutos
mostrando a todos como si no tuvieran permisos. **Siempre migración primero,
deploy después.**

`getTenantContext()` ahora loguea estos fallos con la pista explícita
(*"¿falta aplicar alguna migración?"*), lo que redujo el diagnóstico de media hora
a un vistazo.

### Baja — datos de prueba en la base

11 usuarios y 2 sedes de prueba, marcadas inactivas para que no aparezcan en la
web ni en el switcher. Se van con `seed-test-users.py --cleanup` y
`verify-tenant-isolation.py --cleanup` cuando ya no hagan falta.

---

## Qué quedó verificado

**Aislamiento.** Cada admin ve sólo su padrón; los alumnos sólo a sí mismos;
pedir explícitamente `?dojo_id=eq.<otra sede>` devuelve vacío en
`members_with_status`, `payments`, `classes` y `dojo_members`. Probado con tokens
reales de cada usuario, nunca con la service role key —que bypassea RLS por
definición y habría dado todo verde sin probar nada.

**Escalada de privilegios.** Un admin de sede no puede: crear datos en otra sede,
auto-asignarse superadmin de marca, agregarse a `platform_admins`, ni cambiar la
lógica de cobro (reservada al desarrollador por trigger de columna).

**Sin sesión.** Con el anon key público sólo se leen `dojos`, `classes`,
`academies` y `public_organizations` — lo que la landing necesita. Todo lo demás
devuelve vacío o 403.

**Motor de cobro.** 16/16 casos borde, incluidos los límites de tramo
(días 10/11/19/20), cruce de año, 2 meses de atraso y roles exentos. Los casos
degenerados fallan seguro: config vacía y tiers vacíos dan `gracia`, nunca
bloqueo.

**Integridad.** 0 tablas sin RLS, 0 filas sin `dojo_id`, 0 usuarios sin perfil,
0 pertenencias huérfanas, `authenticated` con SELECT en todas las tablas.

---

## Cómo re-correr

```bash
cd apps/admin-web && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/next build
cd .. 
python3 database/verify-tenant-isolation.py     # aislamiento entre sedes
python3 database/audit-permissions.py           # matriz de permisos por rol
psql "$DB" -f database/verify-billing-parity.sql # motor de cobro
```

Los tres devuelven exit code 0/1, así que sirven en CI.
