# Estándares de Código — AI Explorer

## Estilos y UI

- **Siempre** `StyleSheet.create` en el mismo archivo. Nunca objetos inline en JSX salvo valores dinámicos (ej: `{ color: isActive ? 'red' : 'blue' }`).
- **Colores y tipografía:** siempre desde `src/theme/` (`colors`, `typography`). Prohibido hardcodear `#ffffff` o `fontFamily` directamente.
- **Fuente:** Plus Jakarta Sans (Regular / Bold / ExtraBold). Usar las constantes de `typography`.

## Estado global (Zustand)

```ts
// CORRECTO — selector granular
const worlds = useGameStore((s) => s.worlds);
const devMode = useGameStore((s) => s.devMode);

// INCORRECTO — suscribe todo el estado
const store = useGameStore();
```

Al agregar nuevos campos a `GameState`: siempre agregar inicialización defensiva en la función `migrate` de `gameStore.ts`.

## Compatibilidad web

| Patrón nativo | Reemplazo web |
|---|---|
| `Alert.alert` en checks de respuesta | Feedback inline (mensaje en pantalla) |
| `Alert.prompt` | `Platform.OS === 'web' ? window.prompt(...) : Alert.prompt(...)` |
| `Vibration.vibrate()` | Guard `if (Platform.OS === 'android')` |
| Navegación entre niveles | `router.replace(...)` (evita history stack) |

**Layout de niveles en web desktop:** `LevelScreen.tsx` y `EvalScreen.tsx` envuelven cada nivel/eval en `WebPhoneFrame` (`src/components/WebPhoneFrame.tsx`): tarjeta centrada tipo teléfono (max-width 680/720, alto ≤ min(860, 100vh−56), radio 20, sombra) que replica el layout desktop de los HTML prototipo. Así el botón principal queda al fondo de la tarjeta, no del viewport. Los niveles NO deben implementar su propio marco — lo hereda todo nivel registrado en los dispatchers.

## DevMode

Todos los niveles deben tener bypass en cada función de validación:

```ts
const devMode = useGameStore((state) => state.devMode);

function checkQuiz() {
  if (devMode) { setQuizChecked(true); addXP(32); return; }
  // ... lógica real
}
```

## Agregar un nivel nuevo

Estructura plana con numeración global continua N1–N43 (ver CLAUDE.md).

1. Crear `src/levels/Level{N}.tsx` (siguiente N disponible; usar un nivel existente como referencia)
2. Registrar en `LevelScreen.tsx` → `LEVEL_COMPONENTS[N] = Level{N}`
3. Agregar entrada en `INITIAL_WORLDS` en `gameStore.ts` (si no existe)
4. **Incrementar `version`** en persist config de `gameStore.ts`

## Agregar un mundo nuevo

1. Crear `src/levels/Level{N}.tsx` para cada nivel del mundo (numeración global continua)
2. Agregar world completo en `INITIAL_WORLDS` en `gameStore.ts`
3. Registrar todos los niveles en `LevelScreen.tsx` (`LEVEL_COMPONENTS`)
4. Agregar color scheme en `WORLD_COLORS` en `src/utils/trophies.ts`
5. Incrementar `version` en persist

## Versión del store

Incrementar `version` en `gameStore.ts` **siempre que** se agregue un nivel, un mundo, o un campo nuevo a `GameState`. La función `migrate` sincroniza el estado persistido con la nueva estructura preservando el progreso del usuario.

## Misión diaria

`src/utils/dailyMission.ts` **no puede importar nada de `gameStore.ts`** — circular dependency. Usar tipos estructurales propios.

## Comentarios

Solo cuando el WHY es no-obvio: una restricción oculta, un workaround de bug, comportamiento que sorprendería a un lector. Sin comentarios que expliquen QUÉ hace el código.

## Tests

No hay test runner configurado. No agregar tests sin discutirlo primero.

---

> **Meta-instrucción para Claude:** Actualizar este archivo cuando se establezca un nuevo patrón de código, se invalide uno existente, o se agreguen nuevas reglas de compatibilidad.
