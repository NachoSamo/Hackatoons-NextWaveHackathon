# 02 — Timeline, checkpoints y recorte

**Owner: Samo.** Los checkpoints son parados, de 5 minutos, y no se saltean.

---

## El número que hay que tener grabado

```
Sábado  14:00 → 02:00        = 12 h
  − cena (1 h) − merienda (0.5 h)  = 10.5 h efectivas
Domingo 07:00 → 11:00        =  4 h
  (11:00–12:30 es SOLO pitch, no código)
─────────────────────────────────────────
VENTANA REAL DE CONSTRUCCIÓN ≈ 14 h
```

Si la idea elegida no entra en 14 horas con margen, es la idea equivocada.

---

## Checkpoints

| Hora | Checkpoint | Qué tiene que estar |
|---|---|---|
| **~13:20** | Idea congelada | Challenge elegido + demo path escrito |
| **17:00** | Spike resuelto | La pieza incierta (LLM/visión/agente) probada end-to-end en un script feo. Arquitectura definida. Contratos de API escritos |
| **18:00** | **FEEDBACK FREEZE** | Después de acá, ningún feedback de mentor toca arquitectura ni alcance |
| **~21:00** | Core end-to-end | Backend funcionando aunque sea sin frontend lindo |
| **22:30** | **CHECKPOINT DE RECORTE** | Se mira el demo path y se decide qué se corta. El más importante del día |
| **01:30** | MVP + demo grabada | Todo funcionando + **video de respaldo grabado**. Se apaga |
| **02:00–07:00** | Dormir | No negociable. Dormir es ventaja competitiva |
| **07:00–11:00** | Refinamiento + plus | Pulido visual, detalles que impactan |
| **11:00–12:30** | Solo pitch | Mínimo 4 ensayos completos con cronómetro. Cero código |

---

## Orden de ataque: por riesgo, no por dificultad

**Las primeras 3 horas nadie escribe lógica de negocio fina.**

El CRUD no tiene riesgo — sabemos que lo vamos a poder hacer, entonces hacerlo primero no nos da
información. Lo que necesitamos saber temprano es si la parte que **no sabemos si funciona**, funciona.

Spike vertical finito en las primeras 2-3 horas: script feo, sin frontend, que prueba end-to-end la
pieza incierta (¿el modelo extrae bien los campos? ¿el agente encadena? ¿la latencia es tolerable?).

- Si falla a las 17:00 → hay margen para cambiar el enfoque.
- Si falla a las 23:00 → estamos muertos.

Esto además protege contra el rework por feedback de mentores: la capa de datos y la capa de modelo
sobreviven a casi cualquier pivote de la Y. Lo que se tira es la lógica de negocio construida antes
de validar.

---

## Regla de recorte (acordada en frío, ANTES del evento)

En el checkpoint de las 22:30 se miran los pasos del demo path y se decide:

1. ¿Algún paso se **elimina**?
2. ¿Algún paso se **simplifica**?
3. ¿Algún paso se **hardcodea**?

> **Un paso hardcodeado que se ve perfecto en el pitch vale más que un paso real a medio terminar
> que falla en vivo.**

> **Si algo no llega: se recorta el paso. NO se agregan personas al problema.**

Esta decisión es incómoda de tomar a las 22:30 con sueño y ego. Por eso está acordada hoy.

---

## Filtro anti scope-creep

Cuando alguien proponga una feature a las 21:00, la única pregunta es:

**"¿En qué paso del demo path se ve?"**

Si la respuesta es "no se ve" → no se hace.
