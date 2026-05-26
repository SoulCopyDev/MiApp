# /project:new-level — Generador autónomo de niveles

Lee el archivo de especificación en `$ARGUMENTS` y genera el nivel completo en el sistema.

## Inputs requeridos

```
/project:new-level ruta/al/spec.md
```

El spec file usa formato Markdown con YAML frontmatter. Ver template en `.claude/commands/_nivel-template.md`.

---

## Paso 1 — Leer y validar el spec

1. Leer el archivo en `$ARGUMENTS` con Read.
2. Parsear el frontmatter YAML (entre `---`).
3. Validar:
   - `n` es un número ≥ 1 y no existe aún como `src/levels/Level{n}.tsx`
   - `mundo` es 1–6 (o nuevo mundo)
   - `xp_max` ≥ 50
   - Al menos 3 módulos declarados (excluyendo intro y fin)
4. Si falta cualquier campo requerido: reportar error y detener.

---

## Paso 2 — Generar `src/levels/Level{N}.tsx`

Crear el archivo usando la arquitectura **MODULES-array (Archetype B)**. Sustituir todos los `{N}`, `{NOMBRE}`, etc. con los valores del spec.

### Estructura del archivo generado

```tsx
// src/levels/Level{N}.tsx — generado por /project:new-level
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
```

Solo importar `Alert` si hay módulo tipo `quiz` con feedback alert (raro). Omitir imports no usados.

### Constantes de datos

Declarar `MODULES` array con un objeto por módulo del spec. Orden: intro (índice 0) → módulos → fin (índice MODULES.length-1).

```tsx
// ─── DATOS ────────────────────────────────────────────────
const GLOBAL_N = {N};
const TOTAL_XP = {xp_max};

// Helpers de aleatorización (solo si hay matching/vf/classify)
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

const MODULES = [
  // índice 0: intro
  { type: 'intro' as const, xp: 0 },
  // índice 1..N: módulos del spec en orden
  // índice final: fin/completion
  { type: 'fin' as const, xp: 0 },
] as const;
```

Datos de matching, vf, classify: declararlos como constantes separadas ANTES de MODULES array, fuera del componente (no recalcular en cada render).

```tsx
// Solo para módulos matching:
const PARES_M{índice} = [
  { left: '...', right: '...' },
  // ...
];

// Solo para módulos vf:
const VF_M{índice} = [
  { s: '...', correct: true, fb: '...' },
  // ...
];

// Solo para módulos classify:
const CLASSIFY_M{índice} = {
  categorias: ['Cat A', 'Cat B', 'Cat C'],
  items: [{ texto: '...', correcto: 0 }, ...],
};
```

### Código del componente

```tsx
export default function Level{N}() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const addXP        = useGameStore(s => s.addXP);
  const devMode      = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  const [xp,   setXp]   = useState(0);
```

#### Estado por tipo de módulo (solo declarar los necesarios según spec):

```tsx
  // quiz
  const [quizChoice,   setQuizChoice]   = useState<number | null>(null);
  const [quizDone,     setQuizDone]     = useState(false);

  // matching
  const [matchLeft,    setMatchLeft]    = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set());
  const [shuffledRight, setShuffledRight] = useState<{ idx: number; text: string }[]>([]);

  // builder
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);

  // vf
  const [vfAnswers, setVfAnswers] = useState<Record<number, boolean>>({});
  const [vfLocked,  setVfLocked]  = useState<Set<number>>(new Set());

  // sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec,     setSprintSec]     = useState(60); // sobreescribir con valor del spec
  const [sprintText,    setSprintText]    = useState('');
  const [sprintDone,    setSprintDone]    = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // classify
  const [classifyAnswers, setClassifyAnswers] = useState<Record<number, number>>({});
  const [classifyDone,    setClassifyDone]    = useState(false);
```

#### Derivados:

```tsx
  const m            = MODULES[step];
  const isIntro      = step === 0;
  const isFin        = step === MODULES.length - 1;
  const progress     = Math.round((step / (MODULES.length - 1)) * 100);
  const canGoBack    = step > 0 && !isIntro;
```

#### useEffect para cleanup del sprint:

```tsx
  // Solo si hay módulo sprint:
  useEffect(() => {
    return () => { if (sprintTimer.current) clearInterval(sprintTimer.current); };
  }, []);
```

