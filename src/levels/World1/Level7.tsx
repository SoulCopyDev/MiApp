import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, BackHandler, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };

// ---------- Datos — Evaluación Mundo 1 ----------
const QUIZ_POOL: QuizItem[] = [
  {
    q: '¿Cuál es la diferencia más importante entre una IA y una calculadora?',
    opts: ['La calculadora es más rápida', 'La IA aprendió de ejemplos sin reglas escritas', 'La IA solo funciona con internet', 'La calculadora puede aprender sola'],
    correct: 1, explain: 'La IA aprende de millones de ejemplos. La calculadora sigue reglas que alguien programó — nunca aprende.',
  },
  {
    q: 'ChatGPT escribe una fecha histórica incorrecta con total confianza. ¿Por qué?',
    opts: ['Tiene un bug de software', 'Predice texto probable sin verificar si es verdad (alucinación)', 'No tiene acceso a internet', 'El usuario escribió mal la pregunta'],
    correct: 1, explain: 'Los LLMs predicen la secuencia de palabras más probable. Pueden generar datos falsos que suenan perfectamente reales.',
  },
  {
    q: '¿Cuál de estos comportamientos le es IMPOSIBLE a cualquier IA actual?',
    opts: ['Traducir textos largos en segundos', 'Detectar cáncer en radiografías con 94% de precisión', 'Sentir orgullo genuino cuando ayuda a alguien', 'Recomendar canciones personalizadas'],
    correct: 2, explain: 'La IA genera texto sobre emociones, pero no las experimenta. Sentir orgullo requiere experiencia interna que la IA no tiene.',
  },
  {
    q: 'Spotify te recomienda la canción perfecta. ¿Qué hizo la IA?',
    opts: ['Un humano eligió la canción para ti', 'Comparó tu historial con el de millones de usuarios similares', 'Leyó tu estado de ánimo por el micrófono', 'Eligió la canción más popular del momento'],
    correct: 1, explain: 'Filtrado colaborativo: la IA encuentra usuarios con historial casi idéntico al tuyo y te recomienda lo que a ellos les encantó.',
  },
  {
    q: 'Un prompt dice "Escribe algo sobre el clima". ¿Qué ingrediente le falta principalmente?',
    opts: ['Rol', 'Instrucción específica', 'Formato', 'Todos los anteriores'],
    correct: 3, explain: 'Le faltan todos: no define a quién va dirigido, qué tipo de texto, qué aspecto del clima, ni la extensión o formato esperado.',
  },
  {
    q: '¿Cuál es el propósito del ingrediente ROL en un prompt?',
    opts: ['Hacer el prompt más largo', 'Activar el vocabulario, nivel y perspectiva correctos en la IA', 'Obligar a la IA a seguir instrucciones', 'Definir el idioma de la respuesta'],
    correct: 1, explain: 'El rol define el "modo" de la IA. Un médico explica diferente que un profesor — el rol activa ese registro específico.',
  },
  {
    q: 'Usas ChatGPT para un trabajo escolar sin verificar la información. ¿Cuál es el principal riesgo?',
    opts: ['El trabajo puede estar perfecto', 'La IA puede inventar datos que suenan reales pero son falsos', 'ChatGPT no puede escribir trabajos escolares', 'El riesgo es solo de plagio'],
    correct: 1, explain: 'Los LLMs alucinan: pueden citar estudios, estadísticas y fechas completamente inventadas con total confianza.',
  },
  {
    q: 'Una IA fue entrenada solo con textos en inglés. ¿Qué problema tendrá?',
    opts: ['Funcionará perfectamente en todos los idiomas', 'Puede tener menor precisión en otros idiomas', 'Aprenderá los demás idiomas sola', 'Solo puede responder preguntas en inglés'],
    correct: 1, explain: 'La IA solo conoce lo que vio en su entrenamiento. Menos datos en un idioma = menor precisión en ese idioma.',
  },
  {
    q: 'Al construir un proyecto con IA, ¿cuál es el primer paso?',
    opts: ['Elegir el LLM más caro', 'Definir el problema y la audiencia', 'Escribir el código', 'Diseñar la interfaz visual'],
    correct: 1, explain: 'Siempre primero el problema: ¿qué dolor resuelves? ¿para quién? Sin esto, el mejor prompt del mundo no sirve.',
  },
  {
    q: 'TikTok te muestra gatitos seguidos. ¿Cómo lo decidió la IA?',
    opts: ['Alguien en TikTok eligió el contenido para ti', 'Analizó cuántos segundos ves, si repites y si pausas los videos de gatitos', 'Leyó tu historial de Google', 'Muestra el contenido más popular del momento'],
    correct: 1, explain: 'TikTok analiza más de 200 señales: tiempo de visualización, repeticiones, pausas. Detecta exactamente qué tipo de contenido te engancha.',
  },
  {
    q: 'Una IA detecta que una persona pertenece a un grupo étnico y le muestra menos ofertas de trabajo. Esto es:',
    opts: ['Funcionamiento correcto de la IA', 'Sesgo algorítmico — resultado de datos de entrenamiento sesgados', 'Una decisión intencional de la empresa', 'Imposible en sistemas modernos'],
    correct: 1, explain: 'El sesgo algorítmico ocurre cuando datos históricos discriminatorios se replican en el modelo. La IA aprende los sesgos de quienes crearon los datos.',
  },
  {
    q: 'Para un proyecto de IA escolar, después de escribir el prompt base, ¿qué sigue?',
    opts: ['Publicarlo inmediatamente', 'Probarlo con usuarios reales y ajustar según los resultados', 'Guardarlo sin cambios', 'Pedir a la IA que lo mejore sola'],
    correct: 1, explain: 'Iterar: probar → evaluar → ajustar. Los usuarios reales revelan fallos que nunca imaginaste.',
  },
  {
    q: '¿Cuándo es más adecuado usar un LLM para estudiar?',
    opts: ['Para que haga tu tarea en lugar de ti', '"Actúa como tutor: explícame fracciones con 3 analogías y dame 2 ejercicios con respuestas"', 'Copiando la respuesta directamente sin leerla', 'Verificar si tus respuestas son correctas sin entender por qué'],
    correct: 1, explain: 'Los LLMs son mejores tutores cuando les das rol, contexto e instrucción específica. Son pésimos cuando los usas para hacer trampa.',
  },
  {
    q: 'El modo desarrollador en la app sirve para:',
    opts: ['Cambiar el diseño de la app', 'Saltarse validaciones para probar los módulos más rápido', 'Activar funciones premium', 'Conectar con APIs externas'],
    correct: 1, explain: 'El dev mode permite al equipo de desarrollo navegar los módulos sin completar cada actividad, acelerando la revisión del contenido.',
  },
];

