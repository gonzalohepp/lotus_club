#!/usr/bin/env python3
"""
Auditoría de permisos: qué puede LEER y ESCRIBIR cada rol, tabla por tabla.

Se autentica de verdad con cada usuario de prueba y consulta la API REST con su
token. No usa la service role key en ningún chequeo de permiso: esa bypassea RLS
por definición y daría todo verde sin probar nada.

Además prueba los intentos de cruce entre sedes, que es donde un multi-tenant
mal armado se rompe.

Uso:
    python3 database/audit-permissions.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "admin-web", ".env.local")
PASSWORD = "TestDojo2026!"

ACTORES = [
    ("admin.alfa@test.local", "admin de sede"),
    ("profe.alfa@test.local", "instructor"),
    ("alumno.alfa@test.local", "alumno"),
    ("becado.alfa@test.local", "becado"),
]

# (tabla, columnas)
TABLAS = [
    ("members_with_status", "email"),
    ("dojo_members", "user_id"),
    ("classes", "id"),
    ("payments", "id"),
    ("memberships", "id"),
    ("access_logs", "id"),
    ("dojos", "id"),
    ("organizations", "id"),
    ("platform_admins", "user_id"),
    ("org_members", "id"),
    ("dojo_invitations", "id"),
]


def load_env():
    out = {}
    with open(ENV, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


env = load_env()
URL = env["NEXT_PUBLIC_SUPABASE_URL"]
ANON = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SRK = env["SUPABASE_SERVICE_ROLE_KEY"]


def call(method, path, token, body=None, key=None, prefer=None):
    r = urllib.request.Request(URL + path, method=method)
    r.add_header("apikey", key or ANON)
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    if prefer:
        r.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def login(email):
    st, b = call("POST", "/auth/v1/token?grant_type=password", None,
                 {"email": email, "password": PASSWORD})
    return b.get("access_token") if st == 200 else None


fallos = []


def check(cond, titulo, detalle=""):
    if not cond:
        fallos.append((titulo, detalle))
    return "✓" if cond else "✗"


print("=" * 88)
print("B. MATRIZ DE LECTURA — filas visibles por rol")
print("=" * 88)

tokens = {}
for email, etiqueta in ACTORES:
    tokens[email] = login(email)
    if not tokens[email]:
        fallos.append((f"login {email}", "no pudo autenticarse"))

hdr = f"{'TABLA':22}" + "".join(f"{e.split('.')[1][:9]:>11}" for e, _ in ACTORES)
print(hdr)
print("-" * 88)

for tabla, col in TABLAS:
    fila = f"{tabla:22}"
    for email, _ in ACTORES:
        tok = tokens.get(email)
        if not tok:
            fila += f"{'—':>11}"
            continue
        st, rows = call("GET", f"/rest/v1/{tabla}?select={col}", tok)
        n = len(rows) if isinstance(rows, list) else f"e{st}"
        fila += f"{n:>11}"
    print(fila)

print()
print("=" * 88)
print("C. ESCRITURA — quién puede modificar qué")
print("=" * 88)

# El alumno no debe poder crear clases ni pagos en su sede
tok_alumno = tokens.get("alumno.alfa@test.local")
tok_profe = tokens.get("profe.alfa@test.local")
tok_admin = tokens.get("admin.alfa@test.local")

st, dojos = call("GET", "/rest/v1/dojos?slug=eq.zz-test-alfa&select=id", SRK, key=SRK)
alfa = dojos[0]["id"] if dojos else None
st, dojos = call("GET", "/rest/v1/dojos?slug=eq.zz-test-beta&select=id", SRK, key=SRK)
beta = dojos[0]["id"] if dojos else None

pruebas = [
    ("alumno crea una clase en su sede", tok_alumno, "POST", "/rest/v1/classes",
     {"dojo_id": alfa, "name": "HACK", "price_principal": 1}, False),
    ("alumno se registra un pago", tok_alumno, "POST", "/rest/v1/payments",
     {"dojo_id": alfa, "user_id": "00000000-0000-0000-0000-000000000000",
      "amount": 1, "period_from": "2026-01-01", "period_to": "2026-01-31"}, False),
    ("instructor crea una clase", tok_profe, "POST", "/rest/v1/classes",
     {"dojo_id": alfa, "name": "ZZ borrar", "price_principal": 1}, True),
    ("instructor registra un pago", tok_profe, "POST", "/rest/v1/payments",
     {"dojo_id": alfa, "user_id": "00000000-0000-0000-0000-000000000000",
      "amount": 1, "period_from": "2026-01-01", "period_to": "2026-01-31"}, False),
    ("admin de Alfa crea clase EN BETA", tok_admin, "POST", "/rest/v1/classes",
     {"dojo_id": beta, "name": "HACK CRUZADO", "price_principal": 1}, False),
    ("admin se auto-asigna superadmin de marca", tok_admin, "POST", "/rest/v1/org_members",
     {"org_id": "00000000-0000-0000-0000-000000000000",
      "user_id": "00000000-0000-0000-0000-000000000000", "role": "superadmin"}, False),
    ("admin se agrega a platform_admins", tok_admin, "POST", "/rest/v1/platform_admins",
     {"user_id": "00000000-0000-0000-0000-000000000000"}, False),
    ("admin cambia la lógica de cobro de su sede", tok_admin, "PATCH",
     f"/rest/v1/dojos?id=eq.{alfa}", {"billing": {}}, False),
]

for titulo, tok, method, path, body, deberia_funcionar in pruebas:
    if not tok:
        continue

    # `Prefer: return=representation` es imprescindible acá. Sin él, un UPDATE
    # o DELETE que RLS filtró a cero filas igual devuelve 204, indistinguible de
    # uno que sí escribió — y el chequeo daría un falso positivo de fuga.
    # Con representation, "bloqueado" se ve como lista vacía.
    st, res = call(method, path, tok, body, prefer="return=representation")
    escribio = st in (200, 201) and isinstance(res, list) and len(res) > 0
    funciono = escribio
    marca = check(funciono == deberia_funcionar, titulo,
                  f"esperado {'permitido' if deberia_funcionar else 'bloqueado'}, dio HTTP {st}")
    estado = "permitido" if funciono else f"bloqueado ({st})"
    print(f"  {marca} {titulo:48} {estado}")

print()
print("=" * 88)
print("D. SIN SESIÓN — qué expone el anon key público")
print("=" * 88)

publicas = {"dojos", "classes", "public_organizations", "academies", "organizations"}
for tabla, col in TABLAS + [("public_organizations", "slug")]:
    st, rows = call("GET", f"/rest/v1/{tabla}?select={col}", None)
    n = len(rows) if isinstance(rows, list) else None
    expuesta = isinstance(rows, list) and n > 0
    esperado = tabla in publicas
    marca = check(expuesta == esperado or not expuesta, f"anon lee {tabla}",
                  f"devolvió {n} filas sin sesión")
    detalle = f"{n} filas" if isinstance(rows, list) else f"HTTP {st}"
    print(f"  {marca} {tabla:24} {detalle}")

print()
print("=" * 88)
if fallos:
    print(f"❌ {len(fallos)} PROBLEMA(S)")
    for t, d in fallos:
        print(f"   · {t}: {d}")
else:
    print("✅ SIN PROBLEMAS DE PERMISOS")
print("=" * 88)

sys.exit(1 if fallos else 0)
