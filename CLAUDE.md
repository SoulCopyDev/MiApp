# CLAUDE.md — AI Explorer

Referencia técnica completa del proyecto. Actualizar cuando cambien arquitectura, entidades, dependencias o convenciones.

## Contexto adicional (leer según tarea)

| Archivo | Cuándo leerlo |
|---|---|
| `.claude/description.md` | Onboarding, entender qué es el proyecto, decisiones de arquitectura |
| `.claude/standards.md` | Antes de escribir código — convenciones, patrones, compatibilidad web |
| `.claude/workflow.md` | Deploy, ramas, estado de auditoría, onboarding de colaboradores |
| `.claude/commands/new-level.md` | Generador autónomo de niveles (`/project:new-level ruta/spec.md`) |
| `.claude/commands/_nivel-template.md` | Template del spec file — copiar y rellenar para crear un nivel |

> Estos archivos son parte de la documentación viva. Actualizarlos proactivamente igual que este CLAUDE.md.

---

## Stack y versiones

| Tecnología | Versión |
|---|---|
| React Native | 0.81.5 |
| Expo | ~54.0.33 |
| React | 19.1.0 |
| TypeScript | ~5.9.2 |
| Zustand | ^5.0.12 |
| Expo Router | ~6.0.23 |
| React Navigation (stack + bottom-tabs) | ^7.x (peer dep de Expo Router) |
| AsyncStorage | 2.2.0 |
| expo-font | ~14.0.11 |
| babel-preset-expo | ~54.0.10 |
| @expo/vector-icons (MaterialIcons) | ^15.0.3 |
| @expo-google-fonts/plus-jakarta-sans | ^0.4.2 |
| react-native-web | ^0.21.0 |
| EAS CLI | >= 18.0.0 |

**Runtime:** Node 20+ (ver `.nvmrc`) + Expo Go / EAS Build. Sin backend. Sin APIs externas. 100% offline.
> `expo export --platform web` falla en Node 18 — `Array.toReversed()` no existe. Usar `nvm use 20`.

---

## Arquitectura

Monolito React Native. Una sola app. Sin microservicios, sin servidor.

```
MiApp/
├── app/                     # Expo Router — file-based routing
│   ├── _layout.tsx          # Raíz: fonts, web wrapper, Stack + DownloadBanner (web)
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab bar config (Inicio/Mapa/Trofeos/Configuración)
│   │   ├── index.tsx        # → HomeScreen
│   │   ├── map.tsx          # → MapScreen
│   │   ├── badges.tsx       # → BadgesScreen
│   │   └── settings.tsx     # → SettingsScreen
│   ├── world/
│   │   └── [worldId].tsx    # → WorldScreen (URL: /world/1)
│   ├── level/
│   │   └── [N].tsx       # → LevelScreen (URL: /level/7)
│   └── eval/
│       └── [worldId].tsx # → EvalScreen (URL: /eval/2 | /eval/final)
├── app.json                 # Config Expo (scheme: aiexplorer, web.output: spa)
├── babel.config.js          # babel-preset-expo
├── metro.config.js          # getDefaultConfig(__)
├── eas.json                 # EAS Build profiles (dev/preview/production)
├── assets/
│   ├── fonts/useFonts.ts    # Registro de fuentes
│   └── *.png                # Íconos y splash
└── src/
    ├── config/
    │   ├── avatarEmojis.ts  # Lista de emojis de avatar disponibles
    │   └── downloadConfig.ts # URLs de descarga de la app (APK, Play Store, App Store)
    ├── components/
    │   ├── WebSidebar.tsx   # Sidebar de navegación para desktop (solo web)
    │   └── DownloadBanner.tsx # Banner/card de descarga de app móvil (solo web)
    ├── hooks/
    │   ├── useCustomFonts.ts # Carga Plus Jakarta Sans
    │   ├── useBreakpoint.ts # Retorna 'mobile'|'tablet'|'desktop' según ancho
    │   └── useMobileDetect.ts # Detección UA (android/ios/desktop), PWA, localStorage dismiss
    ├── levels/
    │   ├── BaseLevel.tsx    # Componente base reutilizable (quiz de opción múltiple)
    │   ├── LevelScreen.tsx  # Dispatcher: N → Level{N} component
    │   ├── EvalScreen.tsx   # Dispatcher: worldId → Eval{W} | EvalFinal
    │   ├── Level{1-36}.tsx  # Niveles regulares (N1=World1/L1 … N36=World6/L6)
    │   └── eval/
    │       ├── Eval{1-6}.tsx   # Evaluaciones de mundo (N37-N42)
    │       └── EvalFinal.tsx   # Evaluación final (N43)
    ├── screens/
    │   ├── HomeScreen.tsx   # Tab Inicio: perfil, rango, misión diaria, botón JUGAR, botón descarga APK (web)
    │   ├── MapScreen.tsx    # Tab Mapa: lista de mundos con progreso
    │   ├── WorldScreen.tsx  # Stack: niveles de un mundo específico
    │   ├── BadgesScreen.tsx # Tab Trofeos: insignias y trofeos por nivel/mundo
    │   └── SettingsScreen.tsx # Tab Configuración: perfil, avatar, reset
    ├── store/
    │   └── gameStore.ts     # Store Zustand global (único store del proyecto)
    ├── theme/
    │   ├── colors.ts        # Design tokens de color
    │   ├── typography.ts    # Design tokens tipográficos
    │   └── index.ts         # Re-exporta colors + typography
    ├── types/
    │   └── navigation.ts    # Tipos legacy (usado solo como referencia)
    └── utils/
        ├── dailyMission.ts  # Generación/detección de misiones diarias (sin dependencia circular)
        ├── rankSystem.ts    # Sistema de rangos por estrellas (8 tiers)
        └── trophies.ts      # Construcción de grupos de trofeos por mundo
```

