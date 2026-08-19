# Feedback Kuro — plan de trabajo

Origen: *"Informe de evaluación funcional y de marca"*, agosto 2026, por Guada con
revisión de Claudio y Turco. Probado sobre `lotus-club.vercel.app`.

---

## Estado al 29/07/2026

| Sección | Estado | Qué falta |
|---|---|---|
| §0 Bloqueantes | 🟡 **4 / 5** | Sólo queda el tagline. |
| §1 Resueltos al revés | ✅ **2 / 2** | — |
| §2 Bugs confirmados | ✅ **5 / 5** | — |
| §3 Nomenclatura | ✅ **3 / 3** | — |
| §4 Idioma y marca | ✅ **9 / 9** | — |
| §5 Cambios por rol | 🟡 **2 / 17** | **Ya no hay nada bloqueado.** |
| §6 Funcionalidades nuevas | 🟡 **1 / 9** | Presupuestar aparte. |

**Verificado:** `tsc` sin errores, `next build` compila, y el lint quedó igual
que antes de los cambios (3 errores y 20 warnings preexistentes, ninguno nuevo).
Sin commit todavía.

**Hay 2 migraciones nuevas sin aplicar** (`supabase db push`):
`20260811120000_mestre_finance_own_sede_only` y
`20260811130000_restore_lotus_brand_name`.

### Lo que apareció mientras se arreglaba

- **Los tres síntomas de Reportes eran una sola causa.** `darkSelectProps` pisaba
  los defaults correctos de `StyledSelect` con valores de cuando la pantalla era
  sólo oscura: `hover:bg-carbon-950` pintaba el trigger casi negro en tema claro
  con texto casi negro encima, `focus:bg-carbon-800` hacía lo mismo al recorrer
  las opciones, y el panel quedaba al 5% de opacidad dejando ver el texto de
  atrás. Se borró el override entero.

- **11 clases de Tailwind malformadas** con doble opacidad (`dark:bg-white/5/50`,
  `dark:border-white/10/50`) en `reportes`, `metricas` y `asistencia-vivo`.
  Tailwind admite una sola, así que no compilaban y el elemento se quedaba con el
  color del tema claro. Eso explica "Top 5 alumnos: texto gris sobre fondo
  blanco" y "el fondo de los filtros queda transparente".

- **La superposición del alta de alumno** eran 4 etiquetas en `absolute -top-6`
  (−24px) dentro de una grilla con `gap-5` (20px): caían 4px dentro de la fila de
  arriba, justo sobre el teléfono. Pasaron a flujo normal.

- **De paso salieron las medallas 🥇🥈🥉** del Top 5 de Métricas, por la misma
  regla de "sin emojis" del manual.

---

# ✅ HECHO

## §2. Bugs confirmados — 5 / 5

- [x] **Contraste ilegible en los filtros de Reportes.**
      → Causa: `darkSelectProps` en `app/reportes/page.tsx:31`. Eliminado; ahora
      usa los defaults theme-aware de `StyledSelect`.

- [x] **La exportación de Métricas no llevaba nombres, sólo el ID de usuario.**
      → `app/metricas/page.tsx`: se sumó el join a `profiles` en la consulta de
      pagos y las filas del Excel se arman a mano con encabezados en español
      (Alumno, Monto, Método, Fecha…). Antes `XLSX.json_to_sheet` volcaba el
      objeto crudo, así que salía `user_id` y un `profiles` con "[object Object]".

- [x] **"Top 5 alumnos" ilegible en modo oscuro.**
      → Era `dark:bg-white/10/50` (clase inválida). Se corrigió, y además el
      `hover:bg-carbon-800` que oscurecía la fila en tema claro y el número de
      puesto que no tenía color de texto.

- [x] **Campos superpuestos en el alta de alumno.**
      → `app/components/members/MemberForm.tsx`: 4 etiquetas en `absolute -top-6`
      pasaron a flujo normal con `mb-2`, y el ícono de cada campo se ancló a un
      wrapper propio para seguir centrado respecto del input.

