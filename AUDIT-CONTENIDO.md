# AUDIT-CONTENIDO — Inventario de obsolescencia

**Escaneo de código:** 2026-07-21 · **Verificación web del panorama:** 2026-07-22
**Learning path de referencia:** `Diagrama-de-flujo-detallado-LEARNING-PATH-v2.txt` (abril 2025)
**Alcance:** 43 niveles (`src/levels/Level{1-36}.tsx`, `src/levels/eval/*.tsx`) — 46.284 líneas
**Decisión vigente:** los HTMLs prototipo son fuente de verdad **solo de diseño/UX**. El contenido se actualiza en los `.tsx`.

> ⚠️ **Nada de la §8 debe copiarse al curso sin re-verificar.** El panorama se levantó con búsqueda web el 2026-07-22 y cada dato lleva su nivel de confianza. Los marcados 🟡 y 🔴 **no están confirmados** y no deben entrar al material tal cual.

---

## 1. Cómo leer este inventario

### Tipos de obsolescencia

| Tipo | Qué es | Arreglo |
|---|---|---|
| **A** | Nombre o versión de modelo/herramienta superada | Mecánico. Find-replace + revisión de concordancia |
| **B** | Hecho que caducó: cifra, capacidad, precio, límite, "lo que la IA aún no puede" | Requiere verificar el dato hoy y reescribir |
| **C** | Hueco conceptual: el path de abril no lo cubre | Contenido nuevo |

### Prioridades

| P | Criterio |
|---|---|
| **P0** | **La respuesta marcada como correcta es falsa hoy**, o el ejemplo central del módulo ya no existe |
| **P1** | Dato visible desactualizado que no rompe la lógica del ejercicio |
| **P2** | Cosmético |
| **OK** | **Falso positivo: hecho histórico fechado.** No tocar |

### Sobre los falsos positivos

De las 194 menciones a "2023/2024/2025", **la mayoría son OK**. Un hecho histórico con fecha explícita no caduca:

- `Level35:85` — "AlphaFold ganó el Nobel de Química 2024" → **OK, no tocar**
- `Level36:227` — "Hinton renunció a Google en 2023" → **OK**
- `Level5:79` — "ChatGPT alcanzó 100M de usuarios en enero-febrero 2023" → **OK**

**La regla:** el problema no es la fecha, es el **presente implícito**. `"Figure 02 desde 2024"` está bien. `"los robots humanoides actuales (2025-2026)"` está podrido. Aplicar esta regla elimina ~60% del ruido del escaneo antes de tocar código.

---

## 2. Resumen ejecutivo

| Cluster | Niveles | Estado | Esfuerzo |
|---|---|---|---|
| **Herramientas** | N19–N24, Eval4 | 🔴 Crítico — reescritura estructural | Alto |
| **Técnico LLM** | N8, N18 | 🔴 Crítico — tablas comparativas muertas | Medio |
| **Creativo** | N13–N17, Eval3 | 🔴 Crítico — **un producto central desapareció** | Alto |
| **Futuro** | N31–N36, Eval6 | 🟡 Medio — presente implícito | Medio |
| **Fundamentos** | N1–N7, N9–N12 | 🟢 Bajo — conceptual, no caduca | Bajo |
| **Ética / Proyecto** | N5, N25–N30, Eval1/2/5 | 🟢 Bajo — casos fechados | Bajo |

### Los tres hallazgos que definen el plan

1. **N19 y N8 no se arreglan con find-replace.** Su obsolescencia es estructural: la mecánica del nivel está construida sobre una distinción que ya no existe.
2. **N15 enseña Sora como frontera del video con IA. Sora fue discontinuado en abril de 2026** (§8.4). No es un dato viejo: el producto no existe.
3. **El curso no menciona agentes ni MCP**, que en 2026 son el eje de la industria (§8.6). El hueco Tipo C pasó de "deseable" a "notorio".

---

## 3. P0 — Rompen la corrección del ejercicio

### 🔴 N19 (`Level19.tsx`) — El nivel completo gira sobre "GPT-3.5 vs GPT-4o"

**Es la columna vertebral del nivel**, no una mención suelta. Cinco módulos dependen de esa dicotomía.

