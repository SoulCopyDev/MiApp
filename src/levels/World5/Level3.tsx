import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type MatchPair = { left: string; right: string };
type DragItem = { text: string; correct: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type SortItem = string;

// ---------- Pools de datos ----------
const CRITERIA_Q: QuizQ[] = [
  { q: "Tu idea es 'una app para resolver la contaminación del planeta'. ¿Qué falla?", opts: ["Demasiado específica", "Demasiado amplia — imposible empezar", "Ya existe perfecta", "Mucha programación"], correct: 1, explain: "Error clásico: ideas tan grandes que no sabes dónde empezar. Acota: 'reciclar en mi edificio'." },
  { q: "¿Cuál es un MVP (versión mínima funcional)?", opts: ["App nativa con 15 funciones y pagos", "Grupo WhatsApp + formulario de cuidado de mascotas", "Sistema completo integrado al gobierno", "Red social entera"], correct: 1, explain: "MVP = mínimo que resuelve + permite aprender. WhatsApp + form = validable en 1 semana." },
  { q: "Antes de construir, ¿qué haces PRIMERO?", opts: ["Contratar programador", "Registrar marca", "Hablar con 5 personas que tengan el problema", "Crear redes sociales"], correct: 2, explain: "Validar antes de construir. 5 entrevistas honestas > 6 meses de código sin usuarios." },
  { q: "Tu amiga dice 'qué idea tan genial'. ¿Validación suficiente?", opts: ["Sí, ella te conoce", "No — amigos son amables; busca feedback de desconocidos", "Si lo dice dos veces", "Solo en redes"], correct: 1, explain: "Sesgo de validación social. Valida con gente que NO te conozca." },
  { q: "¿Por qué ideas simples como Post-it o Uber funcionaron?", opts: ["Mucho dinero", "Problema específico + mucha gente con él + ejecución simple", "Copiaron ideas existentes", "Suerte"], correct: 1, explain: "Problema específico + audiencia grande + ejecución limpia = patrón repetible." }
];

const EXAMPLES_Q: QuizQ[] = [
  { q: "¿Qué tienen en común Post-it, Uber, WhatsApp y Airbnb?", opts: ["Fueron primeras en su categoría", "Resolvieron un problema específico con solución simple", "Tuvieron inversión millonaria desde el día 1", "Usaron IA desde el inicio"], correct: 1, explain: "Patrón común: problema concreto + solución simple + ejecución clara. Ni primeros ni más financiados." },
  { q: "El creador de Google Maps quería resolver:", opts: ["Turismo", "Perderse en una ciudad nueva", "Publicidad digital", "Fotos satelitales"], correct: 1, explain: "Un problema personal universal: no saber cómo llegar de A a B. El resto vino después." },
  { q: "WhatsApp empezó siendo:", opts: ["App de red social", "Sistema de estados para mostrar disponibilidad a contactos", "Juego de fiesta", "Herramienta de trabajo"], correct: 1, explain: "'Disponible / en reunión / sin batería'. El chat masivo vino como evolución, no como diseño inicial." },
  { q: "La idea original de Airbnb:", opts: ["Reemplazar hoteles globalmente", "Alquilar 3 colchones inflables en San Francisco durante conferencia", "Competir con Booking", "Crear red social de viajeros"], correct: 1, explain: "MVP radicalmente pequeño: 3 colchones inflables por 1 fin de semana para pagar renta." }
];

const MATCH_PAIRS: MatchPair[] = [
  { left: "Mis abuelos no entienden cómo pedir medicinas por internet", right: "Chatbot en WhatsApp que los guía paso a paso con audios" },
  { left: "Mi grupo de estudio pierde tiempo buscando resúmenes de cada tema", right: "Bot que recibe PDFs del colegio y devuelve resúmenes por tema" },
  { left: "En mi barrio nadie sabe qué días pasa el camión de reciclaje", right: "Canal automático que avisa por Telegram antes de cada recolección" },
  { left: "Los niños de una fundación no tienen tutor de inglés", right: "Chatbot educativo con voz adaptado a su edad y nivel" },
  { left: "Los emprendedores de mi mamá no saben redactar facturas", right: "Formulario + IA que genera factura profesional en PDF" },
  { left: "Mi colegio desperdicia comida porque nadie calcula porciones", right: "Sistema que predice asistencia y ajusta cantidades diariamente" }
];

const MVP_ITEMS: DragItem[] = [
  { text: "Grupo WhatsApp con formulario de pedidos + PDF menú", correct: "mvp" },
  { text: "Landing con botón 'únete a la lista de espera'", correct: "mvp" },
  { text: "Bot de Telegram que responde 3 preguntas clave", correct: "mvp" },
  { text: "Página simple donde alguien agenda 30 min de asesoría", correct: "mvp" },
  { text: "Google Sheet público con info útil actualizada a mano", correct: "mvp" },
  { text: "App móvil con 30 pantallas + pagos + notificaciones + logros", correct: "grande" },
  { text: "Plataforma completa con 5 roles y dashboard administrativo", correct: "grande" },
  { text: "Sistema con IA propia entrenada desde cero en 12 idiomas", correct: "grande" },
  { text: "Red social con feed + chat + stories + live + marketplace", correct: "grande" },
  { text: "Marketplace con vendedores verificados + pagos protegidos + seguro", correct: "grande" }
];

const SORT_MVP: SortItem[] = [
  "1 · Idea cruda: 'quiero resolver X problema'",
  "2 · Problema específico: 'X para usuario Y en contexto Z'",
  "3 · Hipótesis de valor: 'si X pasara, Y ahorraría Z'",
  "4 · MVP diseñado: la versión más chica que prueba la hipótesis",
  "5 · Lanza a 5 personas: datos reales > opiniones",
  "6 · Itera o pivotea: ajusta según lo aprendido"
];

const TF_Q: TFItem[] = [
  { stmt: "Necesitas una idea 100% original para que valga la pena construirla", correct: false, explain: "Falso. Google no fue el primer buscador. Ejecutar mejor > ser primero." },
  { stmt: "Para validar una idea hoy puedes empezar con cero pesos", correct: true, explain: "WhatsApp + Forms + IA gratuita = suficiente antes de invertir un peso." },
  { stmt: "Si no sabes programar, no puedes crear nada con IA", correct: false, explain: "Falso. Lovable, Bolt, Bubble, Airtable, Zapier permiten construir sin código." },
  { stmt: "Hablar con 5 usuarios potenciales antes de construir ahorra meses perdidos", correct: true, explain: "5 conversaciones honestas te dicen si resuelves algo real." },
  { stmt: "Si tu primera versión te da vergüenza, lanzaste demasiado tarde", correct: true, explain: "Reid Hoffman (LinkedIn). El perfeccionismo mata más proyectos que la mediocridad." }
];

const BUILDER_USER: BuilderConfig = { xp: 22, rows: [
  { key: "edad", label: "Edad de tu usuario", opts: ["Niños 6-11", "Adolescentes 12-17", "Jóvenes 18-25", "Adultos 26-50", "Adultos mayores 55+"] },
  { key: "contexto", label: "¿Dónde vive / qué hace?", opts: ["Estudiante colegio público", "Emprendedor pequeño", "Trabajador de oficina", "Cuidador/a en casa", "Profesional independiente"] },
  { key: "problema", label: "¿Qué problema específico vive?", opts: ["Le cuesta entender un tema técnico solo", "Pierde tiempo en tareas repetitivas", "No encuentra información confiable", "Se siente solo/a o sin apoyo", "No sabe por dónde empezar un proyecto"] },
  { key: "canal", label: "¿Dónde lo alcanzas?", opts: ["WhatsApp (lo usa todos los días)", "Instagram / TikTok", "Web + Google", "App móvil", "Boca a boca"] }
]};

const BUILDER_PROTO: BuilderConfig = { xp: 22, rows: [
  { key: "momento", label: "¿Cuándo se usa?", opts: ["Al despertar (necesidad de rutina)", "Durante el estudio/trabajo", "En una crisis o urgencia", "Por la noche (reflexión)"] },
  { key: "accion", label: "¿Qué hace el usuario?", opts: ["Pregunta algo y recibe respuesta en 10 seg", "Sube un documento y recibe resumen", "Elige entre 3 opciones y el sistema lo guía", "Agenda algo automáticamente"] },
  { key: "salida", label: "¿Qué obtiene?", opts: ["Texto corto y claro", "Audio que puede escuchar", "Lista con próximos pasos accionables", "Confirmación visual con emoji"] }
]};

const BUILDER_PITCH: BuilderConfig = { xp: 22, rows: [
  { key: "hook", label: "1. Gancho (5s)", opts: ["¿Sabías que 7 de cada 10 estudiantes dicen que no entienden IA?", "Hace 2 años vi a mi abuela llorar de frustración con una app.", "Cada día, miles de familias latinas pierden un contacto importante para siempre."] },
  { key: "problem", label: "2. Problema (15s)", opts: ["La gente mayor se siente excluida del mundo digital.", "Los estudiantes pierden horas buscando resúmenes confiables.", "Los emprendedores pequeños no saben usar IA a su favor."] },
  { key: "solution", label: "3. Solución (25s)", opts: ["Un chatbot en WhatsApp que guía paso a paso con audios simples.", "Una plataforma que recibe PDFs y devuelve resúmenes por tema.", "Una herramienta que genera plan de contenido semanal con IA."] },
  { key: "cta", label: "4. Llamada a acción (10s)", opts: ["Busco 5 personas dispuestas a probarlo esta semana.", "Necesito un cofundador técnico para construir el MVP.", "Si te interesa, déjame tu WhatsApp y te mando el primer demo."] }
]};

const BUILDER_NAME_PROJ: BuilderConfig = { xp: 18, rows: [
  { key: "concepto", label: "Concepto central", opts: ["Aprende", "Conecta", "Cuida", "Impulsa", "Guía", "Crea"] },
  { key: "publico", label: "Público / categoría", opts: ["Joven", "Abuelos", "Futuro", "Mi gente", "Estudiantes", "Barrio"] },
  { key: "emocion", label: "Emoción / promesa", opts: ["Fácil", "Contigo", "Seguro", "Libre", "Juntos", "Hoy"] }
]};

const BUILDER_LOGO: BuilderConfig = { xp: 15, rows: [
  { key: "estilo", label: "Estilo visual", opts: ["Minimalista (líneas simples)", "Ilustración cálida (trazos dibujados)", "Geométrico moderno", "Orgánico / natural"] },
  { key: "color", label: "Paleta de color", opts: ["Cálidos (naranja/amarillo/rojo)", "Fríos (azul/cyan/verde)", "Neutros (negro/blanco/gris)", "Vibrantes (rosa/violeta)"] },
  { key: "simbolo", label: "Símbolo central", opts: ["Una mano", "Una planta creciendo", "Un corazón", "Un puente", "Una flecha hacia adelante", "Un círculo con personas"] },
  { key: "mensaje", label: "Mensaje/emoción en una palabra", opts: ["Esperanza", "Claridad", "Fuerza", "Calma", "Cambio"] }
]};

const TOTAL_STEPS = 21;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World5Level3({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const criteriaQ = useRef(pickN(CRITERIA_Q, 5)).current;
  const examplesQ = useRef(pickN(EXAMPLES_Q, 4)).current;
  const matchPairs = useRef(pickN(MATCH_PAIRS, 4)).current;
  const mvpItems = useRef(pickN(MVP_ITEMS, 8)).current;
  const sortMvp = useRef(SORT_MVP).current;
  const tfQ = useRef(pickN(TF_Q, 5)).current;

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  // Drag & Drop
  const [dragPlaced, setDragPlaced] = useState<{ [key: number]: string }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);

  // Builders
  const [builderState, setBuilderState] = useState<{ [key: string]: string }>({});
  const [builderCfg, setBuilderCfg] = useState<BuilderConfig | null>(null);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 10, 17]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Inicializar sort
  useEffect(() => {
    if (step === 7) {
      const order = sortMvp.map((_, i) => i).sort(() => Math.random() - 0.5);
      // Ensure not already sorted
      if (order.every((v, i) => v === i)) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      setSortOrder(order);
      setSortOk(false);
    }
  }, [step]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => { setStep(s => s + 1); resetActivity(); };
  const finishLevel = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(5, 3, stars, xp);
    navigation.goBack();
  };

  const resetActivity = () => {
    setQuizAnswers({}); setQuizChecked(false);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
    setSortOrder([]); setSortOk(false);
    setDragPlaced({}); setDragSel(null);
    setBuilderState({}); setBuilderCfg(null);
    setTfAnswers({}); setTfChecked(false);
    setReflectText('');
  };

  // Quiz
  const checkQuiz = (items: QuizQ[]) => {
    setQuizChecked(true);
    let correct = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    addXP(correct * 8);
  };

  // Matching
  const handleMatchLeft = (i: number) => { if (!matchedLeft.has(i)) setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      setMatchedLeft(prev => new Set(prev).add(matchSel));
      setMatchedRight(prev => new Set(prev).add(ri));
      setMatchSel(null);
    } else {
      Alert.alert('❌', 'Ese no es el par correcto.');
      setMatchSel(null);
    }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };
  const checkSort = () => {
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) { setSortOk(true); addXP(15); }
    else Alert.alert('Incorrecto', 'Algunos pasos están fuera de lugar.');
  };

  // Drag & Drop
  const handleDragDrop = (zone: string) => {
    if (dragSel === null) return;
    const item = mvpItems[dragSel];
    if (item.correct !== zone) { Alert.alert('Incorrecto', 'Esa no pertenece a esta categoría.'); return; }
    setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
    setDragSel(null);
  };
  const removeDragItem = (idx: number) => {
    setDragPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkDrag = () => {
    if (Object.keys(dragPlaced).length < mvpItems.length) { Alert.alert('Faltan tarjetas', 'Clasifica todas las tarjetas.'); return; }
    addXP(15);
    nextStep();
  };

  // Builder
  const selectBuilder = (key: string, val: string) => setBuilderState(prev => ({ ...prev, [key]: val }));
  const getBuilderComplete = (cfg: BuilderConfig) => cfg.rows.every(r => builderState[r.key]);

  // V/F
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    tfQ.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    addXP(correct * 5);
  };

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false, accent = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff, accent && styles.btnAccent]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
  const tag = (t: string) => <Text style={styles.tag}>{t}</Text>;
  const title = (t: string) => <Text style={styles.title}>{t}</Text>;
  const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
  const body = (t: string) => <Text style={styles.body}>{t}</Text>;

  const renderBuilder = (cfg: BuilderConfig) => (
    <View style={styles.stepContainer}>
      {cfg.rows.map(r => (
        <View key={r.key} style={styles.builderRow}>
          <Text style={styles.builderLabel}>{r.label}</Text>
          <View style={styles.builderOpts}>
            {r.opts.map(o => (
              <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]}
                onPress={() => selectBuilder(r.key, o)}>
                <Text style={styles.builderOptText}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.builderLabel}>Vista previa:</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>
          {cfg.rows.map(r => `${r.label}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}
        </Text>
      </View>
    </View>
  );

  const renderQuizBlock = (items: QuizQ[], moduleTag: string, moduleTitle: string, moduleSub: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {title(moduleTitle)}
      {sub(moduleSub)}
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && styles.quizOptSel]}
              onPress={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))} disabled={quizChecked}>
              <Text style={styles.quizOptText}>{String.fromCharCode(65 + oi)}. {o}</Text>
            </TouchableOpacity>
          ))}
          {quizChecked && <Text style={quizAnswers[qi] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
        </View>
      ))}
      {!quizChecked ? btn('Comprobar respuestas', () => checkQuiz(items)) : btn('Continuar →', nextStep)}
    </View>
  );

  const renderReflection = (moduleTag: string, moduleTitle: string, prompt: string, placeholder: string, minLen: number, xpReward: number) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {title(moduleTitle)}
      {sub('No hay respuesta correcta. Procesa lo aprendido con tus palabras.')}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>{prompt}</Text>
      </View>
      <TextInput style={styles.textArea} placeholder={placeholder} value={reflectText} onChangeText={setReflectText} multiline />
      <Text style={styles.charCount}>{reflectText.trim().length} / {minLen} mínimo</Text>
      {btn('Enviar reflexión →', () => { if (reflectText.trim().length >= minLen) { addXP(xpReward); nextStep(); } else Alert.alert('Muy corto', `Mínimo ${minLen} caracteres.`); }, reflectText.trim().length < minLen)}
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>💡</Text></View>
          {title('Tu Idea para Cambiar Algo')}
          {sub('Los mejores inventos empezaron con una frustración personal. Pasa de "tengo ideas vagas" a "tengo el plano completo de mi propio proyecto".')}
          {body('Cómo pasar de idea vaga a proyecto con plano · Criterios de una buena idea · MVP · Validación real · Tu primer pitch')}
          {btn('¡Vamos! Empecemos 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📖 Módulo 1 · Teoría')}
          {title('Los mejores inventos empezaron con una frustración')}
          {body('Post-it nació porque un químico no podía marcar páginas. Uber nació en una noche fría en París sin taxi. La fórmula: 1) Detecta un problema que TÚ vives. 2) Confirma que otros también lo viven. 3) Diseña la versión más pequeña posible. 4) Lanza y aprende.')}
          {btn('Entendido, sigamos →', nextStep)}
        </View>
      );
      case 2: return renderReflection('✍️ Tus 3 problemas · +14 XP', 'Piensa tú',
        'Lista 3 problemas que HAS VIVIDO tú mismo. No "el hambre mundial" — cosas concretas que te frustraron esta semana.',
        '1. Mi abuela no sabe usar la app del banco...\n2. Mi colegio pierde 30 min diarios...\n3. ...', 100, 14);
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 3 · Builder')}
          {title('¿A quién ayuda tu idea exactamente?')}
          {renderBuilder(BUILDER_USER)}
          {btn('Terminar →', () => { addXP(BUILDER_USER.xp); nextStep(); }, !getBuilderComplete(BUILDER_USER))}
        </View>
      );
      case 4: return renderQuizBlock(criteriaQ, '❓ Módulo 4 · Quiz', '¿Cómo sé si mi idea es buena?', '5 situaciones reales. Aplica los 5 filtros.');
      case 5: return renderQuizBlock(examplesQ, '❓ Módulo 5 · Quiz', 'Ideas simples que cambiaron el mundo', '4 productos famosos. ¿Cómo empezaron en realidad?');
      case 6: return (
        <View style={styles.stepContainer}>
          {tag('🔗 Módulo 6 · Matching')}
          {title('Problema → Solución con IA')}
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchSel, matchedLeft.has(i) && styles.matchDone]}
                  onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
                  <Text style={styles.matchText}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchDone]}
                  onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
                  <Text style={styles.matchText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {matchComplete && btn('Continuar →', () => { addXP(15); nextStep(); })}
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('↕️ Módulo 7 · Ordenar')}
          {title('El MVP: la versión más simple')}
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={styles.sortRow}>
              <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
              <Text style={styles.sortText}>{sortMvp[origIdx]}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={20} /></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={20} /></TouchableOpacity>
              </View>
            </View>
          ))}
          {!sortOk ? btn('Verificar orden', checkSort) : btn('Continuar →', nextStep)}
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          {tag('🧩 Módulo 8 · Clasificar')}
          {title('MVP vs Idea completa')}
          <View style={styles.chipWrap}>
            {mvpItems.map((item, i) => dragPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, dragSel === i && styles.chipOn]}
                onPress={() => setDragSel(dragSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['mvp', 'grande'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleDragDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'mvp' ? '🌱 MVP' : '🏛️ Grande'}</Text>
                {Object.entries(dragPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeDragItem(parseInt(k))}>
                    <Text style={styles.dropChip}>{mvpItems[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar clasificación', checkDrag, Object.keys(dragPlaced).length < mvpItems.length)}
        </View>
      );
      case 9: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 9 · Builder')}
          {title('Prototipa con palabras')}
          {renderBuilder(BUILDER_PROTO)}
          {btn('Terminar →', () => { addXP(BUILDER_PROTO.xp); nextStep(); }, !getBuilderComplete(BUILDER_PROTO))}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('🗣️ Módulo 10 · Validación')}
          {title('Valida con 5 personas reales')}
          {body('Las 3 preguntas oro:\n1. ¿Cómo resuelves hoy este problema?\n2. ¿Qué es lo más frustrante?\n3. ¿Pagarías por una solución?\n\nEncuentra 5 personas reales que vivan el problema. Escucha más de lo que hablas (80% ellos, 20% tú).')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 11 · Builder')}
          {title('Sprint: tu pitch en 60 segundos')}
          {renderBuilder(BUILDER_PITCH)}
          {btn('Terminar →', () => { addXP(BUILDER_PITCH.xp); nextStep(); }, !getBuilderComplete(BUILDER_PITCH))}
        </View>
      );
      case 12: return renderReflection('💰 MVP cero pesos · +15 XP', 'Piensa tú',
        'Si tuvieras que validar UNA idea esta semana sin gastar UN SOLO peso, ¿cuál elegirías y con qué 3 herramientas gratis la construirías?',
        'Elegiría validar... Con estas 3 herramientas gratuitas: 1)... 2)... 3)...', 100, 15);
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 13 · Builder')}
          {title('El nombre de tu proyecto')}
          {renderBuilder(BUILDER_NAME_PROJ)}
          {btn('Terminar →', () => { addXP(BUILDER_NAME_PROJ.xp); nextStep(); }, !getBuilderComplete(BUILDER_NAME_PROJ))}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 14 · Builder')}
          {title('El logo de tu proyecto')}
          {renderBuilder(BUILDER_LOGO)}
          {btn('Terminar →', () => { addXP(BUILDER_LOGO.xp); nextStep(); }, !getBuilderComplete(BUILDER_LOGO))}
        </View>
      );
      case 15: return renderReflection('🌆 Tu ciudad · +18 XP', 'Piensa tú',
        'Elige UN problema urgente real de tu ciudad o barrio. Descríbelo en una frase, di quién lo vive más fuerte, y propón una solución con IA.',
        'En mi ciudad lo que más me frustra es... Quien más lo vive es... Mi solución con IA sería...', 120, 18);
      case 16: return (
        <View style={styles.stepContainer}>
          {tag('✅ Módulo 16 · V/F')}
          {title('Mitos de emprender con IA')}
          {tfQ.map((item, i) => (
            <View key={i} style={styles.tfCard}>
              <Text style={styles.tfStmt}>{i + 1}. {item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === true && styles.tfTrue]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: true }))} disabled={tfChecked}>
                  <Text>✅ Verdadero</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === false && styles.tfFalse]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: false }))} disabled={tfChecked}>
                  <Text>❌ Falso</Text>
                </TouchableOpacity>
              </View>
              {tfChecked && <Text style={tfAnswers[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!tfChecked ? btn('Comprobar', checkTF) : btn('Continuar →', nextStep)}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          {tag('🇱🇦 Módulo 17 · Casos reales')}
          {title('Jóvenes latinoamericanos que cambiaron algo')}
          {body('Simón Borrero (Rappi): de un barrio en Bogotá a 9 países.\nAlec Oxenford (Mercado Libre): empezó sin aceptar pagos online.\nElisa Velázquez: cursos gratuitos de IA para mujeres latinas, empezó con 12 alumnas.')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 18: return renderReflection('💭 Tu convicción · +18 XP', 'Piensa tú',
        'La IA puede ayudarte a refinar una idea, pero hay algo que no puede darte — la razón personal por la que vale la pena luchar. ¿Cuál es TU razón?',
        'Mi razón es... Me importan estas personas porque...', 120, 18);
      case 19: return renderReflection('✍️ Tu plano final · +20 XP', 'Piensa tú',
        'Si tuvieras que explicarle a tu mejor amigo — en 3 frases — qué vas a construir, para quién, y por qué importa ahora: ¿qué le dirías?',
        'Voy a construir... Para... Porque importa ahora que...', 150, 20);
      case 20: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>💡</Text></View>
          {title('¡Nivel 27 completado!')}
          {sub('Terminaste "Tu Idea para Cambiar Algo". Ahora eres Changemaker.')}
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          {btn('Volver al mapa', finishLevel, false, true)}
        </View>
      );
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => Alert.alert('Salir', '¿Salir del nivel?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', onPress: () => navigation.goBack() }])}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#d97706', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#92400e', backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fffbeb', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#d97706' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  quizOptText: { fontSize: 12, color: '#374151' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46' },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b' },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  matchSel: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  matchDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 11, color: '#374151' },
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6, gap: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#d97706', justifyContent: 'center', alignItems: 'center' },
  sortNumText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  sortText: { flex: 1, fontSize: 11, color: '#374151' },
  sortArrows: { gap: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db' },
  chipOn: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  chipText: { fontSize: 11, color: '#374151' },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 100 },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
  tfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  tfStmt: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  tfTrue: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tfFalse: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#d97706', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#92400e', marginBottom: 16 },
});