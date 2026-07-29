#!/usr/bin/env python3
"""
Crea un padrón de prueba completo en las dos sedes de test.

Un usuario por cada rol y por cada sede, más un alumno que pertenece a LAS DOS
—el caso que motivó todo el multi-tenant: "lunes en Lanús, viernes en
Avellaneda"—. Sirve para ver en pantalla que su cuota y sus clases son
independientes en cada una.

Las sedes van con is_active = false: no aparecen en el mapa de la landing ni en
el switcher de un superadmin. RLS no mira ese campo, así que todo lo demás
funciona igual.

Idempotente. Para borrar todo:  --cleanup

Uso:
    python3 database/seed-test-users.py [--cleanup]
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "admin-web", ".env.local")

ORG_SLUG = "lotus"
PASSWORD = "TestDojo2026!"
CLEANUP = "--cleanup" in sys.argv

TEST_DOJOS = [("zz-test-alfa", "ZZ Test Alfa"), ("zz-test-beta", "ZZ Test Beta")]

# (email, nombre, apellido, índice de sede, rol, estado de cuota)
#
# El estado sirve para ver el motor de cobro en acción sin esperar al mes que
# viene: `al_dia` vence en el futuro, `gracia` venció el mes pasado (recargo
# según el día de hoy) y `vencido` arrastra tres meses (bloquea el QR).
USERS = [
    ("admin.alfa@test.local",      "Ana",     "Álvarez",  0, "admin",      None),
    ("profe.alfa@test.local",      "Bruno",   "Benítez",  0, "instructor", None),
    ("alumno.alfa@test.local",     "Carla",   "Cáceres",  0, "member",     "al_dia"),
    ("moroso.alfa@test.local",     "Damián",  "Duarte",   0, "member",     "gracia"),
    ("bloqueado.alfa@test.local",  "Elena",   "Escobar",  0, "member",     "vencido"),
    ("becado.alfa@test.local",     "Facundo", "Ferrer",   0, "becado",     None),

    ("admin.beta@test.local",      "Gabriela", "Gómez",   1, "admin",      None),
    ("profe.beta@test.local",      "Hernán",   "Herrera", 1, "instructor", None),
    ("alumno.beta@test.local",     "Irene",    "Ibáñez",  1, "member",     "al_dia"),
    ("becado.beta@test.local",     "Julián",   "Juárez",  1, "becado",     None),
]

# El caso multi-sede: la misma persona en las dos, con estados distintos.
MULTI = ("multisede@test.local", "Karina", "Klein", "member")


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
    r = urllib.request.Request(URL + path, method=method)
    r.add_header("apikey", SRK)
    r.add_header("Authorization", f"Bearer {SRK}")
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


def find_user(email, cache=[]):
    if not cache:
        st, lst = api("GET", "/auth/v1/admin/users?per_page=300")
        cache.append(lst.get("users", []) if isinstance(lst, dict) else [])
    return next((u for u in cache[0] if u["email"] == email), None)


def ensure_user(email, first, last):
    st, body = api("POST", "/auth/v1/admin/users", {
        "email": email, "password": PASSWORD, "email_confirm": True,
        "user_metadata": {"full_name": f"{first} {last}"},
    })
    if st in (200, 201):
        uid = body["id"]
    else:
        found = find_user(email)
        if not found:
            print(f"  ✗ {email}: {body}")
            return None
        uid = found["id"]

    api("PATCH", f"/rest/v1/profiles?user_id=eq.{uid}",
        {"first_name": first, "last_name": last, "email": email})
    return uid


def end_date_for(estado):
    """Vencimiento que produce cada fase del motor de cobro."""
    today = date.today()
    if estado == "al_dia":
        return (today + timedelta(days=25)).isoformat()
    if estado == "gracia":
        # Fin del mes pasado: el recargo depende del día de hoy.
        return (today.replace(day=1) - timedelta(days=1)).isoformat()
    if estado == "vencido":
        return (today.replace(day=1) - timedelta(days=90)).isoformat()
    return None


st, orgs = api("GET", f"/rest/v1/organizations?slug=eq.{ORG_SLUG}&select=id,name")
if st != 200 or not orgs:
    sys.exit(f"No se encontró la organización '{ORG_SLUG}'")
org_id = orgs[0]["id"]

# ---------------------------------------------------------------- cleanup ---
if CLEANUP:
    for email in [u[0] for u in USERS] + [MULTI[0]]:
        u = find_user(email)
        if u:
            api("DELETE", f"/auth/v1/admin/users/{u['id']}")
            print(f"  eliminado: {email}")
    sys.exit(0)

# ------------------------------------------------------------------ sedes ---
dojo_ids, dojo_names = [], []
for slug, name in TEST_DOJOS:
    api("POST", "/rest/v1/dojos?on_conflict=org_id,slug",
        [{"org_id": org_id, "slug": slug, "name": name, "is_active": False}],
        prefer="resolution=merge-duplicates,return=minimal")
    st, rows = api("GET", f"/rest/v1/dojos?org_id=eq.{org_id}&slug=eq.{slug}&select=id,name")
    dojo_ids.append(rows[0]["id"])
    dojo_names.append(rows[0]["name"])

# ------------------------------------------------------------------ clases --
CLASSES = [
    (0, "BJJ Adultos", "Ana Álvarez", ["lunes", "miercoles", "viernes"], "20:00", "21:30", 30000, 15000),
    (0, "BJJ Kids", "Bruno Benítez", ["martes", "jueves"], "18:00", "19:00", 22000, 11000),
    (1, "No-Gi", "Gabriela Gómez", ["martes", "jueves"], "19:00", "20:30", 28000, 14000),
]
class_ids = {}
for idx, name, instr, days, ini, fin, p1, p2 in CLASSES:
    st, rows = api("GET", f"/rest/v1/classes?dojo_id=eq.{dojo_ids[idx]}&select=id,name")
    existing = next((c for c in (rows or []) if c["name"] == name), None)
    if existing:
        class_ids[(idx, name)] = existing["id"]
        continue
    st, res = api("POST", "/rest/v1/classes", {
        "dojo_id": dojo_ids[idx], "name": name, "instructor": instr, "days": days,
        "start_time": ini, "end_time": fin, "capacity": 25, "max_students": 25,
        "price_principal": p1, "price_additional": p2, "color": "#1E40AF",
    }, prefer="return=representation")
    if st in (200, 201):
        class_ids[(idx, name)] = (res[0] if isinstance(res, list) else res)["id"]

print("=" * 78)
print("USUARIOS DE PRUEBA")
print("=" * 78)
print(f"{'EMAIL':30} {'CONTRASEÑA':16} {'ROL':11} {'SEDE':14} ESTADO")
print("-" * 78)

for email, first, last, idx, role, estado in USERS:
    uid = ensure_user(email, first, last)
    if not uid:
        continue

    api("POST", "/rest/v1/dojo_members?on_conflict=dojo_id,user_id",
        {"dojo_id": dojo_ids[idx], "user_id": uid, "role": role, "is_active": True},
        prefer="resolution=merge-duplicates")

    end = end_date_for(estado)
    if end:
        api("POST", "/rest/v1/memberships?on_conflict=dojo_id,member_id",
            {"dojo_id": dojo_ids[idx], "member_id": uid, "type": "monthly",
             "start_date": (date.today() - timedelta(days=200)).isoformat(), "end_date": end},
            prefer="resolution=merge-duplicates")

        cid = class_ids.get((idx, "BJJ Adultos")) or class_ids.get((idx, "No-Gi"))
        if cid:
            api("POST", "/rest/v1/class_enrollments?on_conflict=dojo_id,user_id,class_id",
                {"dojo_id": dojo_ids[idx], "user_id": uid, "class_id": cid, "is_principal": True},
                prefer="resolution=merge-duplicates")

        # Un pago viejo, para que el motor NO los trate como alumnos nuevos.
        # Sin esto `new_member_exempt` los exime del recargo y los estados
        # `gracia` y `vencido` nunca se llegan a ver.
        if estado in ("gracia", "vencido"):
            pago = date.fromisoformat(end) - timedelta(days=30)
            api("POST", "/rest/v1/payments", {
                "dojo_id": dojo_ids[idx], "user_id": uid, "amount": 30000,
                "method": "efectivo", "paid_at": pago.isoformat(),
                "period_from": pago.isoformat(), "period_to": end,
                "notes": "Pago histórico (datos de prueba)",
            })

    print(f"{email:30} {PASSWORD:16} {role:11} {dojo_names[idx]:14} {estado or '—'}")

# ------------------------------------------------------- alumno multi-sede ---
email, first, last, role = MULTI
uid = ensure_user(email, first, last)
if uid:
    for i, estado in [(0, "al_dia"), (1, "gracia")]:
        end = end_date_for(estado)
        api("POST", "/rest/v1/dojo_members?on_conflict=dojo_id,user_id",
            {"dojo_id": dojo_ids[i], "user_id": uid, "role": role, "is_active": True},
            prefer="resolution=merge-duplicates")
        api("POST", "/rest/v1/memberships?on_conflict=dojo_id,member_id",
            {"dojo_id": dojo_ids[i], "member_id": uid, "type": "monthly",
             "start_date": (date.today() - timedelta(days=300)).isoformat(),
             "end_date": end},
            prefer="resolution=merge-duplicates")

        cid = class_ids.get((i, "BJJ Adultos")) or class_ids.get((i, "No-Gi"))
        if cid:
            api("POST", "/rest/v1/class_enrollments?on_conflict=dojo_id,user_id,class_id",
                {"dojo_id": dojo_ids[i], "user_id": uid, "class_id": cid, "is_principal": True},
                prefer="resolution=merge-duplicates")

        pago = date.fromisoformat(end) - timedelta(days=30)
        api("POST", "/rest/v1/payments", {
            "dojo_id": dojo_ids[i], "user_id": uid, "amount": 30000,
            "method": "efectivo", "paid_at": pago.isoformat(),
            "period_from": pago.isoformat(), "period_to": end,
            "notes": "Pago histórico (datos de prueba)",
        })

    print(f"{email:30} {PASSWORD:16} {'member':11} {'AMBAS':14} al día en Alfa / en gracia en Beta")

print("-" * 78)
print(f"\nSedes de prueba: {dojo_names[0]} y {dojo_names[1]} (inactivas: no salen en la web)")
print("Para borrar todo:  python3 database/seed-test-users.py --cleanup")
