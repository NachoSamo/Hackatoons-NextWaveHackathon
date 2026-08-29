# 00 — Dominios: quiénes son y qué les duele

Los briefs salen de problemas que estas empresas están resolviendo hoy. El jurado son las personas
que escribieron esos briefs. Conocer su dolor real es ventaja directa.

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

## El patrón (la señal más fuerte que tenemos)

> **Datos fragmentados multi-fuente → capa de IA que unifica, explica y ACTÚA → interfaz simple y
> accionable (a veces conversacional), no un dashboard más.**

Tres señales independientes apuntan a esto: cómo se describe Yuno, cómo se describe Nauta, y el
proyecto que ganó la edición anterior (4thena: centralizaba señales de WhatsApp/Telegram/LinkedIn/Slack
en una memoria consultable por IA que generaba documentos accionables).

**Primer filtro al leer los briefs: ¿esta idea encaja en ese patrón?**

---

## Problemáticas recurrentes por dominio

Formato: quién sufre → qué le pasa → por qué duele.

### Pagos
1. Merchant multi-país pierde ventas por approval rate bajo y no sabe por qué falla cada transacción.
2. Finanzas tarda días en conciliar pagos entre múltiples PSPs y acquirers.
3. Negocio entrando a un mercado nuevo no sabe qué métodos habilitar (BNPL, wallets, QR) y pierde conversión.
4. Fraude detectado tarde porque cada proveedor tiene su sistema aislado.

### Logística
1. Importador no sabe el estado de un container hasta que ya generó costo de detención.
2. Operador arma la información de un shipment desde emails y PDFs sueltos, a mano.
3. Nadie anticipa demoras por clima, aduana o proveedor — se descubren cuando ya pasaron.
4. Documentación de compliance cross-border generada y verificada manualmente.

### AI-Native (criterio de diseño transversal, no un dominio)
1. ¿La IA es el motor de la decisión, o es un chatbot pegado arriba de un CRUD? Lo segundo pierde puntos.
2. ¿El sistema anticipa, o solo reporta lo que ya pasó?
3. ¿Explica el porqué de su decisión, o es caja negra?
4. ¿La salida es accionable (WhatsApp/Slack, un botón "resolver") o es otro dashboard?