| Línea | Contenido | Problema |
|---|---|---|
| 659–687 | Módulo 4 completo: *"GPT-3.5 vs GPT-4o: ¿cuál usar?"* con tabla comparativa VS | Ambos nombres desaparecidos de la interfaz |
| 632–652 | Módulo *"Detective: ¿cuál es GPT-4o?"* | La mecánica entera identifica un modelo que ya no existe |
| 699–709 | Drag-drop con zonas literales `'⚡ GPT-3.5'` y `'GPT-4o'` | Las zonas de destino son nombres muertos |
| 135 | Fill-in-blank `'se llama GPT-'` → `['4o','3.5','5','Ultra']`, **correcta = '4o'** | **Respuesta correcta hoy falsa** |
| 593 | *"La versión gratuita (GPT-3.5 y algo de GPT-4o)... la de pago (Plus)"* | Tiers cambiados (§8.2) |
| 79, 112, 769 | *"DALL-E solo funciona con GPT-4o"* | Restricción que ya no aplica |
| 122–124, 149 | Quiz *"¿Qué ventaja tiene GPT-4o sobre GPT-3.5?"* | Pregunta sin referente |

**Lo que confirma la verificación:** el eje "gratis vs. pago" **sigue existiendo** — hoy sería *free* contra la familia de pago (§8.2) — pero los nombres cambiaron dos veces en 14 meses. Reescribir con los nombres de julio de 2026 garantiza repetir este documento en enero.

**Recomendación:** reencuadrar el eje a **"modelo rápido vs. modelo que razona"**, una distinción que sobrevivió a todos los renombramientos y que hoy es más visible que nunca (modos de razonamiento extendido en las cuatro plataformas). Los nombres concretos entran vía `aiLandscape.ts`, no en el texto de los módulos. Es el ítem más caro del inventario y el de mayor retorno.

### 🔴 N15 (`Level15.tsx`) — Sora ya no existe

Escalado de P1 a **P0** tras la verificación. Confirmado en el centro de ayuda de OpenAI (§8.4): app discontinuada el **26 de abril de 2026**, API el **24 de septiembre de 2026**.

| Línea | Contenido | Problema |
|---|---|---|
| 571 | *"En 2023 el mundo se quedó sin palabras cuando OpenAI mostró **Sora**"* | Presentado como estado del arte del video generativo |
| — | Módulo 2 del path: matching *"Sora, Runway, Pika → empresa/fortaleza"* | Una de las tres opciones es un producto muerto |
| — | Módulo 16: *"Límites actuales: lo que la IA de video aún no puede hacer bien"* | **El tipo de afirmación que peor envejece.** Verificar límite por límite contra §8.4 |

**Nota pedagógica:** la muerte de Sora es, en sí misma, mejor material que el que reemplaza. Un producto de OpenAI con un acuerdo de mil millones con Disney cerrado por economía unitaria enseña algo que ningún módulo del curso enseña hoy: **las herramientas van y vienen; el criterio para elegirlas es lo que permanece.** Encaja con el objetivo declarado de Eval4 (`:90`): *"saber elegir la herramienta correcta según la tarea: el criterio sirve aunque cambien las herramientas"*. Vale la pena considerarlo como reencuadre de N15 en vez de sustituir un nombre por otro.

### 🔴 N8 (`Level8.tsx`) — Tabla comparativa y cifras técnicas

| Línea | Contenido | Tipo |
|---|---|---|
| 808–811 | Tabla: `GPT-4o 128K` / `Claude 3.5 200K` / `Gemini 1.5 1M` / `Grok 2 128K` | **B — las 4 filas muertas**, modelo y ventana |
| 129 | *"la ventana de contexto de GPT-4 estándar es 8.192 tokens... GPT-4-32k... GPT-4 Turbo 128.000"* | **B — P0**, taxonomía inexistente |
| 576 | *"GPT-4 cobra ~$0.03 por cada 1.000 tokens de entrada"* | **B — P0**, precio muy desactualizado a la baja |
| 579 | *"GPT-4 tiene ventana de 128.000 tokens... Claude hasta..."* | **B** |
| 157–161 | Quiz *"Gemini superó a GPT-4 en benchmarks"* | **B** — el punto pedagógico (desconfiar de afirmaciones absolutas) **sigue perfecto**; solo cambian los nombres |
| 68 | *"GPT-4o ve imágenes... Gemini analiza videos... Claude..."* | **A** |

