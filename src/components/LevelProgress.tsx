import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import StepDots from './StepDots';

// Contexto ligero para que cada nivel/eval reporte su paso actual y el total,
// y así el indicador `StepDots` se renderice UNA sola vez (en LevelChrome), al pie.
// Cada nivel solo añade: useReportProgress(step, TOTAL_STEPS)

type Progress = { current: number; total: number };
const noop = () => {};
const Ctx = createContext<{ progress: Progress; report: (p: Progress) => void }>({
  progress: { current: 0, total: 0 },
  report: noop,
});

export function LevelProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0 });
  const report = useCallback(
    (p: Progress) => setProgress((prev) => (prev.current === p.current && prev.total === p.total ? prev : p)),
    [],
  );
  return <Ctx.Provider value={{ progress, report }}>{children}</Ctx.Provider>;
}

/** Cada nivel llama a esto una vez con su paso actual y su total de pasos. */
export function useReportProgress(current: number, total: number) {
  const { report } = useContext(Ctx);
  useEffect(() => {
    report({ current, total });
  }, [current, total, report]);
}

export function useLevelProgress() {
  return useContext(Ctx).progress;
}

/** Envoltura que renderiza el nivel y, al pie (bajo el botón), la fila de step-dots. */
export function LevelChrome({ children }: { children: React.ReactNode }) {
  const { current, total } = useLevelProgress();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{children}</View>
      <StepDots current={current} total={total} />
    </View>
  );
}
