# Workflow de Equipo — AI Explorer

## Ramas

| Patrón | Uso |
|---|---|
| `main` | Producción. Todo merge aquí triggea deploy a Vercel. |
| `fix/[descripcion]` | Bugs, hotfixes, auditorías |
| `feat/[descripcion]` | Nuevas funcionalidades |

Flujo estándar: branch → commits → PR o merge directo a main → Vercel deploy automático.

## Deploy web

```bash
npm run build:web        # genera dist/ (requiere Node 20+)
vercel --prod            # deploy a producción
```

- URL producción: https://mi-app-kappa-navy.vercel.app
- `.nvmrc` apunta a Node 20 — Vercel lo lee automáticamente
- `vercel.json` ya configurado en raíz

## Build móvil (EAS)

```bash
eas build --profile preview --platform android    # APK para pruebas
eas build --profile production --platform android  # App Bundle para Play Store
```

Perfiles en `eas.json`: `development` / `preview` / `production`.

## Actualizar el APK de descarga

1. `eas build --profile preview --platform android`
2. Descargar APK del dashboard EAS
3. Reemplazar `public/downloads/ai-explorer.apk`
4. `npm run build:web && vercel --prod`

## Renumeración Opción B (2026-05-25) ✅ Ejecutado

Refactor completo de numeración continua N1–N43. Ver propuesta en `/Descargas/propuesta-renumeracion-niveles-IA-Explorer.md`.

**Cambios:** estructura plana `Level{1-36}.tsx` + `eval/Eval{1-6}.tsx` + `eval/EvalFinal.tsx`. Rutas `/level/[N]` y `/eval/[worldId]`. `completeLevel(globalN, stars, xp)`. `coordsToGlobalN()` exportada.

---

## Estado de auditoría

**Nomenclatura nueva:** N5 (antes M1·N5), N9 (antes M2·N3), N13 (antes M3·N1), etc.

