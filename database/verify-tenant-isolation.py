#!/usr/bin/env python3
"""
Verifica que el aislamiento entre sedes funcione de verdad.

Crea dos sedes de prueba con dos usuarios cada una, obtiene un access_token REAL
de cada uno y consulta la API REST como ese usuario. Probar con la service role
key no serviría: bypassea RLS por definición, que es justo lo que hay que medir.

Las sedes de prueba (`zz-test-*`) van con is_active = false, así que no aparecen
en el mapa de la landing ni en el switcher del panel. RLS no mira ese campo, de
modo que el aislamiento se verifica igual. Se usan sedes dedicadas y no filiales
reales para no ensuciarle el padrón a ningún instructor.

Idempotente: se puede correr las veces que haga falta.

Uso:
    python3 database/verify-tenant-isolation.py [--cleanup]
"""
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "admin-web", ".env.local")

ORG_SLUG = "lotus"
PASSWORD = "TestDojo2026!"
CLEANUP = "--cleanup" in sys.argv

TEST_DOJOS = [("zz-test-alfa", "ZZ Test Alfa"), ("zz-test-beta", "ZZ Test Beta")]

USERS = [
    ("test.alfa.admin@example.com", "Ana", "Alfa", 0, "admin"),
    ("test.alfa.alumno@example.com", "Bruno", "Alfa", 0, "member"),
    ("test.beta.admin@example.com", "Carla", "Beta", 1, "admin"),
    ("test.beta.alumno@example.com", "Diego", "Beta", 1, "member"),
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
SRK = env["SUPABASE_SERVICE_ROLE_KEY"]
ANON = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]


def req(method, path, token, body=None, prefer=None):
    r = urllib.request.Request(URL + path, method=method)
    r.add_header("apikey", SRK if token == SRK else ANON)
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
    st, b = req("POST", "/auth/v1/token?grant_type=password", ANON,
                {"email": email, "password": PASSWORD})
    if st != 200:
        print(f"  ✗ login {email}: {b}")
        return None
    return b["access_token"]


st, orgs = req("GET", f"/rest/v1/organizations?slug=eq.{ORG_SLUG}&select=id,name", SRK)
if st != 200 or not orgs:
    sys.exit(f"No se encontró la organización '{ORG_SLUG}'")
org_id = orgs[0]["id"]

# ---------------------------------------------------------------- cleanup ---
if CLEANUP:
    st, lst = req("GET", "/auth/v1/admin/users?per_page=200", SRK)
    users = lst.get("users", []) if isinstance(lst, dict) else []
    for email, *_ in USERS:
        found = next((u for u in users if u["email"] == email), None)
        if found:
            req("DELETE", f"/auth/v1/admin/users/{found['id']}", SRK)
            print(f"  usuario eliminado: {email}")
    for slug, _ in TEST_DOJOS:
        req("DELETE", f"/rest/v1/dojos?org_id=eq.{org_id}&slug=eq.{slug}", SRK)
        print(f"  sede eliminada: {slug}")
    sys.exit(0)

print("=" * 70)
print("1. SEDES Y USUARIOS DE PRUEBA")
print("=" * 70)

dojo_ids, dojo_names = [], []
for slug, name in TEST_DOJOS:
    req("POST", "/rest/v1/dojos?on_conflict=org_id,slug", SRK,
        [{"org_id": org_id, "slug": slug, "name": name, "is_active": False}],
        prefer="resolution=merge-duplicates,return=minimal")
    st, rows = req("GET", f"/rest/v1/dojos?org_id=eq.{org_id}&slug=eq.{slug}&select=id,name", SRK)
    dojo_ids.append(rows[0]["id"])
    dojo_names.append(rows[0]["name"])
    print(f"  ✓ sede {name}")

for email, first, last, idx, role in USERS:
    st, body = req("POST", "/auth/v1/admin/users", SRK, {
        "email": email, "password": PASSWORD, "email_confirm": True,
        "user_metadata": {"full_name": f"{first} {last}"},
    })
    if st in (200, 201):
        uid = body["id"]
    else:
        st2, lst = req("GET", "/auth/v1/admin/users?per_page=200", SRK)
        found = next((u for u in lst.get("users", []) if u["email"] == email), None)
        if not found:
            sys.exit(f"  ✗ {email}: {body}")
        uid = found["id"]

    req("PATCH", f"/rest/v1/profiles?user_id=eq.{uid}", SRK,
        {"first_name": first, "last_name": last, "email": email})
    req("POST", "/rest/v1/dojo_members?on_conflict=dojo_id,user_id", SRK,
        {"dojo_id": dojo_ids[idx], "user_id": uid, "role": role, "is_active": True},
        prefer="resolution=merge-duplicates")

    print(f"  ✓ {email:32} {role:8} {dojo_names[idx]}")

print()
print("=" * 70)
print("2. AISLAMIENTO — qué ve cada uno en members_with_status")
print("=" * 70)

by_id = dict(zip(dojo_ids, dojo_names))
ok = True

for email, _, _, idx, role in USERS:
    tok = login(email)
    if not tok:
        ok = False
        continue

    st, rows = req("GET", "/rest/v1/members_with_status?select=email,role,dojo_id", tok)
    rows = rows if isinstance(rows, list) else []
    sedes = {by_id.get(r["dojo_id"], r["dojo_id"][:8]) for r in rows}

    if sedes - {dojo_names[idx]}:
        ok = False

    print(f"\n  {email}  ({role} de {dojo_names[idx]})")
    print(f"    filas: {len(rows)}   sedes: {', '.join(sorted(sedes)) or '—'}")
    for e in sorted(r["email"] for r in rows):
        print(f"      · {e}")

print()
print("=" * 70)
print("3. INTENTO DE CRUCE — admin de Alfa pidiendo datos de Beta")
print("=" * 70)

tok = login(USERS[0][0])
if tok:
    for table, sel in [("members_with_status", "email,dojo_id"), ("payments", "id,dojo_id"),
                       ("classes", "id,name,dojo_id"), ("dojo_members", "user_id,role,dojo_id")]:
        st, rows = req("GET", f"/rest/v1/{table}?select={sel}&dojo_id=eq.{dojo_ids[1]}", tok)
        vacio = rows == []
        if not vacio:
            ok = False
        print(f"  {table:22} → {'✓ vacío' if vacio else f'✗ DEVOLVIÓ {rows}'}")

print()
print("=" * 70)
print("4. ALUMNO — sólo debe verse a sí mismo")
print("=" * 70)

tok = login(USERS[1][0])
if tok:
    st, rows = req("GET", "/rest/v1/members_with_status?select=email", tok)
    rows = rows if isinstance(rows, list) else []
    solo_yo = [r["email"] for r in rows] == [USERS[1][0]]
    if not solo_yo:
        ok = False
    print(f"  {'✓' if solo_yo else '✗'} ve {len(rows)} fila(s): {[r['email'] for r in rows]}")

print()
print("=" * 70)
print("✅ AISLAMIENTO CORRECTO" if ok else "❌ HAY FUGAS — revisar las políticas RLS")
print("=" * 70)
print(f"\nPassword de los usuarios de prueba: {PASSWORD}")
print("Para borrar todo lo que creó este script:  --cleanup")

sys.exit(0 if ok else 1)
