import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type EthicsItem = { text: string; correct: string; explain: string };
type SprintItem = { text: string; good: boolean };
type FillItem = { sentence: string; allOpts: string[]; correct: Record<string, number>; explain: string };
type BuilderRow = { key: string; label: string; opts: string[] };

const TOTAL_STEPS = 23; // 0:intro + 19 módulos + 2 reflexiones + 1:complete
const CONTENT_STEPS = 19;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const DIAGNOSIS_Q_POOL: QuizItem[] = [
  { q: 'Cuando un médico moderno usa IA para diagnóstico, lo correcto es:', opts: ['La IA reemplaza al médico', 'La IA asiste al médico — sugiere posibilidades, el médico decide con su contexto', 'Solo la IA decide', 'Solo el médico'], correct: 1, explain: 'Asistencia, no reemplazo. El médico tiene contexto del paciente que la IA no tiene.' },
  { q: 'Una IA puede detectar enfermedades a partir de:', opts: ['Solo síntomas', 'Imágenes médicas + síntomas + historia clínica + datos de wearables — análisis multimodal', 'Solo edad', 'Solo dieta'], correct: 1, explain: 'IA médica multimodal: combina rayos X, blood tests, history, lifestyle.' },
  { q: 'La IA puede detectar Parkinson antes que un médico humano por:', opts: ['Magia', 'Cambios sutiles en habla y patrón de tipeo en celular — detectables con IA, invisibles a humanos', 'Adivinación', 'El color de los ojos'], correct: 1, explain: 'Apps experimentales detectan micro-cambios en tono/ritmo de voz. Detecta Parkinson 2-3 años antes que un neurólogo.' },
  { q: 'Por qué los hospitales son cautelosos al adoptar IA en diagnóstico:', opts: ['Por capricho', 'Errores tienen consecuencias graves — vida y muerte. Necesitan validación rigurosa', 'Por costo nada más', 'Por moda'], correct: 1, explain: 'Validación clínica = años de pruebas. La FDA exige evidencia en miles de pacientes.' },
  { q: 'El campo médico donde la IA tiene mayor avance hoy es:', opts: ['Cirugía cerebral', 'Radiología (interpretación de imágenes) — porque las imágenes son perfectas para visión por computador', 'Psiquiatría', 'Nutrición'], correct: 1, explain: 'Visión + imágenes médicas = combinación natural. Radiología, dermatología y oftalmología lideran adopción de IA.' },
];

const PROTEIN_Q_POOL: QuizItem[] = [
  { q: '¿Para qué sirven las proteínas en tu cuerpo?', opts: ['Solo para músculos', 'Son los "trabajadores" moleculares: hacen TODO — digerir, defender, transportar oxígeno, estructurar tejidos', 'Solo para uñas', 'Solo para pelo'], correct: 1, explain: 'Proteínas: enzimas (digestión), anticuerpos (defensa), hemoglobina (oxígeno), colágeno (estructura).' },
  { q: '¿Por qué importa la FORMA 3D de una proteína?', opts: ['Para verse bonita', 'Las proteínas funcionan según su forma — si está mal plegada, NO trabaja', 'No importa', 'Solo el color'], correct: 1, explain: 'Forma 3D = función. Proteínas mal plegadas causan Alzheimer, Parkinson y otras enfermedades.' },
  { q: 'Antes de AlphaFold, predecir estructura de UNA proteína tomaba:', opts: ['10 minutos', 'Años de trabajo experimental, a veces décadas', '1 día', '1 hora'], correct: 1, explain: 'Cristalografía de rayos X y resonancia magnética. Caro, lento, no siempre exitoso. AlphaFold lo hace en horas.' },
  { q: '¿Qué hace AlphaFold con las proteínas?', opts: ['Las dibuja en color', 'Predice su estructura 3D a partir de la secuencia de aminoácidos — con precisión similar a métodos experimentales', 'Las inventa', 'Solo las pinta'], correct: 1, explain: 'Input: secuencia de letras (aminoácidos). Output: forma 3D. Tan preciso como métodos experimentales.' },
  { q: 'AlphaFold ha resuelto la estructura de:', opts: ['10 proteínas', '200 millones de proteínas — esencialmente TODAS las conocidas en organismos vivos', 'Solo humanos', 'Cero'], correct: 1, explain: '200M proteínas catalogadas. Open source en EBI. Revolucionó biomedicina globalmente.' },
  { q: 'Una aplicación directa de AlphaFold para tu salud:', opts: ['Ninguna', 'Diseño rápido de medicamentos personalizados — para tu enfermedad específica', 'Solo cosmética', 'Maquillaje'], correct: 1, explain: 'AlphaFold permite diseñar moléculas que se "enchufan" exactamente con la proteína defectuosa de una enfermedad.' },
];

