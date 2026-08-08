#!/usr/bin/env python3
"""
Deja el entorno con DOS academias de demo y todo cargado para testear.

Borra las sedes existentes de la organización y crea dos nuevas con padrón
completo: manager, instructores, alumnos en distintos estados de cuota, clases
con instructor principal y secundario, inscripciones, pagos, asistencias y
registros de acceso.

Los roles de MARCA (head coach y superadmin) no se tocan: viven en org_members
y son independientes de las sedes.

CUIDADO: borrar una sede arrastra en cascada sus alumnos, clases, pagos y
accesos. Las 33 sedes reales de Lotus se recuperan con seed-lotus-filiales.py.

Uso:
    python3 database/seed-demo-academies.py            # borra y recrea
    python3 database/seed-demo-academies.py --keep     # sólo agrega, no borra
"""
import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "admin-web", ".env.local")

ORG_SLUG = "lotus"
PASSWORD = "TestDojo2026!"
KEEP = "--keep" in sys.argv
random.seed(7)  # reproducible

ACADEMIES = [
    {
        "slug": "demo-norte", "name": "Kuro Demo Norte",
        "city": "Vicente López", "address": "Av. Maipú 1420",
        "lat": -34.5265, "lng": -58.4780,
    },
    {
        "slug": "demo-sur", "name": "Kuro Demo Sur",
        "city": "Quilmes", "address": "Rivadavia 480",
        "lat": -34.7203, "lng": -58.2540,
    },
]

# (sufijo, nombre, apellido, rol, estado de cuota)
#   al_dia  → vence el mes que viene
#   gracia  → venció el mes pasado (recargo según el día de hoy)
#   vencido → tres meses de atraso (bloquea el QR)
PEOPLE = [
    ("manager",  "Diego",    "Márquez",  "admin",      None),
    ("profe1",   "Sofía",    "Rinaldi",  "instructor", None),
    ("profe2",   "Nicolás",  "Ferreyra", "instructor", None),
    ("alu1",     "Martina",  "Sánchez",  "member",     "al_dia"),
    ("alu2",     "Joaquín",  "Fernández","member",     "al_dia"),
    ("alu3",     "Valentina","Rodríguez","member",     "al_dia"),
    ("alu4",     "Bautista", "López",    "member",     "al_dia"),
    ("alu5",     "Camila",   "Díaz",     "member",     "gracia"),
    ("alu6",     "Thiago",   "Pérez",    "member",     "gracia"),
    ("alu7",     "Emilia",   "Torres",   "member",     "vencido"),
    ("alu8",     "Lucas",    "Gómez",    "member",     "vencido"),
    ("becado",   "Julieta",  "Romero",   "becado",     None),
]

