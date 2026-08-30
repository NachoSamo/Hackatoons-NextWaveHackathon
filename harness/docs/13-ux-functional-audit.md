# 13 — Auditoría funcional y de usabilidad del frontend

> Corte: 30/08/2026 sobre `develop@ca6a484`. Se cruzaron el demo path, las reglas de negocio, el
> contrato frontend/backend y la app local en ejecución. El backend se inspeccionó en modo read-only.
> Esta auditoría describe problemas y prioridades; no incluye correcciones.

## Resultado ejecutivo

La estructura general está bien orientada: landing → silencio saludable → detección → cola →
investigación → comparación → recomendación. La app ya parece un producto y no una colección de
dashboards.

El riesgo principal está en la **verdad de la interacción**. Algunos controles tienen apariencia y
copy de función terminada, pero su efecto real es más limitado:

- `Aplicar vista` sólo cambia el resumen de filtros; no recalcula KPIs, gráfico ni cola con ese scope.
- `Pausar` deja de escuchar en el navegador, pero no pausa el replay o el loop del backend.
- `Centinel Copilot` parece aceptar preguntas abiertas, aunque hoy responde mediante tres ramas
  locales por palabras clave.
- `Interpretar` cambia algunos selectores mediante keywords, pero no explica qué entendió ni ejecuta
  el análisis.

Antes de sumar animaciones o nuevas superficies conviene cerrar esas cuatro brechas. Son problemas de
confianza y de guión, no detalles cosméticos.

## Método y alcance

- lectura de `docs/05`, `06`, `08`, `10`, `11`, `12`, arquitectura y pitch;
- revisión estática de estados, eventos, accesibilidad y contrato API del frontend;
- recorrido real de landing, Command Center, filtros y comparación en `localhost:5173`;
- prueba de Escape, nombres accesibles, landmarks, overflow y tamaño de blancos interactivos;
- sin inyectar incidentes ni modificar backend durante esta auditoría.

La skill `gsd:ui-review` instalada no pudo ejecutarse fielmente porque le faltan sus recursos
`ui-review.md` y `ui-brand.md`. Se aplicó el mismo criterio en seis ejes de forma manual. La skill de
testing también requiere Playwright Python, ausente en este entorno; la comprobación dinámica se hizo
con el navegador integrado.

## Scorecard

| Eje | Puntaje | Lectura |
|---|---:|---|
| Narrativa y jerarquía | 3/4 | El recorrido principal se entiende y la cola conserva contexto. |
| Claridad de interacción | 2/4 | Hay controles cuya etiqueta excede su efecto real. |
| Estados y recuperación | 2/4 | Healthy/validating/diagnosed son claros; pause, offline y errores no son robustos. |
| Accesibilidad e inputs | 2/4 | Buen uso parcial de labels/ARIA; faltan foco, Escape y nombre del input Copilot. |
| Responsive y resiliencia | 3/4 | No hubo overflow horizontal en desktop y existen breakpoints; modales largos concentran riesgo. |
| Consistencia y mantenibilidad | 2/4 | Sistema visual consistente, pero persisten estilos legacy y dos modelos conversacionales ambiguos. |
| **Total** | **14/24** | Base sólida; todavía no es segura para una demo sin explicar sus límites. |

## P0 — corregir antes del ensayo completo

### 1. `Aplicar vista` no aplica una vista

**Promesa visible:** elegir el cruce dimensional a inspeccionar y mostrar `Aplicados · …`.

**Comportamiento real:** `applyScope()` sólo copia `scope` a `appliedScope`. Los KPIs, el gráfico y
la cola siguen leyendo el overview, SSE y snapshot globales. El usuario puede creer que está viendo
`Adyen × BR × code 91` cuando los números siguen siendo globales.

**Decisión necesaria:** una de estas dos opciones, sin punto medio:

1. aplicar el scope realmente a gráfico/KPIs/cola; o
2. renombrar la acción a `Preparar simulación` y eliminar toda afirmación de vista filtrada.

Para el pitch actual conviene la opción 2 si filtrar agregados requiere tocar backend.

