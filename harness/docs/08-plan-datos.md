# Plan planner/executor — Capa de datos, C2 Control Tower

**Planner:** Claude (este documento) · **Executor:** modelo terra (ChatGPT/Codex) · **Monitor:** Pena
· **Revisor final:** Claude.

---

## Cómo se usa este documento

1. **Sección A — Briefing.** Se pega **una sola vez** al abrir la sesión con el executor. Es todo el
   contexto que necesita: no debe hacer falta que lea el chat ni que adivine nada del repo.
2. **Sección B — Tareas T1…T9.** Se pega **una por mensaje**, en orden. Cada tarea tiene
   *Hacé / No hagas / Hecho cuando*. Nunca dos tareas juntas.
3. **Sección C — Protocolo de monitoreo.** El paso a paso de Pena entre tarea y tarea.
4. **Sección D — Gate de revisión final.** Lo que Claude va a revisar al terminar.

**Paso 0, antes de arrancar:** copiar este documento a `harness/docs/08-plan-datos.md` y commitearlo.
Regla del harness: *si no está en el repo, no existe* — y el executor lo va a poder leer desde ahí en
vez de depender de que esté pegado en el chat.

---
---

# SECCIÓN A · BRIEFING (pegar una sola vez)

> Todo lo que sigue hasta el fin de la Sección A es el contexto permanente del executor.

## A.1 · El proyecto

Prototipo para el **NextWave Hackathon 2026** (Yuno × Nauta × OpenAI), Buenos Aires. Challenge
elegido: **C2 · The Control Tower (Yuno)** — un sistema que mira pagos en vivo, detecta cuándo cae la
conversión (approval rate), localiza la causa raíz con evidencia y la explica en lenguaje humano.

