# 07 — Disparador de decisiones core · Challenge 2

> Para la reunión de arranque. **Nada de esto está decidido.**
>
> **Cómo se usa:** máx 3–4 min por decisión. Cada una trae una recomendación. Si nadie objeta →
> decidido, se anota en el `DECIDIDO:` y se copia a `decision-log.md`. Si hay debate y no cierra en 4
> min → lo desempata Samo y se sigue.
>
> Contexto de dominio: `06-dominio-pagos.md`. Resumen del research técnico: al final de este archivo.

---

## El sistema en 4 cajas

```
[0] Generador   → stream de transacciones falsas pero creíbles
                        │
[1] Detector    → "¿la conversión cayó de verdad, o es ruido normal?"
                        │
[2] Localizador → "¿dónde exactamente? (proveedor X + Brasil + banco Y)"
                        │
[3] Explicador  → el LLM lo cuenta en español, estima la plata, recomienda acción
   (LLM)
```
\+ **Panel de inyección** para que el juez cree su incidente en vivo (trial by fire).

---

## D1 · Alcance del demo path — ¿qué es obligatorio?

El brief pide: stream normal sin falsas alarmas · caída inyectada y detectada · diagnóstico de causa
raíz con evidencia · explicación + costo + acción recomendada · **dos incidentes simultáneos
separados** · trial by fire.

**Opciones:**
- **A —** Todo lo de arriba es must. Bonus solo si sobra tiempo.
- **B —** Recortar "dos incidentes simultáneos" a bonus, foco total en un incidente hecho impecable.

**Recomendación: A**, pero con "dos incidentes" como el primer candidato a recorte en el checkpoint
de las 22:30 si vamos ajustados.

`DECIDIDO: __________`

---

## D2 · Generador de datos — grabado vs en vivo  ⚠️ camino crítico, arranca ya (Pena)

Sin datos realistas con incidentes inyectables no hay demo. Es lo primero que tiene que existir.

**Opciones:**
- **Grabado + inyección encima:** se generan de antemano varias horas de tráfico "normal"
  determinístico, se guardan, y en la demo se reproducen como un video. El detector se calibra contra
  *esa* grabación. Un módulo aparte "pinta encima" el incidente que pide el juez.
- **En vivo:** todo se genera en tiempo real. Más flexible, pero cada corrida es distinta y no podés
  calibrar el detector contra lo que vas a mostrar.

**Recomendación: grabado + inyección encima.** Más seguro para el trial by fire.

`DECIDIDO: __________`

---

## D3 · El Localizador — ingenuo vs robusto  (el corazón del challenge)

Cuando algo se rompe (proveedor X en Brasil), se "ensucian" todos los totales que lo contienen. Hay
que distinguir la causa de su sombra.

**Opciones:**
- **Ingenuo (drill-down goloso):** mirás qué dimensión está más en rojo, bajás por ahí, repetís.
  Fácil. **Falla cuando la causa es una combinación** (proveedor X + banco Y + Brasil juntos), y el
  juez casi seguro inyecta una combinación.
- **Robusto (simular y comparar):** por cada sospechoso te preguntás "si el culpable fuera este,
  ¿cómo se verían los demás números?", armás ese escenario, lo comparás con lo real, y te quedás con
  el que mejor explica todo siendo la explicación más chica. Más código, no se cae con combinaciones
  nuevas.

**Recomendación: robusto.** Es la razón por la que el challenge es ganable. El research lo respalda
(es el núcleo de los algoritmos publicados Squeeze/HotSpot).

`DECIDIDO: __________`

---

## D4 · Dónde va el LLM

**Opciones:**
- **El LLM solo explica:** detección y localización son código determinístico; el LLM traduce el
  resultado a español, estima la plata (con números que salen de los datos), arma las dos audiencias
  y redacta la acción recomendada.
- **El LLM también busca la causa:** le pasás las transacciones y que razone.