### 2. `Pausar` no pausa el sistema

`Pausar` desactiva polling y SSE del cliente. El backend puede seguir avanzando ventanas y
diagnosticando. Al reanudar, la UI puede saltar varios estados o encontrar un incidente ya creado.

Esto contradice el fallback del demo path: controles determinísticos y repetibles. Debe quedar claro
si el producto pausa la observación local o el replay completo; la etiqueta tiene que decir la verdad.

### 3. Start/Reset son optimistas ante fallas

`start()` y `reset()` esperan las llamadas, pero no tienen `try/catch/finally`. Después de una falla
pueden dejar `busy` activo, o marcar `HEALTHY/READY` sin prueba suficiente. La salud del backend se
consulta una sola vez y los controles no se bloquean cuando está offline.

Para una demo, el criterio mínimo es: error visible, botón recuperable, estado no engañoso y una
acción de reintento.

### 4. El Copilot promete conversación abierta, pero responde por keywords

El input libre responde sólo a `next/ahora`, `owner/responsable` o a una respuesta genérica. La
pregunta “¿desde cuándo?” o una repregunta concreta reciben el mismo relato de operaciones. Además,
“¿por qué este responsable?” devuelve las primeras dos evidencias aunque no expliquen ownership.

El pitch promete consultar qué cambió, desde cuándo, afectados, ownership y contradicciones. Hay que:

- conectar el input al contrato real de explicación; o
- convertirlo honestamente en preguntas sugeridas cerradas y quitar el campo libre.

### 5. La interpretación natural de comparaciones no confirma qué entendió

`Interpretar` reconoce unas pocas marcas, países, métodos y ventanas. Luego cambia controles en
silencio. No muestra campos reconocidos/no reconocidos, no avisa que todavía falta ejecutar y puede
dejar filtros previos mezclados con la consulta nueva.

Antes del pitch debe existir una confirmación compacta: `Entendí: Adyen · Brasil · últimos 60 s · vs
baseline`, con desconocidos explícitos y CTA `Ejecutar comparación`.

## P1 — usabilidad y accesibilidad

| Hallazgo | Evidencia | Riesgo / ajuste sugerido |
|---|---|---|
| Input del Copilot depende del placeholder | No tiene `<label>` ni `aria-label` | El propósito desaparece al escribir y no tiene nombre accesible. Agregar label visible u oculto. |
| Escape no cierra filtros ni comparación | Verificado en ejecución | Implementar Escape, cierre por backdrop cuando sea seguro y retorno de foco al trigger. |
| Modales sin focus trap | `aria-modal=true`, sin gestión de foco | Teclado puede navegar al Command Center detrás. Encerrar foco y enfocar título/primer control al abrir. |
| Comparación puede abrirse sobre diagnóstico | Dos overlays anidados | Confunde jerarquía y cierre. El modal hijo debe ser una vista interna o gestionar correctamente la pila. |
| Trigger de filtros sin estado accesible | Sin `aria-expanded`/`aria-controls`; panel sin role/nombre | Agregar contrato de disclosure; hoy un lector no sabe si está abierto. |
| Inputs sin foco visible | `outline: 0` en Copilot y consulta; sólo algunos selects cambian borde | Agregar `:focus-visible` consistente a input, select y botones. |
| Click target de Brand sobredimensionado | En Command Center llegó a ocupar ~796 × 21 px | Limitar el item de grid con `justify-self:start`/`width:fit-content`. |
| Targets menores a 44 px | Toggle 81 × 34; nav y links con alto visual 18–42 px | Aumentar área clickeable sin inflar necesariamente la forma visible. |
| Cola difícil de escanear | Cinco factores de prioridad usan labels de 7 px | Mostrar score total + 1–2 drivers; dejar el desglose completo para el detalle. |
| Gráfico poco cuantificable | Sin escala Y visible; `0/30 snapshots` no comunica intervalo | Agregar rango o valores de referencia y expresar `30 ventanas de 60 s`. |
| Logs invertidos sin indicación | Se muestran newest-first | Rotular `Más recientes primero` y mantener header visible durante scroll. |