const HEALTH_Q_POOL: QuizItem[] = [
  { q: 'AlphaFold ganó Nobel de Química 2024 por:', opts: ['Inventar antibióticos', 'Predecir estructura 3D de proteínas — aceleró biomedicina 50 años en 4', 'Curar cáncer', 'Diseñar nuevos genes'], correct: 1, explain: 'Hassabis y Jumper de DeepMind. Nobel a un sistema de IA. Marca un antes y después.' },
  { q: '¿Cuál vacuna fue desarrollada con ayuda significativa de IA?', opts: ['Solo viejas vacunas', 'Las vacunas COVID mRNA (Pfizer, Moderna) — 11 meses vs 10-15 años tradicional', 'Solo en futuro', 'Ninguna'], correct: 1, explain: 'COVID validó IA en biomedicina como nada antes. La velocidad fue posible porque IA optimizó cada etapa.' },
  { q: 'Apple Watch detecta:', opts: ['Solo pasos', 'Fibrilación auricular (ECG), caídas, ritmo cardíaco anormal — aprobado por FDA', 'Solo el clima', 'Nada útil médicamente'], correct: 1, explain: 'Series 4+ tiene ECG aprobado FDA. Casos reales documentados: ha alertado infartos antes de síntomas.' },
  { q: 'El primer medicamento aprobado por FDA basado en CRISPR cura:', opts: ['Cáncer', 'Anemia falciforme — Casgevy aprobado en 2023', 'Diabetes', 'Calvicie'], correct: 1, explain: 'Casgevy: hito histórico de la medicina genética. Cura definitiva, no tratamiento.' },
  { q: 'El reto principal de chatbots terapéuticos como Woebot es:', opts: ['Sin reto', 'Distinguir cuándo derivar a humano profesional — para casos graves NO pueden reemplazarlo', 'Solo idiomas', 'Solo precio'], correct: 1, explain: 'Buen diseño = chatbot que reconoce sus límites y deriva. Mal diseño = chatbot que crea dependencia.' },
  { q: 'El gran dilema de la medicina del futuro es:', opts: ['Sin dilemas', 'Acceso desigual — tratamientos millonarios solo para ricos vs sistemas públicos colapsados', 'Solo costo', 'Solo idioma'], correct: 1, explain: 'Medicina avanza más rápido que sistemas de salud pública. Sin políticas valientes, será solo para élites.' },
];

const BIOETHICS_POOL: EthicsItem[] = [
  { text: 'Usar IA para detectar cáncer mejor en países con escasos radiólogos', correct: 'ok', explain: 'Aceptable: democratiza diagnóstico de calidad. Beneficio claro, sin reemplazar al médico humano.' },
  { text: 'CRISPR para curar a un niño de anemia falciforme con su autorización', correct: 'ok', explain: 'Aceptable: cura enfermedad grave existente con consentimiento informado.' },
  { text: 'Editar embriones para hacerlos más inteligentes o atléticos', correct: 'no', explain: 'Inaceptable: "eugenesia genética". Línea ética cruzada — convertir a humanos en productos diseñados.' },
  { text: 'Chatbot terapéutico para zona rural sin psicólogos disponibles, con derivación clara', correct: 'ok', explain: 'Aceptable: llena vacío real con derivación cuando es serio. Mejor que nada.' },
  { text: 'Sistema que niega seguro médico basado en datos genéticos predictivos', correct: 'no', explain: 'Inaceptable: discriminación genética. Por eso muchos países prohíben esto por ley.' },
  { text: 'IA que analiza tus datos médicos para personalizar dosis de medicamentos', correct: 'ok', explain: 'Aceptable: medicina de precisión. Mejora resultados sin riesgos éticos significativos.' },
  { text: 'App que diagnostica enfermedades sin involucrar nunca a un médico humano', correct: 'cuest', explain: 'Cuestionable: depende de la enfermedad. Para resfriado común OK; para cáncer no.' },
  { text: 'Empresa que vende tus datos genéticos a aseguradoras sin consentimiento', correct: 'no', explain: 'Inaceptable: violación masiva de privacidad. 23andMe ha tenido demandas reales por esto.' },
  { text: 'IA que sugiere tratamientos pero el médico humano decide y es responsable', correct: 'ok', explain: 'Aceptable: modelo correcto. IA como herramienta del médico, no reemplazo.' },
  { text: 'Sistema que decide automáticamente quién recibe trasplante de órgano', correct: 'no', explain: 'Inaceptable: decisiones de vida o muerte sobre órganos requieren juicio humano contextual.' },
];

