Scaffold a new interactive level for AI Explorer.

## Steps

1. Ask the user: world number (1–6) and level number.
2. Ask: level name and topic/theme (one sentence).
3. Read an existing level from the same world as structural reference (e.g., `src/levels/World{N}/Level{M-1}.tsx`).
4. Create `src/levels/World{N}/Level{M}.tsx` following the same patterns:
   - Import `useGameStore` and select `devMode`
   - Define `THEORY_STEPS` (Set of step indices where back navigation applies)
   - Add `devMode` bypass in every check/validation function
   - Place `resultBanner` **outside** the `ScrollView`
   - Use `router.replace(...)` for any next-level navigation (never `router.push`)
   - All styles via `StyleSheet.create`, colors from `src/theme/`
5. Register in `src/levels/LevelScreen.tsx`:
   - Add import: `import World{N}Level{M} from './World{N}/Level{M}';`
   - Add to map: `levelComponents[N][M] = World{N}Level{M}`
6. Verify `INITIAL_WORLDS` in `src/store/gameStore.ts` has the level entry. If missing, add it.
7. Increment `version` in persist config in `gameStore.ts` (e.g., 20 → 21).
8. Report to user: files created/modified + new version number.

## Reference files
- `src/levels/BaseLevel.tsx` — for simple quiz-only levels
- `src/levels/World1/Level7.tsx` — reference for evaluation-type levels
- `src/levels/World1/Level1.tsx` — reference for multi-step interactive levels
- `.claude/standards.md` — full coding standards