**El concepto de N8 no caduca** — tokens, ventana de contexto, temperatura, alucinaciones. Solo caducan los números. Es el candidato ideal para estrenar `aiLandscape.ts`: si la tabla se alimenta de la capa de contenido, el próximo refresco es una línea.

### 🔴 N18 (`Level18.tsx`) — Multimodalidad anclada a GPT-4o

| Línea | Contenido | Tipo |
|---|---|---|
| 110–113 | Matching `GPT-4o` / `Gemini 2.0` / `Claude 3.5` / `Grok 2` → fortaleza | **A + B**, los 4 pares desactualizados |
| 573 | *"los modelos más avanzados como GPT-4o, Gemini 2.0 y Claude 3.5"* | **A** — presente implícito |
| 594–597 | Módulo sobre el lanzamiento de GPT-4o (mayo 2024) y su latencia | **OK como hecho histórico**, pero está presentado como frontera |
| 72–80, 128 | Quiz sobre Voice Mode | **A** |
| 757–760 | Be My Eyes + GPT-4o | **A** — el caso sigue vigente, cambia el modelo |

### 🔴 Eval4 (`eval/Eval4.tsx`)

| Línea | Contenido | Tipo |
|---|---|---|
| 93 | Correcta: *"Acceso a GPT-4o, generación de imágenes, modo de voz avanzado"* | **P0** — describe un tier inexistente |
| 83 | *"Copilot es GPT-4 de OpenAI integrado en Office"* | **A** |
| 86 | *"Perplexity tiene plan gratis, Claude..."* | **B** — planes cambiados (§8.2) |
| 139–143 | Prompt-compare: *"medallas de Colombia en París 2024"* con *"ChatGPT (versión gratis, datos 2023)"* respondiendo que no sabe | **P0 — el ejercicio ya no reproduce.** El punto (fecha de corte vs. búsqueda web) sigue siendo válido, pero el modelo gratuito de hoy tiene búsqueda web y contestaría bien |

> ⚠️ **Las evaluaciones se actualizan al final**, después de sus niveles, o se reescriben dos veces.

---

## 4. P1 — Desactualizado pero no rompe la lógica

### Cluster Herramientas (N20–N24)

| Ubicación | Contenido | Tipo |
|---|---|---|
| `Level21.tsx` (18 hits) | Nivel Gemini — versiones y capacidades | A — Gemini saltó de 2.0 a la familia 3.x (§8.3) |
| `Level22.tsx` (8 hits) | Nivel Grok — `Grok 2`, integración con X | A |
| `Level23:50,68,107,195` | *"Llama 3 8B corre en una laptop"*, Ollama, LM Studio | A — el argumento (IA local, privada, gratis) sigue vigente y **se fortaleció** (§8.6) |
| `Level23:196` | *"los modelos locales responden con menos inteligencia que GPT-4 o Claude"* | **B** — la brecha se estrechó; verificar antes de repetir |
| `Level23:138` | *"Microsoft pagó 13 mil millones a OpenAI para meter GPT-4 en Office"* | A — hecho histórico, modelo integrado cambiado |
| `Level23:159` | *"Siri conectada a ChatGPT desde 2024"* | B — verificar estado actual |
| `Level24:317` | *"el kit óptimo para un estudiante de 12-15 años hoy en día"* | **B — presente implícito.** Es la recomendación de herramientas del curso: revisar entera |

### Cluster Creativo (N13–N17)

| Ubicación | Contenido | Tipo |
|---|---|---|
| `Level15` | **Ver §3 — P0** | — |
| `Level15:191,759` | SAG-AFTRA 2023, huelga de actores | OK histórico |
| `Level15:174,643` | Washed Out 2024, comercial de Coca-Cola 2024 | OK histórico |
| `Level13` | Imagen: DALL-E, Midjourney | A — el campo se pobló mucho (§8.4) |
| `Level14` | Audio: ElevenLabs, Suno, Udio | A — **los tres siguen vivos y son líderes**, pero con capacidades y licenciamiento muy distintos (§8.5). Actualización de datos, no de estructura |
| `Level16` | No-code: Lovable / Bolt / Bubble / Framer | A + C — la categoría se transformó con los agentes de código (§8.6) |
| `Level17` | NotebookLM y análisis de datos | A — capacidades ampliadas |

