#!/usr/bin/env python3
"""
Carga las filiales de Lotus Club como sedes (`dojos`) de la organización.

Fuente de datos: database/lotus-filiales.json — separado a propósito, para que
corregir una dirección o un instructor no implique tocar código.

Idempotente: hace upsert por (org_id, slug), así que se puede volver a correr
después de editar el JSON. Las coordenadas ya cargadas NO se pisan salvo que se
pase --regeocode; así, un pin corregido a mano desde /superadmin sobrevive a la
próxima corrida.

Geocodificación: Nominatim (OpenStreetMap), sin API key. Su política de uso pide
un User-Agent identificable y máximo 1 request por segundo — de ahí la pausa
entre consultas. Las que ya traen lat/lng en el JSON no se consultan.

Uso:
    python3 database/seed-lotus-filiales.py [--regeocode] [--dry-run]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "admin-web", ".env.local")
DATA = os.path.join(ROOT, "database", "lotus-filiales.json")

ORG_SLUG = os.environ.get("LOTUS_ORG_SLUG", "lotus")
USER_AGENT = "LotusClubDojoAccess/1.0 (seed script)"

REGEOCODE = "--regeocode" in sys.argv
DRY_RUN = "--dry-run" in sys.argv


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
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", SRK)
    req.add_header("Authorization", f"Bearer {SRK}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def geocode(query):
    """Devuelve (lat, lng) o (None, None). Nunca lanza: una sede sin pin es
    preferible a cortar la carga entera."""
    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1})
    req = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "es"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            results = json.loads(resp.read().decode())
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"      geocode falló: {e}")
    return None, None


# ---------------------------------------------------------------------------

with open(DATA, encoding="utf-8") as fh:
    filiales = json.load(fh)

st, orgs = api("GET", f"/rest/v1/organizations?slug=eq.{ORG_SLUG}&select=id,name")
if st != 200 or not orgs:
    sys.exit(f"No se encontró la organización '{ORG_SLUG}': {orgs}")

org_id = orgs[0]["id"]
print(f"Organización: {orgs[0]['name']}  ({len(filiales)} filiales a cargar)")
print("=" * 78)

st, existing = api("GET", f"/rest/v1/dojos?org_id=eq.{org_id}&select=slug,lat,lng")
known = {d["slug"]: d for d in (existing or [])}

created = updated = geocoded = missing = 0

for f in filiales:
    slug = f["slug"]
    prev = known.get(slug)

    lat, lng = f.get("lat"), f.get("lng")

    # Se respeta el pin existente: puede haber sido corregido a mano.
    if prev and prev.get("lat") is not None and not REGEOCODE:
        lat, lng = prev["lat"], prev["lng"]

    if lat is None and f.get("address"):
        query = ", ".join(x for x in [f["address"], f.get("city"), f.get("province"), "Argentina"] if x)
        lat, lng = geocode(query)
        if lat is not None:
            geocoded += 1
        time.sleep(1.1)  # política de uso de Nominatim

    if lat is None:
        missing += 1

    row = {
        "org_id": org_id,
        "slug": slug,
        "name": f["name"],
        "team": f.get("team"),
        "instructor": f.get("instructor"),
        "instructor_rank": f.get("instructor_rank"),
        "address": f.get("address"),
        "city": f.get("city"),
        "schedules_text": f.get("schedules_text"),
        "maps_url": f.get("maps_url"),
        "lat": lat,
        "lng": lng,
        "is_active": True,
    }

    pin = f"{lat:.4f},{lng:.4f}" if lat is not None else "SIN PIN"
    action = "actualiza" if prev else "crea    "

    if DRY_RUN:
        print(f"  [dry] {action} {f['name']:38} {pin}")
        continue

    # `on_conflict` es obligatorio: sin él PostgREST resuelve el upsert contra
    # la primary key (id), no contra la unique (org_id, slug), y una sede que ya
    # existe falla con 23505 en vez de actualizarse.
    st, res = api(
        "POST", "/rest/v1/dojos?on_conflict=org_id,slug", [row],
        prefer="resolution=merge-duplicates,return=minimal",
    )

    if st in (200, 201, 204):
        print(f"  ✓ {action} {f['name']:38} {pin}")
        if prev:
            updated += 1
        else:
            created += 1
    else:
        print(f"  ✗ {f['name']}: {res}")

print("=" * 78)
print(f"creadas: {created}   actualizadas: {updated}   geocodificadas: {geocoded}   sin pin: {missing}")
if missing:
    print("\nLas que quedaron sin pin no aparecen en el mapa de la web.")
    print("Cargalas a mano desde /superadmin → sede → Datos → tocá el mapa.")
