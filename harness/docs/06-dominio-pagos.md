# 06 — Dominio: orquestación de pagos (Challenge 2)

> Contexto del dominio elegido. Sirve para dos cosas: **vocabulario común del equipo** y **munición
> para la defensa técnica** ante el jurado (que trabaja en Yuno y sabe todo esto).
>
> El research técnico (algoritmos de localización de causa raíz, detección online, etc.) y las
> decisiones abiertas están en `07-decisiones-core.md`.

---

## 1. Cómo viaja un pago

```
Comprador → Merchant → Gateway/Orquestador → PSP / Adquirente → Red (Visa/MC) → Banco emisor
                                                                                     │
                              ← ← ← ← ← ← ← respuesta (aprobado / código de rechazo) ←
```

Tres momentos, no uno:

| Momento | Qué pasa | Cuándo |
|---|---|---|
| **Autorización** | El emisor pone un *hold* sobre los fondos y responde aprobado/rechazado. **No se movió plata todavía.** | Instantáneo |
| **Captura** | El merchant confirma la venta; los fondos quedan marcados para transferir. | Inmediato en e-commerce, o días después |
| **Clearing & Settlement** | Redes y bancos mueven la plata de verdad. | T+1 / T+2 |
| **Chargeback** | El titular disputa el cargo después. | Hasta 120+ días |

**El Challenge 2 vive en la Autorización.** La métrica es: de todos los intentos de autorización,
¿cuántos aprobaron?

## 2. Quién es quién