### Cluster Futuro (N31–N36) — el patrón es "presente implícito"

Casi sin errores factuales; con **marcos temporales que se quedaron atrás**. Casi todo es `"(2025-2026)"` usado como *ahora*.

| Ubicación | Contenido |
|---|---|
| `Level32:82` | *"Limitación más grande de los robots humanoides actuales (2025-2026)"* — correcta: la batería |
| `Level32:447,457,548,623` | *"el estado del arte en 2025-2026"*, *"¿cuál enfoque domina en 2025-2026?"* |
| `Level32:164–166` | Figure 02, Optimus, Unitree H1 — **datos de 2024 presentados como actuales.** La escala cambió (§8.7) |
| `Level33:166,173,178,180` | *"Wing busca expandirse a LATAM en 2025-2026"*, *"desde 2025-2026"* — **predicciones de abril cuya fecha ya pasó: hay que decir qué ocurrió** |
| `Level33:500,510` | *"estado real de la movilidad autónoma 2025-2026"* |
| `Level34:136` | *"GPT-5 y modelos mayores consumirán órdenes de magnitud más"* — futuro que ya es presente |
| `Level34:396` | *"tecnologías que ya salvan vidas en 2025-2026"* |
| `Level35:148,214` | *"3 casos reales que ya operan en 2025-2026"*, *"Estado real 2024-2025"* |
| `Level31:71` | *"ChatGPT / Claude / Gemini (2025-2026)"* como etiqueta de "IA generalista actual" |
| `Level31:79` | *"GPT-4 ya engaña a ~50% de evaluadores"* (Test de Turing) | A + B |
| `Level31:102` | *"AGI antes de 2030"* / encuestas AI Impacts 2023, mediana ~2047 | verificar encuestas recientes |
| `Eval6:71` | *"Las herramientas líderes de imagen con IA en 2025-2026 son..."* | **P0** — respuesta correcta que caduca sola |
| `Eval6:83,106` | *"El no-code de 2023-2026"*, *"Revolución 2023-2026"* | B |

**Arreglo para todo el cluster:** sustituir el rango de años pegado al texto por una constante única (`AÑO_REVISION` en `aiLandscape.ts`). Hoy son ~40 ediciones dispersas; después, una línea.

### Cluster Fundamentos y Ética — casi limpio

| Ubicación | Contenido | Veredicto |
|---|---|---|
| `Level5:77–84` | Fake Detector: 8 titulares fechados con fuente | **OK — el módulo mejor envejecido del curso.** Modelo a imitar |
| `Level5:580–583` | Casos: abogado 2023, deepfakes LATAM, arrestos falsos | **OK** |
| `Level5:686` | *"quién puede hacerla mejor hoy en 2025"* | **B** — único ítem real de N5 |
| `Level1`–`Level3`, `Level6`, `Level7`, `Level9`–`Level12` | 1–2 hits cada uno, casi todos históricos | **Solo pasada de versiones** |

**Confirma la hipótesis:** N1–N12 (menos N8) están sanos. Tokens, ingredientes del prompt, few-shot, CoT, roles, sesgo, ética — nada caduca. **La podredumbre se concentra donde el contenido nombra productos.**

---

## 5. Tipo C — Huecos conceptuales

La verificación **subió la urgencia** de esta sección. Ya no es "contenido deseable": es una ausencia visible en un curso de IA de 2026.

| Hueco | Por qué importa ahora | Dónde encajaría |
|---|---|---|
| **Agentes autónomos** | El eje declarado de la industria en 2026 (§8.6). Un curso de IA que solo enseña "pedir y recibir" describe la IA de 2023 | Mundo nuevo, o reencuadre de M5 (Proyecto) |
| **Razonamiento extendido** | Es la distinción real que ve un usuario hoy al elegir modelo | **Eje de reemplazo para N19** |
| **Conexión a herramientas / MCP** | Estándar de facto de la industria (§8.6) | M2 o M4 |
| **Computer use** | La IA que opera la interfaz | M4 |
| **IA local madura** | N23 lo toca de refilón; la brecha con la nube se estrechó | Ampliar N23 |

