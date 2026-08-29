# 05 — Los 4 challenges (briefs desarrollados + análisis de selección)

> Fuente: `NextWave Hackathon 2026 — Challenges MASTER (EN)` (PDF en el root del repo).
> Los 4 briefs ya son públicos para toda la hackathon. Este archivo los desarrolla en español y
> los evalúa contra los criterios del kickoff.
>
> Se lee: en el kickoff del sábado, antes de la convergencia. Cada uno llega con una candidata y
> una Y en una frase (ver `01-kickoff.md`).

> ## ✅ CHALLENGE ELEGIDO: C2 · The Control Tower (Yuno) — 29/08
>
> Vamos por acá. El resto de este archivo queda como registro del análisis de selección.
> - Contexto del dominio (pagos): **`06-dominio-pagos.md`**
> - Decisiones técnicas core (sin tomar aún): **`07-decisiones-core.md`**

---

## Reglas comunes a los 4

- **Se elige uno solo.** Cada equipo ataca exactamente un challenge.
- **Se puede inventar todo** — datos, flujos, APIs, DBs, protocolos, frameworks. Podés inspirarte en
  cosas que existen o diseñar lo tuyo. **Pero tenés que poder defender cada decisión.**
- **Trial by fire.** El jurado va a operar el sistema **en vivo, con un input no ensayado, delante de
  todos**. Tiene que reaccionar bien sin que el equipo toque nada.
- **La defensa técnica pesa tanto como la demo.** El jurado pregunta arquitectura y cada decisión.
  Una demo espectacular que el equipo no sabe explicar pierde contra una demo modesta bien defendida.

**Entregables (iguales para los 4):** (1) presentación · (2) demo en vivo o video · (3) repo público
con README · (4) diagrama de arquitectura · (5) decision log con alternativas consideradas y por qué
se eligió lo que se eligió.

**Vocabulario compartido:** *Agent* = sistema de IA que ejecuta trabajo autónomo con herramientas, no
solo chatea · *Tool* = acción que el agente puede ejecutar · *Human-in-the-loop* = punto donde el
agente para y le pide a un humano que revise/apruebe/decida · *Merchant* = empresa que cobra pagos
(challenges 1 y 2).

**Los hosts:** *Yuno* = plataforma de orquestación de pagos; el merchant integra una vez y cobra por
muchos proveedores y métodos — Yuno ve todas las transacciones de todos. *Nauta* = automatización con
IA para logística internacional; agentes leen mails y documentos de importadores/exportadores
(facturas, BLs, órdenes de compra), trackean contenedores, detectan problemas y ejecutan acciones sin
que un humano pida.

---

## Challenge 1 · Yuno — The Buyer Who Isn't Human

**Tema:** pagos agénticos, mandatos y verificación.

**Una frase:** una solución para que un merchant le cobre a un agente de IA que compra en nombre de
una persona — con mandatos, límites y verificación, sin que el fraude entre por la puerta nueva.

### Definiciones clave

- **Purchasing agent:** sistema de IA que descubre, decide y compra en nombre de una persona o empresa.
- **Mandato:** la autorización verificable que un humano le da a su agente: qué puede comprar, con qué
  límites (monto, categoría, validez) y con qué método de pago.
- **Verificación:** cómo el merchant confirma que el agente que le compra actúa dentro de un mandato
  válido de un humano real.
- **Revocación:** el humano retira el mandato; toda compra posterior debe fallar.
- **Chargeback / disputa:** el titular niega un pago ("yo no autoricé esto") y el banco revierte la plata.

### El problema

Cada vez más compras las hace un agente de IA por alguien: el asistente que compra el vuelo cuando
baja de precio, el agente de una empresa que repone inventario, el que compara y contrata el mejor
plan. Todo el sistema de Yuno — como todo sistema de pagos — asume que quien aprieta "pagar" es una
persona, y ese supuesto se está rompiendo. Cuando el que compra es un agente:

