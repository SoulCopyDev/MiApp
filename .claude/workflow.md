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

## Estado de auditoría (Mundo 1)

Rama: `fix/auditoria`

| Issue | Estado | Detalle |
|---|---|---|
| GLOBAL-01 | ✅ Resuelto | Botón ← Volver en pasos teóricos (THEORY_STEPS) en L1–L6 |
| GLOBAL-02 | ✅ Resuelto | resultBanner fuera de ScrollView, showResult sin andAdvance |
| GLOBAL-03 | ⏳ Pendiente | Alert.alert → feedback inline en respuestas incorrectas (L1/L2/L4/L6) |
| GLOBAL-04 | ⏳ Pendiente | Toast "+N XP ✨" global al completar ejercicios |
| GLOBAL-06 | ✅ Resuelto | allowBack declarado correctamente en LevelScreen |
| GLOBAL-07 | ✅ Resuelto | DevMode bypass en todas las funciones check de L1–L6 |
| EVAL-M1-01 | ✅ Resuelto | World1/Level7.tsx — evaluación final Mundo 1 |
| N3-01..11 | ⏳ Pendiente | Restauración de contenido — requiere HTML prototipos |

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
