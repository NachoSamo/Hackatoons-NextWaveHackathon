# DEMO PATH — la secuencia exacta que se muestra en el pitch

> **Se congela ANTES de escribir código (sábado ~13:20). Es el contrato del equipo.**
>
> Esto NO es una lista de features. Es el guión de pantallas y acciones, paso por paso.
> **Todo lo que no aparece acá es opcional.**

## Cómo se usa

- Feature propuesta a las 21:00 → *"¿en qué paso del demo path se ve?"* → si no se ve, no se hace.
- Checkpoint de recorte (22:30) → se eliminan / simplifican / hardcodean **pasos**, no features sueltas.
- Un paso hardcodeado que se ve perfecto vale más que un paso real a medio terminar que falla en vivo.

---

## Los pasos

*(completar el sábado — ejemplo de la forma que tiene que tener)*

| # | Qué se ve en pantalla | Qué hace el que presenta | Estado | Responsable |
|---|---|---|---|---|
| 1 | Tablero con N embarques, 2 en rojo | Abre la app | ⬜ | |
| 2 | — | Pone un packing list de papel bajo la cámara | ⬜ | |
| 3 | Campos extraídos y estructurados | — | ⬜ | |
| 4 | El agente marca una discrepancia con la orden de compra | — | ⬜ | |
| 5 | Borrador de mail al proveedor generado | — | ⬜ | |
| 6 | Acción ejecutada / confirmada | Aprieta "aprobar" | ⬜ | |

Estados: ⬜ pendiente · 🟡 en progreso · ✅ listo · 🔧 hardcodeado · ❌ recortado

---

## Fallbacks obligatorios

- [ ] Cada paso que use la cámara tiene un botón equivalente de subir archivo
- [ ] Ningún paso puede terminar en pantalla en blanco si falla: siempre fallback visible
- [ ] **Video del demo path completo grabado el sábado ~01:30**, cuando ya funciona
