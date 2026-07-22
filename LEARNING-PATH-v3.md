# IA EXPLORER — LEARNING PATH v3 (propuesta)

**Fecha:** 2026-07-22 · **Estado: PROPUESTA — no se toca código hasta aprobación**
**Reemplaza a:** `Diagrama-de-flujo-detallado-LEARNING-PATH-v2.txt` (feb–abr 2026)
**Insumo:** `AUDIT-CONTENIDO.md` (inventario de obsolescencia, 2026-07-21/22)

---

## 0. Qué cambia respecto a la v2 — en una frase

La v2 definía **qué construir** (36 niveles desde cero). La v3 define **qué renovar**: el curso ya está construido y auditado, así que esto es un *diff*, no un plano.

---

## 1. Restricciones de esta versión

| # | Restricción | Consecuencia de diseño |
|---|---|---|
| 1 | **Cero cambios de UI/UX** | No se toca ningún estilo, layout ni componente |
| 2 | **Cambios mínimos y de contenido** | No se agregan ni eliminan niveles. Se mantiene 6 mundos · 36 niveles · 7 evaluaciones · numeración N1–N43 |
| 3 | **Audiencia: 9–17 años, uso productivo** | Cada nivel debe dejar al estudiante **capaz de hacer algo**, no solo enterado de algo |
| 4 | **Nada muerto** | Ninguna herramienta discontinuada se enseña como vigente |
| 5 | **Ejes durables** | Se prefiere el eje que sobrevive al renombramiento sobre el nombre de versión |

> **Por qué no se agregan niveles.** Un nivel nuevo obliga a tocar `LEVEL_COMPONENTS`, `INITIAL_WORLDS`, la migración del store, `trophies.ts`, las insignias y el techo de estrellas de `rankSystem.ts` (126 = 42 niveles puntuados × 3). Eso es cambio estructural, no de contenido. **Todo lo nuevo entra reemplazando el contenido de un slot existente.**

> **Lo que sí es barato y seguro:** renombrar mundos y niveles. La migración de `gameStore.ts` ya sincroniza nombres e íconos preservando el progreso (`updateLevelName` / `updateWorldName` existen). Un renombre = una edición + subir `version`. No es UI.

---

## 2. El material nuevo: personalizar tu IA

Es el hueco que la v2 nunca contempló, y es el más alineado con la audiencia: un estudiante de 9–17 no necesita saber qué empresa hizo qué modelo — necesita que **su** IA lo conozca, recuerde su curso, su materia y su forma de estudiar.

### Cómo se enseña: categorías, no rutas de clic

Una instrucción tipo *"Ajustes › Personalización › Instrucciones personalizadas"* se pudre en el próximo rediseño de interfaz. Una categoría no. El nivel enseña **las seis palancas que toda IA seria tiene hoy**, y luego dónde vive cada una en cada producto:

| Palanca | Qué es | Por qué le importa a un estudiante |
|---|---|---|
| **Instrucciones permanentes** | Lo que la IA debe saber de ti siempre, sin repetirlo | "Tengo 13 años, estoy en 8°, explícame sin tecnicismos" — una vez, no cada chat |
| **Memoria** | Lo que recuerda entre conversaciones | Que no le tengas que contar tu proyecto desde cero cada vez |
| **Espacios / proyectos** | Contextos separados con sus propios archivos y reglas | Un espacio por materia: el de Biología no se mezcla con el de Historia |
| **Estilo / tono** | Cómo responde: largo o corto, formal o cercano | Que deje de escribir ensayos cuando querías tres líneas |
| **Conexiones** | Qué apps y archivos puede ver | Sus apuntes, sus PDFs, su calendario |
| **Privacidad y entrenamiento** | Qué se guarda y cómo se desactiva | **El más importante y el que nadie enseña.** Qué NO contarle a una IA |

### Dónde vive en el path

Se enseña por **inducción**: primero el estudiante configura cuatro productos concretos (N19–N22), después generaliza el modelo mental (N23).

- **N19–N22** — cada nivel de producto gana módulos de configuración de *ese* producto (ChatGPT, Claude, Gemini, Grok)
- **N23** — **slot reconvertido**: deja de ser catálogo de herramientas y pasa a ser *"Personaliza cualquier IA"*, cubriendo el modelo transversal + dónde están esos ajustes en Copilot, DeepSeek, Perplexity y los demás

**Por qué se sacrifica N23:** era un nivel-catálogo (*"el ecosistema completo"*). Los catálogos son la peor inversión pedagógica del curso — envejecen cada trimestre y no dejan ninguna capacidad instalada. La amplitud de ecosistema que aportaba se absorbe en N24, que ya es el nivel de decisión ("¿cuál herramienta uso?").

---

## 3. Veredicto nivel por nivel

**Leyenda:** 🟢 Intacto · 🔵 Barrido (años/nombres vía capa de contenido) · 🟠 Renovación de contenido · 🔴 Reencuadre (cambia lo que enseña) · ✅ Hecho