- ¿Cómo sabe el merchant que ese agente representa a un humano real que autorizó la compra?
- ¿Cómo autoriza una persona a su agente a gastar **sin entregar la tarjeta en crudo**?
- ¿Qué pasa cuando el agente se equivoca, alucina una compra, o alguien lo suplanta?
- ¿Quién responde por la disputa: el humano, el agente, el merchant?

Hoy no hay buena respuesta: los merchants o bloquean bots (y pierden la venta legítima) o los dejan
pasar como humanos (y se comen el fraude y los chargebacks). El mandato — la pieza que haría todo
esto seguro — no existe en la práctica.

### Objetivo

El circuito completo de una compra agéntica segura:

- Un humano crea un mandato de compra para su agente: qué, cuánto, hasta cuándo, con qué método — sin
  entregar la tarjeta en crudo.
- El merchant verifica el mandato antes de aceptar: agente legítimo, mandato válido, compra dentro de
  los límites.
- La compra corre de punta a punta: el agente descubre, decide y paga; el humano recibe un registro
  de qué se compró y bajo qué mandato.
- Los casos feos se manejan explícitamente: compra fuera del mandato, mandato vencido o revocado en
  vivo, agente suplantado, disputa posterior.
- Cada decisión de compra deja un rastro auditable que humano, merchant y auditor pueden leer.

### Trial by fire

El jurado opera el sistema en vivo: **revoca el mandato y mira al agente intentar comprar**, o cambia
un límite y ve qué pasa. → Predecible: sabés exactamente qué van a hacer.

### Resultados esperados

Demo mostrando: humano creando un mandato + su agente completando una compra e2e (mockeable) dentro
del mandato · un intento fuera del mandato (monto excedido, categoría prohibida, vencido) rechazado o
escalado a aprobación humana — nunca aprobado en silencio · revocación en vivo funcionando · qué ve
cada parte (humano su registro, merchant su verificación, auditor el rastro completo) · trial by fire
pasado.

### Bonus

Flujo completo de disputa (el humano niega una compra y el rastro auditable resuelve quién tiene
razón) · mandatos con condiciones ricas ("si baja de $150", "hasta 3 veces al mes") evaluadas
correctamente · defensa contra un agente adversario que intenta comprar fuera de su mandato por
caminos creativos.

### Caso ficticio mínimo

**Merchant:** VuelaYa, agencia de viajes online que quiere aceptar compras de agentes sin abrir la
puerta al fraude. **Comprador:** Marta autoriza a su agente personal: "comprame un vuelo a Córdoba si
baja de $150, válido hasta fin de mes".

1. Marta crea el mandato; el agente empieza a mirar precios.
2. Aparece un vuelo a $130 → el agente compra; Marta recibe su registro, VuelaYa su verificación.
3. El agente intenta comprar otro vuelo a $300 → fuera del mandato → rechazado o escalado.
4. Marta revoca el mandato; el agente intenta de nuevo → falla.

### Análisis de selección

| Criterio | Evaluación |
|---|---|
| Explicabilidad (1 frase) | **Alta** — "cobrale a un agente sin comerte el fraude" |
| Ejecutable en 14h | **Media** — sin ML pesado, todo mockeable; el riesgo es el volumen de features del circuito |
| Demo visual | **Alta** — 3 vistas simultáneas, revocación en vivo, rechazo con motivo |
| Match con el patrón | **Medio-alto** — no es "unificar datos" pero es el tema #1 de Yuno + OpenAI ahora |
| Fit de equipo | **Alto** — Luca el agente comprador, Pena mandatos/trail en Postgres, Samo la API de verificación, Juani las 3 vistas |
| Riesgo de fallar en vivo | **Bajo** — el trial by fire es predecible; el fallo esperable es scope, no crash |

### Ángulos posibles (la Y — a definir con el equipo, no cerrar hoy)

- **A · El mandato como credencial verificable.** El mandato es un token firmado (tipo credencial
  verificable / JWT) que el merchant valida sin llamar a nadie. Foco en el protocolo: firma,
  expiración corta, revocation list. La revocación en vivo sale gratis. Defensa técnica fuerte.