- [x] **Fichas de alumno sin modo oscuro** en `/members`.
      → `MemberList.tsx`, componente `DesktopCard`: no tenía ni una variante
      `dark:`. Se agregaron 16 reglas. *(Lo detecté yo, no está en el informe.)*

## §3. Nomenclatura — 3 / 3

- [x] **"Miembros" / "Socios" → "Alumnos"** en toda la app (23 archivos).
      - [x] "Nuevo Miembro" → "Nuevo Alumno" (dashboard y `/members`)
      - [x] "Socio" → "Alumno" en el formulario de alta
      - [x] "Socios al día" → "Alumnos al día" (tarjetas del dashboard)
      - [x] El ítem "Miembros" del menú lateral
      - [x] Título "Gestión de Miembros"

- [x] **"Academia" → "Sede"** para cada punto físico.
      - [x] Ítem "Academias" del menú → "Sedes"
      - [x] "Administrar Academias" → "Administrar Sedes"
      - [x] También el diálogo de acceso de invitado ("Viene de otra academia" →
            "otra sede", "Academia de origen" → "Sede de origen")

- [x] **Textos de la pantalla de sedes revisados**: ya no mezcla los dos términos.
      *Lo único que queda ahí es que dice "Sedes de **Kuro**" en vez de "Sedes de
      Lotus Club Argentina" — eso no es texto, es el nombre de la organización en
      la base. Ver §1.*

## §4. Idioma y sistema de marca — 9 / 9

- [x] **"Admin Panel" → "Panel de Administración"**, **"Instructor Panel" →
      "Panel de Instructor"** (`AdminLayout.tsx`).
- [x] **"Communications Hub" → "Comunicaciones"** (`notificaciones/page.tsx`).
- [x] **Página 404 al español.** Creada en `app/not-found.tsx` — antes se mostraba
      la de Next, en inglés.
- [x] **Tildes:** "Metricas" → "Métricas", "Fisico" → "Físico" (3 lugares),
      "Valido / No valido" → "Válido / No válido".
- [x] **Voseo unificado:** "Escanea" → "Escaneá" en `/qr` (×2) y `/validate`.
- [x] **Todos los emojis fuera.** El 🥋 de las clases pasó a iconografía lucide
      en un componente compartido nuevo (`app/components/kuro/ClassIcon.tsx`).
      Después de que confirmaras que salen todos, también se fueron: los 🥋 de
      los mensajes de WhatsApp (4), el del pin del mapa de la landing —ahora un
      SVG del mismo glifo—, las medallas 🥇🥈🥉 del Top 5, los ✨💵🏦📱 de los
      modales de pago y los 📢⚠️🚩 de los títulos de las notificaciones push.
      Lo único que queda son ⚠ dentro de comentarios de código, que no ve nadie.
- [x] **Colores fuera de token.** Se sacó el filtro de 11 colores de `/classes` y
      el selector "Cromática" de Nueva Clase. Las clases nuevas usan el token de
      marca; las existentes conservan el color que ya tenían.
- [x] **Tipografía confirmada: sí es Montserrat**, cargada por `next/font/google`
      en `app/layout.tsx:10`. Se expone como `--font-geist-sans` por razones
      históricas, que es probablemente por qué pareció un fallback del sistema.
      **Sin trabajo pendiente, sólo avisarles.**

## §5. Cambios por rol — 2 / 17

- [x] Mestre → Clases: sacar el filtro por color.
- [x] Responsable → "Nueva Clase": sacar el selector de color.

---

# ⬜ RESTA

## §0. Bloqueantes — 4 / 5

Respondidos por Gonzalo el 29/07/2026. Los cuatro resueltos **ya están
implementados**, no sólo decididos.

- [x] **¿Un mismo email puede tener varios roles?** → **Sí, y hay que armarlo
      todo.** Implementado: ver "Multi-perfil" en §6.
- [x] **¿El Mestre ve la recaudación de toda la red?** → **No.** Sólo la de su
      propia sede, y únicamente si además es administrador de esa sede.
      Implementado en §1.