### M1 — ¿Qué es la IA? (N1–N6)

| N | Nivel | Veredicto |
|---|---|---|
| N1 | Robots vs. Humanos | 🟢 |
| N2 | La IA vive en tus apps | 🟢 |
| N3 | Prompting básico | 🟢 |
| N4 | ¡Crea algo con IA hoy! | 🟢 nombres de herramienta vía capa |
| N5 | IA y Ética | 🟢 **el nivel mejor envejecido del curso** — modelo a imitar |
| N6 | Tu primer proyecto | 🟢 |

**Mundo entero sin trabajo real.** Los fundamentos no caducan.

### M2 — Domina el Prompting (N7–N12)

| N | Nivel | Veredicto |
|---|---|---|
| N7 | Prompting intermedio | 🟢 |
| N8 | El cerebro secreto de la IA | 🟠 tabla comparativa muerta, ventanas de contexto y precio de 2024. **El concepto no caduca, solo los números** → se alimenta de `aiLandscape.ts` |
| N9 | Prompts creativos | 🟢 |
| N10 | Prompts que fallan | 🟢 |
| N11 | Prompts en cadena (CoT) | 🟢 refuerza el nuevo eje de N19 |
| N12 | Trucos avanzados | 🟢 |

### M3 — IA Creativa (N13–N18)

| N | Nivel | Veredicto |
|---|---|---|
| N13 | IA que dibuja | 🔵 el campo se pobló; herramientas vía capa |
| N14 | IA que canta y habla | 🔵 las 3 herramientas siguen vivas. **Material nuevo disponible sin tocar estructura:** el giro de licenciamiento musical encaja en los módulos de ética que ya existen |
| N15 | IA que filma | ✅ **hecho** — herramientas vivas; Sora solo como lección |
| N16 | Haz tu primera web con IA | 🟠 la categoría se transformó con los agentes de código |
| N17 | Secretos en los datos | 🔵 |
| N18 | IA multimodal | 🟠 **anclado a un modelo muerto.** Además el marco caducó: la multimodalidad ya no es frontera, es lo normal → reencuadrar de *"mira lo que puede hacer"* a *"cómo le paso una foto, un PDF o un audio y saco algo útil"* |

### M4 — de catálogo a configuración (N19–N24)

**El mundo con más cambio.** Es donde entra el material nuevo.

| N | Nivel | Veredicto |
|---|---|---|
| N19 | ChatGPT | ✅ eje reencuadrado a *rápido vs. razona* · 🟠 **+ módulos de configuración** |
| N20 | Claude | 🟠 renovación + configuración |
| N21 | Gemini | 🟠 renovación + configuración |
| N22 | Grok | 🟠 renovación + configuración |
| N23 | ~~Perplexity, Copilot y más~~ → **Personaliza cualquier IA** | 🔴 **reconversión completa** — §2 |
| N24 | ¿Cuál herramienta uso? | 🟠 refrescar + absorber la amplitud de ecosistema que traía N23 |

**Renombre opcional del mundo:** *"El Gran Torneo de Herramientas"* → algo tipo *"Tu IA, a tu medida"*. Barato y seguro (§1), pero es decisión tuya — el nombre actual también sostiene el arco.

### M5 — Tu Proyecto de Impacto (N25–N30)

| N | Nivel | Veredicto |
|---|---|---|
| N25 | Crea tu chatbot | 🔵 **gana coherencia**: el system prompt es exactamente la personalización de N23 aplicada |
| N26 | Haz que la IA trabaje sola | 🟠 **aquí entran los agentes** — el hueco Tipo C se llena sin gastar un slot. La automatización sigue siendo el tema; el agente es cómo se hace hoy |
| N27 | Tu idea para cambiar algo | 🟢 |
| N28 | Diseña una app sin código | 🟠 refrescar herramientas; revisar solape con N16 |
| N29 | Comparte tu creación | 🟢 |
| N30 | Presenta tu proyecto | 🟢 |

### M6 — El Futuro de la IA (N31–N36) — **decisión abierta**

Es el mundo **menos alineado con el propósito declarado** y el **más caro de mantener**. Cuatro de sus seis niveles son documentales: enseñan *sobre* la IA (robots, autos autónomos, medicina, clima) sin dejar ninguna capacidad instalada. Y son justo los que exigen re-verificación cada seis meses, para siempre.

**Opción 6-A — conservadora:** mantener los seis como están, refrescar datos y atar los años a `ANIO_REVISION`.
· Costo hoy: bajo · Costo recurrente: **alto y permanente**

**Opción 6-B — recomendada:** fusionar los dos documentales más podridos y liberar un slot para lo que la audiencia sí necesita.