CLASSES = [
    # (nombre, días, inicio, fin, precio principal, adicional, color, cupo)
    ("BJJ Gi — Noche",     ["Lun", "Mie", "Vie"], "20:00", "21:30", 50000, 35000, "blue",    30),
    ("BJJ No-Gi",          ["Mar", "Jue"],        "20:00", "21:30", 50000, 35000, "purple",  30),
    ("BJJ Kids",           ["Lun", "Mie"],        "18:00", "19:00", 40000, 28000, "amber",   25),
    ("Preparación física", ["Mar", "Jue", "Sáb"], "19:00", "20:00", 35000, 25000, "emerald", 20),
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
    headers = {"apikey": SRK, "Authorization": f"Bearer {SRK}", "Content-Type": "application/json"}
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
    found = find_user(email)
    if found:
        uid = found["id"]
    else:
        st, body = api("POST", "/auth/v1/admin/users", {
            "email": email, "password": PASSWORD, "email_confirm": True,
            "user_metadata": {"first_name": first, "last_name": last},
        })
        if st not in (200, 201):
            sys.exit(f"No se pudo crear {email}: {body}")
        uid = body["id"]
    api("POST", "/rest/v1/profiles?on_conflict=user_id",
        [{"user_id": uid, "email": email, "first_name": first, "last_name": last}],
        prefer="resolution=merge-duplicates")
    return uid


def end_date_for(estado):
    today = date.today()
    if estado == "al_dia":
        return (today.replace(day=1) + timedelta(days=45)).isoformat()
    if estado == "gracia":
        return (today.replace(day=1) - timedelta(days=1)).isoformat()
    if estado == "vencido":
        return (today.replace(day=1) - timedelta(days=90)).isoformat()
    return None


# ---------------------------------------------------------------------------
st, orgs = api("GET", f"/rest/v1/organizations?slug=eq.{ORG_SLUG}&select=id,name")
if st != 200 or not orgs:
    sys.exit(f"No se encontró la organización '{ORG_SLUG}'")
org_id, org_name = orgs[0]["id"], orgs[0]["name"]
print(f"Organización: {org_name}\n")

if not KEEP:
    st, existing = api("GET", f"/rest/v1/dojos?org_id=eq.{org_id}&select=id,name")
    print(f"Borrando {len(existing)} sedes existentes (cascada)…")
    api("DELETE", f"/rest/v1/dojos?org_id=eq.{org_id}")
    print("  listo\n")

for spec in ACADEMIES:
    api("POST", "/rest/v1/dojos?on_conflict=org_id,slug",
        [{"org_id": org_id, "slug": spec["slug"], "name": spec["name"],
          "city": spec["city"], "address": spec["address"],
          "lat": spec["lat"], "lng": spec["lng"],
          "timezone": "America/Argentina/Buenos_Aires", "is_active": True}],
        prefer="resolution=merge-duplicates")
    st, rows = api("GET", f"/rest/v1/dojos?org_id=eq.{org_id}&slug=eq.{spec['slug']}&select=id,name")
    dojo_id = rows[0]["id"]
    print(f"{spec['name']}")

    # --- personas -----------------------------------------------------------
    staff, students = [], []
    for suf, first, last, role, estado in PEOPLE:
        email = f"{suf}.{spec['slug']}@test.local"
        uid = ensure_user(email, first, last)
        api("POST", "/rest/v1/dojo_members?on_conflict=dojo_id,user_id",
            [{"dojo_id": dojo_id, "user_id": uid, "role": role, "is_active": True}],
            prefer="resolution=merge-duplicates")

        if role in ("admin", "instructor"):
            staff.append((uid, f"{first} {last}"))
        else:
            students.append((uid, f"{first} {last}", estado))

        end = end_date_for(estado)
        if end:
            api("POST", "/rest/v1/memberships",
                [{"dojo_id": dojo_id, "member_id": uid, "type": "monthly",
                  "start_date": (date.today() - timedelta(days=120)).isoformat(),
                  "end_date": end}])
    print(f"  {len(staff)} staff · {len(students)} alumnos")

    # --- clases -------------------------------------------------------------
    class_ids = []
    for i, (name, days, ini, fin, pp, pa, color, cap) in enumerate(CLASSES):
        principal = staff[(i % (len(staff) - 1)) + 1]   # instructores, no el manager
        secundario = staff[((i + 1) % (len(staff) - 1)) + 1]
        st, created = api("POST", "/rest/v1/classes",
            [{"dojo_id": dojo_id, "name": name, "days": days,
              "start_time": ini, "end_time": fin,
              "price_principal": pp, "price_additional": pa,
              "color": color, "capacity": cap, "max_students": cap,
              "category": "artes-marciales" if "física" not in name else "acondicionamiento-fisico",
              "instructor": principal[1], "instructor_id": principal[0],
              "secondary_instructor": secundario[1] if secundario[0] != principal[0] else None,
              "secondary_instructor_id": secundario[0] if secundario[0] != principal[0] else None}],
            prefer="return=representation")
        if isinstance(created, list) and created:
            class_ids.append(created[0]["id"])
    print(f"  {len(class_ids)} clases")

    # --- inscripciones, pagos, asistencia y accesos -------------------------
    pagos = asistencias = accesos = 0
    for uid, nombre, estado in students:
        elegidas = random.sample(class_ids, k=min(2, len(class_ids)))
        for j, cid in enumerate(elegidas):
            # sin on_conflict: la tabla no tiene unique (user_id, class_id)
            api("POST", "/rest/v1/class_enrollments",
                [{"dojo_id": dojo_id, "user_id": uid, "class_id": cid, "is_principal": j == 0}])

        if estado == "vencido":
            # Un alumno sin NINGÚN pago es "nuevo" y queda exento por
            # `new_member_exempt`. Para que figure moroso de verdad necesita
            # historial: un pago viejo que ya no cubre el período actual.
            api("POST", "/rest/v1/payments",
                [{"dojo_id": dojo_id, "user_id": uid, "amount": 50000, "method": "efectivo",
                  "paid_at": (date.today() - timedelta(days=130)).isoformat(),
                  "period_from": (date.today() - timedelta(days=130)).isoformat(),
                  "period_to": (date.today() - timedelta(days=100)).isoformat()}])
            pagos += 1

        if estado in ("al_dia", "gracia"):
            api("POST", "/rest/v1/payments",
                [{"dojo_id": dojo_id, "user_id": uid, "amount": 50000,
                  "method": random.choice(["efectivo", "transferencia"]),
                  "paid_at": (date.today() - timedelta(days=random.randint(1, 25))).isoformat(),
                  "period_from": date.today().replace(day=1).isoformat(),
                  "period_to": end_date_for("al_dia")}])
            pagos += 1

        # asistencia de las últimas 3 semanas y su acceso correspondiente
        for d in range(1, 22, 3):
            if estado == "vencido" or random.random() > 0.65:
                continue
            dia = date.today() - timedelta(days=d)
            api("POST", "/rest/v1/class_attendance?on_conflict=user_id,class_id,date",
                [{"dojo_id": dojo_id, "user_id": uid, "class_id": elegidas[0], "date": dia.isoformat()}],
                prefer="resolution=merge-duplicates")
            asistencias += 1
            api("POST", "/rest/v1/access_logs",
                [{"dojo_id": dojo_id, "user_id": uid, "result": "autorizado",
                  "reason": None, "scanned_at": f"{dia.isoformat()}T20:0{d % 6}:00-03:00"}])
            accesos += 1

        if estado == "vencido":
            api("POST", "/rest/v1/access_logs",
                [{"dojo_id": dojo_id, "user_id": uid, "result": "denegado",
                  "reason": "Cuota vencida o cuenta inactiva",
                  "scanned_at": f"{(date.today() - timedelta(days=2)).isoformat()}T20:05:00-03:00"}])
            accesos += 1

    print(f"  {pagos} pagos · {asistencias} asistencias · {accesos} accesos\n")

print(f"Contraseña de todos: {PASSWORD}")
print("Ejemplos:  manager.demo-norte@test.local · profe1.demo-sur@test.local · alu1.demo-norte@test.local")
print("Roles de marca (sin cambios): headcoach@test.local · brandadmin@test.local")