#### useEffect para resetear estado al cambiar de step:

```tsx
  useEffect(() => {
    setQuizChoice(null); setQuizDone(false);
    setMatchLeft(null);  setMatchedPairs(new Set());
    setBuilderText('');  setBuilderDone(false);
    setVfAnswers({});    setVfLocked(new Set());
    setSprintRunning(false); setSprintSec({duracion}); setSprintText(''); setSprintDone(false);
    setClassifyAnswers({}); setClassifyDone(false);
    // inicializar shuffledRight para matching del step actual
    const mod = MODULES[step];
    if (mod.type === 'matching') {
      const pares = mod.pares; // referencia al array de datos
      setShuffledRight(
        [...pares.map((p, i) => ({ idx: i, text: p.right }))]
          .sort(() => Math.random() - 0.5)
      );
    }
  }, [step]);
```

#### Navegación:

```tsx
  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleFinish = () => {
    const stars = xp >= TOTAL_XP * 0.67 ? 3
                : xp >= TOTAL_XP * 0.4  ? 2
                : xp >= TOTAL_XP * 0.15 ? 1 : 0;
    completeLevel(GLOBAL_N, stars, xp);
    router.back();
  };
```

### Funciones render por tipo

Generar SOLO las funciones necesarias según los tipos del spec:

#### Intro:
```tsx
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel {N} · {MODULES.length - 1} módulos</Text>
      <View style={styles.iconCircle}><Text style={styles.iconEmoji}>{icono}</Text></View>
      <Text style={styles.title}>{nombre}</Text>
      <Text style={styles.body}>{descripcion}</Text>
      {/* Contenido del intro del spec */}
      <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
        <Text style={styles.btnText}>¡Empecemos! 🚀</Text>
      </TouchableOpacity>
    </View>
  );
```

#### Theory:
```tsx
  const renderTheory = (mod: typeof MODULES[number] & { type: 'teoria' }) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>{mod.tag}</Text>
      <Text style={styles.title}>{mod.titulo}</Text>
      <Text style={styles.body}>{mod.contenido}</Text>
      {mod.infoBox && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{mod.infoBox}</Text>
        </View>
      )}
      <View style={styles.navRow}>
        {canGoBack && (
          <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
            <Text style={styles.btnNavText}>← Volver</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
          <Text style={styles.btnText}>Entendido →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
```

#### Quiz:
```tsx
  const renderQuiz = (mod: typeof MODULES[number] & { type: 'quiz' }) => {
    const handleAnswer = (idx: number) => {
      if (quizDone) return;
      if (devMode) { setQuizChoice(mod.correct); setQuizDone(true); addXP(mod.xp); return; }
      setQuizChoice(idx);
      setQuizDone(true);
      if (idx === mod.correct) addXP(mod.xp);
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{mod.tag}</Text>
        <Text style={styles.title}>{mod.titulo}</Text>
        <Text style={styles.qText}>{mod.pregunta}</Text>
        {mod.opciones.map((op, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.quizOpt,
              quizDone && i === mod.correct && styles.quizOptOk,
              quizDone && i === quizChoice && i !== mod.correct && styles.quizOptBad,
            ]}
            onPress={() => handleAnswer(i)}
            disabled={quizDone}
          >
            <Text style={styles.quizOptText}>{op}</Text>
          </TouchableOpacity>
        ))}
        {quizDone && (
          <View style={[styles.feedbackBox, quizChoice === mod.correct ? styles.fbOk : styles.fbBad]}>
            <Text style={styles.feedbackText}>{mod.feedback}</Text>
          </View>
        )}
        {quizDone && (
          <View style={styles.navRow}>
            {canGoBack && (
              <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
                <Text style={styles.btnNavText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
```