**Nota estructural:** el path v2 asume 6 niveles por mundo. Añadir Tipo C implica **v3 del learning path + migración del store** (`version` en `gameStore.ts`). No es un añadido menor.

---

## 6. Plan de ejecución

**Fase 0 cerrada.** Antes de tocar código, dos decisiones:

1. **Validar los P0** (§3) — ~18 ítems concretos.
2. **Decidir sobre N19 y N15.** Son las dos bifurcaciones caras: parche cosmético (barato, se vuelve a pudrir) vs. reencuadre a un eje estable (más caro una vez).

| Paso | Qué | Por qué en ese orden |
|---|---|---|
| 1 | ✅ **HECHO** — `src/content/aiLandscape.ts` + `ANIO_REVISION` | Todo lo demás importa de aquí |
| 2 | N8 + N18 | Datos puros, sin rediseño. Siguiente paso |
| 3 | ✅ **HECHO** — N19 (rediseño de eje → "rápido vs. razonando") | El más caro |
| 4 | ✅ **HECHO** — N15 (Sora → arco completo: asombró y cerró) | El reencuadre es el mismo argumento |
| 5 | N20–N24 | Siguen el patrón de N19 |
| 6 | N13, N14, N16, N17 | Cluster creativo restante |
| 7 | N31–N36 | Mayormente `AÑO_REVISION` + predicciones cumplidas |
| 8 | N1–N7, N9–N12 | Barrido de versiones |
| 9 | Eval1–6 + EvalFinal | **Al final siempre** |
| 10 | `scripts/check-stale.mjs` | Impide que se repita en silencio |

**Regla de trabajo para Fase 2:** cada dato de reemplazo se **busca y se cita en el momento**, con su fecha en `revisadoEn`. Ninguno se escribe de memoria — ver §9.

---

## 7. Limitaciones del escaneo de código

- **Es un escaneo por términos, no una lectura completa.** Detecta lo que *nombra* un modelo, herramienta o año. Un dato obsoleto que no mencione ninguno de esos términos —una capacidad descrita sin nombrar el producto, un "esto todavía no es posible"— **no aparece aquí**. Cada nivel necesita lectura dirigida en su turno.
- **Los conteos por archivo son coincidencias de términos**, no defectos. Incluyen los falsos positivos históricos de §1.
- **`src/screens/`, `src/store/`, `src/utils/` y `src/components/` están limpios** — verificado: cero menciones. Toda la obsolescencia vive en `src/levels/`.

---

## 8. Panorama verificado — 2026-07-22

Levantado con búsqueda web el 2026-07-22. **Sirve para dimensionar el trabajo, no como fuente de contenido.**

### 8.1 Niveles de confianza

| | Criterio |
|---|---|
| 🟢 | Confirmado en fuente primaria o prensa tecnológica establecida |
| 🟡 | Solo en agregadores/blogs SEO. Plausible, **sin confirmar** |
| 🔴 | Fuentes en conflicto directo entre sí |

**Advertencia sobre la calidad de las fuentes.** La mayoría de resultados fueron blogs SEO de comparativas, y **se contradicen entre sí en los datos más básicos**. Tres búsquedas distintas dieron tres respuestas distintas sobre qué modelo usa ChatGPT gratis. Los buscadores están saturados de contenido generado para posicionar, no para informar. **Para Fase 2 hay que ir a fuentes primarias** (blogs oficiales de cada laboratorio, documentación de producto), no a comparativas.

### 8.2 Modelos de lenguaje