**Recomendación: solo explica.** Si el diagnóstico depende de que el modelo razone sobre miles de
transacciones, el trial by fire es una lotería. Además es la respuesta a "¿por qué es AI-native y no
GPT sobre un CRUD?": *la IA produce el entendimiento, no el cálculo.*

`DECIDIDO: __________`

---

## D5 · El Detector — cómo maneja el ruido del día

La conversión sube y baja sola según la hora. Un detector tonto ("si baja de 90%, alarma") suena solo
de madrugada y perdemos el trial by fire por falsa alarma.

**Opciones:**
- **Esperado-por-hora + CUSUM:** calculás cuánto *debería* estar la conversión a esta hora, y te
  alarmás solo si lo real se aleja de lo esperado (CUSUM = fórmula estándar para acumular esa
  evidencia).
- **Umbral simple sobre ventana móvil:** más rápido de hacer, más falsos positivos.

**Recomendación: esperado-por-hora + CUSUM.** El brief pide explícitamente manejar el ruido de "hora
del día y fin de semana".

`DECIDIDO: __________`

---

## D6 · Cuántas dimensiones entran a la búsqueda  (define el modelo de datos de Pena)

**Opciones:**
- **5 ejes + código como evidencia:** buscar en merchant × proveedor × método × país × banco. El
  código de rechazo no es eje: es lo que explica *qué* pasa en el slice ganador.
- **6 ejes** incluyendo el código de rechazo como eje de búsqueda.
- **3–4 ejes** (proveedor × país × banco, merchant fijo).

**Recomendación: 5 + código como evidencia.** Cubo manejable, narrativa clara (separa el "dónde" del
"qué"). Ver tabla de cardinalidades en `06-dominio-pagos.md` §6.

`DECIDIDO: __________`

---

## D7 · Panel de inyección para el juez — cuánta libertad

El trial by fire exige que un juez cree su propio incidente. Si ese panel falla, falla el challenge.

**Opciones:**
- **Acotado:** el juez elige de dropdowns (qué dimensiones, qué magnitud de caída, cuándo) y
  dispara. A prueba de balas.
- **Libre:** el juez puede describir cualquier cosa.

**Recomendación: acotado.** El "wow" no se pierde — el juez igual arma una combinación que nosotros
no ensayamos. Y no se rompe en vivo.

`DECIDIDO: __________`

---

## D8 · Bonus — ¿cuáles sí?

| Bonus | Costo | Recomendación |
|---|---|---|
| **Honestidad** ("no tengo evidencia suficiente" con intervalo de confianza en pantalla) | Bajo — es una fórmula (Wilson), casi gratis. Además protege contra el falso positivo en vivo | **Sí** |
| **Dos audiencias** (ops detallado / ejecutivo en una línea con la plata) | Bajo — sale gratis una vez que hay diagnóstico y LLM | **Sí** |
| **Costo en plata** del incidente | Bajo — `intentos afectados × (tasa normal − tasa actual) × ticket promedio` | **Sí** (casi un must, el brief lo pide) |
| **Memoria de incidentes** ("esto ya pasó el martes") | Medio — guardar incidentes resueltos + match por similitud | Si sobra tiempo |
| **Agente adversario** / defensa | Medio-alto | No |

`DECIDIDO: __________`

---

## D9 · Stack del stream

**Opciones:**
- **In-memory Python** (proceso que empuja eventos a un buffer) + SSE/WebSocket al frontend + REST
  para la inyección.
- Algo con cola de mensajes (Kafka/Redis streams).

**Recomendación: in-memory.** Kafka en 14h es tiempo tirado. Postgres guarda el histórico y los
incidentes resueltos.

`DECIDIDO: __________`

---

## D10 · Reparto y orden de ataque (primeras 3 horas)

**Regla del timeline:** las primeras 3h nadie escribe lógica de negocio fina. Se ataca el **spike de
riesgo**: ¿el localizador robusto realmente aísla una combinación que no usamos para desarrollarlo?

