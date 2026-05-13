import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FakeItem = { text: string; correct: string; explain: string };
type BuilderRow = { key: string; label: string; opts: string[] };

const TOTAL_STEPS = 7; // 0:intro + 5 módulos + 1:complete
const CONTENT_STEPS = 5;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const MASTER_Q_POOL: QuizItem[] = [
  { q: 'Diferencia clave entre IA estrecha (hoy) e IA general (AGI):', opts: ['IA estrecha es más cara', 'IA estrecha domina UN dominio; AGI dominaría CUALQUIER tarea como humano experto', 'Solo el color cambia', 'Son lo mismo'], correct: 1, explain: 'Narrow AI: ChatGPT, Claude (lenguaje). AGI hipotética: cualquier dominio. ASI: supera humanos en TODO.' },
  { q: 'Cuando una IA inventa información falsa con tono seguro, se dice que:', opts: ['Funciona bien', 'Alucina (hallucinates) — predice texto probable sin verificar verdad', 'Está cansada', 'No funciona'], correct: 1, explain: 'Alucinación: limitación inherente de LLMs. Por eso siempre verifica info importante.' },
  { q: 'El uso ético de IA implica:', opts: ['No usarla nunca', 'Verificar info, declarar cuándo usaste IA, considerar consecuencias, respetar privacidad', 'Usarla para todo', 'Solo para diversión'], correct: 1, explain: 'Ética práctica = honestidad sobre uso + responsabilidad sobre consecuencias + respeto a otros.' },
  { q: 'Los datos sesgados producen:', opts: ['Mejores modelos', 'Modelos sesgados que magnifican esos sesgos en sus salidas', 'Modelos neutros', 'Modelos veloces'], correct: 1, explain: 'Garbage in, garbage out. Si entrenas con datos sesgados raciales/género, el modelo amplifica esos sesgos.' },
  { q: 'Las apps que YA usas (Spotify, Maps, Netflix) tienen IA porque:', opts: ['Están de moda', 'IA permite recomendaciones, optimización de rutas, generación de subtítulos a escala imposible para humanos', 'Es decoración', 'Por error'], correct: 1, explain: 'IA invisible es la más común. Cada app moderna tiene capas de IA — solo no las ves explícitamente.' },
  { q: 'Los 4 ingredientes de un prompt efectivo son:', opts: ['Color, tamaño, idioma, fuente', 'Rol + Tarea + Contexto + Formato', 'Solo la pregunta', 'Tiempo, lugar, persona, modo'], correct: 1, explain: 'Rol (eres X) + Tarea (haz Y) + Contexto (sabiendo Z) + Formato (en formato W). Núcleo de prompting.' },
  { q: '"Few-shot prompting" significa:', opts: ['Sin ejemplos', 'Dar al modelo 2-5 ejemplos del resultado esperado para que generalice', 'Hacer preguntas rápidas', 'Solo en inglés'], correct: 1, explain: 'Few-shot: "...y ahora aplica el mismo patrón a esto". Mejora calidad significativamente vs zero-shot.' },
  { q: '"Chain-of-Thought" (CoT) sirve para:', opts: ['Hablar más bonito', 'Que el modelo razone paso a paso, mejorando precisión en problemas complejos', 'Cambiar idioma', 'Hacer cuentas'], correct: 1, explain: 'CoT: "piensa paso a paso". Reduce errores de razonamiento en matemáticas, lógica, decisiones.' },
  { q: 'El parámetro "temperatura" en una IA controla:', opts: ['Velocidad', 'Creatividad vs precisión: alta = creativa/aleatoria, baja = precisa/conservadora', 'Color', 'Tamaño'], correct: 1, explain: 'Temperatura 0 = siempre la misma respuesta probable. Temperatura 1+ = más variación creativa.' },
  { q: 'Si un prompt falla, lo correcto es:', opts: ['Repetirlo igual 10 veces', 'Identificar qué le faltó (rol, contexto, formato, ejemplos) y reformular', 'Cambiar de modelo', 'Rendirse'], correct: 1, explain: 'Iteración inteligente: diagnostica el fallo específico, ajusta, vuelve a intentar.' },
  { q: 'Al generar imágenes con IA, los "negative prompts" sirven para:', opts: ['Ser pesimista', 'Decirle al modelo qué NO incluir (ej: sin texto, sin manos extra, sin marca de agua)', 'Insultar al modelo', 'Hacer trampa'], correct: 1, explain: 'Negative prompts: "no quiero esto". Crítico para resultados profesionales.' },
  { q: 'Las herramientas líderes de imagen IA en 2025-2026 son:', opts: ['Solo MS Paint', 'Midjourney (estética), DALL-E (integrado en ChatGPT), Stable Diffusion (open source), Firefly (Adobe)', 'Solo Photoshop', 'Inexistentes'], correct: 1, explain: 'Cada una tiene fortalezas: Midjourney (arte), DALL-E (instrucciones complejas), SD (control técnico), Firefly (legalmente seguro).' },
  { q: 'ElevenLabs es famoso por:', opts: ['Editar fotos', 'Clonación de voz con IA — puede replicar tu voz con 30 segundos de audio', 'Hacer videos', 'Programar'], correct: 1, explain: 'ElevenLabs lidera voice cloning. Capacidades reales pero también riesgos éticos (deepfakes de voz).' },
  { q: 'AlphaFold (Nobel 2024) hizo qué exactamente:', opts: ['Crear arte', 'Predijo estructura 3D de 200M de proteínas, acelerando biomedicina 50 años en 4', 'Compuso música', 'Hizo películas'], correct: 1, explain: 'AlphaFold democratizó biomedicina. Cualquier estudiante ahora puede acceder a estructuras antes imposibles.' },
  { q: 'El "pipeline multimodal" significa:', opts: ['Solo texto', 'Combinar IA de texto + imagen + audio + video en flujo coordinado para crear algo más rico', 'Solo videos', 'Solo música'], correct: 1, explain: 'Pipeline multimodal: ej. texto → guion → imágenes generadas → audio narrado → video editado.' },
  { q: 'ChatGPT vs Claude · Diferencia clave:', opts: ['Solo el color', 'ChatGPT es generalista; Claude es más fuerte en razonamiento profundo, escritura larga y código', 'Son idénticos', 'ChatGPT es gratis'], correct: 1, explain: 'Cada modelo tiene fortalezas. Claude prioriza calidad y seguridad; GPT prioriza versatilidad e integración.' },
  { q: 'Gemini destaca por:', opts: ['Solo gratis', 'Integración con ecosistema Google (Drive, Gmail, Sheets) + ventana de contexto larga + multimodal nativo', 'Solo en China', 'No funciona'], correct: 1, explain: 'Gemini = ventaja Google: tu data ya está allí. Y su ventana de contexto supera competidores.' },
  { q: 'Perplexity es ideal para:', opts: ['Solo entretenimiento', 'Búsqueda con IA — combina LLM + búsqueda web en tiempo real, citando fuentes', 'Solo programación', 'Solo gaming'], correct: 1, explain: 'Perplexity: búsqueda inteligente con citas. Reemplaza Google para muchas consultas que requieren actualidad.' },
  { q: 'La elección de herramienta correcta depende de:', opts: ['Nada, todas son iguales', 'Tarea + presupuesto + privacidad + capacidades del modelo + curva de aprendizaje', 'Solo el precio', 'Solo el color'], correct: 1, explain: 'No hay "mejor IA absoluta". Hay "mejor IA para esta tarea, en este contexto".' },
  { q: 'Cuándo combinar varias IAs:', opts: ['Nunca', 'Cuando cada una aporta algo único (ej: Perplexity busca + Claude analiza + Midjourney visualiza)', 'Solo si pagas Premium', 'Solo en inglés'], correct: 1, explain: 'Stacks de IA: Perplexity + Claude + Lovable + Zapier es combo común para construir productos rápido.' },
  { q: 'El "system prompt" de un chatbot es:', opts: ['El primer mensaje', 'Las instrucciones invisibles que definen su comportamiento (rol, tono, objetivo, límites)', 'Su nombre', 'El idioma'], correct: 1, explain: 'System prompt: reglas secretas. Por eso un mismo modelo puede ser "tutor amigable" o "asistente legal".' },
  { q: 'Zapier vs Make vs n8n · Diferencia:', opts: ['Son idénticos', 'Zapier = más simple/popular, Make = más visual/poderoso, n8n = open source/autohosteable', 'Solo precio', 'Solo idioma'], correct: 1, explain: 'Mismo objetivo (automatización), enfoques diferentes.' },
  { q: 'MVP (Minimum Viable Product) significa:', opts: ['Producto perfecto', 'La versión más simple que VALIDA si tu idea resuelve un problema real con usuarios', 'Producto millonario', 'Solo prototipo'], correct: 1, explain: 'MVP: lo más pequeño que prueba tu hipótesis.' },
  { q: 'Lovable, Bolt, Bubble son herramientas de:', opts: ['Cocinar', 'No-code: construir apps web/móviles sin programar tradicional', 'Editar audio', 'Hacer cálculo'], correct: 1, explain: 'No-code 2024-2026 cambió todo. Construyes apps reales describiéndolas en lenguaje natural.' },
  { q: 'Un "elevator pitch" efectivo dura:', opts: ['10 minutos', '30-60 segundos: problema + solución + por qué tú', '5 segundos', '1 hora'], correct: 1, explain: 'Elevator pitch: si te encuentras a un inversor en un ascensor, ¿qué le dices en lo que dura el viaje?' },
  { q: 'Geoffrey Hinton (padre del deep learning) en 2023:', opts: ['Inventó nuevo modelo', 'Renunció a Google para hablar libremente sobre RIESGOS existenciales de IA', 'Se retiró', 'Cambió de profesión'], correct: 1, explain: 'Hinton, Premio Turing, dejó Google a los 75 años para advertir. Cambió de optimista a alertista público.' },
  { q: 'El "problema de alineación" en IA es:', opts: ['Los robots se desalinean', 'Garantizar que objetivos de IA súper capaz sean COMPATIBLES con valores humanos', 'Color de la pantalla', 'Rotación física'], correct: 1, explain: 'Alineación: campo entero de investigación. Corazón de la seguridad de IA.' },
  { q: 'Da Vinci (sistema robótico) ha realizado:', opts: ['10 cirugías', '14 millones de cirugías reales — sistema robótico quirúrgico más usado del mundo', 'Solo demos', 'Cero'], correct: 1, explain: '14M cirugías reales globalmente. En Colombia: Fundación Santa Fe, Imbanaco, Soma.' },
  { q: 'Waymo opera servicio de robotaxi REAL en:', opts: ['Solo en demos', 'Phoenix, San Francisco, Los Angeles, Austin — 100,000+ viajes semanales sin conductor', 'Solo Asia', 'Inexistente'], correct: 1, explain: 'Waymo no es ciencia ficción. Es producto comercial real.' },
  { q: 'Casgevy (medicamento basado en CRISPR aprobado por FDA en 2023) cura:', opts: ['Cáncer', 'Anemia falciforme — cura definitiva al 90% de pacientes (no tratamiento crónico)', 'Diabetes', 'COVID'], correct: 1, explain: 'Hito histórico: primera terapia CRISPR aprobada FDA. Costo: $2.2M USD/paciente.' },
  { q: 'El gran reto de la medicina del futuro NO es la tecnología — es:', opts: ['Idioma', 'Acceso desigual: tratamientos millonarios solo para ricos vs sistemas públicos colapsados', 'Color', 'Velocidad'], correct: 1, explain: 'Medicina avanza más rápido que sistemas de salud pública. Sin políticas valientes, será solo para élites.' },
  { q: 'El balance neto de la IA para el planeta depende de:', opts: ['Está condenado', 'Cómo se use: optimizar redes/predicción climática = bueno; consumo masivo sin propósito = malo', 'El color', 'Solo precio'], correct: 1, explain: 'MIT: $1 invertido en IA optimizadora ahorra $5-10 en consumo global.' },
];