| Dato | Confianza |
|---|---|
| **Anthropic — Claude Sonnet 5**, lanzado 30 jun 2026, default para Free y Pro | 🟢 Primaria (newsroom de Anthropic) |
| **Anthropic — familias: Mythos, Fable, Opus, Sonnet, Haiku** | 🟢 Primaria |
| **Claude Opus 4.8** — modelo de codificación de referencia | 🟡 |
| **OpenAI — familia GPT-5.6**: *Sol* (frontera), *Terra* (medio), *Luna* (rápido), + modo *Ultra* | 🟡 **openai.com devolvió 403; sin confirmar en primaria** |
| **OpenAI — free = GPT-5.5 Instant** desde 5 may 2026 | 🔴 Tres fuentes dan GPT-5.2, GPT-5.5 y GPT-5.6 |
| **Google — Gemini 3** (Pro + DeepThink) desde nov 2025; **Gemini 3.6 Flash** el 21 jul 2026; Gemini 4 en preentrenamiento | 🟢 TechCrunch, CNBC, 9to5Google |
| **Gemini 3.5 Pro** retrasado, en pruebas con socios | 🟢 TechCrunch |
| **xAI — Grok 4.3** | 🟡 |
| Suscripciones: ~$20/mes estándar; tiers altos $100–$300/mes | 🟡 Consistente entre agregadores |

**Implicación para N19:** entre abril de 2025 y julio de 2026, OpenAI renombró su línea al menos dos veces y Google publicó cuatro versiones de Gemini. **Cualquier nivel construido sobre nombres de versión se pudre en meses.** Es el argumento más fuerte a favor del reencuadre.

### 8.3 Lo que cambió desde el corte de conocimiento (enero 2026)

Mi conocimiento llega a **enero de 2026**; hoy es **22 de julio de 2026**. Seis meses ciegos. Lo relevante ocurrido en ese hueco, según la verificación:

- Discontinuación de Sora (marzo–abril) 🟢
- Claude Sonnet 5 (junio) 🟢
- Familia GPT-5.6 (junio–julio) 🟡
- Gemini 3.6 Flash (julio) 🟢
- Consolidación de agentes y MCP como estándar 🟡

### 8.4 Video e imagen

| Dato | Confianza |
|---|---|
| **Sora discontinuado**: app el 26 abr 2026, API el 24 sep 2026. Anuncio 24 mar 2026 | 🟢 Centro de ayuda de OpenAI |
| Motivo: ~$1M/día de costo operativo frente a $2,1M de ingresos *totales*; giro estratégico hacia agentes y robótica | 🟡 |
| Acuerdo de Disney (~$1.000M) cancelado con el producto | 🟡 |
| Líderes de video: **Veo 3.1** (Google), **Kling 3.0**, **Runway Gen-4.5** | 🟡 |
| Audio nativo sincronizado = estándar de la categoría | 🟡 |
| Imagen: Midjourney, ChatGPT Images, Flux, Ideogram, Firefly siguen vigentes | 🟡 |

> El dato de Sora es el único de esta subsección con respaldo primario — y es justo el que obliga a rediseñar N15.

### 8.5 Audio y música

| Dato | Confianza |
|---|---|
| **Suno v5.5** (26 mar 2026) — líder de mercado | 🟡 |
| **Udio** — descargas pausadas hasta el lanzamiento de su plataforma co-licenciada con UMG | 🟡 |
| **ElevenLabs / ElevenMusic** (abr 2026) — voz, música y efectos unificados; entrenado con datos licenciados | 🟡 |
| **Stable Audio 3** (20 may 2026) — pesos abiertos, corre en un portátil | 🟡 |

**Buena noticia para N14:** las tres herramientas del nivel (ElevenLabs, Suno, Udio) siguen siendo las relevantes. Es actualización de datos, no rediseño. **Pero el ángulo de licenciamiento y copyright cambió sustancialmente** y el nivel ya toca ética del audio — hay material nuevo que encaja sin tocar la estructura.

### 8.6 Agentes, MCP y código

| Dato | Confianza |
|---|---|
| **MCP como estándar de facto**, gobernanza bajo la Linux Foundation, integrado en las plataformas mayores | 🟡 |
| >10.000 servidores MCP publicados; ~97M de descargas mensuales de SDK (mar 2026) | 🟡 |
| Gartner: 40% de las aplicaciones empresariales con agentes a fines de 2026 (desde <5% en 2025) | 🟡 |
| Agentes de navegador / computer use convergiendo entre plataformas | 🟡 |
| IDEs con IA (Cursor, Zed, CLIs de agentes) como categoría consolidada | 🟡 |
| Modelos pequeños abaratando la inferencia | 🟡 |