#### Matching:
```tsx
  const renderMatching = (mod: typeof MODULES[number] & { type: 'matching' }) => {
    const allMatched = matchedPairs.size === mod.pares.length;
    const handleLeft = (idx: number) => {
      if (matchedPairs.has(idx)) return;
      setMatchLeft(idx === matchLeft ? null : idx);
    };
    const handleRight = (item: { idx: number; text: string }) => {
      if (matchLeft === null) return;
      if (devMode) {
        const newSet = new Set(matchedPairs);
        mod.pares.forEach((_, i) => newSet.add(i));
        setMatchedPairs(newSet);
        addXP(mod.xp);
        return;
      }
      if (item.idx === matchLeft) {
        const newSet = new Set(matchedPairs); newSet.add(matchLeft);
        setMatchedPairs(newSet);
        setMatchLeft(null);
        if (newSet.size === mod.pares.length) addXP(mod.xp);
      } else {
        setMatchLeft(null);
      }
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{mod.tag}</Text>
        <Text style={styles.title}>{mod.titulo}</Text>
        <View style={styles.matchGrid}>
          <View style={styles.matchCol}>
            {mod.pares.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.matchItem, matchLeft === i && styles.matchItemSel, matchedPairs.has(i) && styles.matchItemOk]}
                onPress={() => handleLeft(i)}
                disabled={matchedPairs.has(i)}
              >
                <Text style={styles.matchText}>{p.left}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.matchCol}>
            {shuffledRight.map((item) => (
              <TouchableOpacity
                key={item.idx}
                style={[styles.matchItem, matchedPairs.has(item.idx) && styles.matchItemOk]}
                onPress={() => handleRight(item)}
                disabled={matchedPairs.has(item.idx)}
              >
                <Text style={styles.matchText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {allMatched && (
          <View style={styles.navRow}>
            {canGoBack && (
              <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
                <Text style={styles.btnNavText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
```

#### Builder:
```tsx
  const renderBuilder = (mod: typeof MODULES[number] & { type: 'builder' }) => {
    const handleSubmit = () => {
      if (devMode || builderText.trim().length >= mod.minChars) {
        setBuilderDone(true);
        addXP(mod.xp);
      }
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{mod.tag}</Text>
        <Text style={styles.title}>{mod.titulo}</Text>
        <Text style={styles.body}>{mod.prompt}</Text>
        <TextInput
          style={[styles.textArea, builderDone && styles.textAreaDone]}
          placeholder={`Escribe al menos ${mod.minChars} caracteres…`}
          value={builderText}
          onChangeText={setBuilderText}
          multiline
          editable={!builderDone}
        />
        {!builderDone && (
          <TouchableOpacity
            style={[styles.btnPrimary, builderText.trim().length < mod.minChars && !devMode && styles.btnOff]}
            onPress={handleSubmit}
          >
            <Text style={styles.btnText}>Guardar →</Text>
          </TouchableOpacity>
        )}
        {builderDone && (
          <View style={styles.navRow}>
            {canGoBack && (
              <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
                <Text style={styles.btnNavText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
```

#### Verdadero/Falso:
```tsx
  const renderVF = (mod: typeof MODULES[number] & { type: 'vf' }) => {
    const allDone = vfLocked.size === mod.items.length;
    const handleVF = (itemIdx: number, answer: boolean) => {
      if (vfLocked.has(itemIdx)) return;
      if (devMode) {
        const newLocked = new Set(vfLocked);
        mod.items.forEach((_, i) => newLocked.add(i));
        setVfLocked(newLocked);
        addXP(mod.xp);
        return;
      }
      const newAnswers = { ...vfAnswers, [itemIdx]: answer };
      const newLocked  = new Set(vfLocked); newLocked.add(itemIdx);
      setVfAnswers(newAnswers);
      setVfLocked(newLocked);
      if (newLocked.size === mod.items.length) addXP(mod.xp);
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{mod.tag}</Text>
        <Text style={styles.title}>{mod.titulo}</Text>
        {mod.items.map((item, i) => {
          const answered = vfLocked.has(i);
          const correct  = answered && vfAnswers[i] === item.correct;
          return (
            <View key={i} style={styles.vfItem}>
              <Text style={styles.vfStatement}>{item.s}</Text>
              <View style={styles.vfBtns}>
                <TouchableOpacity
                  style={[styles.vfBtn, answered && item.correct === true && styles.vfBtnOk, answered && !correct && vfAnswers[i] === true && styles.vfBtnBad]}
                  onPress={() => handleVF(i, true)} disabled={answered}
                >
                  <Text style={styles.vfBtnText}>VERDADERO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vfBtn, answered && item.correct === false && styles.vfBtnOk, answered && !correct && vfAnswers[i] === false && styles.vfBtnBad]}
                  onPress={() => handleVF(i, false)} disabled={answered}
                >
                  <Text style={styles.vfBtnText}>FALSO</Text>
                </TouchableOpacity>
              </View>
              {answered && <Text style={correct ? styles.vfFbOk : styles.vfFbBad}>{item.fb}</Text>}
            </View>
          );
        })}
        {allDone && (
          <View style={styles.navRow}>
            {canGoBack && (
              <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
                <Text style={styles.btnNavText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
```