- [x] **¿La organización se llama "Kuro" o "Lotus Club Argentina"?** →
      **Lotus Club Argentina**, y las sedes demo pasan a "Lotus Demo
      Norte/Sur". Implementado en §1.
- [x] **¿Los emojis salen?** → **Sí, todos.** Implementado en §4.
- [ ] **¿Cuál es el tagline vigente?** El informe pregunta por
      "Academia, comunidad, evolución." que no aparece en ningún lado.
      **Es lo único que falta definir.**

## §1. Las dos cosas que habíamos resuelto al revés — 2 / 2

- [x] **Nombre de la organización → "Lotus Club Argentina".**
      *Kuro es la plataforma, Lotus Club es la red del cliente.* La pantalla de
      sedes ya no dice "Sedes de Kuro". Las sedes demo pasan a "Lotus Demo
      Norte" y "Lotus Demo Sur".
      → Migración `20260811130000_restore_lotus_brand_name.sql` y
      `database/seed-demo-academies.py`.
      ⚠️ **El PDF de credenciales entregado dice "Kuro Demo Norte/Sur".** Los
      usuarios, contraseñas y slugs no cambian, así que el acceso sigue
      funcionando, pero conviene reemitirlo o avisar.

- [x] **Alcance financiero del Mestre → sólo su propia sede.**
      La plata es de la sede y la ve quien la administra. Un Mestre la ve
      únicamente donde además tiene fila propia en `dojo_members` como `admin`,
      y ahí también puede cobrar.
      → Migración `20260811120000_mestre_finance_own_sede_only.sql` (cambia
      `default_capability` y borra los overrides que lo resucitarían) más el
      espejo en `lib/tenant/types.ts`.
      *De paso apareció que los defaults estaban escritos en TRES lugares y la
      consola de permisos mostraba `head_coach.manageDojoSettings = true` cuando
      la base decía false desde la migración 20260810150000. Quedaron alineados.*

## §5. Cambios por rol — restan 15

### Mestre

- [ ] Dashboard: sumar cantidad total de alumnos y cantidad por faja.
- [ ] Métricas: sumar filtro por Coordinador Regional y por sede.
- [ ] Notificaciones: sacar el filtro por sede de arriba y sumar
      "¿A quién le enviamos?" (todo el país / ciudad / sede / clase puntual).
- [ ] Notificaciones: evaluar adjuntar imagen al mensaje.
- [x] Pagos: ya no aparece en el perfil de marca (se fue con el cambio de §1).
- [ ] **Decidir:** ahora que el multi-perfil existe, el informe pide sacar
      "Validar Acceso" y "Mi Perfil" del perfil de Mestre — esas dos son del
      perfil de alumno. Es un cambio de menú visible, así que no lo hice solo.

### Coordinador Regional

- [ ] Dashboard: sumar cantidad de alumnos y cantidad por faja.
- [ ] "Mis Clases": dejar ver clases, horarios, profesores y asistencia de las
      sedes bajo su coordinación (hoy sólo ve las clases donde figura como
      instructor).
- [ ] Notificaciones: igual que el Mestre pero acotado a sus sedes.
- [ ] *Ya se puede:* si se le sacan las opciones de QR.

### Responsable de Academia

- [ ] Alta de alumno: explicar o sacar el campo "Código de acceso personalizado".
- [ ] Alta de alumno: confirmar que el vencimiento se calcula solo.
- [ ] Aclarar qué significa "Clases inscriptas" en el perfil.
- [ ] Revisar de dónde sale el valor de la clase ("la pastilla").
- [ ] *No es un bug:* que Ramiro Bianchi no vea el selector de perfil es
      correcto —el selector se esconde cuando tenés una sola sede
      (`components/tenant/DojoSwitcher.tsx:35`). Explicárselo.

### Profesor / Instructor

- [ ] "Mis Clases": buscador de alumno con su historial de asistencias y ficha.

### Alumno

- [ ] "Mi Asistencia": filtro por rango de fechas y métricas asociadas.
- [ ] "Mi Asistencia": indicador de constancia ("asististe 7/12 clases este mes").
- [ ] Definir si el alumno puede desanotarse de una clase solo.