**Todo 🟡** — son cifras de blogs de marketing y hay que tratarlas con escepticismo. Pero la **dirección** es consistente en todas las fuentes, y eso basta para concluir que el hueco Tipo C es real. Las cifras concretas no deben entrar al curso sin fuente primaria.

### 8.7 Robótica y movilidad (M6)

| Dato | Confianza |
|---|---|
| Tesla Optimus en AWE 2026 (Shanghái); producción en Fremont; objetivo declarado de escala millonaria | 🟡 |
| Nueva mano de Optimus: 25 actuadores por mano | 🟡 |
| Robotaxi de Tesla operando en Miami (jul 2026); expansión a Las Vegas, Phoenix, Orlando, Tampa, Dallas, Houston | 🟡 |
| Waymo: sin datos de expansión 2026 en esta ronda | ❔ **No verificado** |
| Figure AI: sin datos de 2026 en esta ronda | ❔ **No verificado** |

**M6 necesita su propia ronda de verificación.** Esta búsqueda se orientó a modelos de lenguaje; robótica y movilidad quedaron con cobertura parcial. Las afirmaciones de N32–N33 sobre "el estado del arte 2025-2026" no pueden reescribirse con lo levantado aquí.

---

## 9. Regla permanente sobre datos

El origen de este problema no fue descuido: fue **escribir datos volátiles sin fecha ni fuente**. La corrección estructural es tan importante como el contenido.

1. **Todo dato volátil vive en `aiLandscape.ts`**, nunca inline en un módulo.
2. **Todo dato lleva `revisadoEn` y `fuente`.** Sin fuente, no entra.
3. **Ningún dato se escribe de memoria** — ni la mía (corte en enero de 2026) ni la de un agregador SEO. Fuente primaria o no entra.
4. **`check-stale.mjs` avisa** cuando un `revisadoEn` supera los 6 meses, y falla si aparece un nombre de modelo fuera de la capa de contenido.
5. **Preferir ejes que no caduquen.** "Rápido vs. razonador" sobrevive a los renombramientos; "GPT-3.5 vs GPT-4o" duró 14 meses.

---

## Fuentes de la verificación (2026-07-22)

**Primarias**
- [Anthropic — Newsroom](https://www.anthropic.com/news)
- [OpenAI Help Center — What to know about the Sora discontinuation](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation)

**Prensa tecnológica**
- [TechCrunch — Google releases three new Gemini models, but no 3.5 Pro](https://techcrunch.com/2026/07/21/google-releases-three-new-gemini-models-but-no-3-5-pro/)
- [CNBC — Google expands Gemini lineup with cheaper models](https://www.cnbc.com/2026/07/21/google-gemini-flash-ai-mythos-rival.html)
- [9to5Google — Gemini 3.6 Flash launch](https://9to5google.com/2026/07/21/gemini-3-6-flash-launch/)
- [Wikipedia — Gemini 3](https://en.wikipedia.org/wiki/Gemini_3_(AI))

**Agregadores (🟡 — usar solo para dimensionar)**
- [llm-stats — AI Updates Today](https://llm-stats.com/llm-updates)
- [ThursdAI — July 2026 releases](https://thursdai.news/releases/2026-07)
- [Fello AI — Best AI Models](https://felloai.com/best-ai-models/)
- [Futurum Group — OpenAI Sora discontinuation](https://futurumgroup.com/insights/openai-sora-discontinuation-what-the-end-of-a-platform-means-for-enterprise-ai-strategy/)
- [AI Magicx — Suno vs Udio vs ElevenLabs 2026](https://www.aimagicx.com/blog/suno-vs-udio-vs-elevenlabs-music-comparison-2026)
- [Firecrawl — Agentic AI trends](https://www.firecrawl.dev/blog/agentic-ai-trends)
- [The Robot Report — Tesla targets 10M Optimus units](https://www.therobotreport.com/from-evs-to-robotics-tesla-targets-10m-optimus-units-with-new-texas-plant/)