const HOSPITAL_SPRINT_ITEMS: SprintItem[] = [
  { text: 'IA detecta tu enfermedad antes de que tengas síntomas (predictiva)', good: true },
  { text: 'Solo un médico humano sin IA, como en 1985', good: false },
  { text: 'Robots cirujanos asisten en operaciones complejas', good: true },
  { text: 'IA da diagnóstico y receta sin que NUNCA hable contigo un humano', good: false },
  { text: 'Tu reloj inteligente comparte datos con tu doctor en tiempo real', good: true },
  { text: 'Salas de espera de 6 horas como hoy', good: false },
  { text: 'Recepcionista digital que entiende síntomas y te dirige a especialista correcto', good: true },
  { text: 'Solo la IA decide tratamiento sin oír al paciente', good: false },
  { text: 'Medicamentos diseñados específicamente para TU genética', good: true },
  { text: 'Hospital sin pacientes — todo se hace en casa con telemedicina + wearables', good: true },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'El sistema de IA que predice estructura 3D de proteínas y ganó Nobel 2024 se llama _____.', allOpts: ['AlphaFold', 'AlphaGo', 'AlphaZero', 'AlphaStar'], correct: { fb0: 0 }, explain: 'AlphaFold: Hassabis y Jumper de DeepMind. Aceleró biomedicina 50 años en 4.' },
  { sentence: 'La técnica para editar genes específicos del ADN se llama _____.', allOpts: ['CRISPR', 'ADN', 'RNA', 'PCR'], correct: { fb0: 0 }, explain: 'CRISPR: Nobel 2020. Como editor de Word para tu ADN.' },
  { sentence: 'El primer medicamento aprobado por FDA basado en CRISPR cura la anemia _____.', allOpts: ['falciforme', 'perniciosa', 'ferropénica', 'aplásica'], correct: { fb0: 0 }, explain: 'Casgevy aprobado en 2023. Cura definitiva al 90% de pacientes.' },
  { sentence: 'El reloj inteligente más reconocido por detectar problemas cardíacos antes de síntomas es Apple _____.', allOpts: ['Watch', 'Health', 'Care', 'Vitals'], correct: { fb0: 0 }, explain: 'Apple Watch desde Series 4 (2018). Tiene ECG aprobado FDA.' },
];