- **B · Policy engine de mandatos ricos.** Un mini-DSL para condiciones ("si baja de X", "3 veces al
  mes", categorías) que el merchant evalúa. El diferencial es la expresividad + la explicación de por
  qué se rechazó una compra. Ataca el bonus directo.
- **C · La disputa que se resuelve sola.** Foco en el rastro auditable: cuando el humano niega la
  compra, el trail firmado resuelve automáticamente quién tiene razón. "El chargeback que se cierra
  solo." Narrativa muy vendible a un jurado fintech.

### Esbozo de demo path

Marta crea mandato (form) → agente monitorea precios (tick visible) → vuelo a $130 → agente compra →
3 paneles se actualizan (Marta: recibo · VuelaYa: verificación OK · Auditor: trail) → agente intenta
$300 → panel muestra RECHAZO con motivo → el jurado revoca el mandato → siguiente intento FALLA →
(bonus) Marta niega la compra → el trail resuelve.

---

## Challenge 2 · Yuno — The Control Tower  ✅ ELEGIDO

> Desarrollo del dominio y del enfoque técnico: `06-dominio-pagos.md` y `07-decisiones-core.md`.

**Tema:** monitoreo de pagos en vivo y diagnóstico de causa raíz.

**Una frase:** un sistema que mira los pagos en vivo, detecta cuándo cae la conversión, diagnostica
la causa raíz con evidencia y la explica en lenguaje humano — antes de que el merchant se entere por
Twitter.

### Definiciones clave

- **Provider:** procesador externo que maneja el pago (Stripe, Adyen, dLocal, MercadoPago).
- **Método de pago:** tarjeta, PSE, wallet, PIX, cash-in-store.
- **Conversión (approval rate):** % de pagos aprobados sobre intentados — la métrica que mueve más plata.
- **Banco emisor:** el banco que emitió la tarjeta del comprador; puede rechazar por su cuenta.
- **Decline code:** el motivo que devuelve el provider cuando un pago no aprueba.
- **Dimensiones de una transacción:** merchant × provider × método × país × banco emisor × decline
  code — el diagnóstico vive en esas intersecciones.
- **Causa raíz:** el origen real, no el síntoma ("el provider X rechaza tarjetas del banco Y en Brasil
  desde las 14:03", no "cayó la conversión").

### El problema

La conversión cae en silencio y por mil motivos distintos: un provider degradado, un banco emisor
sobre-rechazando, un método caído en un país, un cambio que nadie avisó. Cada punto de conversión
perdido es plata que se va por minuto. Hoy la detección es artesanal: un humano mira dashboards
cuando puede, las alertas clásicas fallan por los dos lados (o disparan por todo o por nada), y para
cuando alguien nota la caída ya pasaron horas.

Y detectar es la parte fácil. La difícil es el diagnóstico: ¿la caída es de un provider, un método,
un país, un banco emisor, un merchant? La respuesta está dispersa en miles de transacciones y hoy la
arma un humano cansado cruzando filtros a las 3 a.m.

### Objetivo

Un sistema de monitoreo y diagnóstico que:

- Mira un stream de transacciones en vivo y detecta caídas de conversión que importan,
  distinguiéndolas del ruido normal (hora del día, fines de semana, varianza estadística).
- Diagnostica la causa raíz navegando las dimensiones hasta aislar dónde está el problema.
- Explica con evidencia: qué cayó, desde cuándo, a quién afecta, cuánta plata está costando y por qué
  el sistema cree eso — en lenguaje que entiende una persona de operaciones.
- Prioriza cuando pasan varias cosas a la vez, y dice honestamente cuando la evidencia no alcanza.
- Recomienda una acción para el humano — **sin ejecutarla** (este challenge diagnostica, no remedia).

### Trial by fire

El jurado **inyecta en vivo un incidente que el equipo nunca ensayó** (una combinación de dimensiones
nueva) — el sistema tiene que detectarlo y diagnosticarlo bien delante de todos. → El más
impredecible de los 4.

### Resultados esperados

Demo mostrando: stream (mockeado) corriendo normal y el sistema sin disparar por ruido · una caída
real inyectada en vivo → detectada en tiempo razonable · el diagnóstico de causa raíz correcto con la
evidencia visible · la explicación legible + el costo estimado + la acción recomendada · un caso con
dos incidentes simultáneos separados y priorizados · trial by fire pasado.

### Bonus

Un caso donde el sistema admite que la evidencia no alcanza en vez de inventar un diagnóstico ·
reconocer un incidente repetido ("esto ya pasó el martes") usando memoria · una explicación
consumible por dos audiencias: operaciones (detalle) y un ejecutivo (una línea con la plata).

### Caso ficticio mínimo

**Escenario:** PagoTotal, un orquestador que procesa pagos para 3 merchants con 3 providers en
México, Colombia y Brasil (datos y volúmenes inventados y extensibles).

1. Operación normal — el sistema mira y no molesta a nadie.
2. Un provider empieza a sobre-rechazar solo en Brasil → detección + diagnóstico.
3. Al mismo tiempo, un banco emisor mexicano cae para un solo merchant → el sistema separa las dos
   historias y las prioriza.
4. El jurado inyecta su propio incidente (trial by fire).

### Análisis de selección

| Criterio | Evaluación |
|---|---|
| Explicabilidad (1 frase) | **Alta** — "te avisa por qué cae la conversión antes de que lo notes" |
| Ejecutable en 14h | **Media-baja** — requiere generador de stream realista + detección que separe señal de ruido + navegación de dimensiones; es el más algorítmico |
| Demo visual | **Media-alta** — el wow es la explicación en lenguaje natural + el costo en plata, no el dashboard |
| Match con el patrón | **Muy alto** — es exactamente "datos fragmentados en miles de transacciones → IA aísla y explica → acción" |
| Fit de equipo | **Alto** — Pena/Luca la parte de datos y análisis, LLM para la explicación, Juani el dashboard |
| Riesgo de fallar en vivo | **Alto** — el trial by fire exige que el algoritmo de causa raíz **generalice** a un incidente no visto, en vivo |

### Ángulos posibles (la Y — a definir con el equipo, no cerrar hoy)

- **A · Drill-down guiado por plata.** El agente navega la jerarquía de dimensiones eligiendo en cada
  paso la rama con mayor caída de conversión ponderada por volumen, y muestra el camino que recorrió.
  Robusto y explicable — el jurado ve el razonamiento, no una caja negra.
- **B · La honestidad como diferencial.** El sistema que dice "no tengo evidencia suficiente" en vez
  de inventar. Foco en calibración e intervalos de confianza. Menos flashy, muy defendible, ataca el
  bonus más difícil.
- **C · Memoria de incidentes.** Un store de incidentes pasados; reconoce repeticiones ("esto ya pasó
  el martes") y sugiere la acción que funcionó la vez anterior. Le da un arco narrativo a la demo.

### Esbozo de demo path

Stream normal corriendo, sistema en silencio → inyectás una caída (provider X sobre-rechaza solo en
Brasil) → alerta con diagnóstico: qué, desde cuándo, a quién, cuánta plata, por qué → inyectás un
segundo incidente simultáneo (banco emisor MX para 1 merchant) → el sistema separa y prioriza por
plata → el jurado inyecta el suyo → el sistema lo diagnostica en vivo.

---

## Challenge 3 · Nauta — The Interface That Builds Itself

**Tema:** agentes que generan su propia UI en runtime.

**Una frase:** un sistema donde un agente que ejecuta un workflow genera y renderiza su propia
interfaz en tiempo real — la UI nace del estado del flujo y de las decisiones del agente, no de
pantallas predefinidas.

### Definiciones clave

**Dominio logístico:** *Client* = empresa importadora/exportadora que usa Nauta · *Operación
logística* = un shipment; agrupa órdenes de compra, contenedores y documentos · *Booking* = la
reserva de espacio en un buque; la confirma la naviera · *Container* = la unidad física trackeada de
origen a destino · *ETD / ETA* = fecha estimada de salida / llegada · *Estados del contenedor:*
booking confirmado → en tránsito → llegó a puerto → aduana → entregado · *Documentos:* Purchase Order
(la orden del cliente a su proveedor) · Booking Confirmation (la naviera confirma buque, ruta,
fechas) · Bill of Lading (el contrato de transporte; identifica el shipment) · Invoice / Packing List
· Arrival Notice.

**Los agentes:** *Flow (workflow)* = la secuencia de pasos y decisiones que un agente ejecuta cuando
salta un trigger · *Trigger* = el evento que arranca un flow (llega un mail, cambia una ETA, una hora
programada) · *Run* = una ejecución individual de un flow; el mismo flow corre muchas veces.

### El problema

En Nauta los agentes corren flows que toman decisiones reales: revisan documentos, detectan demoras,
escalan problemas, notifican clientes. Pero los humanos que supervisan esos agentes no necesariamente
entienden cómo funcionan estos sistemas, y están acostumbrados a interfaces que fueron diseñadas para
escenarios que alguien anticipó, que requieren trabajo de frontend cada vez que nace un flow nuevo, y
que no pueden mostrar lo inesperado: cuando el agente pega contra un caso raro, la pantalla no
existe.

Resultado: humanos ciegos frente a agentes que están trabajando; decisiones y aprobaciones lentas y
fuera de contexto; y el frontend se vuelve el cuello de botella de la automatización cuando se trata
de confianza y adopción del usuario final.

### Objetivo

Un sistema donde un agente que ejecuta un flow genera y renderiza su propia interfaz en tiempo real:

- La UI nace del estado del flow y de las decisiones que el agente toma en el camino, no de pantallas
  predefinidas.
- La UI evoluciona con cada run: el agente ejecuta, la interfaz cambia.
- Si el flow cambia, la interfaz cambia.
- Es bidireccional e interactiva: lo que el humano responde en la UI vuelve al agente y afecta su
  ejecución.

### Trial by fire

El jurado **modifica el flow en vivo** (agrega un paso, cambia una decisión) — la interfaz tiene que
adaptarse sola. → Parcialmente predecible: sabés el tipo de cambio, no el cambio exacto.

### Resultados esperados

Demo mostrando: un agente ejecutando un flow con decisiones visibles · una interfaz generada en
runtime que refleja el estado del flow · runs sucesivos → la interfaz se actualiza con cada uno · un
momento human-in-the-loop resuelto a través de una interfaz generada (aprobar, elegir, corregir) · el
flow modificado → la interfaz se adapta sin trabajo manual.

### Bonus

Coherencia visual: la UI generada respeta un design system, no es un collage · varios flows corriendo
a la vez, cada uno con su interfaz · seguridad: qué puede y qué no puede hacer una UI generada por un
agente.

### Caso ficticio mínimo

**Empresa:** "Muebles del Sur", importadora que trae muebles de Vietnam a México. **Agente:** Ari —
gestiona los bookings de la empresa y monitorea sus shipments.

Flow base: (1) trigger: llega un mail con una Booking Confirmation → (2) Ari extrae los datos:
carrier, buque, puertos, ETD/ETA, contenedores → (3) crea la operación y monitorea el viaje en cada
run → (4) si detecta un problema serio → un humano decide en la misma interfaz.

Momentos clave (cada run cambia el front): (1) Run 1 — booking confirmado → nace la interfaz: mapa
con la ruta Vietnam → México, card del booking y sus contenedores · (2) Run 2 — el buque zarpa → el
front cambia solo: posición del buque en el mapa, contenedores en tránsito · (3) Run 3 — transbordo
inesperado (parada no planeada, la ETA se corre 9 días) → el mapa redibuja la ruta y la interfaz
genera un panel de decisión human-in-the-loop: esperar, buscar alternativa, o avisar al cliente
final · (4) El trial → agregar un paso al flow ("validar el Bill of Lading contra el booking antes de
confirmar") y la interfaz lo tiene que reflejar sola.

### Análisis de selección

| Criterio | Evaluación |
|---|---|
| Explicabilidad (1 frase) | **Media** — el concepto necesita contexto y el valor ("no más frontend por flow") es de segundo orden |
| Ejecutable en 14h | **Media** — el agente emite un spec de UI y un renderer genérico lo pinta; factible con catálogo de componentes fijo. Riesgo: coherencia visual |
| Demo visual | **Muy alta** — mapa con ruta, barco moviéndose, panel de decisión que aparece solo, la UI cambiando en cada run. La más vistosa de las 4 |
| Match con el patrón | **Medio-alto** — "software que piensa y actúa, no dashboards estáticos" es la tesis de Nauta |
| Fit de equipo | **Medio** — carga a Juani (frontend) con lo más incierto y Juani también tiene el pitch 21:00–01:00. Luca podría hacer el spec-gen |
| Riesgo de fallar en vivo | **Medio** — si el spec-gen está bien hecho el trial anda; si hay pasos hardcodeados, se cae |

### Ángulos posibles (la Y — a definir con el equipo, no cerrar hoy)

- **A · UI-as-a-tool.** El agente tiene un set de "tools de UI" (`mostrar_mapa`, `pedir_decisión`,
  `tabla`, `timeline`) y las invoca; el front es un renderer de esas invocaciones. Acotado,
  defendible, y el trial by fire anda solo: un paso nuevo = una llamada nueva a una tool que ya
  existe.
- **B · Spec declarativo completo.** El agente emite un árbol de componentes (JSON tipo UI schema) y
  un renderer React genérico lo pinta. Más ambicioso, más "se construye sola", más riesgo de collage.
- **C · La UI aparece donde el humano hace falta.** La interfaz generada existe sobre todo para los
  puntos de decisión: cuando el agente se traba, genera el panel exacto que ese caso necesita. Menos
  "toda la UI", más "el human-in-the-loop se dibuja solo".

### Esbozo de demo path

Llega mail con Booking Confirmation → Run 1: nace la UI (mapa ruta VN→MX, card de booking,
contenedores) → Run 2: el buque zarpa, la UI cambia sola (posición del barco, contenedores "in
transit") → Run 3: transbordo, ETA +9 días → la UI redibuja la ruta y genera el panel de decisión
(esperar / buscar alternativa / avisar al cliente) → el humano decide → el jurado agrega un paso al
flow → la UI lo refleja sola.

---

## Challenge 4 · Nauta — The Agent on the Line

**Tema:** agentes de voz que trabajan procesos legacy por teléfono.

**Una frase:** un agente que atiende el teléfono y trabaja un proceso logístico legacy de punta a
punta — llama, escucha, negocia dentro de un mandato, y convierte la conversación humana desordenada
en compromisos verificados en los sistemas de atrás.

### Definiciones clave

- **Voice agent:** sistema de IA que sostiene una conversación hablada en tiempo real — escucha,
  habla y sobrevive interrupciones — mientras ejecuta trabajo con herramientas en mitad de la llamada.
- **Drayage (transporte terrestre):** el tramo en camión que lleva un contenedor del puerto al
  depósito del cliente; hoy se coordina casi todo por teléfono.
- **Carrier / dispatcher:** la empresa de camiones y el humano que atiende el teléfono, cotiza tarifas
  y asigna camiones.
- **Commitment:** un hecho verificable extraído de una conversación ("pickup jueves 10:00, $8.500
  MXN, chofer Juan") al que ambas partes pueden ser sujetadas después.
- **Mandato:** la autorización que un humano le da al agente para negociar y comprometerse: tope de
  precio, ventana horaria, condiciones — la misma idea del Challenge 1, acá gobernando lo que el
  agente puede acordar por voz.
- **Escalación:** el momento en que el agente pasa una llamada en vivo a un humano — sin cortar y sin
  perder lo que ya se dijo.
- **Barge-in:** el que llama interrumpe al agente en mitad de la frase; la conversación tiene que
  sobrevivirlo.

El vocabulario logístico del Challenge 3 (operación, booking, contenedor, ETA) también aplica acá. El
stack de voz es libre: el evento lo apoya OpenAI y su Realtime API es un fit natural — pero vale
cualquier stack que puedas defender.

### El problema

El software se comió la oficina, pero la mitad de la logística todavía pasa por teléfono: cotizar un
camión, confirmar un pickup, perseguir a un chofer, renegociar una ventana de entrega. Los agentes
que leen mails y documentos son ciegos al canal donde los problemas realmente se resuelven — y esas
llamadas no dejan registro estructurado (lo acordado vive en la memoria de alguien o en un post-it),
dependen de que dos humanos estén disponibles al mismo tiempo, y no escalan (diez shipments en
problemas = diez conversaciones simultáneas que alguien tiene que sostener).

La automatización de texto frena en el borde de la red telefónica. La última milla del proceso legacy
es una llamada — y un agente que no puede hablar, escuchar y comprometerse queda afuera.

### Objetivo

Un agente de voz que corre el tramo de transporte terrestre de un shipment enteramente por teléfono:

- Hace llamadas salientes: llama a carriers, pide cotizaciones y negocia tarifa y ventana de pickup —
  varias negociaciones, una mejor elección, siempre dentro de un mandato.
- Recibe llamadas entrantes: un chofer avisa una demora, un dispatcher mueve un horario — el agente
  entiende, decide y actúa en tiempo real.
- Cada llamada produce **compromisos, no transcripciones**: qué se acordó, con quién y bajo qué
  mandato, escrito en el estado de la operación y auditable después.
- Conversación y sistema quedan consistentes: lo que el agente dice por teléfono siempre coincide con
  lo que el sistema sabe — y lo que escucha actualiza el sistema.
- Los casos feos se manejan explícitamente: el humano de la línea se sale del libreto, se
  contradice, se niega, o empuja algo fuera del mandato → el agente escala a un humano en mitad de la
  llamada, sin cortar.

### Trial by fire

**Un juez agarra un teléfono y hace de la otra parte** — un dispatcher o chofer no ensayado, poco
cooperativo e improvisando. El agente tiene que llegar a un resultado correcto y comprometido en
vivo, delante de todos. → El más brutal de los 4.

### Resultados esperados

Demo mostrando: el agente llamando a al menos dos carriers (telefonía mockeable, la conversación de
voz real), negociando y reservando la mejor opción dentro del mandato · una llamada entrante (un
chofer avisa un problema) entendida y convertida en decisión + operación actualizada · una
renegociación: cambió la situación y el agente llama de vuelta para mover lo acordado — sin exceder
nunca el mandato · el rastro auditable: cada compromiso trazable al momento de la conversación que lo
produjo · una escalación en mitad de la llamada: un humano toma una conversación en vivo y recibe el
contexto de todo lo ya dicho · trial by fire pasado.

### Bonus

Barge-in manejado con naturalidad · robustez al mundo real (ruido de fondo, acentos fuertes, español
e inglés mezclados en la misma llamada) · defensa contra manipulación por voz: el que llama usa
urgencia, labia o impersonación para sacar al agente del mandato — y falla.

### Caso ficticio mínimo

**Empresa:** "Textiles Pacífico", importadora con un contenedor llegando al puerto de Manzanillo que
necesita camión hasta su depósito en Guadalajara. **Agente:** Volta — coordina transporte terrestre
por teléfono bajo un mandato: "reservá un camión para el jueves, hasta $9.000 MXN".

1. El contenedor se confirma en puerto → Volta llama a dos carriers, cotiza, negocia y reserva el
   mejor dentro del mandato; el humano ve qué se acordó y por qué.
2. El dispatcher llama a la mañana siguiente: el camión se rompió, el pickup pasa al viernes → Volta
   entiende, evalúa y reprograma — o escala si el mandato no lo cubre.
3. Un carrier llama con una "oferta especial" arriba del tope → fuera del mandato → rechazada con
   cortesía o escalada, nunca comprometida.
4. El trial → un juez toma el teléfono e improvisa la otra parte; Volta tiene que cerrar un
   compromiso correcto en vivo.

Los números de teléfono, carriers, tarifas y la capa de telefonía se pueden inventar — la
conversación de voz en vivo y los compromisos, no.

### Análisis de selección

| Criterio | Evaluación |
|---|---|
| Explicabilidad (1 frase) | **Alta** — "un agente que atiende el teléfono y cierra el camión por vos" |
| Ejecutable en 14h | **Baja** — voz en tiempo real (barge-in, latencia, ruido) + negociación multi-llamada + escalación mid-call. Muchas piezas frágiles |
| Demo visual | **Media** — es audio; hay que mostrar el commitment estructurándose en pantalla. Impacta si sale, pero es efímero |
| Match con el patrón | **Medio** — "la última milla legacy es una llamada" encaja con Nauta, pero no es "unificar datos fragmentados" |
| Fit de equipo | **Medio-bajo** — nadie del equipo tiene experiencia marcada en voz en tiempo real; es apuesta grande. Suma puntos de sponsor (Realtime API) |
| Riesgo de fallar en vivo | **Muy alto** — voz en tiempo real + juez adversario improvisando = muchísimas formas de romperse. Si sale, es el más memorable |

### Ángulos posibles (la Y — a definir con el equipo, no cerrar hoy)

- **A · Compromisos, no voz.** La voz es real pero simple (poca negociación); el diferencial es cómo
  cada frase se vuelve un hecho verificable escrito en el estado de la operación, trazable al segundo
  de la conversación que lo produjo. Baja el riesgo de la parte más frágil.
- **B · Negociaciones paralelas.** El agente llama a 2–3 carriers, compara y elige — el wow es ver la
  tabla de ofertas llenándose y la decisión cayendo dentro del mandato.
- **C · Anti-manipulación por voz.** El que llama usa urgencia / labia / impersonación para sacar al
  agente del mandato y falla. Foco en la robustez del mandato bajo presión conversacional — ataca el
  bonus y el trial by fire de frente.

### Esbozo de demo path

Contenedor confirmado en puerto → Volta llama al carrier 1 (voz real, telefonía mockeada), cotiza,
negocia → llama al carrier 2 → compara, reserva el mejor dentro del mandato → la pantalla muestra el
commitment + por qué → a la mañana el dispatcher llama: camión roto, pasa al viernes → Volta entiende
y reprograma (o escala) → un carrier llama con "oferta especial" arriba del tope → Volta rechaza
cortés, nunca commitea → el juez toma el teléfono e improvisa.

---

## Tabla comparativa

| Criterio | C1 · Buyer | C2 · Control Tower | C3 · Interface | C4 · Agent on the Line |
|---|---|---|---|---|
| Host | Yuno | Yuno | Nauta | Nauta |
| Explicabilidad (1 frase) | Alta | Alta | Media | Alta |
| Ejecutable en 14h | Media | Media-baja | Media | Baja |
| Demo visual | Alta | Media-alta | **Muy alta** | Media |
| Match con el patrón | Medio-alto | **Muy alto** | Medio-alto | Medio |
| Fit de equipo | **Alto** | Alto | Medio | Medio-bajo |
| Riesgo de fallar en vivo | **Bajo** | Alto | Medio | **Muy alto** |
| Trial by fire predecible | Sí (revocar / límite) | No (incidente nuevo) | Parcial (agregar paso) | No (juez improvisa) |
| Concepto compartido | mandato + verificación | causa raíz + evidencia | spec de UI + renderer | voz real + commitments |

> **Nota:** C1 y C4 comparten la idea de *mandato* (autorización con límites que el agente no puede
> exceder). C3 y C4 comparten el dominio logístico de Nauta. Si el equipo tiene una preferencia de
> dominio (pagos vs. logística) eso descarta la mitad de la tabla de entrada.