---

## Navegación (Expo Router)

Navegación basada en archivos en `app/`. Entry point: `expo-router/entry`.

**URLs web / deep links (`aiexplorer://`):**
- `/` → Inicio (HomeScreen)
- `/map` → Mapa (MapScreen)
- `/badges` → Trofeos (BadgesScreen)
- `/settings` → Configuración (SettingsScreen)
- `/world/[worldId]` → WorldScreen
- `/level/[N]` → LevelScreen (N=1–36, regular levels)
- `/eval/[worldId]` → EvalScreen (worldId=1–6 o `'final'`)

**Navegación programática:**
```ts
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { coordsToGlobalN } from '../store/gameStore';

router.push('/world/1');
router.push(`/level/${coordsToGlobalN(worldId, levelId)}`); // regular levels
router.push(`/eval/${worldId}`);                             // world eval
router.push('/eval/final');                                  // final eval
router.back();

// Leer params de ruta (devuelven string — convertir a número)
const { N } = useLocalSearchParams<{ N: string }>();
const n = Number(N);
const { worldId } = useLocalSearchParams<{ worldId: string }>();
```

---

## Estado global (Zustand)

**Archivo:** `src/store/gameStore.ts`
**Clave AsyncStorage:** `ai-explorer-storage-v2`
**Versión actual de migración:** `20`

### Entidades principales

```ts
type LevelStatus = 'locked' | 'current' | 'completed';

interface LevelProgress {
  id: number; name: string; icon: string;
  status: LevelStatus; stars: number;
}

interface World {
  id: number; name: string; icon: string;
  description: string; levels: LevelProgress[];
}

interface Badge {
  id: number; name: string; description: string;
  icon: string; unlocked: boolean; color: string; bgColor: string;
}

interface UserProfile {
  name: string; avatarEmoji: string; soundEnabled: boolean;
}

interface GameState {
  profile: UserProfile;
  playerLevel: number;
  currentXP: number;
  maxXP: number;
  streak: number;
  lastPlayedDate: string | null;  // 'YYYY-MM-DD' local
  totalStars: number;
  worlds: World[];
  badges: Badge[];
  dailyMission: DailyMission | null;
  devMode: boolean;
}
```

### Fórmulas clave

- **XP para subir nivel:** `1000 + (level - 1) * 500`
- **XP por nivel completado:** `50 + stars * 20`
- **Misión diaria reward XP:** `50 + offset * 25` (offset 2–5)

### Acciones disponibles

`setProfile` · `completeLevel(globalN, stars, xp)` · `unlockBadge` · `addXP` · `resetProgress` · `setDevMode` · `updateStreak` · `refreshDailyMission` · `updateLevelName` · `updateWorldName`

### Utilidades de numeración global (exportadas)