**El jurado opera el sistema en vivo e inyecta un incidente que el equipo nunca ensayó** ("trial by
fire"). Nada puede crashear delante de ellos.

**Reparto del equipo — respetar las fronteras:**

| Quién | Carpeta | Qué hace |
|---|---|---|
| **Pena — esta spec** | `backend/data/` | Modelo de datos, generador, stream en vivo, inyector, capa de queries |
| Luca | `backend/core/` | Detector (CUSUM) + localizador de causa raíz + agente LLM. **No implementar nada de esto** |
| Samo | `backend/main.py`, integración | Esqueleto FastAPI, panel de inyección (UI) |
| Juani | `frontend/` | Dashboard React |

**Stack obligatorio:** Python + FastAPI + Uvicorn (pip) · PostgreSQL local · pandas/pyarrow/numpy.
Hoy `backend/` está vacío.

**Reglas del repo que anulan defaults habituales:**
1. El único objetivo es que la demo corra en vivo sin crashear.
2. **Nada de tests, CI ni abstracciones prematuras. No crear `test_*.py`.**
3. Si algo se puede hardcodear y se ve igual en la demo, se hardcodea.
4. **`try/except` amplio con fallback visible.** Ningún endpoint puede devolver 500 al frontend.
5. Preferir simple y legible sobre elegante. Sin capas de abstracción, sin ORMs, sin factories.

## A.2 · Qué se construye, en una frase

Un mundo sintético de pagos que produce **(a)** un stream en vivo de ~65 transacciones/segundo,
**(b)** un forecast por celda contra el cual comparar, y **(c)** un inyector que degrada un slice
arbitrario del mundo para que el motor de Luca lo detecte y lo localice.

## A.3 · Decisiones cerradas (no reabrir, no "mejorar")

| # | Decisión | Consecuencia |
|---|---|---|
| 1 | **Cubo de 4 ejes:** `merchant × provider × payment_method × country` = **81 celdas hoja** | `issuer_bank` y `decline_code` **NO son ejes: son evidencia** del slice ganador |
| 2 | **Replay determinístico** con semilla fija, reproducido a reloj real | Cada corrida es idéntica → `reset` rebobina → el video de respaldo coincide con lo que pasa en vivo |
| 3 | **65 tx/s, ventana de detección 60 s** | 3.900 intentos/ventana ≈ 48 por celda |
| 4 | **Postgres desde el minuto 0**, pero el camino caliente va por memoria | Ring buffer para la ventana de 60 s; Postgres para evidencia e histórico |
| 5 | El inyector **degrada probabilidades**, no inserta rechazos falsos | Defensa ante el jurado: *"degradamos al proveedor y el stream reaccionó solo"* |

**Los tres almacenamientos:**

| Dónde | Qué | Para qué | Tamaño |
|---|---|---|---|
| Ring buffer (memoria) | Últimos ~30 min | Cubo de 60 s y tick SSE. Sub-100 ms | ~120k filas |
| `transactions` (Postgres) | Raw de las últimas ~2 h | Evidencia, decline codes, detalle | ~470k filas |
| `baseline_profile` (Postgres) | **Agregado** de 14 días simulados | El forecast por celda | ~27k filas |

> Por qué el baseline va agregado y no raw: 14 días a 65 tx/s serían 78M de filas. Con **14 días
> agregados** + **2 horas en crudo a la misma densidad que el stream**, el total queda en ~500k
> filas, no hay salto de volumen entre el histórico y la demo, y el baseline sigue saliendo de datos
> simulados en vez de una curva hardcodeada.

## A.4 · El mundo

Caso ficticio: **PagoTotal**, orquestador de pagos con 3 merchants y 3 providers en México, Colombia
y Brasil.

```python
MERCHANTS = ["tiendita", "rappido", "streamplus"]      # retail, delivery, suscripciones
PROVIDERS = ["adyen", "dlocal", "mercadopago"]
COUNTRIES = ["MX", "CO", "BR"]

METHODS_BY_COUNTRY = {
    "MX": ["card", "wallet", "cash_oxxo"],
    "CO": ["card", "wallet", "pse"],
    "BR": ["card", "wallet", "pix"],
}

ISSUERS_BY_COUNTRY = {   # EVIDENCIA, no eje del cubo
    "MX": ["banorte", "bbva_mx", "banamex", "hsbc_mx"],
    "CO": ["bancolombia", "davivienda", "bbva_co"],
    "BR": ["itau", "bradesco", "nubank", "santander_br"],
}
```

**Decline codes — usar esta tabla ISO 8583 exacta, no inventar códigos propios.** El agente de Luca
indexa su base de conocimiento por estos códigos:

| Código | Nombre | Tipo |
|---|---|---|
| `05` | Do Not Honor | soft, genérico — **~35% de todos los rechazos** |
| `51` | Insufficient Funds | soft |
| `91` | Issuer Unavailable | soft |
| `96` | System Malfunction | soft |
| `61` / `65` | Exceeds Limit / Activity Limit | soft |
| `14` | Invalid Card Number | hard |
| `54` | Expired Card | hard |
| `41` / `43` | Lost / Stolen Card | hard |
| `N7` | CVV Mismatch | hard |

**Dos propiedades del mundo que NO son decorativas — sin ellas la demo falla:**

1. **Tasa base propia por celda.** Aproximadamente: `pix`×BR ~96%, `pse`×CO ~88%, `cash_oxxo`×MX
   ~91%, `card` ~78–86% según país, `wallet` ~90%. Cada provider suma su desvío (±2 pts) y cada
   merchant el suyo (±1,5 pts). **Si todas las celdas tienen la misma tasa, el localizador acierta
   por casualidad** y falla en el trial by fire.
2. **Peso de volumen desigual por celda.** Algunas celdas grandes (`card`×BR×`rappido`, ~8% del
   total) y otras deliberadamente chicas (`cash_oxxo`×`streamplus`, ~0,3%). **Esto es lo que hace
   posible el caso `Insufficient evidence`**: sin celdas de bajo volumen no hay muestra chica que
   mostrar.

**Estacionalidad** — `seasonality(hour_utc, day_type) -> float`: curva por hora que afecta **volumen
y tasa a la vez** (de madrugada hay menos tráfico y peor aprobación: otro mix de compradores, más
fraude). Fin de semana: −15% de volumen, −1,5 pts de tasa. Es la variación natural que el sistema
tiene que distinguir de un incidente real.

## A.5 · Esquema de base de datos

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL,
  merchant_id    TEXT NOT NULL,        -- eje 1
  provider_id    TEXT NOT NULL,        -- eje 2
  payment_method TEXT NOT NULL,        -- eje 3
  country        TEXT NOT NULL,        -- eje 4
  issuer_bank    TEXT NOT NULL,        -- evidencia
  amount_usd     NUMERIC(10,2) NOT NULL,
  approved       BOOLEAN NOT NULL,
  decline_code   TEXT,                 -- NULL si approved; evidencia
  latency_ms     INT NOT NULL,
  source         TEXT NOT NULL         -- 'fixture' | 'live'
);
CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_slice
  ON transactions (created_at DESC, provider_id, country, merchant_id, payment_method);