#### Sprint:
```tsx
  const renderSprint = (mod: typeof MODULES[number] & { type: 'sprint' }) => {
    const startSprint = () => {
      setSprintRunning(true);
      sprintTimer.current = setInterval(() => {
        setSprintSec(s => {
          if (s <= 1) {
            clearInterval(sprintTimer.current!);
            setSprintDone(true);
            addXP(mod.xp);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    };
    const submitSprint = () => {
      if (sprintText.trim().length >= mod.minChars || devMode) {
        clearInterval(sprintTimer.current!);
        setSprintDone(true);
        addXP(mod.xp);
      }
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{mod.tag}</Text>
        <Text style={styles.title}>{mod.titulo}</Text>
        <Text style={styles.body}>{mod.instruccion}</Text>
        {!sprintRunning && !sprintDone && (
          <TouchableOpacity style={styles.btnPrimary} onPress={startSprint}>
            <Text style={styles.btnText}>⏱ Iniciar ({mod.duracion}s)</Text>
          </TouchableOpacity>
        )}
        {sprintRunning && (
          <>
            <Text style={styles.timer}>{sprintSec}s</Text>
            <TextInput style={styles.textArea} value={sprintText} onChangeText={setSprintText} multiline placeholder="Escribe aquí…" />
            <TouchableOpacity style={styles.btnPrimary} onPress={submitSprint}>
              <Text style={styles.btnText}>Enviar →</Text>
            </TouchableOpacity>
          </>
        )}
        {sprintDone && (
          <View style={styles.navRow}>
            {canGoBack && (
              <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
                <Text style={styles.btnNavText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
```

#### Classify (3 categorías):
```tsx
  const renderClassify = (mod: typeof MODULES[number] & { type: 'classify' }) => {
    const allDone = Object.keys(classifyAnswers).length === mod.items.length;
    if (devMode && !allDone) {
      const auto: Record<number, number> = {};
      mod.items.forEach((item, i) => { auto[i] = item.correcto; });
      setClassifyAnswers(auto); setClassifyDone(true); addXP(mod.xp);
    }
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{mod.tag}</Text>
        <Text style={styles.title}>{mod.titulo}</Text>
        {mod.items.map((item, i) => (
          <View key={i} style={styles.classifyItem}>
            <Text style={styles.classifyText}>{item.texto}</Text>
            <View style={styles.classifyBtns}>
              {mod.categorias.map((cat, catIdx) => (
                <TouchableOpacity
                  key={catIdx}
                  style={[
                    styles.classifyBtn,
                    classifyAnswers[i] === catIdx && (catIdx === item.correcto ? styles.classifyBtnOk : styles.classifyBtnBad),
                    classifyAnswers[i] !== undefined && catIdx === item.correcto && styles.classifyBtnOk,
                  ]}
                  onPress={() => {
                    if (classifyAnswers[i] !== undefined) return;
                    const newAns = { ...classifyAnswers, [i]: catIdx };
                    setClassifyAnswers(newAns);
                    if (Object.keys(newAns).length === mod.items.length) {
                      setClassifyDone(true); addXP(mod.xp);
                    }
                  }}
                  disabled={classifyAnswers[i] !== undefined}
                >
                  <Text style={styles.classifyBtnText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {allDone && (
          <View style={styles.navRow}>
            {canGoBack && (
              <TouchableOpacity style={styles.btnNav} onPress={prevStep}>
                <Text style={styles.btnNavText}>← Volver</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
```