| N | v2 | v3 propuesto |
|---|---|---|
| N31 | AGI | 🔵 igual — es conceptual, envejece bien |
| N32 | Robótica | 🔴 → **"Estudia con IA sin hacer trampa"** |
| N33 | Autos y drones | 🔴 → **"IA con cuerpo"** — absorbe robótica + movilidad en un solo nivel |
| N34 | Tu planeta | 🔵 igual |
| N35 | Tu salud | 🔵 igual |
| N36 | Tu misión | 🟢 igual |

**Por qué "Estudia con IA sin hacer trampa" es el mejor uso de un slot libre:**
- Es *el* caso de uso de la audiencia: 9–17 años, la IA ya está en sus tareas, con o sin curso
- El curso hoy no lo cubre en ningún lado — hay fragmentos sueltos, ningún nivel
- Integridad académica, IA como tutor que pregunta en vez de responder, verificar antes de entregar, cuándo NO usarla
- **No caduca.** Cero mantenimiento futuro
- Es lo que un padre de familia quiere ver en el entregable del mundo

Efecto colateral: el contenido documental de M6 se reduce a la mitad → la carga de verificación permanente también.

---

## 4. Coste total

| Bucket | Niveles | # |
|---|---|---|
| 🟢 Intacto | N1–N7, N9–N12, N27, N29, N30, N36 | 15 |
| 🔵 Barrido | N13, N14, N17, N25, N31, N34, N35 | 7 |
| 🟠 Renovación | N8, N16, N18, N20, N21, N22, N24, N26, N28 | 9 |
| 🔴 Reencuadre | N23, N32, N33 | 3 |
| ✅ Hecho | N15, N19 | 2 |

**15 de 36 niveles no se tocan.** El trabajo real se concentra en 12 (renovación + reencuadre) y está casi todo en M4.

**Evaluaciones:** las 7 se actualizan **al final**, después de sus niveles. Eval4 es la que más cambia (refleja la reconversión de M4). Eval6 tiene un P0 propio (`:71`, respuesta correcta que caduca sola).

---

## 5. Antes de escribir contenido: rondas de verificación

Regla vigente (`AUDIT-CONTENIDO.md` §9): **ningún dato volátil se escribe de memoria.** Mi conocimiento corta en enero de 2026 y los agregadores SEO se contradicen entre sí. Pendientes por ronda:

| Ronda | Qué verificar | Bloquea |
|---|---|---|
| **A** | Ajustes de personalización reales, producto por producto | N19–N23 — **el material nuevo** |
| **B** | Robótica y movilidad — §8.7 quedó sin verificar | N33 |
| **C** | Agentes: qué es real vs. marketing | N26 |
| **D** | Herramientas de imagen / no-code / datos | N13, N16, N17, N28 |

Fuente primaria por dato (centros de ayuda y documentación de producto, no comparativas), con `revisadoEn` + `fuente` en `aiLandscape.ts`.

> Sobre la ronda A: los centros de ayuda suelen ser accesibles aunque las salas de prensa bloqueen (`openai.com` devolvió 403 en la ronda anterior). Es la fuente correcta para features de configuración.

---

## 6. Orden de ejecución propuesto

| # | Paso | Por qué ahí |
|---|---|---|
| 1 | ✅ `aiLandscape.ts` | Hecho |
| 2 | Ronda de verificación **A** | Sin esto, el material nuevo se escribe de memoria |
| 3 | **N23** — Personaliza cualquier IA | Es el material nuevo. Define el vocabulario que usan N19–N22 |
| 4 | N19–N22 — configuración por producto | Bajan del modelo general |
| 5 | N8 + N18 | Datos puros, ya diagnosticados |
| 6 | N24 + N16 + N26 (ronda C, D) | |
| 7 | N32 — Estudia con IA sin hacer trampa | Si se aprueba 6-B |
| 8 | N33 (ronda B) | |
| 9 | Barridos 🔵 | Mecánico |
| 10 | Evaluaciones + `check-stale.mjs` | **Siempre al final** |

**Detalle módulo a módulo:** solo se especifica para los 3 slots reencuadrados (N23, N32, N33) y para los módulos de configuración de N19–N22. El resto son ediciones sobre estructura existente y no necesitan plano previo.

---

## 7. Decisiones abiertas

| # | Decisión | Recomendación |
|---|---|---|
| 1 | **M6: opción 6-A o 6-B** | **6-B** — libera el hueco más grande de la audiencia y corta mantenimiento permanente |
| 2 | **N23 se reconvierte a personalización** | Sí — es el slot de menor valor pedagógico actual |
| 3 | **Sora en N15** | Hoy quedan ~3 líneas en la intro (sin XP) que enseñan "las herramientas van y vienen". Se puede recortar a cero si prefieres que no aparezca ningún producto muerto |
| 4 | **Renombrar el mundo 4** | Opcional, barato |
| 5 | **Rango 9–17 años** | Fuera de alcance de esta versión, pero conviene anotarlo: un nivel que funciona a los 9 rara vez funciona a los 17 |