**Propuesta de arranque:**
| Quién | Primeras 3h |
|---|---|
| **Pena** | Generador de datos (D2) + modelo de datos (D6). Es el camino crítico, todo lo demás espera esto |
| **Luca** | Localizador robusto (D3) contra un CSV de juguete que arma él mismo, sin esperar a Pena |
| **Samo** | Esqueleto FastAPI + contrato de API stream/incidentes + panel de inyección (D7) |
| **Juani** | Mentores 14–17h, después marca + wireframe del dashboard |

**Checkpoint 17:00:** localizador + generador se enchufan y el spike está probado contra
combinaciones nuevas. Si a las 17:00 el localizador no generaliza → hay margen para simplificar.

`DECIDIDO: __________`

---

## Decisiones que NO son de equipo (no ratholear acá)

Las resuelven Luca/Samo sobre la marcha: forma exacta del score del ripple y la penalización por
tamaño · tamaño de ventana y umbral del CUSUM · bucketing temporal y factor de compresión del
"día" · prompt y template del LLM · umbral de "¿1 causa o 2?".

---

## Riesgos (del research)

1. **El localizador no generaliza.** Mitigación: opción robusta (D3), probada contra combinaciones no
   usadas en desarrollo, ANTES de la demo.
2. **El generador es el camino crítico oculto.** Sin él no hay nada. Arranca primero (D2).
3. **El panel de inyección del juez.** Si falla, falla el challenge (D7).
4. **Falso positivo en vivo.** El stream normal tiene que correr en silencio. Calibrar con horas de
   datos antes de la demo (D5 + honestidad de D8).
5. **El LLM no determinístico.** Template estructurado, temperatura baja, cache. Una explicación que
   cambia cada corrida se ve mal.

---

## Apéndice — Resumen del research técnico

- **El problema tiene nombre: *multi-dimensional root cause localization*.** Algoritmos publicados:
  Adtributor (Microsoft, 2014), HotSpot (2018), Squeeze / PSqueeze (2019/2022), RiskLoc (2021).
  Citar esta literatura nos para un nivel arriba en la defensa. Ningún otro equipo lo va a hacer.
- **Por qué el drill-down goloso falla (efecto ripple):** cuando un slice hoja se rompe, todas las
  agregaciones que lo contienen se ven rotas — la causa proyecta una sombra sobre todo el cubo. El
  drill-down goloso es esencialmente Adtributor, que **asume que la causa vive en una sola
  dimensión**. El juez va a inyectar una combinación → falla en vivo. **Este es el riesgo #1.**
- **La solución en 14h:** por cada cuboide candidato, simular el ripple ("si este fuera la causa,
  ¿cómo se vería el resto del cubo?"), comparar contra lo observado, scorear por calidad de
  explicación penalizando tamaño (navaja de Occam), quedarse con el mejor. Es el núcleo de
  Squeeze/HotSpot, ~100–300 líneas de pandas/numpy, determinístico y generaliza.
- **Ojo — KPI ratio:** la conversión es `aprobados/intentos`, no una suma. Adtributor y HotSpot
  asumen KPIs aditivos. Hay que localizar sobre **intentos y aprobados por separado** (o ponderar la
  tasa por volumen de intentos). Frase de defensa: "elegimos base Squeeze porque la conversión es un
  *derived measure*".
- **Detección online:** CUSUM (acumula desvíos respecto de un esperado, dispara al cruzar umbral,
  implementación recursiva simple) o EWMA. Sobre el **residuo** contra un baseline con estacionalidad.
- **La honestidad tiene fórmula:** con muestras chicas, si `n·p̂` o `n·(1−p̂)` < 10 el intervalo de
  Wald no sirve → usar **Wilson** o Agresti-Coull; < 5, la tasa es solo un indicador crudo. El slice
  con 12 transacciones que "cayó 40%" es ruido, y lo mostramos con el intervalo en pantalla.
- **Dato de oro para el pitch:** el código 05 "Do Not Honor" es 30–40% de los rechazos y no dice
  nada. *"Nuestro sistema infiere lo que el emisor no te dice."* (Ver claims a verificar en
  `06-dominio-pagos.md` §5.)
