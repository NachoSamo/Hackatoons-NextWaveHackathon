# 08 — Producto, UX y go-to-market · Control Tower

> Tesis de producto, experiencia, venta e investigación de usuarios. Para el dominio técnico ver
> `06-dominio-pagos.md`; para decisiones de arquitectura y algoritmo ver `07-decisiones-core.md`.
> Este archivo contiene hipótesis pre-evento: las decisiones ratificadas se copian a
> `decision-log.md`.

## 1. Síntesis ejecutiva

**Control Tower es una capa de inteligencia de incidentes para Yuno que vigila el stream de pagos, detecta caídas de conversión que realmente importan, aísla la causa raíz entre múltiples dimensiones y explica qué está pasando, cuánto cuesta y qué debería revisar una persona.**

No es otro dashboard ni otro sistema de alertas. Convierte miles de eventos fragmentados en una historia operacional defendible:

> “Desde las 14:03, Provider X está rechazando tarjetas emitidas por Bank Y en Brasil. La aprobación cayó 18 puntos frente al comportamiento esperado, afecta a dos merchants y representa aproximadamente USD 12.400 por hora. Confianza del diagnóstico: alta. Acción sugerida: revisar el proveedor y considerar desviar tráfico.”

La promesa principal es:

> **De una caída silenciosa a una explicación accionable, antes de que el merchant la descubra por sus clientes.**

## 2. Qué pide realmente el challenge

El Challenge 2 de Yuno exige:

1. Vigilar un stream de transacciones en vivo.
2. Distinguir una caída real del ruido normal: horario, fines de semana y variación estadística.
3. Navegar las dimensiones `merchant × provider × method × country × issuing bank × decline code`.
4. Aislar una causa raíz, no limitarse a detectar el síntoma.
5. Mostrar evidencia: qué cayó, desde cuándo, a quién afecta, cuánto dinero cuesta y por qué el sistema cree eso.
6. Priorizar incidentes simultáneos.
7. Admitir cuando la evidencia no alcanza.
8. Recomendar una acción a una persona **sin ejecutarla**.
9. Recordar incidentes anteriores, como bonus.
10. Explicar el mismo evento para operaciones y para una audiencia ejecutiva.

### Límites que no conviene cruzar en el MVP

- No convertirlo en un sistema de remediación autónoma. La consigna pide diagnosticar y recomendar.
- No centrar el relato en conciliación, settlement o chargebacks. Pueden ser expansión futura, pero no son el núcleo evaluado.
- No vender “un LLM que mira métricas”. El valor está en detección estadística, aislamiento dimensional, evidencia y trazabilidad; el LLM traduce y facilita la exploración.
- No afirmar causalidad cuando solo existe correlación.
- No disparar alertas por cada anomalía pequeña.

## 3. Relación entre nosotros, Yuno, merchants y providers

```text
Providers / bancos / adquirentes / wallets
                 ↓ señales y respuestas
             Plataforma Yuno
                 ↓ stream normalizado
         Control Tower de incidentes
          ↙                         ↘
Operaciones y soporte Yuno      Equipo de pagos del merchant
          ↘                         ↙
        explicación, evidencia y acción sugerida
```

### Quién es el cliente

- **Cliente directo para la hackathon:** Yuno. Es quien tiene visibilidad transversal, integra la capacidad y decide incorporarla a su producto u operación.
- **Compradores internos posibles en Yuno:** Product, Payments Operations, Customer Success, Support y liderazgo de producto/operaciones.
- **Usuario operativo primario:** analista de operaciones o payments performance de Yuno.
- **Usuario externo primario:** responsable de Payments/Operations del merchant.
- **Comprador económico del lado merchant:** Head of Payments, COO o CFO, según el tamaño de la organización.
- **Beneficiario final:** el merchant, porque reduce pérdida de ingresos y tiempo de investigación; indirectamente, también el comprador que evita un pago fallido.
- **Proveedores:** fuentes de señal y posibles responsables de un incidente, no el cliente principal.

### Modelo de producto

La relación es **B2B2B**:

```text
Nuestro prototipo → capacidad integrada por Yuno → valor operativo para sus merchants
```

Yuno podría usarla internamente, incluirla en su portal, ofrecerla como módulo premium o incorporarla a una experiencia white-label. La solución fortalece la propuesta de Yuno; no intenta reemplazar su orquestación.

## 4. Problema de producto

### Problema funcional

Cuando cae la conversión, la señal está fragmentada entre dashboards, códigos, proveedores, países, métodos y bancos. La detección llega tarde y la causa se reconstruye manualmente.

### Problema económico

Cada minuto sin diagnóstico mantiene abierta la pérdida de pagos potencialmente aprobables. En operaciones de alto volumen, una variación pequeña puede representar muchas ventas.

### Problema humano