```ts
import { coordsToGlobalN } from '../store/gameStore';

// Mapping bidireccional (interno al store):
// N=1–36: worldId=ceil(N/6), levelId=N-(worldId-1)*6
// N=37–42: worldId=N-36, levelId=7 (eval de mundo)
// N=43: worldId=6, levelId=8 (eval final)
coordsToGlobalN(worldId, levelId): number
```

---

## Sistema de niveles

### BaseLevel.tsx

Componente genérico. Recibe `{ globalN, levelName, questions }`.

```ts
interface Question {
  question: string;
  options: string[];
  correct: number;      // índice de la opción correcta
  explanation?: string;
}
```

Flujo: pregunta → selección → feedback 1500ms → siguiente pregunta → resultado con estrellas → `completeLevel(globalN, ...)` → `router.back()`.

**Estrellas:** `floor((correctas / total) * 3)`

### Numeración continua N1–N43

| Rango | Tipo | Ruta |
|---|---|---|
| N1–N6 | World 1 regular | `/level/1` … `/level/6` |
| N7–N12 | World 2 regular | `/level/7` … `/level/12` |
| N13–N18 | World 3 regular | … |
| N19–N24 | World 4 regular | … |
| N25–N30 | World 5 regular | … |
| N31–N36 | World 6 regular | `/level/31` … `/level/36` |
| N37–N42 | Evaluaciones de mundo 1–6 | `/eval/1` … `/eval/6` |
| N43 | Evaluación Final | `/eval/final` |

### Agregar un nuevo nivel

1. Crear `src/levels/Level{N}.tsx` (siguiente N disponible) con su lógica o usando `BaseLevel`
2. Registrar en `LevelScreen.tsx` en `LEVEL_COMPONENTS`
3. Agregar entrada en `INITIAL_WORLDS` dentro de `gameStore.ts`
4. **Incrementar `version`** en el config de `persist` en `gameStore.ts`

### Agregar un nuevo mundo

1. Crear carpeta `src/levels/World{N}/` con sus Level{M}.tsx
2. Agregar world a `INITIAL_WORLDS` en `gameStore.ts`
3. Registrar todos sus niveles en `LevelScreen.tsx`
4. Agregar color scheme en `WORLD_COLORS` en `src/utils/trophies.ts`
5. **Incrementar `version`** en persist (la migración lo maneja automáticamente)

---

## Sistema de rangos

8 tiers basados en `totalStars` (máx teórico 126 = 42 niveles × 3 estrellas):

| Nivel | Nombre | Stars |
|---|---|---|
| 1 | Novato | 0–4 |
| 2 | Aprendiz | 5–14 |
| 3 | Explorador | 15–29 |
| 4 | Analista | 30–49 |
| 5 | Estratega | 50–74 |
| 6 | Experto IA | 75–99 |
| 7 | Maestro | 100–119 |
| 8 | Leyenda IA | 120+ |

---

## Sistema de insignias (15 badges)

Desbloqueadas automáticamente en `completeLevel()`. Condiciones mixtas: primer nivel, mundos completos, acumulación de estrellas, niveles específicos.

---

## Misión diaria

**Archivo:** `src/utils/dailyMission.ts` (sin imports del store — evita dependencia circular)

- Se genera una vez por día (fecha local 'YYYY-MM-DD')
- Objetivo: nivel 2–5 posiciones por delante del nivel actual del jugador
- Estado: `'pending' | 'in_progress' | 'completed'`
- Se detecta/actualiza en `HomeScreen` vía `useFocusEffect`

---

## Diseño (Design System)

**Fuente:** Plus Jakarta Sans (Regular, Bold, ExtraBold)
**Todos los estilos:** `StyleSheet.create` inline en cada archivo

```ts
// Usar siempre desde src/theme/
import { colors, typography } from '../theme';
```

Nunca usar colores o fontFamily hardcodeados fuera de `src/theme/`.

---

## Scripts

```bash
npm start          # expo start (dev, QR code)
npm run android    # expo run:android
npm run ios        # expo run:ios
npm run web        # expo start --web (dev server web)
npm run build:web  # expo export --platform web → genera dist/
npm run preview:web  # sirve dist/ localmente con npx serve
```

**EAS Builds:**
- `development` — cliente dev, distribución interna
- `preview` — APK, distribución interna
- `production` — App Bundle Android (Play Store)