#### Fin/Completion:
```tsx
  const renderFin = () => {
    const stars = xp >= TOTAL_XP * 0.67 ? 3 : xp >= TOTAL_XP * 0.4 ? 2 : xp >= TOTAL_XP * 0.15 ? 1 : 0;
    return (
      <View style={styles.finContainer}>
        <Text style={styles.finTrophy}>🏆</Text>
        <Text style={styles.finTitle}>¡{nombre} completado!</Text>
        <View style={styles.starsRow}>
          {[1,2,3].map(s => (
            <Text key={s} style={{ fontSize: 40, color: s <= stars ? colors.accent : colors.borderLight }}>★</Text>
          ))}
        </View>
        <Text style={styles.finXP}>+{xp} XP ganados</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleFinish}>
          <MaterialIcons name="arrow-back" size={18} color={colors.surface} />
          <Text style={styles.btnText}> Volver al mundo</Text>
        </TouchableOpacity>
      </View>
    );
  };
```

#### Dispatcher (renderModule):
```tsx
  const renderModule = () => {
    if (m.type === 'intro')    return renderIntro();
    if (m.type === 'teoria')   return renderTheory(m as any);
    if (m.type === 'quiz')     return renderQuiz(m as any);
    if (m.type === 'matching') return renderMatching(m as any);
    if (m.type === 'builder')  return renderBuilder(m as any);
    if (m.type === 'vf')       return renderVF(m as any);
    if (m.type === 'sprint')   return renderSprint(m as any);
    if (m.type === 'classify') return renderClassify(m as any);
    if (m.type === 'fin')      return renderFin();
    return null;
  };
```