const FAKE_POOL: FakeItem[] = [
  { text: 'Las IAs actuales (ChatGPT, Claude, Gemini) son AGI (Inteligencia General Artificial)', correct: 'no', explain: 'MITO. Son IAs estrechas — muy capaces en lenguaje, pero NO general.' },
  { text: 'Una IA puede "alucinar" — inventar información falsa con tono seguro', correct: 'ok', explain: 'VERDAD. Limitación inherente. Por eso siempre verifica info importante.' },
  { text: 'AlphaFold ganó el Nobel de Química 2024 por predecir estructura de proteínas', correct: 'ok', explain: 'VERDAD. Hassabis y Jumper de DeepMind. Hito histórico.' },
  { text: 'Si una IA pasa el Test de Turing, es definitivamente consciente', correct: 'no', explain: 'MITO. Pasar el test = imitar conversación humana. NO implica consciencia.' },
  { text: 'Los autos Tesla Autopilot son técnicamente "totalmente autónomos" (Nivel 5)', correct: 'no', explain: 'MITO. Autopilot/FSD son Nivel 2 técnicamente, pese a marketing.' },
  { text: 'Casgevy (CRISPR) cura anemia falciforme con tratamiento único — pero cuesta $2.2M USD', correct: 'ok', explain: 'VERDAD. Hito histórico de medicina genética. Acceso desigual real.' },
  { text: 'Los chatbots terapéuticos como Woebot pueden REEMPLAZAR completamente a un terapeuta', correct: 'no', explain: 'MITO. Buen diseño = COMPLEMENTO + derivación a humano para casos serios.' },
  { text: 'DeepMind redujo 40% el consumo energético de los data centers de Google con IA', correct: 'ok', explain: 'VERDAD. Caso emblemático 2016. La misma IA que consume energía también optimiza.' },
  { text: 'Alan Turing inventó las bases de la computación moderna y descifró Enigma en la IIGM', correct: 'ok', explain: 'VERDAD. Padre fundacional del campo. Salvó millones de vidas.' },
  { text: 'Una imagen generada por IA pertenece automáticamente a quien la generó (sin restricciones legales)', correct: 'depende', explain: 'DEPENDE. Zona gris legal real. Varía por país.' },
  { text: 'El "problema de alineación" es el corazón de la investigación en seguridad de IA actual', correct: 'ok', explain: 'VERDAD. Anthropic, DeepMind Safety, MIRI invierten millones en esto.' },
  { text: 'Lovable, Bolt y Bubble son herramientas no-code que permiten construir apps reales sin programar', correct: 'ok', explain: 'VERDAD. Revolución 2023-2026. Personas sin saber programar ya construyen apps reales.' },
];