---

## Web / PWA

### Compatibilidad web actual

La app usa Expo SDK 54 + Metro bundler para web. `npm run web` funciona. Compatibilidad:
- Zustand + AsyncStorage → localStorage en web ✅
- Expo Router + React Navigation v7 ✅
- MaterialIcons (SVG) ✅
- expo-font / Plus Jakarta Sans ✅
- `Alert.prompt` → `window.prompt` vía Platform.OS check ✅
- `Vibration.vibrate()` → guard `Platform.OS === 'android'` ✅

### Estructura PWA

```
public/                        # Expo copia este dir a dist/ en build:web
├── index.html                 # Template HTML con meta PWA + registro SW
├── manifest.json              # PWA manifest (name, icons, display:standalone)
├── service-worker.js          # SW: cache-first assets, network-first nav
├── icons/
│   ├── favicon.png            # 48x48
│   ├── icon-512.png           # 1024x1024 (sirve como 512 también)
│   └── qr-app.png             # QR code estático → https://mi-app-kappa-navy.vercel.app
└── downloads/
    └── ai-explorer.apk        # APK Android (72MB) — servido como asset estático
```

**Por qué `public/icons/`:** Metro hashea los nombres de assets en dist/. Los iconos en `public/` tienen rutas estables (`/icons/icon-512.png`), necesarias para el manifest.

**APK en `public/downloads/`:** se sirve directamente desde Vercel como `/downloads/ai-explorer.apk`. Al generar un nuevo APK, reemplazar el archivo y re-deployar.

### Service Worker

Estrategia:
- **Pre-cache en install:** `/` y `/index.html`
- **Navegación (SPA fallback):** network-first → offline sirve `/index.html`
- **Assets `/_expo/**`, scripts, fonts, imágenes:** stale-while-revalidate

Versión de caché: `ai-explorer-v1` — **incrementar al hacer deploy con cambios de assets**.

### Responsive web

`app/_layout.tsx` envuelve la app en `<View style={webRoot}>` solo en `Platform.OS === 'web'` (sin phone-frame — layouts responsivos manejados por cada pantalla).

El hook `src/hooks/useBreakpoint.ts` retorna `'mobile' | 'tablet' | 'desktop'` según `useWindowDimensions`. Breakpoints: mobile < 600px, tablet < 1024px, desktop ≥ 1024px.

Patrón estándar en pantallas:
```ts
const breakpoint = useBreakpoint();
const isWebDesktop = Platform.OS === 'web' && breakpoint !== 'mobile';
```

**Desktop:** sidebar lateral (`WebSidebar.tsx`) + tab bar oculto. Layouts en 2 columnas/grid. Activado en `app/(tabs)/_layout.tsx`.
**Mobile web:** tab bar visible, layouts idénticos a la app nativa.

### Deploy

```bash
npm run build:web   # output → dist/
# deploy dist/ a: Vercel, Netlify, S3+CloudFront
```

**Vercel:** `vercel.json` ya configurado en raíz — conectar repo, Vercel detecta config automáticamente.
**Netlify:** `public/_redirects` ya incluido → SPA routing funciona out-of-the-box.
**Manual (drag-and-drop):** subir carpeta `dist/` directamente a Vercel o Netlify.

**Node requerido en CI:** `.nvmrc` apunta a `20`. Vercel/Netlify leen `.nvmrc` automáticamente.

### Tamaño de bundle (referencia)
- JS bundle: ~3.1MB uncompressed / ~700KB gzip (esperado para RN web)
- Total dist: ~80MB (incluye APK de 72MB en `downloads/` + fuentes + bundle)
- Optimización futura (no urgente): alojar APK en GitHub Releases o CDN externo para reducir tamaño de deploy.

### Descarga de la app móvil

**Config:** `src/config/downloadConfig.ts`
```ts
export const DOWNLOAD_CONFIG = {
  apkUrl: '/downloads/ai-explorer.apk', // null si no hay APK
  playStoreUrl: null,   // reemplazar cuando se publique en Play Store
  appStoreUrl: null,    // reemplazar cuando se publique en App Store
  pwaDemoUrl: 'https://mi-app-kappa-navy.vercel.app',
};
```