## §6. Funcionalidades nuevas — 0 / 9 · **presupuestar aparte**

No son ajustes, son desarrollos. Cada uno necesita definición antes de estimar.

- [ ] **Historial de graduaciones en la ficha del alumno.** Pastilla del color de
      la faja con 1 a 4 rayas. *Ellos mismos piden validar el daltonismo:* la
      alternativa que proponen —el nombre del color escrito sobre la pastilla—
      es la correcta y es la que hay que hacer, porque azul y violeta a ese
      tamaño no se distinguen. Falta sumar fajas infantiles: gris, amarilla,
      naranja y verde.
- [ ] **Historial de asistencias en la ficha del alumno**, visible para Mestre,
      Coordinador y Responsable.
- [ ] **Notas del profesor al alumno** (bitácora de clase).
- [ ] **Calendario mensual** de las clases de la sede, para el alumno.
- [ ] **Navegación entre sedes** para el alumno que viaja.
- [ ] **Ficha de sede**: click sobre una sede para ver horarios, responsables,
      referente/contacto y faja del encargado.
- [ ] **Resumen de alumnos activos por sede y por clase.**
- [ ] **Tienda por sede** (catálogo de productos y precios, sin cobro online).
- [x] **Selector de perfil** en el sidebar, arriba de "Cerrar sesión". Hecho.
      Ver el detalle abajo.

---

## Multi-perfil — cómo quedó

Una cuenta puede ser Mestre de la red **y** responsable de una academia **y**
alumno de otra, sin necesitar tres mails.

**El sombrero se elige, no se deduce de la sede.** Antes el rol salía de la sede
en la que estabas parado, y eso no alcanzaba: un Mestre que además es alumno de
Quilmes, parado en Quilmes, perdía su menú de marca porque el rol explícito
ganaba. Ahora hay dos clases de perfil:

- **Marca** (`marca:<org>`) — ves todas las sedes de esa red, con tu rol de marca.
- **Sede** (`sede:<dojo>`) — ves SÓLO esa sucursal, con el rol que tenés ahí y
  sin rol de marca. Es lo que permite que el Mestre entre como alumno y vea
  exactamente lo que ve un alumno.

**Dónde está:** pie del sidebar, arriba de "Cerrar sesión", como lo pidieron.
Se esconde si tenés un solo perfil.

**Dos decisiones de diseño que conviene revisar:**

- *Sin rol de marca no hay perfiles.* Un alumno de dos sedes no tiene ninguna
  ambigüedad que resolver —en las dos es alumno— y para moverse entre ellas ya
  está el selector de sede. Darle perfiles de sede sería peor: cada uno acota la
  vista a UNA sucursal y le dejaría el selector de sede sin nada que elegir.

- *El middleware también entiende el perfil.* Si no, un Mestre "entrando como
  alumno" seguía pasando el portón de staff y podía escribir `/payments` en la
  barra de direcciones. RLS no le devolvía nada, así que no era un agujero, pero
  tampoco era lo que el selector promete.

**Archivos:** `lib/tenant/constants.ts`, `types.ts`, `server.ts`, `context.tsx`,
`components/tenant/ProfileSwitcher.tsx` (nuevo) y `middleware.ts`.

**Sin probar en pantalla.** Compila y tipa, pero el flujo de cambiar de perfil
necesita una cuenta con rol de marca + membresía propia en una sede. El seed
`seed-org-role-users.py` arma los roles de marca; falta que uno de ellos tenga
además fila en `dojo_members` para verlo funcionar.

---

## Próximo paso

1. **Aplicar las dos migraciones** (`supabase db push`) y probar el selector de
   perfil con una cuenta que tenga rol de marca y membresía propia en una sede.
2. **Definir el tagline**, que es el único bloqueante que queda.
3. **Decidir si salen "Validar Acceso" y "Mi Perfil" del perfil de Mestre.**
4. Atacar los 15 de §5, que ya no tienen nada bloqueado.
5. §6 presupuestado aparte (quedan 8).