## P2 — consistencia y limpieza

- La landing usa landmarks correctos y no mostró overflow horizontal en desktop.
- El titular concatena visualmente su salto de línea en el texto accesible; conviene preservar un
  espacio real entre `rompiendo` y `antes`.
- En español sobreviven términos como `stream`, `baseline`, `snapshot`, `scope` y `routing`. Algunos
  son vocabulario del equipo, pero hay que congelar un glosario para no alternar sin criterio.
- El archivo CSS conserva bloques legacy (`explore`, `policy`, `investigation`, `command-center`)
  que ya no pertenecen al hot path. No bloquean la demo, pero elevan el riesgo de regresión.
- Los presets iniciales `Adyen × BR × 91` hacen que la primera pantalla parezca ensayada. Para el
  trial by fire conviene iniciar en `Todo el tráfico` y ofrecer el escenario sólo al preparar la
  simulación.
- `Aplicar vista` y `Simular señal` conviven en el mismo panel. Aunque sean acciones separadas, su
  cercanía facilita una inyección accidental; se recomienda una confirmación demo-only.

## Qué está funcionando bien y no conviene romper

- landing y producto comparten lenguaje visual y transición;
- la pantalla principal conserva simultáneamente stream e incidentes;
- no se inventan transacciones individuales: la tabla refleja la traza agregada real;
- silencio saludable, validación y diagnóstico tienen estados visuales diferenciados;
- cada incidente abre inline y conserva el contexto de la torre;
- Operations/Executive usan los mismos hechos;
- estimación monetaria se presenta como estimación;
- comparación conserva historial de sesión y deja visibles scope, ventana, UTC y muestra;
- reduced motion ya está contemplado.

## Orden de trabajo recomendado

1. Corregir verdad funcional de `Aplicar vista`, `Pausar`, Start/Reset y Copilot.
2. Ensayar el demo path completo, incluidos dos incidentes y evidencia insuficiente.
3. Cerrar accesibilidad de filtros/modales/inputs.
4. Mejorar lectura de gráfico, cola y logs.
5. Recién entonces limpiar CSS legacy y ajustar microcopy/spacing.

## Criterio de salida

La interfaz queda lista para ensayo cuando una persona que no conoce el sistema puede:

1. iniciar y controlar el stream sin ayuda;
2. distinguir alcance de observación de simulación;
3. entender qué datos afecta cada filtro;
4. abrir, comparar y cerrar una investigación sólo con teclado;
5. hacer dos consultas y reconocer qué entendió el sistema;
6. recuperarse de backend offline sin recargar la página;
7. narrar cada cambio de estado usando solamente evidencia visible.

## Iteración aplicada después de la auditoría

El mismo 30/08 se cerraron los gaps de interfaz que no requieren modificar backend:

- `Aplicar vista` fue eliminado. El panel declara que configura el alcance de una señal de prueba y
  que Centinel continúa monitoreando todo el tráfico.
- `Pausar` pasó a `Congelar vista`, con copy explícito de que el backend sigue procesando.
- Start/Reset validan su respuesta, liberan siempre el estado busy y ofrecen retry ante error.
- La salud del backend se vuelve a comprobar periódicamente.
- Copilot declara sus límites, reconoce preguntas soportadas y el input tiene nombre accesible.
- `Interpretar` parte de un scope vacío y confirma entidades, ventana y referencia reconocidas.
- Filtros y modales soportan Escape; los modales encierran foco y lo devuelven al trigger.
- Inputs/selects tienen foco visible; Brand y toggle recuperan blancos interactivos acotados.
- El gráfico de tasa fue reemplazado por volumen por snapshot entrante: aprobadas, rechazadas y
  aprobaciones esperadas. `tx_count` acumulado se convierte a delta entre snapshots para no dibujar
  crecimiento artificial; la mezcla de aprobación sigue la tasa móvil de 60 segundos del SSE.

Quedan para otro corte: validar el flujo completo con dos incidentes reales, revisar el workspace de
diagnóstico con datos vivos, reducir el detalle de prioridad y limpiar CSS legacy.