CREATE TABLE IF NOT EXISTS baseline_profile (
  merchant_id TEXT, provider_id TEXT, payment_method TEXT, country TEXT,
  hour_utc SMALLINT,           -- 0..23
  day_type TEXT,               -- 'weekday' | 'weekend'
  attempts INT NOT NULL,
  approved INT NOT NULL,
  avg_amount_usd NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (merchant_id, provider_id, payment_method, country, hour_utc, day_type)
);

CREATE TABLE IF NOT EXISTS incidents (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  preset_id TEXT,                        -- NULL si vino del panel del juez
  filters JSONB NOT NULL,                -- {"provider_id":"adyen","country":"BR"}
  approval_multiplier NUMERIC NOT NULL,  -- 0.38 = la aprobación cae al 38% de lo normal
  dominant_decline_code TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  mitigated_at TIMESTAMPTZ               -- botón "aplicar acción (simulado)"
);
```

## A.6 · El contrato con Luca (lo más importante de toda la spec)

```python
def get_cube(window_s: int = 60) -> list[Leaf]
# Leaf = {
#   merchant_id, provider_id, payment_method, country,   # los 4 ejes
#   attempts: int, approved: int,                        # OBSERVADO (ring buffer)
#   fc_attempts: float, fc_approved: float,              # FORECAST (baseline_profile)
#   amount_usd_sum: float,
# }
```

**Devolver `attempts` y `approved` por separado, nunca solo la tasa.** La conversión es un *derived
measure* (`approved/attempts`), y los algoritmos de localización de causa raíz que va a usar Luca
(Squeeze, HotSpot) asumen KPIs aditivos: hay que localizar sobre numerador y denominador por
separado. Si Luca recibe solo la tasa, su localizador queda mal fundado. **Es lo más barato de hacer
bien y lo más caro de hacer mal.**

```python
def get_evidence(filters: dict, window_s: int) -> dict
# {
#   decline_codes: { before: {"05": 120, ...}, after: {...} },   # antes vs después del quiebre
#   issuers: [{ issuer_bank, attempts, approval_rate, delta_pts }],
#   series:  [{ ts, attempts, approval_rate, expected_rate }],   # por segundo
#   sample_size: int,
#   wilson_ci: [lo, hi],
# }

def money_lost(filters: dict, window_s: int) -> dict
# { lost_attempts, avg_ticket_usd, usd_per_hour }
# = intentos_afectados × (tasa_esperada − tasa_real) × ticket_promedio, extrapolado a la hora
```

## A.7 · Endpoints (todos de Pena)

```
GET  /api/stream                (SSE)  { ts, observed_rate, expected_rate, tx_count }
GET  /api/overview              → tasa actual vs esperada, volumen, incidentes activos
GET  /api/cube?window_s=60      → { leaves: [ ...Leaf ] }
GET  /api/evidence?window_s=60&provider_id=adyen&country=BR
GET  /api/inject/options        → combinaciones válidas para poblar los dropdowns del panel
POST /api/inject                { filters, magnitude, decline_code, duration_s } → { incident_id }
POST /api/inject/{id}/stop
GET  /api/incidents/active
POST /api/actions/apply         { incident_id }
POST /api/demo/reset            → rebobina el replay, apaga incidentes, borra source='live'
```

Luca expone aparte `/api/detector` y `/api/agent/explain` en `backend/core/`. **No implementarlos.**

## A.8 · Regla de honestidad (defensa técnica ante el jurado)

El forecast sale **siempre** de `baseline_profile`, **nunca** de la `p` interna del generador. Si el
motor leyera la probabilidad real estaría haciendo trampa, y el jurado lo va a preguntar. Frase de
defensa: *"el motor no tiene acceso al generador; ve lo mismo que vería en producción."*

## A.9 · Árbol de archivos objetivo

```
backend/
  requirements.txt        # fastapi uvicorn "psycopg[binary]" pandas pyarrow numpy
  main.py                 # FastAPI + lifespan que levanta el reproductor
  db.py                   # conexión psycopg3
  data/
    schema.sql
    world.py              # entidades, tasas base, pesos de volumen, curva estacional
    probability.py        # p_approve() + pick_decline_code()
    gen_baseline.py       # 14 días agregados -> baseline_profile
    gen_fixture.py        # 90 min sembrados -> fixture.parquet + COPY
    refresh.py            # re-ancla todo a now()
    replayer.py           # reproductor + ring buffer + COPY batcheado
    injector.py           # motor paramétrico + 3 presets + apply_action
    cube.py               # get_cube, get_evidence, money_lost
    routes.py