const BUILDER_HEALTH = {
  xp: 22,
  rows: [
    { key: 'wearable', label: 'Wearable que vas a usar', opts: ['Apple Watch (ECG + caídas + actividad — más completo)', 'Garmin/Oura (foco en sueño + recuperación + ejercicio)', 'Whoop (atletas profesionales — cargas + recuperación)', 'Fitbit (más asequible, función básica completa)', 'Sin wearable de momento — solo apps gratuitas en celular'] },
    { key: 'monitoreo', label: 'Datos que vas a monitorear', opts: ['Sueño profundo + ritmo cardíaco en reposo (recuperación)', 'Pasos + actividad diaria (sedentarismo)', 'Variabilidad cardíaca (estrés crónico)', 'Calidad del aire local + ejercicio al aire libre', 'Glucosa con monitor continuo (si diabético/prediabético)'] },
    { key: 'salud_mental', label: 'Estrategia de salud MENTAL', opts: ['Meditación con app (Headspace, Calm) 10 min al día', 'Diario digital con IA que detecta patrones de estrés', 'Chatbot terapéutico estructurado (no Replika style)', 'Terapia humana profesional + IA como complemento', 'Sin tecnología — solo conversaciones humanas reales'] },
    { key: 'alimentacion', label: 'Sistema de ALIMENTACIÓN', opts: ['App que escanea código de barras y analiza nutrición', 'Diario de comidas con IA que sugiere ajustes', 'Plan personalizado según tus datos genéticos', 'Sin app — comer comida real, leer etiquetas tradicionalmente', 'Combinación de tecnología + cocina casera consciente'] },
  ],
};

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World6Level5({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [diagnosisQItems] = useState(() => pickN(DIAGNOSIS_Q_POOL, 5));
  const [proteinQItems] = useState(() => pickN(PROTEIN_Q_POOL, 6));
  const [healthQItems] = useState(() => pickN(HEALTH_Q_POOL, 6));
  const [bioethicsItems] = useState(() => pickN(BIOETHICS_POOL, 6));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);

  // Estados de módulos
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [sprintPicks, setSprintPicks] = useState<Record<number, string>>({});
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ethicsAnswers, setEthicsAnswers] = useState<Record<number, string>>({});
  const [ethicsDone, setEthicsDone] = useState(false);

  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  const [builderHealth, setBuilderHealth] = useState<Record<string, string>>({});

  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([7, 9, 11, 16, 19, 20]);
  const isExam = examSteps.has(step);

  useEffect(() => { setAllowBack?.(!isExam); }, [isExam, setAllowBack]);
  useEffect(() => {
    const bh = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExam) { Alert.alert('Actividad en curso', 'No puedes regresar ahora.'); return true; }
      return false;
    });
    return () => bh.remove();
  }, [isExam]);

  useEffect(() => {
    if (step === 7) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 9) { setSprintPicks({}); setSprintSec(90); setSprintStarted(false); setSprintDone(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
    if (step === 11) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 16) { setEthicsAnswers({}); setEthicsDone(false); }
    if (step === 19) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 20) { setBuilderHealth({}); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3; else if (xp >= 120) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(35, stars, xp);
    router.back();
  };

  // Quiz genérico
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuizGen = (items: QuizItem[]) => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < items.length) { Alert.alert('Incompleto'); return false; }
    setQuizChecked(true);
    let c = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert(`${c}/${items.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Sprint
  const startSprint = () => {
    setSprintStarted(true); setSprintSec(90);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { clearInterval(sprintTimer.current!); endSprint(); return 0; } return prev - 1; });
    }, 1000);
  };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = HOSPITAL_SPRINT_ITEMS[i];
    setSprintPicks((p) => ({ ...p, [i]: item.good ? 'good' : 'bad' }));
    const newPicks = { ...sprintPicks, [i]: item.good ? 'good' : 'bad' };
    const good = Object.values(newPicks).filter((v) => v === 'good').length;
    const totalGood = HOSPITAL_SPRINT_ITEMS.filter((x) => x.good).length;
    if (good >= 5 || good === totalGood) endSprint();
  };
  const endSprint = () => {
    if (sprintDone) return;
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const good = Object.values(sprintPicks).filter((v) => v === 'good').length;
    const bad = Object.values(sprintPicks).filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    if (earned > 0) addXP(earned);
    Alert.alert(good >= 5 ? '¡Sprint logrado!' : 'No alcanzaste la meta', `${good} buenas, ${bad} malas. +${earned} XP`);
  };

  // Ethics
  const pickEthics = (i: number, col: string) => { if (!ethicsDone) setEthicsAnswers((p) => ({ ...p, [i]: col })); };
  const checkEthics = () => {
    if (ethicsDone) return true;
    if (Object.keys(ethicsAnswers).length < bioethicsItems.length) { Alert.alert('Clasifica todos'); return false; }
    setEthicsDone(true);
    let c = 0;
    bioethicsItems.forEach((item, i) => { if (ethicsAnswers[i] === item.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${bioethicsItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Fill
  const selFill = (i: number) => { if (!fillChecked) setFillSel(i); };
  const checkFill = () => {
    if (fillChecked) return true;
    if (fillSel === null) { Alert.alert('Elige una opción'); return false; }
    setFillChecked(true);
    if (fillSel === fillItem.correct.fb0) addXP(10);
    Alert.alert(fillSel === fillItem.correct.fb0 ? '✅ +10 XP' : '❌', fillItem.explain);
    return false;
  };

  // Builder
  const selBuilder = (key: string, val: string) => setBuilderHealth((p) => ({ ...p, [key]: val }));
  const checkBuilder = () => {
    if (Object.keys(builderHealth).length < BUILDER_HEALTH.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(BUILDER_HEALTH.xp);
    return true;
  };

  // Reflexión
  const checkReflect = (minLen: number, xpAward: number) => {
    if (reflectVal.trim().length >= minLen) { addXP(xpAward); return true; }
    Alert.alert(`Mínimo ${minLen} caracteres`);
    return false;
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🧬</Text></View>
      <Text style={styles.title}>IA y Tu Salud: La Medicina que Viene por Ti</Text>
      <Text style={styles.subtitle}>La medicina más avanzada del siglo XXI se está construyendo HOY, con IA que ya detecta cáncer mejor que radiólogos, relojes que predicen infartos, y CRISPR que cura enfermedades antes incurables.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>IA YA en tu salud (Apple Watch, radiología) · Detección de cáncer · Wearables salvavidas · AlphaFold (Nobel 2024) · CRISPR + IA · Vacunas COVID · Bioética · Longevidad · Acceso desigual.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ Qué podrás HACER</Text><Text style={styles.cardText}>Tener visión clara de cómo la IA YA cambió la medicina. Conocer casos reales LATAM. Tener tu plan personal de salud con IA.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#4338ca' }]}>Nivel 35 · 20 módulos</Text></View>
      <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}><Text style={[styles.tagText, { color: '#831843' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>La medicina que viene por ti</Text>
      <Text style={styles.bodyText}>La medicina más avanzada del siglo XXI <Text style={{ fontWeight: 'bold' }}>no se está construyendo en hospitales del futuro</Text>. Se está construyendo HOY.</Text>
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 Tres datos:</Text> 2018: Apple Watch aprobado FDA para detectar fibrilación auricular. 2024: AlphaFold gana Nobel. 2024: Casgevy (CRISPR) aprobado para curar anemia falciforme.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🧬 Las 4 áreas que ya cambiaron</Text><Text style={styles.cardText}>1. Diagnóstico: IA + médico {'>'} médico solo.{'\n'}2. Wearables: Apple Watch, Whoop predicen problemas.{'\n'}3. Medicamentos: AlphaFold + IA reducen 10-15 años a 18 meses.{'\n'}4. Genética: CRISPR + IA curando enfermedades antes incurables.</Text></View>
    </View>
  );

  const renderReflect = (tag: string, title: string, question: string, placeholder: string, minLen: number, xpLabel: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>{tag} · +{xpLabel} XP</Text></View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>{question}</Text>
      </View>
      <TextInput style={styles.textArea} multiline placeholder={placeholder} value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.length} / {minLen} mínimo</Text>
    </View>
  );

  const renderExpandCards = (cards: { emoji: string; title: string; body: string; fact: string }[], tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {cards.map((c, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{c.emoji} {c.title}</Text>
          <Text style={styles.cardText}>{c.body}</Text>
          <View style={[styles.highlight, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b', marginTop: 6 }]}>
            <Text style={{ color: '#92400e', fontSize: 11 }}>{c.fact}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderQuiz = (items: QuizItem[], tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#be185d', backgroundColor: '#fdf2f8' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fee2e2' }]}><Text style={[styles.tagText, { color: '#991b1b' }]}>⏱ Módulo 9 · Sprint</Text></View>
      <Text style={styles.title}>El hospital del futuro · ¿Qué será REAL?</Text>
      <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 10 ? '#dc2626' : '#c2410c', marginVertical: 8 }}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
      {!sprintStarted && !sprintDone && (
        <TouchableOpacity style={styles.nextBtn} onPress={startSprint}><Text style={styles.nextText}>⚡ Iniciar Sprint</Text></TouchableOpacity>
      )}
      {(sprintStarted || sprintDone) && HOSPITAL_SPRINT_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.sprintItem, sprintPicks[i] === 'good' && { borderColor: '#16a34a', backgroundColor: '#dcfce7' }, sprintPicks[i] === 'bad' && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]}
          onPress={() => pickSprint(i)}
          disabled={sprintDone || sprintPicks[i] !== undefined}
        >
          <Text style={{ flex: 1, fontSize: 11 }}>{item.text}</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{sprintPicks[i] === 'good' ? '✅' : sprintPicks[i] === 'bad' ? '❌' : ''}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEthics = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>⚖️ Módulo 16 · Clasificador ético</Text></View>
      <Text style={styles.title}>Bioética · Límites de la IA en medicina</Text>
      {bioethicsItems.map((item, i) => (
        <View key={i} style={[styles.card, { marginBottom: 8 }]}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>{i + 1}. {item.text}</Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {['ok', 'cuest', 'no'].map((col) => (
              <TouchableOpacity key={col} style={[styles.ethOpt, ethicsAnswers[i] === col && { borderColor: '#be185d', backgroundColor: '#fdf2f8' }]} onPress={() => pickEthics(i, col)} disabled={ethicsDone}>
                <Text style={{ fontSize: 11, fontWeight: '600' }}>{col === 'ok' ? '✅ Aceptable' : col === 'cuest' ? '⚠️ Cuestionable' : '❌ Inaceptable'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderBuilderHealth = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}><Text style={[styles.tagText, { color: '#831843' }]}>🛠️ Módulo 20 · Builder</Text></View>
      <Text style={styles.title}>Tu plan de salud personal con IA</Text>
      {BUILDER_HEALTH.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#831843', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, builderHealth[row.key] === opt && { borderColor: '#be185d', backgroundColor: '#fdf2f8' }]} onPress={() => selBuilder(row.key, opt)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 56 }}>🧬</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 35 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "IA y Tu Salud: La Medicina que Viene por Ti". Ahora eres BioTech Pioneer.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#be185d', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderReflect('🤔 Tu historia personal', 'Piensa tú', '¿Alguien en tu familia ha tenido cáncer, Alzheimer, diabetes, o alguna enfermedad grave? ¿Qué SIENTES cuando piensas que estadísticamente alguien cercano te tocará vivirlo?', 'En mi familia... Sentí...', 80, '14');
      case 3: return renderExpandCards([
        { emoji: '📱', title: 'Tu teléfono YA tiene IA médica', body: 'Apple Watch detecta fibrilación auricular desde 2018. Samsung Galaxy Watch monitorea presión arterial. Garmin y Whoop predicen enfermedad antes de síntomas.', fact: '⭐ Caso real: Apple Watch ha detectado infartos antes de que el portador supiera.' },
        { emoji: '🏥', title: 'El radiólogo que ya no trabaja solo', body: 'En hospitales serios del mundo, los radiólogos ya trabajan CON IA. Detecta cáncer en mamografías, tumores en TACs, fracturas en rayos X.', fact: '⭐ IA detecta cáncer de mama 9% más temprano que radiólogo solo.' },
        { emoji: '💊', title: 'Tu farmacia ya usa IA', body: 'Cuando consultas interacciones de medicamentos, la base de datos detrás usa IA. Sistemas como Epic verifican con IA interacciones peligrosas.', fact: '⭐ La IA en salud no es futuro — es presente. Solo que silencioso.' },
      ], '📱 Módulo 3 · Presente', 'La IA YA está en tu salud');
      case 4: return renderReflect('💝 Reflexión familiar', 'Piensa tú', '¿Alguien en tu familia ha tenido cáncer, diabetes, Alzheimer? ¿Qué SIENTES cuando piensas que la IA podría estar ayudando a curar a alguien que tú quieres?', 'Lo que siento es... porque...', 120, '16');
      case 5: return renderExpandCards([
        { emoji: '👀', title: 'IA detecta cáncer mejor que radiólogos', body: 'Modelos de IA detectan cáncer de mama, pulmón y piel con 5-10% mayor precisión que radiólogos especialistas.', fact: '⭐ Fundación Santa Fe (Bogotá) implementó IA para mamografías desde 2022.' },
        { emoji: '🇨🇴', title: 'IA en oncología latinoamericana', body: 'El Instituto Nacional de Cancerología en Colombia usa IA para análisis patológico desde 2023.', fact: '⭐ Reto LATAM: hospitales privados premium tienen IA, públicos en muchas regiones aún no.' },
        { emoji: '🤖', title: 'Watson Health · La gran promesa que falló', body: 'IBM invirtió $4B USD entre 2014-2022. Falló por exceso de promesas y datos pobres.', fact: '⭐ Lección: la IA en salud no es magia — requiere datos ENORMES y de calidad.' },
      ], '🎗️ Módulo 5 · Cáncer', 'IA detecta cáncer mejor que radiólogos');
      case 6: return renderExpandCards([
        { emoji: '⌚', title: 'Apple Watch · El reloj que detecta infartos', body: 'ECG desde 2018. Detecta fibrilación auricular automáticamente. Aprobado por FDA como dispositivo médico.', fact: '⭐ Hombre de 47 años en Chicago salvó su vida porque Apple Watch detectó arritmia.' },
        { emoji: '💪', title: 'Whoop y Oura · Salud predictiva', body: 'Usan IA para predecir cuándo te vas a enfermar. Detectan cambios en variabilidad cardíaca antes de síntomas.', fact: '⭐ Estudio Stanford: wearables predijeron COVID en 70% de casos antes de síntomas.' },
        { emoji: '🩸', title: 'Glucómetros continuos con IA', body: 'Dexcom y Libre conectan a teléfono con IA que predice hipoglucemias. Salvan vidas reales.', fact: '⭐ En Argentina, México, Brasil hay subsidios públicos para pacientes diabéticos.' },
      ], '⌚ Módulo 6 · Wearables', 'Tu reloj podría salvar tu vida');
      case 7: return renderQuiz(diagnosisQItems, '❓ Módulo 7 · Quiz', 'IA en diagnóstico médico');
      case 8: return renderExpandCards([
        { emoji: '💬', title: 'Woebot · Chatbot terapéutico aprobado por FDA', body: 'Creado por psicólogas de Stanford. Implementa terapia cognitivo-conductual. Si detecta crisis, deriva a líneas de ayuda.', fact: '⭐ Usuarios reportan reducción de síntomas similar a terapia humana de baja intensidad.' },
        { emoji: '📱', title: 'Wysa, Replika · La complejidad', body: 'Wysa tiene 5M+ usuarios. Replika creó controversia: usuarios desarrollaron "relaciones románticas" con su IA.', fact: '⭐ Lección: chatbots de salud mental requieren diseño cuidadoso con límites y derivación.' },
        { emoji: '🇨🇴', title: 'Salud mental LATAM y la IA', body: 'LATAM tiene crisis de salud mental: 1 psicólogo por 50,000 habitantes en zonas rurales. Apps con IA llegan donde no hay terapeutas.', fact: '⭐ ¿Es mejor un chatbot que NADA? Probablemente sí, con derivación clara.' },
      ], '💬 Módulo 8 · Salud mental', 'IA y salud mental · ¿Terapeuta de bolsillo?');
      case 9: return renderSprint();
      case 10: return renderExpandCards([
        { emoji: '🏆', title: 'AlphaFold · Premio Nobel 2024', body: 'Demis Hassabis y John Jumper de DeepMind ganaron Nobel de Química 2024. IA que predice estructura 3D de proteínas.', fact: '⭐ AlphaFold aceleró 50 años de biomedicina en 4 años. Por eso Nobel.' },
        { emoji: '💊', title: 'Diseño de medicamentos · De 12 años a 18 meses', body: 'Con IA + AlphaFold: empresas llevan medicamentos a fase clínica en 18-24 meses.', fact: '⭐ Primer medicamento descubierto enteramente por IA en fase clínica III en 2024.' },
        { emoji: '🧬', title: 'Aplicaciones reales hoy', body: 'AlphaFold: diseño de antibióticos, tratamientos para enfermedades raras, entender Alzheimer y Parkinson a nivel molecular.', fact: '⭐ Open source: cualquier laboratorio puede usarlo gratis. Democratización masiva de biotecnología.' },
      ], '🏆 Módulo 10 · AlphaFold', 'AlphaFold · El descubrimiento más importante del siglo');
      case 11: return renderQuiz(proteinQItems, '❓ Módulo 11 · Quiz', '¿Qué es una proteína? (en serio, simple)');
      case 12: return renderExpandCards([
        { emoji: '💉', title: 'De 12 años a 18 meses', body: 'Antes de COVID: vacuna nueva = 10-15 años. Para COVID: primera vacuna mRNA en 11 meses. IA fue clave en cada paso.', fact: '⭐ Moderna usó IA para diseñar candidatos en 1 fin de semana.' },
        { emoji: '🌍', title: 'Distribución global con IA', body: 'IA optimizó rutas, predijo demanda local, evitó desperdicio de vacunas a 7 mil millones de personas.', fact: '⭐ Sin IA, hubieran muerto más por logística que por virus en muchas zonas.' },
        { emoji: '🦠', title: 'Próxima pandemia · Estamos preparados', body: 'Programas como SCAN usan IA para detectar nuevos virus emergiendo en tiempo real.', fact: '⭐ Habrá próxima pandemia. La pregunta es si responderemos en semanas (con IA) o en meses.' },
      ], '💉 Módulo 12 · COVID', 'La IA que aceleró las vacunas del COVID');
      case 13: return renderExpandCards([
        { emoji: '✂️', title: 'CRISPR · Cortar y pegar el ADN', body: 'Como un editor de Word para tu ADN. Permite corregir errores que causan enfermedades. Ganó Nobel 2020.', fact: '⭐ Primera medicina aprobada por FDA basada en CRISPR: Casgevy para anemia falciforme.' },
        { emoji: '💪', title: 'Enfermedades genéticas curables HOY', body: 'Anemia falciforme: cura del 90% de pacientes. Beta-talasemia: tratamiento único. Distrofia muscular: ensayos avanzados.', fact: '⭐ Niños latinoamericanos viajan a EE.UU. para acceder. Costo: $2.2M USD.' },
        { emoji: '🔬', title: 'IA + CRISPR · La combinación', body: 'IA predice efectos no deseados antes de editar, optimiza eficiencia, diseña secuencias guía perfectas.', fact: '⭐ Próximos 10 años: 50-100 enfermedades "incurables" tendrán tratamiento real.' },
      ], '✂️ Módulo 13 · CRISPR', 'CRISPR · Cortar y pegar el ADN enfermo');
      case 14: return renderReflect('⚖️ Ética genética', 'Piensa tú', 'CRISPR puede curar enfermedades genéticas. Pero también puede "mejorar" personas: más inteligentes, más altos, con ojos azules. ¿Dónde está la línea? ¿Curar enfermedades sí, mejorar rasgos no? ¿Si tu hijo pudiera nacer libre de cáncer hereditario, lo harías?', 'Mi línea sería... Si fuera mi hijo...', 140, '18');
      case 15: return renderExpandCards([
        { emoji: '🔬', title: 'Da Vinci · 14M cirugías reales', body: 'Brazos robóticos controlados por cirujano con precisión sub-milimétrica, sin temblor, vista 3D HD.', fact: '⭐ Fundación Santa Fe (Bogotá), Imbanaco (Cali), Soma (Medellín) tienen Da Vinci.' },
        { emoji: '🧠', title: 'Próximos pasos · Cirugía autónoma', body: 'STAR demostró suturas más uniformes que humanos. VICAR hace cirugías oculares autónomas.', fact: '⭐ Bioética compleja: ¿quién es responsable si IA quirúrgica daña?' },
        { emoji: '🌍', title: 'Acceso desigual · El gran problema', body: 'Da Vinci cuesta $2M USD por sistema. Solo hospitales premium lo tienen.', fact: '⭐ ¿Debería el sistema público financiar Da Vinci? Algunos países sí, otros no.' },
      ], '🔬 Módulo 15 · Cirugía', 'Robots cirujanos · Da Vinci y lo que viene');
      case 16: return renderEthics();
      case 17: return renderReflect('🌍 Acceso y desigualdad', 'Piensa tú', 'La medicina del futuro es brutalmente cara: CRISPR $2.2M USD, Da Vinci $2M USD. ¿Es esto inevitable o injusto? ¿Cómo aseguramos que la medicina del futuro NO sea solo para ricos?', 'Es injusto/inevitable porque... Mi propuesta para LATAM sería...', 140, '18');
      case 18: return renderExpandCards([
        { emoji: '⏰', title: 'Calico (Google) · La empresa de la longevidad', body: 'Google fundó Calico en 2013 para estudiar el envejecimiento como enfermedad. Ha invertido $2B+ USD.', fact: '⭐ NO ha lanzado tratamientos comerciales. La longevidad es más compleja de lo que el optimismo sugería.' },
        { emoji: '💊', title: 'Drogas anti-envejecimiento existentes', body: 'Rapamicina, metformina, NAD+ supplements. Resultados modestos en humanos, prometedores en animales.', fact: '⭐ Mucho hype, evidencia humana limitada. No una píldora mágica.' },
        { emoji: '🧬', title: 'El reto científico real', body: 'Envejecer son 10+ procesos biológicos simultáneos. Resolver uno solo no extiende vida significativamente.', fact: '⭐ Probablemente extenderemos vida saludable 10-15 años más, pero NO inmortalidad.' },
      ], '⏰ Módulo 18 · Longevidad', '¿Podrá la IA frenar el envejecimiento?');
      case 19: return renderQuiz(healthQItems, '❓ Módulo 19 · Quiz', 'Quiz final · IA y salud');
      case 20: return renderBuilderHealth();
      case 21: return renderReflect('✍️ Tu reflexión final', 'Piensa tú', '¿Qué enfermedad que afecta a alguien que tú quieres quisieras que la IA cure primero? ¿Qué papel quieres jugar TÚ — como paciente, como futuro profesional de salud, como ciudadano?', 'Quisiera que cure primero... porque... Lo que siento...', 150, '22');
      case 22: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => checkReflect(80, 14),
      4: () => checkReflect(120, 16),
      7: () => checkQuizGen(diagnosisQItems),
      9: () => sprintDone,
      11: () => checkQuizGen(proteinQItems),
      14: () => checkReflect(140, 18),
      16: checkEthics,
      17: () => checkReflect(140, 18),
      19: () => checkQuizGen(healthQItems),
      20: checkBuilder,
      21: () => checkReflect(150, 22),
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 4, 7, 9, 11, 14, 16, 17, 19, 20, 21].includes(step);
  const showCheck = [2, 4, 7, 9, 11, 14, 16, 17, 19, 20, 21].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>Comprobar</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#be185d', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#fdf2f8', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#be185d', borderRadius: 4, padding: 11, marginVertical: 8 },
  highlightText: { color: '#831843', fontSize: 13, lineHeight: 20 },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  sprintItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fed7aa', marginBottom: 6, backgroundColor: '#fff' },
  ethOpt: { padding: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#be185d', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#be185d', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});