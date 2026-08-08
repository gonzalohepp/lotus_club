#!/usr/bin/env python3
"""
Usuarios de prueba de ROL DE MARCA (org_members).

`seed-test-users.py` cubre los roles DE SEDE (admin, instructor, member, becado)
en las dos sedes de test. Lo que faltaba es el nivel de organización, que es
donde vive la diferencia que se acaba de introducir:

    head_coach   ve TODAS las sedes y TODOS los alumnos, SIN finanzas
    superadmin   ve todas las sedes, CON finanzas

Sirve para comprobar en pantalla —y contra la API— que al head coach no le
llegan los pagos, que es el punto del rol.

Idempotente. Para borrar:  --cleanup

Uso:
    python3 database/seed-org-role-users.py [--cleanup]
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

# (email, nombre, apellido, rol de organización)
USERS = [
    ("headcoach@test.local", "Turco",  "HeadCoach",  "head_coach"),
    ("brandadmin@test.local", "Brenda", "Superadmin", "superadmin"),
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


def api(method, path, body=None, prefer=None):
    headers = {
        "apikey": SRK,
        "Authorization": f"Bearer {SRK}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def find_user(email):
    st, body = api("GET", f"/auth/v1/admin/users?filter={email}")
    if st != 200:
        return None
    users = body.get("users", body) if isinstance(body, dict) else body
    return next((u for u in users if u.get("email") == email), None)


def ensure_user(email, first, last):
    """Crea el usuario de auth si no existe y devuelve su id."""
    found = find_user(email)
    if found:
        return found["id"]
    st, body = api("POST", "/auth/v1/admin/users", {
        "email": email,
        "password": PASSWORD,
        "email_confirm": True,
        "user_metadata": {"first_name": first, "last_name": last},
    })
    if st not in (200, 201):
        sys.exit(f"No se pudo crear {email}: {body}")
    return body["id"]


# --------------------------------------------------------------------------
st, orgs = api("GET", f"/rest/v1/organizations?slug=eq.{ORG_SLUG}&select=id,name")
if st != 200 or not orgs:
    sys.exit(f"No se encontró la organización '{ORG_SLUG}'")
org_id, org_name = orgs[0]["id"], orgs[0]["name"]
print(f"Organización: {org_name}")

if CLEANUP:
    for email, *_ in USERS:
        u = find_user(email)
        if not u:
            continue
        api("DELETE", f"/rest/v1/org_members?user_id=eq.{u['id']}")
        api("DELETE", f"/rest/v1/profiles?user_id=eq.{u['id']}")
        api("DELETE", f"/auth/v1/admin/users/{u['id']}")
        print(f"  borrado {email}")
    sys.exit(0)

for email, first, last, role in USERS:
    uid = ensure_user(email, first, last)

    # profile: el trigger de auth puede crearlo, pero no siempre con nombre
    api("POST", "/rest/v1/profiles?on_conflict=user_id",
        [{"user_id": uid, "email": email, "first_name": first, "last_name": last}],
        prefer="resolution=merge-duplicates")

    api("POST", "/rest/v1/org_members?on_conflict=org_id,user_id",
        [{"org_id": org_id, "user_id": uid, "role": role, "is_active": True}],
        prefer="resolution=merge-duplicates")

    print(f"  {email:26s} → org_members.{role}")

print()
print(f"Contraseña de todos: {PASSWORD}")
print("Entrar por el bloque 'Acceso de prueba' del login (sólo visible en dev).")
