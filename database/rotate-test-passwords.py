#!/usr/bin/env python3
"""
Cambia la contraseña de los usuarios de prueba a una que NO esté en el repo.

Por qué existe: los seeds usan `TestDojo2026!` hardcodeada, y este repo es
público. Mientras el login por email sólo corre en localhost eso es inofensivo,
pero al habilitarlo en el deploy cualquiera que lea el repo puede entrar —y
entre los usuarios de prueba hay un superadmin de la marca, que ve todas las
sedes, todos los alumnos y todos los pagos.

La contraseña nueva se toma de una variable de entorno, así no vuelve a quedar
escrita en ningún archivo:

    TEST_USERS_PASSWORD='...' python3 database/rotate-test-passwords.py

Sin la variable, genera una al azar y la imprime UNA vez.

Por defecto rota sólo las cuentas PRIVILEGIADAS. Con --all incluye a los
alumnos, que no tienen acceso a nada sensible.
"""
import json
import os
import secrets
import string
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "admin-web", ".env.local")
ALL = "--all" in sys.argv

# Las que abren datos de terceros. El resto son alumnos: sólo ven lo propio.
PRIVILEGED_PREFIXES = ("headcoach@", "brandadmin@", "manager.", "profe", "admin.")


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


def api(method, path, body=None):
    headers = {"apikey": SRK, "Authorization": f"Bearer {SRK}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


password = os.environ.get("TEST_USERS_PASSWORD")
generated = False
if not password:
    alphabet = string.ascii_letters + string.digits
    password = "".join(secrets.choice(alphabet) for _ in range(20))
    generated = True

# El listado de usuarios sale de la base, no de una lista acá: así no hay que
# mantener dos fuentes cuando los seeds cambien.
st, rows = api("GET", "/rest/v1/profiles?select=user_id,email&email=like.*@test.local")
if st != 200:
    sys.exit(f"No se pudo listar los usuarios: {rows}")

targets = [
    r for r in rows
    if ALL or r["email"].startswith(PRIVILEGED_PREFIXES)
]

if not targets:
    sys.exit("No hay usuarios @test.local que rotar.")

print(f"Rotando {len(targets)} de {len(rows)} usuarios de prueba"
      f"{'' if ALL else ' (sólo los privilegiados; usá --all para todos)'}\n")

for r in targets:
    st, body = api("PUT", f"/auth/v1/admin/users/{r['user_id']}", {"password": password})
    ok = st in (200, 201)
    print(f"  {'ok ' if ok else 'ERR'} {r['email']}" + ("" if ok else f"  {str(body)[:80]}"))

print()
if generated:
    print("Contraseña nueva (se muestra UNA sola vez, guardala ahora):")
    print(f"\n    {password}\n")
else:
    print("Contraseña tomada de TEST_USERS_PASSWORD.")
print("Los seeds siguen creando usuarios con la contraseña vieja: volvé a correr")
print("este script después de cada seed, o exportá TEST_USERS_PASSWORD y usala.")