```

> **Fin del briefing.** No escribir código todavía: esperar la primera tarea.

---
---

# SECCIÓN B · TAREAS (pegar de a una)

Estimados desde las 19:00. Corte de recorte del equipo a las 22:30, MVP y video a la 01:30.

---

### T1 · Mundo y probabilidad — *19:00 → 19:20*

**Hacé:** `backend/requirements.txt`, `backend/data/world.py`, `backend/data/probability.py`.

`world.py` = solo constantes y tablas: entidades de A.4, tasa base por celda, peso de volumen por
celda, tabla de decline codes, y `seasonality(hour_utc, day_type) -> float`.

`probability.py` = `p_approve(ctx, incidents) -> float` y `pick_decline_code(ctx, incidents) -> str`.

```
p = base[merchant][provider][method][country]
  * issuer_mult[issuer]
  * seasonality(hour_utc, day_type)
  * jitter(sigma=0.012)
  * PRODUCTO de approval_multiplier de los incidentes que matchean ctx
clamp a [0.02, 0.995]
```

`pick_decline_code`: distribución dependiente del contexto — `91`/`96` más probables en providers
lentos, `51` domina en `cash_oxxo`, `05` se lleva ~35% como genérico. **Si hay un incidente activo
que matchea, su `dominant_decline_code` se lleva ~70% de los rechazos de ese slice.**

**No hagas:** ni base de datos, ni FastAPI, ni scripts de generación todavía.

**Hecho cuando:**
```bash
python -c "from backend.data.world import *; from backend.data.probability import p_approve; print(len(MERCHANTS)*len(PROVIDERS)*9)"
```
imprime `81`, y `p_approve` devuelve valores distintos para dos celdas distintas.

---

### T2 · Baseline agregado de 14 días — *19:20 → 19:35*

**Hacé:** `backend/data/gen_baseline.py`. Simula 14 días **acumulando contadores, sin materializar
filas**, y escribe `backend/data/out/baseline_profile.parquet` con la forma de la tabla
`baseline_profile` (81 celdas × 24 horas × 2 tipos de día ≈ 3.888 filas base; expandir si conviene).

**No hagas:** no escribir a Postgres todavía (eso es T4). Solo parquet.

**Hecho cuando:** el parquet existe y esta consulta en pandas dibuja una **curva**, no una recta:
```bash
python -c "import pandas as pd; d=pd.read_parquet('backend/data/out/baseline_profile.parquet'); g=d.groupby('hour_utc').apply(lambda x: x.approved.sum()/x.attempts.sum()); print(g.round(4).to_string())"
```
La diferencia entre la mejor hora y la peor tiene que ser de **al menos 3 puntos porcentuales**. Si
sale plano, la estacionalidad no está entrando y medio challenge se cae.

---

### T3 · Fixture determinístico → HANDOFF A LUCA — *19:35 → 20:00*

**Hacé:** `backend/data/gen_fixture.py`. Genera **90 minutos de tráfico sano** a 65 tx/s
(~351.000 filas) con `random.Random(SEED)` fijo, y escribe:
- `backend/data/out/fixture.parquet` — las columnas de `transactions`
- `backend/data/out/cube_sample.parquet` — **una ventana de 60 s ya en forma de `Leaf`** (81 filas,
  columnas de A.6), para que Luca pruebe su localizador contra la forma final del dato

**No hagas:** ni Postgres, ni API.

**Hecho cuando:**
```bash
python backend/data/gen_fixture.py && python -c "import pandas as pd,hashlib; d=pd.read_parquet('backend/data/out/fixture.parquet'); print(len(d), d.approved.mean().round(4), hashlib.md5(pd.util.hash_pandas_object(d).values).hexdigest()[:12])"
```
Correrlo **dos veces** tiene que dar **el mismo hash** (determinismo). `cube_sample.parquet` tiene 81
filas y las 9 columnas del contrato.

> **⏸ PARAR ACÁ Y AVISARLE A LUCA.** Pasarle `fixture.parquet`, `baseline_profile.parquet` y
> `cube_sample.parquet`. A partir de este momento trabaja en paralelo y ya no está bloqueado.

---

### T4 · Postgres — *20:00 → 20:25*

**Hacé:** `backend/data/schema.sql` (literal de A.5), `backend/db.py` (conexión psycopg3, DSN por
variable de entorno con default local), y la carga: `baseline_profile` completo + las **últimas 2 h**
del fixture a `transactions` con `source='fixture'`.

**Carga con `COPY` (`cursor.copy()`), nunca `INSERT` fila por fila.** 470k `INSERT`s son minutos;
`COPY` son segundos.

**No hagas:** sin ORM, sin Alembic, sin migraciones. `schema.sql` crudo y listo.

**Hecho cuando:**
```bash
psql -c "select count(*) from transactions; select count(*) from baseline_profile;"
```
devuelve ~470k y ~3.9k, y la carga completa tardó **menos de 30 segundos**.

---

### T5 · Capa de queries — *20:25 → 21:05*

**Hacé:** `backend/data/cube.py` con las tres funciones del contrato A.6. Por ahora `get_cube` lee de
Postgres (el ring buffer llega en T6); dejar la fuente de datos detrás de una función para poder
cambiarla sin tocar la firma.

`fc_attempts` se prorratea desde `baseline_profile`:
`fc_attempts = profile.attempts × (window_s/3600) × factor`, donde `factor` reescala el volumen
agregado de 14 días al caudal del stream en vivo.

**No hagas:** nada de detección, umbrales, CUSUM ni scoring de causa raíz. **Eso es de Luca.** Esta
capa entrega observado + forecast + evidencia, no veredictos.

**Hecho cuando:** `get_cube(60)` devuelve **81 elementos**, todos con `attempts`, `approved`,
`fc_attempts` y `fc_approved` presentes y no nulos, y `abs(sum(approved)/sum(attempts) −
sum(fc_approved)/sum(fc_attempts)) < 0.02` en operación normal (observado y forecast tienen que
coincidir cuando no hay incidente).

---

### T6 · Reproductor en vivo — *21:05 → 21:45*

**Hacé:** `backend/data/replayer.py` + `backend/main.py` (FastAPI con `lifespan`) + el endpoint SSE.

- Tick cada **250 ms**, ~16 transacciones por tick → **65 tx/s**.
- Lee la siguiente tanda de `fixture.parquet`, aplica los incidentes activos **volviendo a tirar el
  resultado** de las transacciones que matchean (segundo stream de RNG sembrado, para que también sea
  determinístico), empuja al **ring buffer de 30 min**.
- Encola un **`COPY` batcheado a Postgres una vez por segundo** (65 filas). Nunca una query por
  transacción.
- Al llegar al final del fixture, loopea.
- **`try/except` amplio: si el reproductor muere, se reinicia solo y la API sigue respondiendo.**
- Cambiar `get_cube` para que lea del ring buffer.

**No hagas:** WebSockets (SSE alcanza), Kafka, Redis, colas.

**Hecho cuando:** `uvicorn backend.main:app` y `curl -N localhost:8000/api/stream` muestra ticks con
`observed_rate` estable y `tx_count` subiendo ~65/s. `select count(*) from transactions where
source='live'` crece de a ~65 por segundo.

---

### T7 · Inyector, endpoints y contratos → HANDOFF A SAMO Y JUANI — *21:45 → 22:30*

**Hacé:** `backend/data/injector.py` + `backend/data/routes.py` con **todos** los endpoints de A.7.

```python
def inject(filters, magnitude, decline_code, duration_s=None, label="") -> Incident
def stop(incident_id) -> None
def apply_action(incident_id) -> None   # rampa el multiplicador a 1.0 en ~20 s
def active() -> list[Incident]
```

`filters` acepta cualquier subconjunto de `{merchant_id, provider_id, payment_method, country,
issuer_bank}`. Filtro vacío = degrada el mundo entero.

**`GET /api/inject/options` es un entregable en sí, no un detalle:** devuelve el espacio de
combinaciones **válidas** (métodos por país, bancos por país, rango de magnitudes) para que el panel
del juez se pueble solo y **nunca pida JSON crudo**.

**Al terminar, escribir los contratos JSON exactos en `harness/AGENTS.md`.** La mayoría de los bugs
de las 23:00 son forma de JSON, no lógica.

**No hagas:** la UI del panel es de Samo. Acá va solo el motor y los endpoints.

**Hecho cuando:**
```bash
curl -X POST localhost:8000/api/inject -H 'content-type: application/json' \
  -d '{"filters":{"provider_id":"adyen","country":"BR"},"magnitude":0.38,"decline_code":"91"}'
