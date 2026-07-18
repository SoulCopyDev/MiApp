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