**Componentes:**
- `DownloadBanner` (en `_layout.tsx`): aparece 2s después de cargar, se descarta via localStorage (`ai-explorer-download-dismissed`). No aparece en PWA standalone ni si ya fue descartado.
  - Android → botón "Descargar" / Play Store
  - iOS → App Store o "Próximamente"
  - Desktop → tarjeta flotante con QR + botones de tienda
- Botón en `HomeScreen`: botón verde fijo en pantalla Inicio, visible en toda la web (móvil y desktop). Solo aparece si hay `apkUrl` o `playStoreUrl` configurado.

**Para actualizar el APK:** reemplazar `public/downloads/ai-explorer.apk` y ejecutar `npm run build:web` + `vercel --prod`.

---

## Reglas del proyecto

### Convenciones estrictas

- **Estilos:** siempre `StyleSheet.create` en el mismo archivo. Nunca styles inline en JSX salvo valores dinámicos.
- **Colores/tipografía:** siempre desde `src/theme/`. Nunca hardcodear `#ffffff` o `fontFamily` directamente.
- **Zustand:** usar selectores granulares. No suscribir el estado completo (`useGameStore(s => s.worlds)`, no `useGameStore()`).
- **Niveles nuevos:** siempre incrementar `version` en `gameStore.ts` para disparar migración.
- **dailyMission.ts:** no importar nada de `gameStore.ts` (evita dependencia circular — usa tipos estructurales propios).
- **Fechas de racha:** usar `getLocalDate()` del store (hora local, no UTC).

### Sin tests

No hay test runner configurado. No agregar tests sin discutirlo antes.

### Sin backend

No existe servidor, API REST, GraphQL ni base de datos externa. Todo el estado vive en AsyncStorage del dispositivo.

### Migración del store

Antes de tocar `INITIAL_WORLDS` o `INITIAL_BADGES`, leer la función `migrate` en `gameStore.ts`. La migración sincroniza nombre/icono de mundos y niveles preservando el progreso del usuario. Al agregar campos nuevos a `GameState`, agregar inicialización defensiva en `migrate`.

---

## Mundos del curso

| ID | Nombre | Niveles |
|---|---|---|
| 1 | ¿Qué es la IA? | 7 |
| 2 | Domina el Prompting | 7 |
| 3 | IA Creativa | 7 |
| 4 | El Gran Torneo de Herramientas | 7 |
| 5 | Tu Proyecto de Impacto | 7 |
| 6 | El Futuro de la IA | 8 |

**Total: 42 niveles** — cada mundo termina con nivel "Evaluación" (World6 tiene además "Evaluación Final").

---

## ⚙️ Meta-regla para Claude Code (TODOS los colaboradores)

Esta sección aplica a **cualquier instancia de Claude** que trabaje en este proyecto.

### Documentación viva — actualización automática

Los siguientes archivos deben mantenerse sincronizados con el estado real del código. Actualizarlos **sin que el usuario tenga que pedirlo**, inmediatamente después de cualquier cambio relevante:

| Archivo | Actualizar cuando... |
|---|---|
| `CLAUDE.md` (este archivo) | Cambie stack, arquitectura, store, navegación, entidades |
| `.claude/description.md` | Cambie número de mundos/niveles, URLs, decisiones de arquitectura |
| `.claude/standards.md` | Se establezca un nuevo patrón o se invalide uno existente |
| `.claude/workflow.md` | Cambie deploy, ramas, estado de auditoría, scripts |

### Reglas de actualización

- **Cambio menor** (fix de typo, actualizar versión): hacerlo silenciosamente.
- **Cambio significativo** (nueva entidad, nuevo patrón, nueva convención): mencionarlo brevemente al usuario.
- **Nunca** dejar información desactualizada — un colaborador nuevo leerá estos archivos y necesita que sean precisos.

### Qué dispara actualización obligatoria

- Añadir / eliminar dependencias → actualizar tabla de stack en `CLAUDE.md`
- Crear / eliminar niveles o mundos → actualizar conteo en `CLAUDE.md` y `.claude/description.md`
- Nuevo patrón de código establecido → agregar a `.claude/standards.md`
- Cambio en proceso de deploy o ramas → actualizar `.claude/workflow.md`
- Issue de auditoría resuelto → marcar ✅ en `.claude/workflow.md`
- Cambio en estructura de carpetas → actualizar árbol en `CLAUDE.md`