```
y en <30 s el SSE muestra `observed_rate` cayendo, `get_cube` muestra las 9 celdas de `adyen×BR` con
`approved` muy por debajo de `fc_approved`, y `get_evidence` muestra el pico de `91`.

> **⏸ 22:30 · CHECKPOINT DE RECORTE DEL EQUIPO.** Si se va tarde, el orden de recorte es:
> **(1)** `weak_signal` y el intervalo de Wilson · **(2)** `apply_action` · **(3)** Postgres entero —
> todo el guión puede correr sobre ring buffer + parquet.
> **No recortar `get_cube` ni el inyector paramétrico: son el challenge.**

---

### T8 · Presets, reset y acción simulada — *22:30 → 23:15*

**Hacé:** los tres casos preparados + `POST /api/demo/reset` + `POST /api/actions/apply`.

| `preset_id` | Filtro | Magnitud | Código dominante | Para qué |
|---|---|---|---|---|
| `provider_br` | `provider=adyen, country=BR` | ×0.38 | `91` | El incidente principal del guión |
| `issuer_mx` | `merchant=rappido, country=MX, issuer=banorte` | ×0.32 | `05` | Segundo incidente simultáneo; la evidencia concentra en `banorte` |
| `weak_signal` | una celda de **bajo volumen** | ×0.55 | `51` | n≈15 → el motor debe poder decir `Insufficient evidence` |

`reset` = rebobina el cursor del fixture a 0, vacía el ring buffer, marca todos los incidentes como
parados, `DELETE FROM transactions WHERE source='live'`.

`apply_action` = marca `mitigated_at` y rampa el multiplicador a 1.0 en ~20 s: el stream se recupera
en pantalla mientras el presentador habla. **El challenge diagnostica, no remedia — dejarlo marcado
como simulación en la respuesta del endpoint.**

**Hecho cuando:** correr `reset` cinco veces seguidas y confirmar que la corrida siguiente es
**idéntica** (mismo `observed_rate` a los mismos segundos).

---

### T9 · Tuning y seguro — *23:15 → 01:00*

**Hacé:** ajustar magnitudes con el dashboard de Juani a la vista hasta que la caída **se vea fea en
pantalla, no sutil**. Después: `backend/data/refresh.py` (re-ancla fixture y raw a `now()`, para
correr el domingo 07:30 antes del pitch), `pg_dump` y copia de los parquets fuera del repo.

**Hecho cuando:** el guión completo corre de punta a punta tres veces sin intervención, y existe el
snapshot para restaurar en 30 s si algo explota.

---
---

# SECCIÓN C · PROTOCOLO DE MONITOREO (Pena)

1. **Una sola sesión con el executor.** Pegar la Sección A una vez. Después, una tarea por mensaje.
   Si notás que empieza a olvidarse cosas o a inventar nombres de campos, re-pegá A.3, A.6 y A.7 —
   son las tres que importan.

2. **Nunca dos tareas juntas.** El executor va a querer adelantarse ("ya que estoy, hago el
   inyector"). Cortalo: *"solo T5, nada más"*. El bloque **No hagas** de cada tarea está puesto
   exactamente para eso.

3. **Corré vos el comando de *Hecho cuando*.** No aceptar "listo" como evidencia. Si el comando no
   está en la tarea, pedíselo antes de dar la tarea por cerrada.

4. **Si falla:** pegar el error **crudo y completo** + *"arreglá solo esto, no toques ningún otro
   archivo"*. No dejar que refactorice para arreglar un traceback.

5. **Un commit por tarea**, directo a `develop`:
   ```bash
   git add -A && git commit -m "data: T5 capa de queries (get_cube/get_evidence/money_lost)"
   ```
   Sirve para tres cosas: rollback si una tarea sale mal, revisión final por diffs, y que Samo vea
   avanzar la capa sin preguntar.

6. **Regla de corte por tiempo:** si una tarea se pasa del **doble** de su estimado, pasar a la
   siguiente y anotar la deuda. A las 22:30 se decide qué se recorta, no antes.

7. **Handoffs, que son lo que desbloquea al resto del equipo:**
   - Al cerrar **T3** → los tres parquets a Luca. Es el momento más importante de la noche: es
     cuando deja de estar bloqueado.
   - Al cerrar **T7** → avisar a Samo (`/api/inject/options` para los dropdowns) y a Juani
     (`/api/stream` y `/api/overview`), y confirmar que los contratos quedaron en `harness/AGENTS.md`.

8. **Decisiones que aparezcan en el camino:** anotarlas en `harness/docs/decision-log.md` con hora y
   motivo. Es regla del harness y es entregable evaluado por el jurado.

9. **Al terminar T8 (o a la 01:00, lo que llegue primero): volver acá y pedir la revisión final.**
   Pasame el rango de commits (`git log --oneline develop`) y arranco por la Sección D.

---
---

# SECCIÓN D · GATE DE REVISIÓN FINAL (Claude)

Lo que voy a revisar, en este orden — son los puntos donde este tipo de capa se rompe en vivo:

**Correctitud del contrato**
1. `/api/cube` devuelve `attempts` y `approved` **separados**, con los nombres exactos de A.6. Si
   colapsó a una tasa, el localizador de Luca queda mal fundado.
2. Los nombres de campo del JSON coinciden **exactamente** con lo escrito en `harness/AGENTS.md`.
3. `fc_attempts`/`fc_approved` salen de `baseline_profile` y **no** de la `p` del generador (regla
   A.8). Es la trampa más fácil de cometer sin querer y la que el jurado va a preguntar.

**Que no se caiga en vivo**
4. `try/except` real en el reproductor y en **cada** endpoint: ningún 500 llega al frontend.
5. El reproductor se reinicia solo si muere, y la API sigue respondiendo con el histórico.
6. `demo/reset` deja el sistema en un estado **idéntico** al inicial, no "parecido".

**Realismo del mundo**
7. Las 81 celdas tienen tasas base distintas **y** volúmenes distintos. Si son uniformes, el
   localizador acierta por casualidad y el trial by fire es una lotería.
8. La curva de estacionalidad tiene amplitud real (≥3 pts entre la mejor y la peor hora).
9. Los decline codes son los de la tabla ISO 8583 de A.4, sin códigos inventados — el agente de Luca
   indexa por ellos.

**Performance y forma**
10. `COPY` en todos los caminos de carga, cero `INSERT` en loop.
11. `get_cube` lee del ring buffer, no de Postgres.
12. Consistencia de timezone: todo UTC, sin `datetime.now()` naive.
13. No se crearon tests, CI ni migraciones (los prohíbe `CLAUDE.md`).
14. Cero llamadas a OpenAI dentro de `backend/data/`.