const TF_POOL: TFItem[] = [
  { stmt: 'La IA puede sentir emociones reales como tristeza o alegría.', correct: false, explain: 'La IA predice palabras. No tiene experiencia interna ni emociones reales.' },
  { stmt: 'Un prompt con ROL, CONTEXTO, INSTRUCCIÓN y FORMATO siempre dará mejores resultados que uno sin estructura.', correct: true, explain: 'La especificidad mejora los resultados. Los 4 ingredientes le dan a la IA exactamente lo que necesita para responder bien.' },
  { stmt: 'Spotify usa datos de millones de usuarios para recomendar canciones.', correct: true, explain: 'El filtrado colaborativo compara tu historial con cientos de millones de oyentes similares.' },
  { stmt: 'Una IA entrenada con fotos de perros reconocerá perfectamente a los lobos.', correct: false, explain: 'La IA solo reconoce lo que vio en el entrenamiento. Sin ejemplos de lobos, intentará clasificarlos como perros.' },
  { stmt: 'Los deepfakes son inofensivos porque todo el mundo sabe que son falsos.', correct: false, explain: 'Los deepfakes pueden dañar reputaciones, difundir desinformación y ser usados para fraude. No son inofensivos.' },
  { stmt: 'Iterar un prompt (ajustarlo varias veces) es una práctica recomendada al trabajar con LLMs.', correct: true, explain: 'La iteración es fundamental: rara vez el primer prompt es el mejor. Ajustar según los resultados mejora la calidad.' },
  { stmt: 'El sesgo en una IA siempre es intencional por parte de los creadores.', correct: false, explain: 'El sesgo suele ser involuntario y proviene de datos históricos sesgados que el modelo aprende sin que nadie lo programe explícitamente.' },
  { stmt: 'Para un proyecto de IA escolar, basta con escribir un prompt y publicarlo sin probarlo.', correct: false, explain: 'Probar con usuarios reales es esencial. Ellos hacen preguntas inesperadas que revelan fallos del sistema.' },
];

// Helper
const pickN = <T,>(arr: T[], n: number): T[] =>
  [...arr].sort(() => Math.random() - 0.5).slice(0, n);

const TOTAL_STEPS = 4; // 0:quiz, 1:tf, 2:resultado, 3:completado

interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World1Level7({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  // Preguntas aleatorias
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 8));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));

  // Estados quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Estados TF
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [tfScore, setTfScore] = useState(0);

  const isExamMode = step <= 1;

  useEffect(() => {
    setAllowBack?.(!isExamMode);
  }, [isExamMode, setAllowBack]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExamMode) {
        if (Platform.OS === 'web') return true;
        Alert.alert('Evaluación en curso', 'No puedes retroceder durante la evaluación.', [{ text: 'OK' }]);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isExamMode]);

  const addXP = (n: number) => setXp(p => p + n);

  const handleClose = () => {
    if (Platform.OS === 'web') {
      const msg = isExamMode
        ? 'Estás en la evaluación. Si sales perderás el progreso. ¿Seguro?'
        : '¿Seguro que quieres salir?';
      if (window.confirm(msg)) router.back();
      return;
    }
    if (isExamMode) {
      Alert.alert('Evaluación en curso', 'Si sales perderás todo el progreso. ¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Salir', '¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => router.back() },
      ]);
    }
  };

  const handleFinish = () => {
    const totalXP = xp;
    const stars = totalXP >= 150 ? 3 : totalXP >= 90 ? 2 : totalXP >= 40 ? 1 : 0;
    completeLevel(1, 7, stars, totalXP);
    router.back();
  };

  // ---- Quiz ----
  const selectQuiz = (qIdx: number, optIdx: number) => {
    if (quizChecked) return;
    setQuizAnswers(p => ({ ...p, [qIdx]: optIdx }));
  };

  const checkQuiz = () => {
    if (devMode) {
      setQuizChecked(true);
      setQuizScore(quizItems.length);
      addXP(quizItems.length * 15);
      setStep(1);
      return;
    }
    if (Object.keys(quizAnswers).length < quizItems.length) {
      Alert.alert('Incompleto', 'Responde todas las preguntas antes de continuar.');
      return;
    }
    let correct = 0;
    quizItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    setQuizScore(correct);
    setQuizChecked(true);
    const earned = correct * 15;
    addXP(earned);
    setStep(1);
  };

  // ---- TF ----
  const selectTF = (idx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers(p => ({ ...p, [idx]: val }));
  };

  const checkTF = () => {
    if (devMode) {
      setTfChecked(true);
      setTfScore(tfItems.length);
      addXP(tfItems.length * 10);
      setStep(2);
      return;
    }
    if (Object.keys(tfAnswers).length < tfItems.length) {
      Alert.alert('Incompleto', 'Responde todas las afirmaciones antes de continuar.');
      return;
    }
    let correct = 0;
    tfItems.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    setTfScore(correct);
    setTfChecked(true);
    const earned = correct * 10;
    addXP(earned);
    setStep(2);
  };

  // ---- Renders ----
  const renderQuiz = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📝 Parte 1 · Quiz — 8 preguntas</Text>
      <Text style={styles.title}>Evaluación Mundo 1</Text>
      <Text style={styles.subtitle}>Demuestra lo que aprendiste sobre IA, prompting y ética.</Text>
      {quizItems.map((q, qIdx) => (
        <View key={qIdx} style={styles.quizCard}>
          <Text style={styles.quizQuestion}>{qIdx + 1}. {q.q}</Text>
          {q.opts.map((opt, optIdx) => {
            let optStyle = styles.quizOption;
            if (quizChecked) {
              if (optIdx === q.correct) optStyle = { ...styles.quizOption, ...styles.quizCorrect };
              else if (quizAnswers[qIdx] === optIdx) optStyle = { ...styles.quizOption, ...styles.quizWrong };
            } else if (quizAnswers[qIdx] === optIdx) {
              optStyle = { ...styles.quizOption, ...styles.quizSelected };
            }
            return (
              <TouchableOpacity key={optIdx} style={optStyle} onPress={() => selectQuiz(qIdx, optIdx)} disabled={quizChecked}>
                <Text style={styles.quizLetter}>{String.fromCharCode(65 + optIdx)}</Text>
                <Text style={styles.quizOptText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <View style={styles.explainBox}>
              <Text style={styles.explainText}>💡 {q.explain}</Text>
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.submitBtn} onPress={checkQuiz}>
        <Text style={styles.submitBtnText}>{quizChecked ? 'Siguiente →' : 'Comprobar respuestas'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✅ Parte 2 · Verdadero o Falso — 5 afirmaciones</Text>
      <Text style={styles.title}>¿Verdad o mito?</Text>
      {tfItems.map((item, idx) => {
        const answered = tfAnswers[idx] !== undefined;
        return (
          <View key={idx} style={styles.tfCard}>
            <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
            <View style={styles.tfOpts}>
              <TouchableOpacity
                style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]}
                onPress={() => selectTF(idx, true)}
                disabled={tfChecked}
              >
                <Text>✅ Verdadero</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]}
                onPress={() => selectTF(idx, false)}
                disabled={tfChecked}
              >
                <Text>❌ Falso</Text>
              </TouchableOpacity>
            </View>
            {tfChecked && (
              <View style={[styles.explainBox, tfAnswers[idx] === item.correct ? styles.explainOk : styles.explainFail]}>
                <Text style={styles.explainText}>
                  {tfAnswers[idx] === item.correct ? '✓ Correcto · ' : '✗ Incorrecto · '}
                  {item.explain}
                </Text>
              </View>
            )}
          </View>
        );
      })}
      <TouchableOpacity style={styles.submitBtn} onPress={checkTF}>
        <Text style={styles.submitBtnText}>{tfChecked ? 'Ver resultado →' : 'Comprobar respuestas'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderResult = () => {
    const totalQ = quizItems.length + tfItems.length;
    const totalCorrect = quizScore + tfScore;
    const pct = Math.round((totalCorrect / totalQ) * 100);
    const totalXP = xp;
    const stars = totalXP >= 150 ? 3 : totalXP >= 90 ? 2 : totalXP >= 40 ? 1 : 0;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>📊 Resultado de la evaluación</Text>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreNum}>{pct}%</Text>
          <Text style={styles.scoreLabel}>{totalCorrect}/{totalQ} correctas</Text>
        </View>
        <View style={styles.starRow}>
          {[1, 2, 3].map(s => (
            <Text key={s} style={[styles.starIcon, s <= stars ? styles.starOn : styles.starOff]}>⭐</Text>
          ))}
        </View>
        <Text style={styles.xpText}>⭐ {totalXP} XP ganados</Text>
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Quiz (8 preguntas × 15 XP)</Text>
            <Text style={styles.breakdownVal}>{quizScore * 15} XP</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>V/F (5 afirm. × 10 XP)</Text>
            <Text style={styles.breakdownVal}>{tfScore * 10} XP</Text>
          </View>
        </View>
        <Text style={styles.feedbackText}>
          {pct >= 80
            ? '¡Excelente! Dominas los conceptos fundamentales de IA del Mundo 1.'
            : pct >= 60
            ? 'Buen trabajo. Hay algunos conceptos que vale la pena repasar antes de seguir.'
            : 'Sigue practicando. Puedes repetir los niveles del Mundo 1 para reforzar.'}
        </Text>
        <TouchableOpacity style={styles.submitBtn} onPress={() => setStep(3)}>
          <Text style={styles.submitBtnText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderComplete = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeBadge}>🏆</Text>
      <Text style={styles.completeTitle}>¡Mundo 1 completado!</Text>
      <Text style={styles.completeSub}>
        Terminaste "¿Qué es la IA?". Entiendes qué puede y qué no puede la IA, cómo hablarle correctamente, y cómo usarla de forma responsable.
      </Text>
      <View style={styles.skillsList}>
        {[
          '✓ Sé qué es la IA y cómo aprende',
          '✓ Reconozco la IA en apps que uso cada día',
          '✓ Construyo prompts con los 4 ingredientes',
          '✓ Uso la IA de forma ética y responsable',
          '✓ Puedo diseñar un proyecto básico con IA',
        ].map((s, i) => <Text key={i} style={styles.skillItem}>{s}</Text>)}
      </View>
      <Text style={styles.xpText}>⭐ {xp} XP ganados en esta evaluación</Text>
      <TouchableOpacity style={styles.submitBtn} onPress={handleFinish}>
        <Text style={styles.submitBtnText}>Volver al mapa →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderQuiz();
      case 1: return renderTF();
      case 2: return renderResult();
      case 3: return renderComplete();
      default: return null;
    }
  };

  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` as any }]} />
        </View>
        <Text style={styles.xpCounter}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  xpCounter: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 20, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  quizCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  quizQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  quizOption: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 6, gap: 8, backgroundColor: colors.background },
  quizSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  quizCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  quizWrong: { borderColor: colors.error, backgroundColor: '#fef2f2' },
  quizLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 24, ...typography.bold, fontSize: 11 },
  quizOptText: { flex: 1, ...typography.regular, fontSize: 12, color: colors.textPrimary },
  explainBox: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  explainOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  explainFail: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  explainText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  tfCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fef2f2' },
  submitBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  scoreCircle: { alignSelf: 'center', width: 120, height: 120, borderRadius: 60, backgroundColor: '#eff6ff', borderWidth: 3, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginVertical: 20 },
  scoreNum: { ...typography.extraBold, fontSize: 32, color: colors.primary },
  scoreLabel: { ...typography.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  starIcon: { fontSize: 30 },
  starOn: { opacity: 1 },
  starOff: { opacity: 0.3 },
  xpText: { ...typography.bold, fontSize: 16, color: colors.accentDark, textAlign: 'center', marginBottom: 16 },
  breakdown: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownLabel: { ...typography.regular, fontSize: 13, color: colors.textSecondary },
  breakdownVal: { ...typography.bold, fontSize: 13, color: colors.textPrimary },
  feedbackText: { ...typography.regular, fontSize: 14, color: colors.textPrimary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeBadge: { fontSize: 60, marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 24, color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  completeSub: { ...typography.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  skillsList: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  skillItem: { ...typography.regular, fontSize: 13, color: colors.textPrimary, marginBottom: 8, lineHeight: 20 },
});