- Fatiga de alertas: demasiado ruido termina siendo ignorado.
- Guardia reactiva: una persona cruza filtros bajo presión y fuera de horario.
- Incertidumbre: nadie sabe si el problema es propio, del merchant, de un banco o de un proveedor.
- Comunicación lenta: operaciones descubre algo, luego debe traducirlo para soporte, liderazgo y el merchant.
- Pérdida de confianza: el merchant no solo pregunta “¿falló?”, sino “¿Yuno entiende qué pasó y me lo puede demostrar?”.

### Job to be done

> Cuando la performance de pagos cambia, necesito saber rápido si importa, dónde está el problema y qué evidencia lo sostiene, para priorizar la respuesta y comunicarla sin investigar manualmente miles de transacciones.

## 5. Tesis y propuesta de valor

### Para Yuno

> Convertir su ventaja de observabilidad transversal en una capacidad de diagnóstico explicable.

Valor:

- Menor tiempo de detección y diagnóstico.
- Menor carga manual para operaciones y soporte.
- Diferenciación más allá de “conectar y rutear proveedores”.
- Mejor conversación con merchants durante incidentes.
- Conocimiento acumulativo mediante memoria de incidentes.
- Base más confiable para futuras capacidades de optimización y remediación.

Yuno ya comunica Smart Routing, Monitors y Unified Insights. Su sitio describe Monitors como detección de anomalías, alertas y redistribución automática del tráfico. Por eso nuestra diferenciación debe ser **explicar la causa con evidencia, separar incidentes, estimar impacto, expresar incertidumbre y recordar precedentes**, no simplemente detectar o rerutear ([Yuno Smart Routing](https://www.y.uno/en/product/smart-routing)).

### Para el merchant

> Entender qué está pasando con su dinero sin convertirse en experto en la infraestructura de todos sus proveedores.

Valor:

- Claridad operacional.
- Menos ventas perdidas por incidentes no advertidos.
- Menos horas cruzando dashboards y abriendo tickets.
- Evidencia compartible con proveedores y equipos internos.
- Mayor confianza en Yuno como capa de control.

### Para operaciones

> Pasar de “la conversión bajó” a “este es el segmento afectado, esta es la evidencia y este es el siguiente paso”.

## 6. El producto

Nombre funcional de trabajo: **Yuno Control Tower**. No cerrar branding hasta validar con el equipo y los mentores.

### 6.1 Flujo principal

```text
Stream de transacciones
        ↓
Normalización de eventos y códigos
        ↓
Baseline contextual esperado
        ↓
Detección de desvío significativo
        ↓
Segmentación y búsqueda dimensional
        ↓
Hipótesis de causa + evidencia + confianza
        ↓
Impacto económico + prioridad
        ↓
Explicación por audiencia + acción sugerida
        ↓
Feedback humano + memoria del incidente
```

### 6.2 Capacidades centrales

#### A. Watch

- Consume transacciones en vivo.
- Calcula aprobación observada y esperada.
- Considera volumen mínimo, franja horaria, día, estacionalidad y variación normal.
- Evita alertar ante muestras pequeñas o fluctuaciones sin impacto.

#### B. Detect

- Detecta cambios persistentes y económicamente relevantes.
- Registra inicio estimado, severidad y alcance.
- Distingue evento aislado, degradación progresiva y caída abrupta.

#### C. Diagnose

- Compara dimensiones y combinaciones.
- Encuentra el segmento que concentra el desvío.
- Separa dos incidentes simultáneos aunque ambos afecten la métrica global.
- Genera hipótesis alternativas cuando la evidencia compite.

#### D. Explain

Cada incidente debe responder:

- ¿Qué cambió?
- ¿Desde cuándo?
- ¿Dónde ocurre?
- ¿A quién afecta?
- ¿Cuánto se desvía de lo esperado?
- ¿Cuánto dinero puede estar costando?
- ¿Cuál es la causa más probable?
- ¿Qué evidencia la sostiene?
- ¿Qué nivel de confianza tiene?
- ¿Qué debería revisar una persona ahora?

#### E. Prioritize

Score sugerido:

```text
prioridad = impacto económico estimado
          × alcance
          × persistencia
          × confianza del diagnóstico
          × criticidad del merchant
```

El score debe ser explicable; no un número mágico.

#### F. Remember

- Busca incidentes similares por patrón dimensional y temporal.
- Muestra qué ocurrió antes, cómo se resolvió y si la recomendación funcionó.
- Nunca usa semejanza histórica como prueba única de causalidad.

## 7. Payment Truth: definición correcta para este challenge

“Payment Truth” puede ser una buena idea paraguas, pero para el MVP debe significar **verdad operacional de un incidente de conversión**, no conciliación financiera completa.

### Capas de verdad

1. **Event truth:** qué eventos y respuestas llegaron realmente de Yuno/proveedores.
2. **Metric truth:** qué métrica cambió frente a qué baseline y con qué tamaño de muestra.
3. **Scope truth:** qué combinación de merchant, provider, método, país, banco y código concentra el problema.
4. **Cause truth:** qué explicación está mejor sustentada y cuáles alternativas siguen abiertas.
5. **Impact truth:** cuántos intentos/ventas y cuánto dinero están potencialmente afectados.
6. **Action truth:** qué puede hacer una persona, quién debería hacerlo y qué evidencia necesita.

### Contrato de confianza de cada incidente

Todo diagnóstico debe incluir:

- Evidencia observada.
- Baseline utilizado.
- Tamaño de muestra.
- Hipótesis principal.
- Hipótesis alternativas.
- Nivel de confianza.
- Datos faltantes.
- Acción recomendada, sin ejecución automática.

### Expansión futura, fuera del MVP

Una Payment Truth completa podría seguir el pago por autorización, captura, confirmación, conciliación y settlement. Es valiosa, pero si aparece en el pitch debe marcarse como **roadmap**, porque el challenge evalúa conversión y causa raíz.

## 8. Taxonomía de rechazos y acciones

Yuno ya normaliza estados, response codes, hard/soft declines y Merchant Advice Codes. La solución debería reutilizar esa taxonomía y enriquecerla, no inventar una incompatible ([Yuno: Transaction Status and Response Codes](https://docs.y.uno/reference/payments/status-and-response-codes/transaction)).

### Por persistencia

- **Hard decline:** repetir la misma operación sin cambiar condiciones probablemente no resuelva el problema. Ejemplos: tarjeta vencida, país o moneda no soportados, credenciales inválidas.
- **Soft decline:** puede resolverse con tiempo, cambio de ruta, autenticación o reintento controlado. Ejemplos: timeout, servicio del adquirente no disponible, fondos insuficientes o rechazo genérico del banco.

### Por capacidad de acción

- **Accionable por Yuno:** degradación de un proveedor, timeout, error de integración, ruta con peor performance, problema de credenciales/configuración.
- **Accionable por el merchant:** parámetros inválidos, configuración, moneda no permitida, experiencia de autenticación o datos enviados.
- **Accionable por el comprador:** fondos insuficientes, tarjeta vencida, autenticación no completada, información incorrecta.
- **Accionable por el provider/banco:** caída, sobre-rechazo localizado, política del emisor o respuesta inconsistente.
- **No accionable por ahora:** evidencia insuficiente, volumen demasiado bajo o código genérico sin señal adicional.

### Regla de UX

No mostrar solo el código. Traducirlo a:

```text
Qué significa → quién puede actuar → qué sugerimos → cuándo volver a evaluar
```

Ejemplo:

> “El rechazo viene principalmente del banco emisor, no del checkout. No recomendamos reintentar inmediatamente. Verificá si el patrón persiste y escalá al emisor con esta evidencia.”

## 9. Hipótesis de producto

### Hipótesis críticas

1. **Dolor:** el mayor costo no es ver la caída, sino aislar y comunicar la causa.
2. **Confianza:** operaciones confía más en una hipótesis acompañada por evidencia y límites que en una explicación absoluta.
3. **Ruido:** reducir falsos positivos vale tanto como detectar rápido.
4. **Impacto:** expresar la pérdida en dinero cambia la prioridad y acelera la respuesta.
5. **Audiencia:** operaciones y liderazgo necesitan el mismo incidente con distinto nivel de detalle.
6. **Memoria:** reconocer incidentes repetidos reduce sustancialmente el tiempo de diagnóstico.
7. **Integración:** Yuno tiene suficiente visibilidad normalizada para segmentar por las seis dimensiones del challenge.
8. **Producto:** la capacidad complementa Monitors/Smart Routing en vez de duplicarlos.
9. **Adopción:** una recomendación con responsable sugerido es más útil que una alerta sin siguiente paso.
10. **Canal:** la alerta debe llegar donde trabaja el usuario, pero la investigación profunda necesita una interfaz propia.

### Cómo validar

- Entrevista con Guada y mentores de Yuno/Getnet.
- Pedir un incidente real anonimizado y reconstruir su línea de tiempo.
- Mostrar dos versiones de una alerta: métrica sola vs. historia con evidencia.
- Preguntar qué dato faltante impediría actuar.
- Probar si la clasificación de responsable coincide con su flujo real.
- Medir si una persona puede explicar el incidente en menos de un minuto.

## 10. Riesgos y edges

### Riesgos técnicos/producto

- **Poco volumen:** una caída aparente puede ser ruido.
- **Cambio de mix:** la conversión global baja porque cambió la composición del tráfico, no porque algo se degradó.
- **Simpson's paradox:** el agregado puede contar una historia opuesta a los segmentos.
- **Datos tardíos o duplicados:** el propio stream puede crear una falsa anomalía.
- **Códigos genéricos:** `DO_NOT_HONOR` o equivalentes no explican por sí solos la causa.
- **Dos causas superpuestas:** proveedor degradado y banco emisor caído al mismo tiempo.
- **Causalidad falsa:** que una dimensión concentre rechazos no prueba que sea la responsable.
- **Baseline roto:** campañas, Black Friday, lanzamiento en un país o cambio de routing alteran el comportamiento esperado.
- **Estimación monetaria engañosa:** intentos rechazados no equivalen automáticamente a ventas recuperables.
- **Datos sensibles:** minimizar PII y controlar acceso por merchant/rol.
- **Recomendación peligrosa:** desviar tráfico puede aumentar costos, fraude o violar acuerdos.
- **Feedback contaminado:** una resolución humana incorrecta no debe convertirse automáticamente en “verdad histórica”.

### Conductas obligatorias

- Estado “investigando” antes de confirmar.
- Estado explícito “evidencia insuficiente”.
- Hipótesis alternativas visibles.
- Trazabilidad desde la explicación hasta los datos agregados que la sostienen.
- Cálculo de impacto mostrado como estimación y con supuestos.
- Separación estricta entre recomendación y acción ejecutada.

## 11. Experiencia de usuario

### Principio rector

> **Calma operativa:** hacer que una situación compleja se sienta comprensible y controlable, sin esconder incertidumbre.

### Arquitectura de información

1. **Command Center**
   - Estado general.
   - Incidentes activos ordenados por prioridad.
   - Conversión observada vs. esperada.
   - Dinero estimado en riesgo.
   - “Todo normal” visible: el silencio también debe generar confianza.

2. **Incident Detail**
   - Resumen ejecutivo de una línea.
   - Timeline: inicio, detección, cambios y estado actual.
   - Segmento afectado.
   - Evidencia principal.
   - Confianza y datos faltantes.
   - Impacto estimado.
   - Acción sugerida y responsable probable.

3. **Evidence Explorer**
   - Árbol o breadcrumbs de dimensiones investigadas.
   - Comparación contra baseline y grupos de control.
   - Decline-code mix antes/después.
   - Capacidad de responder “¿por qué creés esto?”.

4. **Incident Memory**
   - Casos similares.
   - Resolución anterior.
   - Similitudes y diferencias.

5. **Notification Surface**
   - Slack, email o push para despertar al usuario.
   - Mensaje breve con severidad, impacto y enlace al incidente.
   - La notificación no intenta contener toda la investigación.

### Estados críticos

- Normal / no molestar.
- Señal detectada / validando persistencia.
- Investigando causa.
- Diagnóstico probable.
- Diagnóstico confirmado con alta confianza.
- Evidencia insuficiente.
- Monitoreando recuperación.
- Resuelto.
- Reabierto / repetido.

### Dos niveles de explicación

**Ejecutivo**

> “Un incidente en Brasil está poniendo en riesgo aproximadamente USD 12,4k por hora. Está aislado en Provider X y no afecta a los demás mercados.”

**Operaciones**

> “Desde las 14:03, la aprobación de Visa emitida por Bank Y vía Provider X cayó de un baseline de 88% a 61% sobre 1.842 intentos. Otros providers y bancos permanecen dentro de rango. El mix de `DECLINED_BY_BANK` aumentó 3,2×. Confianza: alta.”

### Lenguaje de confianza

Usar:

- “La evidencia indica…”
- “La hipótesis más probable es…”
- “No tenemos datos suficientes para distinguir entre…”
- “Estimamos el impacto bajo estos supuestos…”
- “Recomendamos revisar…”

Evitar:

- “La IA descubrió mágicamente…”
- “Causa confirmada” sin prueba.
- Mensajes alarmistas o excesivamente técnicos.
- Personificar el sistema como si nunca se equivocara.
- Gradientes, copy genérico y componentes decorativos sin función: el producto debe sentirse como una herramienta operacional seria, no como AI slop.

### Accesibilidad y usabilidad

- No depender solo de color para severidad.
- Contraste WCAG y foco visible.
- Tablas/gráficos con alternativa textual.
- Fechas con zona horaria explícita.
- Números y monedas localizados.
- Estados y acciones entendibles sin conocer códigos internos.
- Responsive: detalle completo en desktop; triage y aprobación/acknowledgement en mobile.

## 12. Venta y posicionamiento

### Categoría

No venderlo como “dashboard de pagos con IA”. Posicionarlo como:

> **Incident intelligence para payment operations.**

### Qué se vende

- Menos tiempo ciego.
- Menos horas investigando.
- Menos ruido.
- Mejor comunicación con el merchant.
- Evidencia para decidir y escalar.
- Aprendizaje acumulativo de incidentes.

### Cómo venderlo a Yuno

> “Yuno ya ve cada transacción y puede mover el tráfico. Control Tower convierte esa visibilidad en una explicación causal que operaciones y merchants pueden entender y defender.”

La venta a Yuno es **diferenciación + eficiencia operativa + confianza del merchant**.

### Cómo venderlo al merchant

> “Sabé qué está frenando tus pagos, cuánto te cuesta y quién puede actuar, antes de perder horas investigando entre proveedores.”

La venta al merchant es **revenue protection + claridad + tiempo recuperado**.

### Objeciones esperables

- **“Ya tengo dashboards.”** — Los dashboards muestran síntomas; Control Tower arma y justifica la hipótesis causal.
- **“Ya tengo alertas.”** — El producto filtra ruido, separa incidentes y sugiere quién debería actuar.
- **“Yuno ya tiene Monitors.”** — Esto es la capa explicable de diagnóstico y memoria que potencia Monitors.
- **“No confío en una IA para pagos.”** — No ejecuta remediaciones; muestra evidencia, confianza, alternativas y deja a la persona decidir.
- **“La estimación de pérdida no es exacta.”** — Se presenta como rango/estimación con supuestos visibles, no como contabilidad.

### Modelo comercial hipotético

- Feature integrada para operaciones de Yuno.
- Módulo premium para merchants de alto volumen.
- Pricing por volumen monitoreado, cantidad de merchants o nivel de SLA.
- White-label para bancos/PSPs como expansión.

No validar pricing durante la hackathon; validar primero dolor, ownership y disposición a adoptar.

## 13. Landing page

### Rol dentro del producto

La landing y el panel no son dos productos. Son dos niveles del mismo relato:

```text
Landing: promesa y confianza
        ↓ Watch the live incident
Control Tower: prueba operacional en tiempo real
        ↓ Why this diagnosis?
Incident Detail: evidencia, ownership y acción
```

- **Landing:** persuade a Yuno y al merchant de que vale la pena mirar.
- **Command Center:** permite entender en segundos si la operación está sana y qué incidente importa.
- **Incident Detail:** permite creer, explicar y actuar sobre el diagnóstico.

### Hero recomendado

**Título**

> Know why payments fail—before revenue disappears.

**Subtítulo**

> Control Tower detects meaningful conversion drops, isolates the affected payment path and explains the evidence, impact and next best action in real time.

**CTA primario:** `Watch the live incident`

**CTA secundario:** `Open Control Tower`

### Versión en español para conversación

> Detectá qué está frenando tus pagos, cuánto te cuesta y qué revisar, antes de que el problema escale.

### Estructura de landing

1. **Hero:** promesa + subtítulo + CTAs + captura funcional del Command Center. La visual debe
   mostrar una señal entrando, no una ilustración genérica de IA.
2. **El costo de llegar tarde:** dashboards y alertas muestran síntomas; el equipo todavía cruza
   fuentes durante horas o días mientras el revenue sigue expuesto.
3. **From signal to action:** `Compare → Detect → Diagnose → Recommend`, con una frase y una evidencia
   por etapa.
4. **Payment Truth:** un incidente ejemplo con ventana observada, baseline, muestra, segmento,
   hipótesis, confianza, ownership e impacto estimado.
5. **Una vista transversal:** explicar por qué la posición de Yuno entre merchants y providers hace
   posible contrastar señales que un PSP aislado no puede ver.
6. **Dos audiencias, una verdad:** resumen ejecutivo y detalle operacional derivados del mismo
   evidence bundle.
7. **La forma tradicional vs. Control Tower:** días investigando y escalando sin contexto frente a
   alerta, evidencia y siguiente acción en minutos.
8. **Incertidumbre honesta:** mostrar `Insufficient evidence` como contrato de confianza.
9. **CTA final:** `See Payment Truth in action` → abre la aplicación lista para iniciar el stream.

### Dirección visual

- **Referencia de familia:** [Yuno Payments Concierge](https://y.uno/es/payments-concierge).
- Negro/blanco como base; gris cálido para texto secundario y un azul-violeta eléctrico reservado
  para foco, actividad y relación entre señales.
- Geist Sans para narrativa y Geist Mono para ventanas, timestamps, códigos y métricas.
- Grilla técnica fina, secciones amplias, titulares de gran escala y bordes precisos.
- Estética de control room sobria, no sci-fi. Evitar glassmorphism y gradientes genéricos de IA.
- Movimiento con significado: el stream corre, aparece el desvío, el sistema recorta dimensiones y
  converge en una hipótesis. Respetar `prefers-reduced-motion`.
- Evidencia como objeto visual principal; la IA no necesita avatar, robot ni esfera decorativa.
- La landing usa espacio y relato. La aplicación usa densidad, jerarquía y lectura rápida.

### Copy y tono

Tomar del estilo de Payments Concierge la estructura `problema concreto → visibilidad → acción`,
pero llevarla a nuestro diferencial:

- Usar: `evidence-backed`, `likely owner`, `estimated impact`, `next best action`, `in real time`.
- Evitar: `magic`, `autonomous`, `never wrong`, `guaranteed recovery` o causalidad absoluta.
- Hablar de ingresos protegidos y tiempo de diagnóstico; no inventar ahorros ni performance de
  clientes reales.

### Contrato responsive

- **Desktop:** landing completa y Control Tower de tres zonas.
- **Tablet:** dos zonas; Incident Detail se abre como panel dedicado.
- **Mobile:** la landing mantiene el relato. En la app solo se hace triage: estado, prioridad,
  impacto, ownership, resumen y enlace al detalle. No intentar comprimir el Evidence Explorer.

## 13.1 Panel operacional y modo demo

### Command Center

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Control Tower   LIVE/SIMULATION   time windows   Start · Pause · Reset  │
├──────────────────────────────────────────────────────────────────────────┤
│ Approval observed vs expected     Revenue at risk     Active incidents │
├───────────────────────────────────────────┬──────────────────────────────┤
│ Timeline + window contrast                │ Incident priority queue      │
│ last 2h vs same window / last 7d          │ severity · impact · owner    │
├───────────────────────────────────────────┴──────────────────────────────┤
│ Selected incident: evidence → confidence → recommended human action    │
└──────────────────────────────────────────────────────────────────────────┘
```

El panel puede ser completo y complejo; no puede ser plano. La complejidad se organiza en dos
niveles:

1. **Triage:** salud, comparación temporal, incidentes y dinero en riesgo.
2. **Explicación:** evidencia, hipótesis, ownership, confianza y acción.

### Controles del stream sintético

- Estado inicial `READY`: no hay registros todavía y el CTA principal es `Start live stream`.
- `RUNNING`: ingresan intentos approved/rejected y se actualizan timeline, volumen y approval rate.
- `PAUSED`: congela la reproducción sin borrar el estado para explicar una evidencia.
- `RESET`: vuelve al fixture saludable conocido y deja el sistema listo para repetir la demo.
- `COMPLETE`: indica que el escenario terminó; permite `Replay` o `Reset`.
- Badge persistente `SIMULATION MODE`; nunca disfrazar datos mockeados como producción.
- El panel de inyección del juez vive separado y solo acepta combinaciones válidas, sin JSON.

### Primer recorrido de usuario

1. Llega a la landing y entiende la promesa en menos de diez segundos.
2. Pulsa `Watch the live incident`.
3. Entra al Command Center con estado `READY`.
4. Pulsa `Start live stream`; observa tráfico sano y silencio confiable.
5. Se inyecta un incidente; ve `validating → diagnosing → detected`.
6. Abre `Why this diagnosis?` y encuentra contraste temporal, evidencia y ownership.
7. Revisa la acción recomendada y, en demo, puede `Apply (simulated)` para ver recuperación.

## 14. Conversación con Guada — Solution Business Analyst de Getnet

### Objetivo de la charla

No pedirle que valide “la idea”. Extraer cómo se detectan, investigan, explican y escalan incidentes hoy; dónde se pierde tiempo y qué evidencia permite actuar.

### Apertura sugerida

> “Estamos diseñando una capa que detecta una caída de aprobación, investiga automáticamente dónde se concentra y le explica a operaciones qué evidencia tiene y qué debería revisar. Antes de mostrarte la solución, queremos entender cómo ocurre de verdad en Getnet.”

### Bloque 1 — Caso real

1. Contame el último incidente de aprobación que llegó a tu equipo.
2. ¿Quién lo detectó primero y por qué canal?
3. ¿Qué métrica o señal hizo pensar que no era ruido?
4. ¿Cuánto tiempo pasó entre detección, diagnóstico y comunicación?
5. ¿Qué filtros o sistemas tuvieron que cruzar?
6. ¿Qué dato fue decisivo para identificar la causa?
7. ¿Qué dato faltaba o llegó tarde?

### Bloque 2 — Ownership y escalamiento

1. ¿Cómo distinguen si la causa es del merchant, adquirente, banco emisor, método o integrador?
2. ¿Quién puede actuar en cada caso?
3. ¿Qué evidencia necesita un provider para aceptar un escalamiento?
4. ¿Cuándo se comunica al merchant y quién redacta el mensaje?
5. ¿Qué decisiones están permitidas sin aprobación y cuáles requieren un responsable?

### Bloque 3 — Rechazos

1. ¿Qué códigos son realmente confiables y cuáles son demasiado genéricos?
2. ¿Cómo separan hard, soft y casos no accionables?
3. ¿Qué rechazos justifican retry, cambio de ruta o contacto con el comprador?
4. ¿Qué patrones suelen parecer una causa pero terminan siendo otra cosa?
5. ¿Cómo detectan un sobre-rechazo específico de un emisor?

### Bloque 4 — Alertas y confianza

1. ¿Qué vuelve útil a una alerta y qué hace que la ignoren?
2. ¿Cuál es el costo de un falso positivo? ¿Y de detectar tarde?
3. Si una herramienta dice “Provider X es la causa”, ¿qué evidencia necesitás ver para creerle?
4. ¿Preferís una hipótesis temprana con 70% de confianza o esperar una confirmación más sólida?
5. ¿Cómo debería expresar que todavía no sabe?

### Bloque 5 — Valor y adopción

1. ¿Quién sentiría más valor: operaciones, soporte, producto, comercial o el merchant?
2. ¿Quién sería el owner interno de una herramienta así?
3. ¿Qué métrica demostraría valor en 30 días?
4. ¿Esto debería vivir en un dashboard, Slack, email o dentro del flujo actual?
5. ¿Qué integraciones serían indispensables para que no quede como “otro dashboard más”?

### Tres conceptos para mostrar al final

1. **Incident card:** una línea ejecutiva + impacto + confianza.
2. **Evidence trail:** baseline, dimensiones investigadas y por qué se descartaron alternativas.
3. **Action handoff:** recomendación, responsable sugerido y paquete de evidencia para escalar.

### Frase que queremos poder completar después

> “Para Guada, el momento más caro no es __________; es __________, porque necesita __________ antes de poder __________.”

## 15. Storyboard de demo

### Escena 1 — Confianza por silencio

- Stream normal.
- La interfaz muestra que el sistema está observando.
- Hay variación, pero no alerta.
- Mensaje: “No todo movimiento es un incidente.”

### Escena 2 — Incidente Brasil

- Se inyecta sobre-rechazo de un provider solo en Brasil.
- El sistema detecta persistencia y recorta dimensiones.
- Muestra baseline, volumen, código dominante, impacto y confianza.
- Genera explicación ejecutiva y operacional.

### Escena 3 — Segundo incidente simultáneo

- Un banco mexicano cae para un merchant específico.
- El sistema no mezcla ambos eventos.
- Los prioriza por dinero en riesgo, alcance y confianza.

### Escena 4 — Incertidumbre honesta

- Se inyecta un caso con poco volumen o códigos ambiguos.
- El sistema informa que la evidencia no alcanza y pide/espera más señal.
- Esto demuestra seguridad y confianza, no debilidad.

### Escena 5 — Memoria

- Encuentra un incidente similar ocurrido el martes.
- Explica similitudes y diferencias.
- Sugiere revisar la misma integración, sin declarar automáticamente la misma causa.

### Escena 6 — Trial by fire

- El jurado selecciona merchant, provider, país, método, banco, código, magnitud e inicio.
- El generador inyecta el incidente sin intervención del equipo.
- Control Tower debe detectarlo, separarlo y explicarlo.

### Regla de oro para la demo

El equipo no toca el teclado. El juez modifica la entrada y el sistema reacciona de punta a punta.

## 16. Métricas de éxito

### Producto

- Mean Time to Detect (MTTD).
- Mean Time to Diagnose (MTTDx).
- Precisión/recall de incidentes relevantes.
- Tasa de falsos positivos.
- Precisión del segmento/cause ranking.
- Porcentaje de incidentes con evidencia suficiente.
- Tiempo hasta que un operador comprende y puede explicar el caso.
- Recomendaciones aceptadas o consideradas útiles.

### Negocio

- Revenue at risk detectado a tiempo.
- Horas de análisis manual evitadas.
- Reducción de tickets/escalamientos sin contexto.
- Tiempo de comunicación al merchant.
- Retención, confianza o adopción de merchants.

### Demo

- Detección correcta de ruido vs. incidente.
- Dos incidentes separados.
- Causa raíz defendible.
- Impacto estimado visible.
- Explicación para dos audiencias.
- Caso de evidencia insuficiente.
- Trial by fire sin intervención.

## 17. Decisiones para el Flight Log

### Decisión 1 — Baseline adaptativo vs. umbral fijo

- **Elegimos:** baseline contextual/adaptativo.
- **Alternativa:** alertar si approval rate cae más de X puntos.
- **Trade-off:** aumenta complejidad, pero reduce ruido por hora/día/volumen.

### Decisión 2 — Hipótesis explicable vs. diagnóstico absoluto

- **Elegimos:** causa rankeada con evidencia, confianza y alternativas.
- **Alternativa:** una única respuesta categórica generada por IA.
- **Trade-off:** el mensaje es menos espectacular, pero más seguro y defendible.

### Decisión 3 — Recomendar vs. remediar automáticamente

- **Elegimos:** recomendación humana, sin ejecución.
- **Alternativa:** rerouting o retry automático.
- **Trade-off:** recupera menos dinero inmediatamente, pero respeta la consigna y evita acciones con costos/riesgo no modelados.

### Decisión 4 — Una interfaz vs. dos niveles de explicación

- **Elegimos:** un mismo incidente con vista ejecutiva y operacional.
- **Alternativa:** dashboard técnico único.
- **Trade-off:** exige modelar mejor el contenido, pero reduce traducción manual y cumple el bonus.

### Decisión 5 — Reglas/estadística para detectar, LLM para explicar

- **Elegimos:** pipeline híbrido.
- **Alternativa:** pedir al LLM que detecte directamente desde eventos crudos.
- **Trade-off:** más componentes, pero resultados reproducibles, auditables y resistentes a alucinaciones.

## 18. Pitch de 30 segundos

> “Yuno ve cada pago, pero cuando la conversión cae, entender por qué todavía exige cruzar miles de transacciones bajo presión. Control Tower vigila el stream, distingue ruido de incidentes reales y aísla la causa entre merchant, provider, método, país, banco y código de rechazo. Después explica qué pasó, desde cuándo, cuánto dinero está en riesgo y qué debería revisar una persona, mostrando siempre la evidencia y su nivel de confianza. Y si no sabe, lo dice. Así Yuno pasa de observar pagos a ofrecer claridad operacional antes de que el merchant descubra el problema por sus clientes.”

## 19. Qué debemos construir y qué puede esperar

### MVP de hackathon

- Generador de stream normal e incidentes configurables.
- Baseline simple pero contextual y defendible.
- Detector con umbral estadístico/volumen mínimo.
- Diagnóstico dimensional.
- Incidentes simultáneos.
- Evidence bundle y confidence score.
- Impacto económico estimado.
- Explicación ejecutiva y operacional.
- Recomendación sin ejecución.
- Estado “evidencia insuficiente”.
- Memoria de al menos un incidente anterior.
- Interfaz pulida y trial-by-fire controlable por el jurado.

### Roadmap

- Integraciones reales y observabilidad distribuida.
- Feedback loop de resolución.
- Recomendaciones sensibles a costo, fraude y contratos.
- Auto-remediación con políticas y approval gates.
- Payment Truth de captura, confirmación, conciliación y settlement.
- Experiencia white-label y benchmarking entre segmentos.

## 20. Preguntas abiertas para resolver con mentores

1. ¿Quién opera hoy Monitors y quién recibe sus alertas?
2. ¿Qué parte exacta del diagnóstico sigue siendo manual en Yuno?
3. ¿Yuno ya tiene baseline, anomaly detection y automatic redistribution? ¿Qué espera que agregue el challenge?
4. ¿Qué dimensiones están disponibles en tiempo real y cuáles llegan tarde?
5. ¿Cómo normalizan códigos incompatibles entre providers?
6. ¿Qué significa “money cost” para Yuno: GMV intentado, venta esperada o margen?
7. ¿Qué acciones suelen recomendar sin ejecutar?
8. ¿Cuál es el SLA real de detección/diagnóstico?
9. ¿Quién debe ver la explicación: Yuno, merchant o ambos?
10. ¿Qué información puede mostrarse de un provider sin problemas contractuales?
11. ¿Qué incidente histórico sería el mejor caso de prueba?
12. ¿Qué input sorpresa podría usar un juez para romper una solución ingenua?

## 21. Tesis final

La apuesta no es que “la IA encuentre patrones”. La apuesta es que Yuno puede convertir su posición privilegiada entre merchants y providers en una **fuente confiable de verdad operacional**.

El producto gana si logra cuatro cosas:

1. Detecta solo lo que importa.
2. Explica la causa con evidencia y límites.
3. Traduce complejidad técnica en una decisión humana clara.
4. Hace que Yuno parezca el socio que entiende y protege la operación del merchant, no solo la tubería por donde pasan los pagos.

Ese es el centro del producto, la experiencia, la venta y la demo.

## Fuentes

- Consigna oficial: `NextWave Hackathon 2026 — Challenges MASTER (EN) (1).docx`, Challenge 2 — The Control Tower.
- [Yuno — Payment Orchestration](https://www.y.uno/)
- [Yuno — Payments Concierge](https://y.uno/es/payments-concierge)
- [Yuno — Smart Routing y Monitors](https://www.y.uno/en/product/smart-routing)
- [Yuno API — Transaction Status and Response Codes](https://docs.y.uno/reference/payments/status-and-response-codes/transaction)
