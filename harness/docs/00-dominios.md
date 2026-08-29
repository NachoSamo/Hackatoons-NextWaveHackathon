# 00 — Dominios: quiénes son y qué les duele

Los briefs salen de problemas que estas empresas están resolviendo hoy. El jurado son las personas
que escribieron esos briefs. Conocer su dolor real es ventaja directa.

> **Los 4 briefs ya están y están desarrollados en `05-challenges.md`.** Este archivo queda como el
> contexto de fondo (qué hace cada empresa, qué le duele) que ayuda a defender la solución ante el
> jurado. Abajo, en "Problemáticas por dominio", se marca qué challenge ataca cada dolor.

---

## Yuno — orquestación de pagos

Clientes: McDonald's, Rappi, Uber, inDrive, Netease, GoFundMe. Opera en ~190 países.

**Su dolor, en su propia comunicación:**
- Las empresas dependen de media docena de proveedores de pago por mercado → integración cara y fragmentada.
- Approval rates bajos por ruteo a procesadores con mala performance o latencia.
- Fraude gestionado de forma manual y desconectada entre proveedores.
- Rechazos a nivel emisor = caja negra: nadie explica **por qué** falla un pago.
- Datos en silos, visibilidad limitada entre proveedores.
- Conciliación y settlement como carga operativa.

**Lo que ya tienen (no reinventar, conocer):** Smart Routing, y "Payments Concierge", un agente de IA
que analiza el stack de pagos, explica fallos a nivel emisor, recomienda reglas de ruteo y entrega
insights en lenguaje simple **vía Slack o WhatsApp**.

---

## Nauta — orquestación logística para importadores

Clientes: New Balance, L'Oréal, Moët & Chandon, Ashley Furniture, Soriana. Seed de $7M (2025).

**Su dolor, en su propia comunicación:**
- Los importadores manejan shipments con **emails, spreadsheets y sistemas legacy que no se hablan**.
- Son **reactivos**: se enteran del problema (demora, sobrecosto de detención) cuando ya ocurrió.
- Datos en silos entre ERP / TMS / WMS / documentos / emails / órdenes / inventario.
- Documentación cross-border (aduana, compliance, impuestos) manual y propensa a error caro.

**Su tesis de producto:** "no dashboards estáticos — software que piensa, actúa y se adapta".
Prometen reducir costos de detención hasta 80% y mejorar tiempos de procesamiento de containers 75%.

---

## El patrón (predicción pre-brief — cómo salió)

> **Datos fragmentados multi-fuente → capa de IA que unifica, explica y ACTÚA → interfaz simple y
> accionable (a veces conversacional), no un dashboard más.**

Se predijo esto antes de conocer los briefs, por cómo se describen Yuno y Nauta y por el proyecto que
ganó la edición anterior (4thena). **Cómo salió:**

- **C2 · Control Tower** lo clava: causa raíz dispersa en miles de transacciones → IA la aísla y
  explica → acción recomendada. El más alineado.
- **C3 · Interface That Builds Itself** encaja en la parte "no un dashboard más / software que actúa".
- **C1 · Buyer** y **C4 · Agent on the Line** giran alrededor de otra idea: el **mandato** —
  autorización con límites que el agente no puede exceder — y la confianza verificable.

El patrón sigue siendo un buen filtro para el *ángulo* de la solución (¿la IA es el motor de la
decisión o un chatbot pegado a un CRUD? ¿anticipa o solo reporta? ¿explica el porqué? ¿la salida es
accionable?), pero no alcanza para elegir challenge. Para eso: `05-challenges.md`.

---

## Problemáticas recurrentes por dominio

Formato: quién sufre → qué le pasa → por qué duele.

### Pagos
1. Merchant multi-país pierde ventas por approval rate bajo y no sabe por qué falla cada transacción. → **C2**
2. Finanzas tarda días en conciliar pagos entre múltiples PSPs y acquirers.
3. Negocio entrando a un mercado nuevo no sabe qué métodos habilitar (BNPL, wallets, QR) y pierde conversión.
4. Fraude detectado tarde porque cada proveedor tiene su sistema aislado. → **C1** (fraude por la puerta nueva de los agentes)

### Logística
1. Importador no sabe el estado de un container hasta que ya generó costo de detención. → **C3** (monitoreo del viaje)
2. Operador arma la información de un shipment desde emails y PDFs sueltos, a mano. → **C3** (extracción del Booking Confirmation)
3. Nadie anticipa demoras por clima, aduana o proveedor — se descubren cuando ya pasaron. → **C3** (transbordo inesperado) / **C4** (chofer avisa la demora)
4. Documentación de compliance cross-border generada y verificada manualmente.
5. El tramo de camión (puerto → depósito) se coordina 100% por teléfono, sin registro estructurado. → **C4**

### AI-Native (criterio de diseño transversal, no un dominio)
1. ¿La IA es el motor de la decisión, o es un chatbot pegado arriba de un CRUD? Lo segundo pierde puntos.
2. ¿El sistema anticipa, o solo reporta lo que ya pasó?
3. ¿Explica el porqué de su decisión, o es caja negra?
4. ¿La salida es accionable (WhatsApp/Slack, un botón "resolver") o es otro dashboard?