const BUILDER_TOOL = {
  xp: 35,
  rows: [
    { key: 'problema', label: 'Elige el PROBLEMA real a resolver', opts: ['Mi abuela no puede usar la app del banco', 'Mi colegio pierde tareas en WhatsApp', 'Quiero analizar 100 PDFs académicos', 'Mi negocio familiar no llega a clientes', 'Tengo idea de app para mi comunidad'] },
    { key: 'herramienta', label: 'Elige la HERRAMIENTA principal', opts: ['Claude (razonamiento profundo)', 'ChatGPT (generalista)', 'Gemini (Google ecosystem)', 'Perplexity (búsqueda con citas)', 'Lovable / Bolt (construir app)', 'NotebookLM (analizar documentos)', 'Zapier / Make (automatización)'] },
    { key: 'tecnica', label: 'Elige la TÉCNICA de prompting', opts: ['Zero-shot · pregunto directamente', 'Few-shot · doy 2-3 ejemplos', 'Chain-of-Thought · razono paso a paso', 'System prompt · defino rol y límites', 'Iterativo · refino con varias rondas'] },
    { key: 'plan', label: 'Tu PLAN de acción concreto', opts: ['Empezar HOY: probar herramienta', 'Esta semana: consultar a 3 personas', 'Plan 2 semanas: construir MVP', 'Plan mes: investigar + construir + probar', 'Plan trimestre: validar, escalar, documentar'] },
    { key: 'etica', label: 'Tu CHECK ético', opts: ['Verificaré información de IA', 'Declararé cuándo usé IA', 'No automatizaré decisiones emocionales', 'Respetaré privacidad', 'Pediré feedback honesto'] },
  ],
};

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World6Level7({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [masterQItems] = useState(() => pickN(MASTER_Q_POOL, 15));
  const [fakeItems] = useState(() => pickN(FAKE_POOL, 8));

  // Estados de módulos
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [builderTool, setBuilderTool] = useState<Record<string, string>>({});

  const [fakeAnswers, setFakeAnswers] = useState<Record<number, string>>({});
  const [fakeDone, setFakeDone] = useState(false);

  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([1, 2, 3, 4, 5]);
  const isExam = examSteps.has(step);

  useEffect(() => { setAllowBack?.(!isExam); }, [isExam, setAllowBack]);
  useEffect(() => {
    const bh = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExam) { Alert.alert('Evaluación en curso', 'No puedes regresar durante la evaluación final.'); return true; }
      return false;
    });
    return () => bh.remove();
  }, [isExam]);

  useEffect(() => {
    if (step === 1) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 2) { setBuilderTool({}); }
    if (step === 3) { setFakeAnswers({}); setFakeDone(false); }
    if (step === 4) { setReflectVal(''); }
    if (step === 5) { setReflectVal(''); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro? Es la evaluación final.', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 3;
    completeLevel(6, 7, stars, xp);
    router.back();
  };

  // Quiz
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < masterQItems.length) { Alert.alert('Incompleto'); return false; }
    setQuizChecked(true);
    let c = 0;
    masterQItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert(`${c}/${masterQItems.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Builder
  const selBuilder = (key: string, val: string) => setBuilderTool((p) => ({ ...p, [key]: val }));
  const checkBuilder = () => {
    if (Object.keys(builderTool).length < BUILDER_TOOL.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(BUILDER_TOOL.xp);
    return true;
  };

  // Fake detector
  const pickFake = (i: number, col: string) => { if (!fakeDone) setFakeAnswers((p) => ({ ...p, [i]: col })); };
  const checkFake = () => {
    if (fakeDone) return true;
    if (Object.keys(fakeAnswers).length < fakeItems.length) { Alert.alert('Clasifica todos'); return false; }
    setFakeDone(true);
    let c = 0;
    fakeItems.forEach((item, i) => { if (fakeAnswers[i] === item.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${fakeItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
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
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🎓</Text></View>
      <Text style={styles.title}>Evaluación Final · Graduación AI Expert</Text>
      <Text style={styles.subtitle}>Llegaste al final del camino. 36 niveles, 6 mundos, decenas de proyectos. Esta es tu prueba maestra.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué se evalúa</Text><Text style={styles.cardText}>Quiz maestro de 15 preguntas · Reto de herramientas integrador · Fake detector final · Builder de legado · Pitch de graduación.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🎓 Qué obtienes</Text><Text style={styles.cardText}>Cerrar oficialmente AI Expert. Demostrar dominio integral de los 6 mundos. Recibir certificado de graduación.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🏗️ 5 partes</Text><Text style={styles.cardText}>📝 Quiz Maestro · 🛠️ Reto de herramientas · 🔍 Fake Detector · 📚 Builder de Legado · 🎤 Pitch de Graduación</Text></View>
    </View>
  );

  const renderQuiz = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>📝 Parte 1 · Quiz Maestro</Text></View>
      <Text style={styles.title}>Quiz Maestro (15 preguntas)</Text>
      {masterQItems.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#b45309', backgroundColor: '#fef3c7' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderBuilder = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#78350f' }]}>🛠️ Parte 2 · Reto de herramientas</Text></View>
      <Text style={styles.title}>Reto de herramientas</Text>
      {BUILDER_TOOL.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#78350f', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, builderTool[row.key] === opt && { borderColor: '#b45309', backgroundColor: '#fef3c7' }]} onPress={() => selBuilder(row.key, opt)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderFakeDetector = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>🔍 Parte 3 · Fake Detector</Text></View>
      <Text style={styles.title}>Fake Detector Final</Text>
      {fakeItems.map((item, i) => (
        <View key={i} style={[styles.card, { marginBottom: 8 }]}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>{i + 1}. {item.text}</Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {['ok', 'no', 'depende'].map((col) => (
              <TouchableOpacity key={col} style={[styles.ethOpt, fakeAnswers[i] === col && { borderColor: '#b45309', backgroundColor: '#fef3c7' }]} onPress={() => pickFake(i, col)} disabled={fakeDone}>
                <Text style={{ fontSize: 11, fontWeight: '600' }}>{col === 'ok' ? '✅ Verdad' : col === 'no' ? '❌ Mito' : '⚖️ Depende'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
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

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 90 }}>🎓</Text>
      <Text style={[styles.title, { textAlign: 'center', fontSize: 28 }]}>¡FELICITACIONES, GRADUADO!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Recibiste el certificado oficial: <Text style={{ fontWeight: 'bold' }}>AI Expert · Graduado</Text>. El mundo necesita gente como tú.</Text>
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#854d0e', marginVertical: 12, padding: 18, backgroundColor: '#fef9c3', borderRadius: 12, borderWidth: 1, borderColor: '#fde047' }}>⭐ {xp} XP ganados en la graduación</Text>
      <View style={[styles.card, { width: '100%', backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
        <Text style={{ textAlign: 'center', fontWeight: 'bold', color: '#78350f' }}>🏆 36 de 36 niveles · 100% completado</Text>
      </View>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderQuiz();
      case 2: return renderBuilder();
      case 3: return renderFakeDetector();
      case 4: return renderReflect('📚 Parte 4 · Tu Legado', 'Piensa tú', 'Mira atrás los 36 niveles. Responde con TODO lo que tengas:\n\n1. ¿Qué APRENDISTE? Las 3 lecciones más importantes.\n2. ¿Qué CREASTE? Los 3 proyectos que más te enorgullecen.\n3. ¿Qué HARÁS DIFERENTE ahora?', '1. APRENDÍ: ... | 2. CREÉ: ... | 3. HARÉ DIFERENTE: ...', 300, '30');
      case 5: return renderReflect('🎤 Parte 5 · Pitch de Graduación', 'Piensa tú', 'Tu pitch de graduación · 60 segundos escritos:\n\n🎯 Problema · 💡 Solución · 📊 Impacto · 🚀 Próximo paso', 'Problema: ... · Solución: ... · Impacto: ... · Próximo paso: ...', 250, '35');
      case 6: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      1: checkQuiz,
      2: checkBuilder,
      3: checkFake,
      4: () => checkReflect(300, 30),
      5: () => checkReflect(250, 35),
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![1, 2, 3, 4, 5].includes(step);
  const showCheck = [1, 2, 3, 4, 5].includes(step) && step < TOTAL_STEPS - 1;

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
  progressFill: { height: '100%', backgroundColor: '#b45309', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  ethOpt: { padding: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 120, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#b45309', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#b45309', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});