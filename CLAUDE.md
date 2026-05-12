# CLAUDE.md — AI Explorer

Memoria técnica viva del proyecto. Actualizar cuando cambien arquitectura, entidades, dependencias o convenciones.

---

## Stack y versiones

| Tecnología | Versión |
|---|---|
| React Native | 0.81.5 |
| Expo | ~54.0.33 |
| React | 19.1.0 |
| TypeScript | ~5.9.2 |
| Zustand | ^5.0.12 |
| React Navigation (stack + bottom-tabs) | ^7.x |
| AsyncStorage | 2.2.0 |
| expo-font | ~14.0.11 |
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
├── App.tsx                  # Raíz: NavigationContainer + Stack + Tab navigators
├── index.ts                 # Entry point Expo
├── app.json                 # Config Expo (package: com.miapp.aiexplorer, newArch: true)
├── eas.json                 # EAS Build profiles (dev/preview/production)
├── assets/
│   ├── fonts/useFonts.ts    # Registro de fuentes
│   └── *.png                # Íconos y splash
└── src/
    ├── config/
    │   └── avatarEmojis.ts  # Lista de emojis de avatar disponibles
    ├── hooks/
    │   └── useCustomFonts.ts # Carga Plus Jakarta Sans
    ├── levels/
    │   ├── BaseLevel.tsx    # Componente base reutilizable (quiz de opción múltiple)
    │   ├── LevelScreen.tsx  # Router: worldId+levelId → componente estático
    │   ├── World1/Level{1-6}.tsx
    │   ├── World2/Level{1-7}.tsx
    │   ├── World3/Level{1-7}.tsx
    │   ├── World4/Level{1-7}.tsx
    │   ├── World5/Level{1-7}.tsx
    │   └── World6/Level{1-8}.tsx  # 42 niveles totales
    ├── screens/
    │   ├── HomeScreen.tsx   # Tab Inicio: perfil, rango, misión diaria, botón JUGAR
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
    │   └── navigation.ts    # RootStackParamList + MainTabParamList + tipos de props
    └── utils/
        ├── dailyMission.ts  # Generación/detección de misiones diarias (sin dependencia circular)
        ├── rankSystem.ts    # Sistema de rangos por estrellas (8 tiers)
        └── trophies.ts      # Construcción de grupos de trofeos por mundo
```

---

## Navegación

**Stack raíz (`RootStackParamList`):**
- `MainTabs` — sin params
- `World` — `{ worldId: number }`
- `GameLevel` — `{ worldId: number; levelId: number }`

**Bottom Tabs (`MainTabParamList`):**
- `Inicio` | `Mapa` | `Trofeos` | `Configuración`

---

## Estado global (Zustand)

**Archivo:** `src/store/gameStore.ts`
**Clave AsyncStorage:** `ai-explorer-storage-v2`
**Versión actual de migración:** `19`

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

`setProfile` · `completeLevel` · `unlockBadge` · `addXP` · `resetProgress` · `setDevMode` · `updateStreak` · `refreshDailyMission` · `updateLevelName` · `updateWorldName`

---

## Sistema de niveles

### BaseLevel.tsx

Componente genérico. Recibe `{ worldId, levelId, levelName, questions }`.

```ts
interface Question {
  question: string;
  options: string[];
  correct: number;      // índice de la opción correcta
  explanation?: string;
}
```

Flujo: pregunta → selección → feedback 1500ms → siguiente pregunta → resultado con estrellas → `completeLevel()` → `navigation.goBack()`.

**Estrellas:** `floor((correctas / total) * 3)`

### Agregar un nuevo nivel

1. Crear `src/levels/World{N}/Level{M}.tsx` usando `BaseLevel`
2. Registrar en `LevelScreen.tsx` en el mapa `levelComponents`
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
- React Navigation v7 ✅
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
└── icons/
    ├── favicon.png            # 48x48
    └── icon-512.png           # 1024x1024 (sirve como 512 también)
```

**Por qué `public/icons/`:** Metro hashea los nombres de assets en dist/. Los iconos en `public/` tienen rutas estables (`/icons/icon-512.png`), necesarias para el manifest.

### Service Worker

Estrategia:
- **Pre-cache en install:** `/` y `/index.html`
- **Navegación (SPA fallback):** network-first → offline sirve `/index.html`
- **Assets `/_expo/**`, scripts, fonts, imágenes:** stale-while-revalidate

Versión de caché: `ai-explorer-v1` — **incrementar al hacer deploy con cambios de assets**.

### Responsive web

`App.tsx` envuelve la app en un contenedor con `maxWidth: 480` solo en `Platform.OS === 'web'`. El hook `src/hooks/useBreakpoint.ts` retorna `'mobile' | 'tablet' | 'desktop'` según `useWindowDimensions`. Breakpoints: mobile < 600px, tablet < 1024px, desktop ≥ 1024px.

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
- JS bundle: ~2.8MB uncompressed / ~700KB gzip (esperado para RN web)
- Total dist: ~8.3MB (incluye todas las fuentes de `@expo/vector-icons` y todas las variantes de Plus Jakarta Sans)
- Optimización futura (no urgente): tree-shake icon fonts para incluir solo MaterialIcons.

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
| 1 | ¿Qué es la IA? | 6 |
| 2 | Domina el Prompting | 7 |
| 3 | IA Creativa | 7 |
| 4 | El Gran Torneo de Herramientas | 7 |
| 5 | Tu Proyecto de Impacto | 7 |
| 6 | El Futuro de la IA | 8 |

**Total: 42 niveles** — cada mundo termina con nivel "Evaluación" (World6 tiene además "Evaluación Final").

---

## ⚙️ Meta-regla para Claude Code

Eres responsable de mantener este archivo como la fuente de verdad del proyecto.
Después de cualquier cambio que:
- Añada/elimine dependencias
- Modifique la estructura de carpetas
- Cree/elimine APIs, rutas o modelos de datos
- Cambie patrones de arquitectura
- Introduzca nuevas convenciones

...debes revisar CLAUDE.md y actualizarlo sin que el usuario tenga que pedírtelo.
Si la actualización es menor, hazla silenciosamente.
Si es significativa, menciónala brevemente al usuario.

---

> **INSTRUCCIÓN META PARA CLAUDE CODE:**
> Cada vez que realices cambios significativos en el proyecto (nuevos archivos, refactorizaciones, cambios de arquitectura, nuevas dependencias, nuevas entidades o APIs), evalúa si la información en CLAUDE.md sigue siendo precisa. Si no lo es, actualiza el archivo proactivamente añadiendo, modificando o eliminando la información necesaria. Anuncia brevemente al usuario los cambios realizados en CLAUDE.md.