| Issue | Estado | Detalle |
|---|---|---|
| AUDIT-PENDIENTES | ⏳ Pendiente | **Sin auditar a 2026-07-20: N35, N36, Eval5 (M5), Eval6 (M6) y EvalFinal.** Marcadores confirmados por inspección: `Level35.tsx` tiene 8 `Alert.alert`, `Level36.tsx` 4, `Eval6.tsx` 7 y `Eval5.tsx` 1 — feedback que **no se renderiza en web** (§16/§20); además ninguno navega al siguiente nivel con `router.replace` desde la pantalla final (§18/§28). Auditados: N1–N34 + Eval1–Eval4. |
| GLOBAL-01 | ✅ Resuelto | Botón ← Volver en pasos teóricos (THEORY_STEPS) en N1–N6 |
| GLOBAL-02 | ✅ Resuelto | resultBanner fuera de ScrollView, showResult sin andAdvance |
| GLOBAL-03 | ✅ Resuelto | Feedback inline ya implementado en N1/N2/N4/N6 (resultBanner/stepResult en N1·N2; condicionales ✅/❌ en N4; estados tipoFb/sortFb en N6). Los `Alert.alert` que quedan son solo confirmaciones de salida/back en modo examen, y ya tienen guard web (`Platform.OS==='web'` → `window.confirm`). |
| GLOBAL-04 | ✅ Resuelto | Toast "+N XP ✨" global — propagado a L1-L36 + Eval1-6 |
| GLOBAL-06 | ✅ Resuelto | allowBack declarado correctamente en LevelScreen |
| GLOBAL-07 | ✅ Resuelto | DevMode bypass en todas las funciones check de N1–N6 |
| EVAL-M1-01 | ✅ Resuelto | Eval1.tsx — evaluación final Mundo 1 (ex World1/Level7) |
| N3-01..11 | ✅ Resuelto | Auditoría de Level3 vs nivel-03.html (Mundo 1 · tema claro naranja, 18 módulos/hasta 200 XP). El nivel ya era un port fiel del HTML V2.0 (contenido, XP íntegro sin addXP al store + completeLevel al final, salida con exitLevel, feedback inline, flash de orden 2s, navega a /level/4). Fix v2.2: la correcta caía SIEMPRE en posición fija — DETECT_POOL y SPRINT_POOL todos con `correct:1`. Añadido `shuffleMCQ` (baraja opts + remapea índice) aplicado a detect/sprint/role; feedback del sprint sin referencia hardcodeada a "Prompt B" (usa el texto de la opción correcta). tsc limpio. |
| AUDIT-N12 | ✅ Resuelto | Level12 reconstruido 1:1 vs nivel-12.html (18 módulos, paleta, D&D, validaciones) |
| AUDIT-EVAL2 | ✅ Resuelto | Eval2 fiel a evaluacion-mundo-02.html (quiz completo+shuffle, builder 3 min, badge) |
| AUDIT-N13 | ✅ Resuelto | Level13 fiel a nivel-13.html (tema oscuro M3, 19 módulos/260 XP reales, D&D real, fix XP infinito/duplicado) |
| AUDIT-N14 | ✅ Resuelto | Level14 reconstruido vs nivel-14.html (tema oscuro TEAL propio, 19 módulos/265 XP reales, quiz shuffle+longitud, fix reset de quiz entre pasos y sprint bloqueado, validación de builders, sort con flash rojo) |
| AUDIT-N15 | ✅ Resuelto | Level15 reconstruido vs nivel-15.html (tema oscuro DORADO propio, 19 módulos/265 XP reales, fix nav que saltaba actividades, quiz shuffle+longitud, D&D con flash rojo + porqué, sprint con entrega anticipada, validación de builders/reflexiones) |
| AUDIT-N16 | ✅ Resuelto | Level16 reconstruido vs nivel-16.html (tema oscuro LIMA propio, 19 módulos/255 XP reales, fix XP duplicado (addXP al store durante el nivel), fix D&D que premiaba aunque fallaras y sort atascado sin reintento, ✕ de salida, quiz shuffle+longitud, sprint con entrega anticipada, validación de builders) |
| AUDIT-N17 | ✅ Resuelto | Level17 reconstruido vs nivel-17.html (tema oscuro ÍNDIGO propio, 19 módulos/270 XP reales; módulo de gráfica de barras + tabla de datos + D&D de 3 zonas con flash/porqué/reintento; quiz shuffle+longitud, feedback inline (matching/D&D ya no usan Alert), sprint con entrega anticipada, validación de builders, ✕ de salida, final a /level/18) |
| AUDIT-N18 | ✅ Resuelto | Level18 reconstruido vs nivel-18.html (tema oscuro FUCSIA propio, 19 módulos/265 XP reales; cierre del Mundo 3 con diagrama de flujo multimodal + insignia de mundo; fix XP duplicado (addXP al store), sort con reintento, D&D con porqué/reintento, ✕ de salida, quiz shuffle+longitud, sprint con entrega anticipada, validación de builders; final a /eval/3 (Evaluación del Mundo 3)). **Mundo 3 (N13–N18) completo.** |
| AUDIT-EVAL3 | ✅ Resuelto | Eval3 reconstruido vs eval-mundo3.html (tema oscuro degradado fucsia/púrpura, 5 partes/200 XP reales: quiz 15 + clasificador 8 + D&D 8→7 zonas + pipeline + reflexión sellada; feedback inline (sin Alert), quiz barajado+longitud, validación real de pipeline/reflexión, D&D con marcado por zona + porqué, anillo de puntaje, final a /level/19 (Mundo 4)). **Mundo 3 100% auditado (N13–N18 + Eval).** |
| GLOBAL-DRAG | ✅ Resuelto | Arrastre táctil inmediato en TODOS los drag&drop: shim `src/utils/touchDragShim.ts` (traduce touch→eventos HTML5 drag, sin long-press) instalado 1 vez en `app/_layout.tsx`. Conserva drag con mouse; tap-para-colocar sigue vivo. Global, sin tocar niveles. |
| AUDIT-N19 | ✅ Resuelto | Level19 reconstruido vs nivel-19.html (primer nivel M4 · tema CLARO verde/lima, 20 módulos/~195 XP; 3 mecánicas nuevas: Modo Detective, Constructor de Imagen DALL-E, Mi Sesión Perfecta; fix scoring por conteo real + XP escalonado (detective/ética/sesión/sprint), feedback inline (sin Alert), quiz+fill+sesión barajados, validación de reflexión, ✕ de salida, final a /level/20). Probados los 20 módulos en web. |
| AUDIT-EVAL4 | ✅ Resuelto | Eval4 (Evaluación Mundo 4 · El Gran Torneo de Herramientas · N40 · **tema OSCURO cyan** #000818/#ecfeff, 5 partes/máx 220 XP) **reconstruido** vs eval-mundo4.html. El TSX tenía header oscuro pero **cards de contenido en blanco** (`#fff`, texto `#0f172a`) → roto. Bugs corregidos: (1) **tema roto** → todo el contenido en tema oscuro cyan legible; (2) todo el feedback usaba `Alert.alert` (quiz/torneo/PC/toolkit/reflexión + BackHandler) → invisible en web, ahora barra global inline por parte + feedback por ítem con estado correcto/incorrecto/no-respondido; (3) **validación de texto solo por longitud** (toolkit `<80` chars, reflexión `<40` chars) → validación de contenido real §14 (looksRandom + countTools≥2 + mín. palabras en toolkit; looksRandom + mín. palabras + mentionsTopic en reflexión, con feedback que nombra lo que falta); (4) **longitud de opciones** — la correcta solía ser la más larga en el quiz → distractores alargados en las 25 preguntas (§15/27); (5) navegación final placeholder → completeLevel(40)+`router.replace('/level/25')` (Mundo 5, patrón Eval3→/level/19); (6) ✕ con confirmación (exitLevel). Quiz/torneo ya barajaban opciones (conservado). Probado end-to-end en web: 5 partes con feedback inline visible (quiz: correcto verde / incorrecto rojo + reveal / no-respondido ámbar; PC igual), toolkit y reflexión rechazan texto al azar/fuera de tema y aceptan contenido válido (+30/+20), pantalla final con anillo de puntaje e ir a /level/25. XP solo local durante la eval (store intacto, §26). **Mundo 4 100% auditado (N19–N24 + Eval).** |
| AUDIT-N24 | ✅ Resuelto | Level24 (¿Cuál Herramienta Uso? Elige como un Pro · **último nivel del Mundo 4** · **tema OSCURO violeta** #0a0418/#f5f3ff, primary #8b5cf6, 18 módulos/máx 235 XP) **reconstruido** vs nivel-24.html. El TSX previo era light (cards #f9fafb, texto #111827) sobre fondo oscuro `#0a0418` → **incoherente/roto**. Reescrito con la arquitectura de N23 (paleta violeta como constante, awardOnce, feedback inline). Bugs corregidos: (1) **tema roto** → paleta oscura violeta legible; (2) todo el feedback usaba `Alert.alert` (sprint, 2 quizzes, VF, BackHandler) → invisible en web, ahora inline; (3) **XP fantasma** — teoría "+10 XP" nunca otorgada + umbrales de estrellas pedían ≥200 (inalcanzable, máx real era ~80) → teoría otorgada 1 vez con awardOnce, máx real 235, umbrales 165/106 (~70%/45%); (4) conteo — tag decía "14 módulos", el HTML miente con "20", real **18** → label "Módulo X de 18"; (5) quizzes sin barajar → shuffleOpts (el HTML sí baraja); (6) **quiz maestro: la correcta era la más larga en las 3 preguntas** → distractores alargados (§15/27); (7) contenido "elecciones de México" → **Colombia** (fuente HTML) + teoría restaurada fiel; (8) nav final "Volver al mapa" → completeLevel(24)+`router.replace('/eval/4')` (Evaluación del Mundo 4, patrón N18→/eval/3); (9) ✕ de salida con exitLevel. Probado end-to-end en web: tema legible, sprint (6 verdes/4 rojos + solucionario inline), quiz árbol con reveal de la correcta en fallo, VF con plantilla "❌ Incorrecto. La respuesta correcta es…" en fallo, quiz maestro (correcta ya no es la más larga: 16 vs 21-23 palabras), pantalla final e ir a /eval/4. XP solo local durante el nivel (store intacto en 1011, §26). **Mundo 4 (N19–N24) completo.** |
| AUDIT-N23 | ✅ Resuelto | Level23 (El Ecosistema Completo · M4 **tema OSCURO cyan** #001018/#ecfeff, 19 módulos/máx ~240 XP) **reconstruido** vs nivel-23.html. Nivel distinto (Perplexity, Copilot, Meta AI, open source, IAs de recomendación, modelos locales, precios, mapa del ecosistema) con mecánicas propias: quiz de 1 pregunta, V/F, drag multi-zona (6/2/5 zonas) y **sprint cronometrado con inputs de texto**. Bugs corregidos: (1) **tema roto** — el TSX usaba texto oscuro (`colors.textPrimary`) sobre fondo `#001018` → teoría INVISIBLE; reescrito con paleta oscura cyan legible (texto #ecfeff/#7dd3fc); (2) feedback con `Alert.alert` en drag y sprint → invisible en web, ahora inline (drag con reveal de chips mal puestos en rojo + reintento, sprint con inputs coloreados); (3) **XP fantasma** — teoría mostraba "+10 XP" sin otorgarlo (§25), ahora otorgado una vez con awardOnce; (4) conteo (el HTML miente con "20", real 19 de contenido); (5) quiz barajado (shuffleOptions — el HTML sí baraja); (6) ✕ con confirmación; (7) nav final a /level/24 (antes exitLevel→mapa). Probado end-to-end en web: tema legible, quiz shuffle, drags multi-zona (6/2/5) con feedback inline, sprint con timer/resultados, XP del store sube 240 exacto (no duplicado), final a /level/24. |
| AUDIT-N22 | ✅ Resuelto | Level22 (Grok · M4 tema claro verde xAI #00ba7c + cards oscuras, 20 módulos/máx ~226 XP) **reconstruido** vs nivel-22.html. El TSX previo era más completo que N21 (no atrapaba en duro) pero **todo el feedback usaba `Alert.alert`** → invisible en web (el usuario verificaba y no veía nada). Reescrito render+lógica modelado sobre N21, conservando pools + estructura propia (3 escenarios "elige la herramienta" + word-builder) y restaurando el contenido teórico/casos fiel al HTML. Estándar v2.2: feedback inline en TODO (drag/match/sort/quiz/vf/fill/escenarios/word-builder/prompts — dos componentes nuevos ScenarioComponent y WordBuilderComponent con reveal correcto/incorrecto + explicación); quiz y fill barajados (shuffleOptions); prompt-compare A/B ya barajado (flip) conservado; XP solo local + completeLevel al final (§26); ✕ con confirmación; "Módulo X de 20"; THEORY_STEPS con lecturas; umbrales estrellas 155/100 (~70%/45% de 226); final a /level/23 (antes exitLevel→mapa); fix label del botón de matching ("Continuar →"). Probado end-to-end en web: todos los módulos avanzan con feedback inline visible, escenario (+10) y word-builder (+15) verificados, XP del store sube 114 exacto (no duplicado), final a /level/23. |
| AUDIT-N21 | ✅ Resuelto | Level21 (Gemini · M4 tema claro azul Google #1a73e8, 20 módulos/máx ~201 XP) **reconstruido** vs nivel-21.html. El TSX era una implementación delgada e INJUGABLE: (1) los drags (M3/M16) y el matching (M5) no tenían mecanismo de avance — el usuario quedaba ATRAPADO; (2) todo el feedback usaba `Alert.alert` (no renderiza en web). Reescrito render+lógica modelado sobre la arquitectura ya sólida de N20 (componentes compartidos), conservando las pools Gemini y restaurando el contenido teórico fiel al HTML (cards/highlights/step-lists ricos, ejemplos expandibles, VS grid, casos). Estándar v2.2: feedback inline en todo (drag retorna incorrectos, sort flash 2s, quiz/vf/fill/prompt muestran feedback antes de avanzar §16/§29), quiz+fill barajados (shuffleOpts), prompt-compare con A/B aleatorio + etiquetas neutras (§7), XP solo local + completeLevel al final (§26), ✕ de salida, "Módulo X de 20" (antes tag decía 19), THEORY_STEPS con lecturas 13/18/19, umbrales estrellas 140/90, final a /level/22 (antes exitLevel→mapa). Probado end-to-end en web: drags y matching AVANZAN (antes imposible), shuffles distribuidos, feedback inline visible, XP del store sube 189 exacto (no duplicado), final a /level/22. |
| AUDIT-N34 | ✅ Resuelto | Level34 (IA y Tu Planeta · M6 tema claro verde #15803d/#16a34a + cyan #0891b2, 19 módulos/máx **205 XP reales**) **reconstruido** vs nivel-34.html. Estructura verificada contra el `STEPS` real del HTML (20 entradas = intro + 19 módulos + completado): el intro del HTML lista 20 ítems (incluye una "✍️ Reflexión final" inexistente) y declara **230 XP** — ambos mienten (§21/§25); el conteo y la suma reales (3 reflexiones 14+16+18 · quiz M5 5×8 · quiz M18 6×8 · V/F M13 5×5 · 2 builders 22+22 = **205**) mandan en el intro, en todos los labels "Módulo X de 19" y en los umbrales de estrellas 145/92 (~70%/45%). Ignorados los handlers de drag/sort/compare/fill del motor genérico del HTML (líneas 400–1060) — este nivel no los usa. Estándar v2.2: feedback 100% inline (cero `Alert`); quizzes barajados con `shuffleOpts` y distractores alargados a longitud pareja (§15/27); V/F con formato §17 ("❌ Incorrecto. La respuesta correcta es …"); las 3 reflexiones validan CONTENIDO real (`looksRandom` + `containsTopic` con diccionario climático, "ia" como palabra completa) y no solo longitud (§14); `awardOnce` por step (§26) — XP solo local + `completeLevel(34, stars, xp)` al final, sin `addXP` al store; ✕ con `exitLevel()`; "Volver" solo en teoría/lecturas (1, 3, 4, 7, 8, 10, 11, 12, 14, 15, 17); tarjetas expandibles con estado abierto diferenciado (§2); final navega a `/level/35` (el HTML traía un `alert` placeholder, §18). `tsc --noEmit` limpio. Probado end-to-end en web ejercitando caminos de error (§29): reflexión rechaza texto al azar y texto fuera de tema y no otorga XP; volver a un módulo ya premiado NO reduplica XP; quiz revela la correcta en verde y marca la elegida en rojo; builder bloqueado hasta completar todas las filas; V/F puntúa por aciertos reales; recorrido completo 161 XP → pantalla final (lvl-bar 94%) → `/level/35`. Consola sin errores. |
| AUDIT-N33 | ✅ Resuelto | Level33 (IA en Movimiento: Autos y Drones · M6 tema claro azul #1d4ed8/#0ea5e9, 19 módulos, umbrales 185/120) reconstruido vs nivel-33.html según v2.2. Final a `/level/34`. Commit `9a5524c` (junto con N32). *Fila reconstruida desde la cabecera del TSX — el mensaje de commit original era de una línea.* |
| AUDIT-N32 | ✅ Resuelto | Level32 (Robótica e IA: El Cuerpo de la IA · M6 tema claro slate + naranja #475569/#ea580c, 19 módulos, umbrales 190/120) reconstruido vs nivel-32.html según v2.2. **Bug de contenido cruzado:** el TSX previo tenía el contenido de AGI, que corresponde a N31. Final a `/level/33`. Commit `9a5524c`. *Fila reconstruida desde la cabecera del TSX.* |
| AUDIT-N31 | ✅ Resuelto | Level31 (AGI: ¿Qué Pasaría si la IA Pensara Sola? · **inicio Mundo 6** · tema claro púrpura #5b21b6/#3b82f6, **18 módulos — el HTML dice 19 y miente (§21)**, umbrales 230/150) reconstruido vs nivel-31.html. **Bug de contenido cruzado:** el TSX previo tenía el contenido de Robótica (que es N32). Final a `/level/32`. Commit `135b355`. *Fila reconstruida desde la cabecera del TSX.* |
| AUDIT-N30 | ✅ Resuelto | Level30 (Presenta tu Proyecto · **cierre Mundo 5** · tema claro índigo #4338ca/#6366f1, **18 módulos — el HTML dice 19 y miente (§21)**, umbrales 230/150) reconstruido vs nivel-30.html según v2.2. Final a `/level/31`. Commit `ec5686c`, que además aplicó un cambio global al label inferior en todos los niveles y evals. *Fila reconstruida desde la cabecera del TSX.* |
| AUDIT-N29 | ✅ Resuelto | Level29 (Comparte tu Creación con el Mundo · M5 tema claro teal #0d9488/#14b8a6, 19 módulos, umbrales 230/150) reconstruido vs nivel-29.html según v2.2. Final a `/level/30`. Revisado en navegador. Commit `73ea387`. *Fila reconstruida desde la cabecera del TSX.* |
| AUDIT-N28 | ✅ Resuelto | Level28 (Diseña una App con IA — Sin Código · M5 tema claro violeta #7c3aed/#a855f7, **20 módulos de contenido: 19 numerados + reflexión final**, umbrales 230/145) reconstruido vs nivel-28.html según v2.2. Final a `/level/29`. Revisado en navegador. Commit `25071de`. *Fila reconstruida desde la cabecera del TSX.* |
| AUDIT-N27 | ✅ Resuelto | Level27 (Tu Idea para Cambiar Algo · M5 tema claro ámbar/oro #d97706/#f59e0b, 19 módulos, umbrales 200/125) reconstruido vs nivel-27.html. Mismos problemas que N25/N26: feedback 100% inline (fuera todos los `Alert.alert`); drag MVP-vs-grande que permite colocar en cualquier zona y valida solo al Verificar (§3); quizzes y V/F revelan correcta/incorrecta con explicación, distractores alargados y opciones barajadas; módulo de ordenar sin el número de orden en el texto (§6) y con flash rojo en los pasos mal puestos; 5 reflexiones con validación de contenido real (§14); `awardOnce` por paso y XP por desempeño real (§26); "Volver" solo en teoría (0, 1, 10, 17); pantalla final con lvl-bar 75% + skills + `/level/28`. Commit `af9c5c5`. |
| AUDIT-N26 | ✅ Resuelto | Level26 (Haz que la IA Trabaje Sola · M5 tema claro cyan/sky #0891b2/#0ea5e9, 19 módulos, umbrales 200/125) reconstruido vs nivel-26.html según v2.2. Final a `/level/27`. Commit `ebfda21`. *Fila reconstruida desde la cabecera del TSX — el mensaje de commit original era de una línea.* |
| AUDIT-N25 | ✅ Resuelto | Level25 (Crea tu Chatbot Personalizado · **primer nivel M5** · tema claro rosa/naranja, 19 módulos, umbrales 200/125) reconstruido vs nivel-25.html. Feedback 100% inline (fuera `Alert.alert` de matching/drag/quiz/escenario); drag que valida solo al Verificar y devuelve los chips incorrectos al banco con flash rojo (§3); conteo real 19 módulos (el intro decía 18, §21); quiz/V/F con reveal y explicación, distractores alargados y opciones barajadas; escenario que acepta las dos opciones válidas; compare con etiquetas neutras y orden A/B aleatorio (§7); reflexión con validación de contenido real (§14); `awardOnce` + XP por desempeño real (§26); final a `/level/26` (antes "Volver al mapa"). **Bug de correctitud hallado en la prueba web:** `evaluateSprint` leía el estado obsoleto de `sprintPicks` y contaba una regla de menos → premiaba mal y podía marcar la meta como no alcanzada aun con 6 aciertos; corregido con refs síncronos. Commit `99d6e6d`. |
| AUDIT-N20 | ✅ Resuelto | Level20 (Claude · M4 tema claro melocotón #da7756, 20 módulos/máx ~201 XP) auditado vs nivel-20.html. **Bugs críticos corregidos:** (1) los DOS drag&drop (M3 fortalezas/cuidados y M16 casos de uso) eran IMPOSIBLES de completar — `onDrop` guardaba el texto de display en vez del `colClass` semántico, el check nunca casaba y atrapaba al usuario (el nivel nunca se había probado); (2) XP DUPLICADO — `addXP` llamaba `addXPToStore` durante el nivel Y `completeLevel` al final (jugador recibía el doble); removido, solo completeLevel. **Otros fixes v2.2:** quiz y fill barajados (shuffleOpts — antes correct casi todo idx 1 / idx 0); prompt-compare con orden A/B aleatorio y etiquetas neutras hasta responder (§7); feedback inline ahora se muestra en quiz/vf/fill/prompt (antes chequeaba y avanzaba en un clic sin mostrarlo, §16/§29); ✕ de salida añadido (faltaba, §28); pantalla final navega a /level/21 (antes exitLevel→mapa); label "Módulo X de 20" (antes 21); THEORY_STEPS incluye módulos de solo-lectura 13/18/19; umbrales de estrellas 140/90 (~70%/45% de 201). Probado end-to-end en web: ambos drags avanzan (+20), XP del store sube 171 exacto (no duplicado), shuffles distribuidos, feedback inline visible, final a /level/21. |

## Scripts disponibles

```bash
npm start           # expo start (dev, QR)
npm run android     # expo run:android
npm run web         # expo start --web (dev server web)
npm run build:web   # expo export --platform web → dist/
npm run preview:web # sirve dist/ localmente
```

## Onboarding para nuevo colaborador

1. Leer `.claude/description.md` — qué es el proyecto
2. Leer `.claude/standards.md` — cómo escribir código
3. Leer `CLAUDE.md` (raíz) — referencia técnica completa (stack, store, arquitectura)
4. `npm install && npm run web` — verificar que corre
5. Activar DevMode en Configuración para probar niveles rápido

---

> **Meta-instrucción para Claude:** Actualizar este archivo cuando cambien el proceso de deploy, la estrategia de ramas, el estado de issues pendientes de auditoría, o se agreguen nuevos scripts relevantes.