- **Merchant:** la empresa que cobra (McDonald's, Rappi, etc.).
- **Gateway:** la capa técnica que transmite los datos del pago.
- **Orquestador de pagos (Yuno):** se sienta *arriba* de muchos PSPs. El merchant integra **una sola
  vez** y Yuno rutea cada transacción al proveedor que convenga, reintenta, y guarda la tarjeta
  tokenizada. **Es el único punto que ve todas las transacciones de todos los proveedores.**
- **PSP / Adquirente / Procesador:** Stripe, Adyen, dLocal, MercadoPago. Conecta con las redes y
  tiene la cuenta del merchant.
- **Red / scheme:** Visa, Mastercard, Amex. Los rieles y las reglas.
- **Banco emisor (issuer):** el banco del comprador. **Toma la decisión final de aprobar o rechazar**
  y corre sus propios modelos de riesgo y de fraude.

### Por qué existe una "torre de control"

Cada procesador traduce los códigos de rechazo a su propia taxonomía y expone información distinta:

| Procesador | Qué expone en el rechazo |
|---|---|
| Stripe | El código crudo del emisor |
| Braintree | Etiqueta *soft* / *hard* |
| Adyen | Infiere la razón real con ML |
| Square | Lo oculta casi todo |

Un merchant con un solo PSP ve solo su rincón. **El orquestador ve todos los rincones a la vez** →
puede comparar "el proveedor A rechaza estas tarjetas y el proveedor B las aprueba" y sacar
conclusiones que nadie con visión parcial puede sacar. Esa es la razón de ser del producto.

## 3. Conversión / approval rate

- **Definición:** `pagos aprobados / pagos intentados`. Es la métrica que mueve más plata: cada punto
  perdido es venta perdida por minuto.
- **Baseline sano (card-not-present, e-commerce):** 5–10% de rechazo es normal. **Arriba de 15% ya
  es un problema.** *(regla de industria, defendible como tal)*
- Sube y baja sola durante el día y la semana (menos volumen de madrugada, otro mix de compradores).
  Un detector tiene que distinguir esa variación natural de una caída real — el brief lo pide
  explícitamente.

## 4. Quién puede rechazar un pago

| Actor | Rechazos típicos |
|---|---|
| Gateway / PSP | Error de formato, configuración, límites de velocidad |
| Red | Algún remapeo de códigos de fraude |
| **Banco emisor** | **Fondos insuficientes, modelo de riesgo, tarjeta vencida, límites — la mayoría, y la parte opaca** |

El emisor es una caja negra a propósito: usa códigos genéricos para que nadie pueda inferir sus
umbrales de fraude probando tarjetas.

## 5. Códigos de rechazo (decline codes)

Estándar de base: **ISO 8583**, campo de código de respuesta. Códigos de dos dígitos.

### Soft vs hard — es LA distinción que ordena todo

- **Soft** = temporal, recuperable → **se puede reintentar**. Fondos insuficientes (51), emisor no
  disponible (91), error de sistema (96), y la mayoría de los genéricos.
- **Hard** = permanente → **no se reintenta** (las redes multan por reintentar hard declines).
  Tarjeta perdida (41), robada (43), vencida (54), número inválido (14).

### El código 05 "Do Not Honor"

- Es el rechazo **más común: ~30–40% de todos los rechazos**, y el **menos informativo** — no dice
  nada. Es donde los emisores esconden sus modelos de riesgo.
- **⚠️ Claims a verificar antes de decirlos al jurado** (Yuno sabe más que nosotros):
  - "El análisis de Adyen sugiere que ~50% de los 05 son en realidad fondos insuficientes
    disfrazados" → decir "buena parte", no un número exacto, salvo que tengamos la fuente.
  - "Visa remapea el 59 (fraude sospechado) a 05" → **verificar**, o cambiar a "las redes colapsan
    códigos de fraude en genéricos".

### Tabla mínima para el generador de datos

| Código | Nombre | Tipo |
|---|---|---|
| 00 | Approved | — |
| 05 | Do Not Honor | soft (genérico) |
| 51 | Insufficient Funds | soft |
| 91 | Issuer Unavailable | soft |
| 96 | System Malfunction | soft |
| 14 | Invalid Card Number | hard |
| 54 | Expired Card | hard |
| 41 | Lost Card | hard |
| 43 | Stolen Card | hard |
| 61 / 65 | Exceeds Limit / Activity Limit | soft |
| N7 | CVV Mismatch | hard-ish |

## 6. Las dimensiones de una transacción

El diagnóstico de causa raíz vive en las **intersecciones** de estos atributos:

| Dimensión | Qué es | Cardinalidad en la demo (tentativa) |
|---|---|---|
| Merchant | La empresa que cobra | 3 |
| Provider | El PSP que procesó | 3 |
| Método | Tarjeta, PIX, wallet, PSE, cash | 3–4 |
| País | Dónde ocurrió | 3 (MX, CO, BR) |
| Banco emisor | El banco de la tarjeta | ~8–10 |
| Código de rechazo | Por qué no aprobó | ~10 |

**Recomendación (a decidir en `07`):** buscar la causa cruzando las **5 primeras**. El código de
rechazo **no es un eje de búsqueda, es la evidencia**: una vez que sabés *dónde* está el problema,
mirás qué códigos aparecen ahí y eso te dice *qué* tipo de problema es.

## 7. El dolor de Yuno, mapeado al brief

De la comunicación propia de Yuno (ver `00-dominios.md`):

- **"Rechazos a nivel emisor = caja negra: nadie explica por qué falla un pago."** ← es exactamente
  lo que el Challenge 2 pide resolver.
- "Approval rates bajos por ruteo a procesadores con mala performance o latencia."
- "Datos en silos, visibilidad limitada entre proveedores."
- "Conciliación y settlement como carga operativa."

Ya tienen un producto relacionado, **"Payments Concierge"**: un agente de IA que analiza el stack de
pagos, explica fallos a nivel emisor y da insights en lenguaje simple vía Slack/WhatsApp. **Nuestra
solución es vecina de eso** — conviene saberlo para no proponer algo que ya existe y para poder decir
en qué nos diferenciamos (nosotros: detección + localización de causa raíz determinística en vivo,
no solo explicación).

## 8. Líneas de pitch que salen del dominio

- *"El 40% de los rechazos dicen 'do not honor', que significa nada. Nuestro sistema infiere lo que
  el emisor no te dice."*
- *"El orquestador es el único que ve todos los proveedores a la vez — es el único lugar desde donde
  este diagnóstico es posible."*
- *"Detectar la caída es la parte fácil. La cara es el diagnóstico, y hoy lo hace un humano cansado
  cruzando filtros a las 3am."*

## 9. Glosario rápido

**Autorización** hold de fondos + respuesta aprobado/rechazado · **Captura** merchant confirma la
venta · **Settlement** se mueve la plata (T+1/T+2) · **Chargeback** el titular disputa después ·
**Approval rate / conversión** aprobados/intentados · **CNP** card-not-present (e-commerce) ·
**PSP/adquirente/procesador** quien procesa (Stripe, Adyen…) · **Issuer** banco del comprador, decide
aprobar/rechazar · **Soft decline** temporal, reintentable · **Hard decline** permanente, no
reintentar · **ISO 8583** el estándar de mensajería de pagos con tarjeta · **Decline code** código
de respuesta del rechazo.