#### JSX principal:
```tsx
  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` as any }]} />
        </View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderModule()}
      </ScrollView>
    </View>
  );
}
```

### StyleSheet estándar

Copiar EXACTAMENTE este StyleSheet. No inventar estilos nuevos fuera de él.

```tsx
const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.background },
  bar:          { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track:        { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill:         { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  xpChip:       { ...typography.bold, fontSize: 14, color: colors.primary },
  scrollContent:{ padding: 20, paddingBottom: 60, flexGrow: 1 },
  stepContainer:{ gap: 14 },

  // Tags
  tag:          { ...typography.bold, fontSize: 11, color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },

  // Texto
  title:        { ...typography.extraBold, fontSize: 20, color: colors.textPrimary, lineHeight: 28 },
  body:         { ...typography.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 23 },
  subtitle:     { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Info box
  infoBox:      { backgroundColor: '#eef2ff', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: colors.primary },
  infoText:     { ...typography.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 21 },

  // Intro
  iconCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  iconEmoji:    { fontSize: 36 },

  // Botones
  btnPrimary:   { flexDirection: 'row', alignSelf: 'flex-end', backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  btnText:      { ...typography.bold, color: colors.surface, fontSize: 15 },
  btnOff:       { opacity: 0.4 },
  btnNav:       { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.border },
  btnNavText:   { ...typography.bold, fontSize: 14, color: colors.textSecondary },
  navRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  // Quiz
  qText:        { ...typography.bold, fontSize: 16, color: colors.textPrimary },
  quizOpt:      { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface },
  quizOptText:  { ...typography.regular, fontSize: 14, color: colors.textPrimary },
  quizOptOk:    { borderColor: colors.success, backgroundColor: '#dcfce7' },
  quizOptBad:   { borderColor: colors.error, backgroundColor: '#fee2e2' },
  feedbackBox:  { padding: 12, borderRadius: 12, borderWidth: 1 },
  fbOk:         { backgroundColor: '#dcfce7', borderColor: colors.success },
  fbBad:        { backgroundColor: '#fee2e2', borderColor: colors.error },
  feedbackText: { ...typography.regular, fontSize: 14, color: colors.textPrimary },

  // Matching
  matchGrid:    { flexDirection: 'row', gap: 10 },
  matchCol:     { flex: 1, gap: 8 },
  matchItem:    { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, minHeight: 50, justifyContent: 'center' },
  matchItemSel: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  matchItemOk:  { borderColor: colors.success, backgroundColor: '#dcfce7' },
  matchText:    { ...typography.regular, fontSize: 13, color: colors.textPrimary, textAlign: 'center' },

  // Builder
  textArea:     { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, minHeight: 100, ...typography.regular, fontSize: 15, color: colors.textPrimary, textAlignVertical: 'top' },
  textAreaDone: { backgroundColor: '#f0fdf4', borderColor: colors.success },

  // VF
  vfItem:       { gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  vfStatement:  { ...typography.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  vfBtns:       { flexDirection: 'row', gap: 10 },
  vfBtn:        { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center' },
  vfBtnOk:      { borderColor: colors.success, backgroundColor: '#dcfce7' },
  vfBtnBad:     { borderColor: colors.error, backgroundColor: '#fee2e2' },
  vfBtnText:    { ...typography.bold, fontSize: 12, color: colors.textPrimary },
  vfFbOk:       { ...typography.regular, fontSize: 12, color: colors.success },
  vfFbBad:      { ...typography.regular, fontSize: 12, color: colors.error },

  // Sprint
  timer:        { ...typography.extraBold, fontSize: 32, color: colors.primary, textAlign: 'center' },

  // Classify
  classifyItem: { gap: 8, paddingBottom: 12 },
  classifyText: { ...typography.regular, fontSize: 15, color: colors.textPrimary },
  classifyBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classifyBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface },
  classifyBtnOk: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  classifyBtnBad:{ borderColor: colors.error, backgroundColor: '#fee2e2' },
  classifyBtnText:{ ...typography.bold, fontSize: 13, color: colors.textPrimary },

  // Fin
  finContainer: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  finTrophy:    { fontSize: 64 },
  finTitle:     { ...typography.extraBold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' },
  starsRow:     { flexDirection: 'row', gap: 6 },
  finXP:        { ...typography.bold, fontSize: 16, color: colors.primary },
});
```

---

## Paso 3 — Registrar en `LevelScreen.tsx`

Leer `src/levels/LevelScreen.tsx`. Agregar:

```tsx
import Level{N} from './Level{N}';
```
Al final del bloque de imports de levels.

Agregar al objeto `LEVEL_COMPONENTS`:
```tsx
{N}: Level{N},
```
En orden numérico.

---

## Paso 4 — Actualizar `gameStore.ts`

### 4a. Verificar entrada en INITIAL_WORLDS

Buscar en `INITIAL_WORLDS` el mundo `{mundo}` y verificar que tenga una entrada con `id: {levelId}` donde `levelId = N - (mundo - 1) * 6`.

Si NO existe la entrada: agregar al array `levels` del mundo correspondiente:
```ts
{
  id: {levelId},
  name: '{nombre}',
  icon: '{icono}',
  status: 'locked' as const,
  stars: 0,
},
```

Si el mundo entero no existe (mundo nuevo): agregar el objeto `World` completo al array `worlds`.

### 4b. Incrementar version

Buscar la línea con `version:` en la config de `persist`:
```ts
version: 20,  // → cambiar a 21
```
Incrementar en 1.

---

## Paso 5 — Verificar TypeScript

Ejecutar:
```bash
npx tsc --noEmit 2>&1 | grep "Level{N}" | head -20
```

Si hay errores en el archivo generado: corregirlos antes de reportar éxito.

---

## Paso 6 — Reporte final

Reportar en formato de tabla:

| Acción | Archivo |
|---|---|
| ✅ Creado | `src/levels/Level{N}.tsx` |
| ✅ Registrado | `src/levels/LevelScreen.tsx` |
| ✅ INITIAL_WORLDS | `src/store/gameStore.ts` (version → {nueva}) |
| ✅ N módulos generados | teoria×N, quiz×N, ... |

**XP thresholds:** ★★★ ≥ {xp_max * 0.67} | ★★ ≥ {xp_max * 0.4} | ★ ≥ {xp_max * 0.15}

---

## Reglas inamovibles

- **Nunca** usar `Alert.alert` para feedback — siempre feedback inline en el JSX
- **Nunca** hardcodear colores fuera de `src/theme/colors.ts`
- **Siempre** incluir `devMode` bypass en cada check/validate function
- **Siempre** usar `StyleSheet.create` — sin estilos inline salvo valores dinámicos (`width: \`${progress}%\``)
- **Siempre** que haya datos de quiz/vf/classify/matching: declararlos como constantes FUERA del componente
- **El tipo de `m`** (módulo actual) requiere cast `as any` en el dispatcher para evitar errores de TypeScript en los renders — es esperado
- **No mezclar** `router.push` y `router.replace` en el mismo nivel — usar solo `router.back()` al completar
