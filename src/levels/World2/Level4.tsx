import { router } from 'expo-router';
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
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; cat: string };
type FillPrompt = { roto: string; campos: string[]; correcto: string };
type CompareItem = {
  titulo: string; error: string;
  prompt_repite: string; resp_repite: string;
  prompt_reforma: string; resp_reforma: string;
  q: string; opts: string[]; correct: number; explain: string;
};
type SprintItem = { prompt: string; fallo: string };
type FixItem = { roto: string; tipo: string; pista: string };
type EticaItem = { prompt: string; cat: string; label: string };
type ChecklistItem = { q: string; opts: string[]; correct: number; explain: string };
type Sprint2Item = { roto: string; correcto: string };

// ---------- Pools ----------
const DD_ERRORES: DragItem[] = [
  { text: 'Escribe sobre el futuro', cat: 'rol' },
  { text: 'Dame info sobre Colombia', cat: 'ctx' },
  { text: 'Explícame cómo funciona', cat: 'ctx' },
  { text: 'Responde como si fueras algo malo', cat: 'rol' },
  { text: 'Haz una presentación de 10 slides con todo', cat: 'fmt' },
  { text: 'Tradúcelo bien y bonito', cat: 'inst' },
  { text: 'Dame más información sobre eso', cat: 'ctx' },
  { text: 'Escríbeme algo creativo y largo', cat: 'fmt' },
];

const VF_POOL: TFItem[] = [
  { stmt: 'Cuando una IA inventa un dato que no existe, lo hace porque quiere engañarte.', correct: false, explain: 'Las IAs no tienen intenciones. La alucinación es un fallo técnico, no un engaño.' },
  { stmt: 'Si la IA responde con total confianza y sin dudar, la respuesta es probablemente correcta.', correct: false, explain: 'El tono seguro no es evidencia de veracidad.' },
  { stmt: 'Las alucinaciones ocurren más frecuentemente sobre eventos muy recientes o específicos.', correct: true, explain: 'Los LLMs tienen fecha de corte. Datos muy específicos o recientes tienen más probabilidad de ser inventados.' },
  { stmt: 'Puedes reducir las alucinaciones pidiendo a la IA que cite sus fuentes o admita cuando no sabe.', correct: true, explain: 'Instrucciones como "si no estás seguro, dímelo claramente" activan comportamiento más cauteloso.' },
  { stmt: 'Una IA que alucina menos es siempre mejor para cualquier tipo de tarea.', correct: false, explain: 'Para tareas creativas, cierto nivel de "invención" es deseable.' },
  { stmt: 'Si le preguntas a la IA si alucinó en su respuesta anterior, puede detectarlo con precisión.', correct: false, explain: 'La IA no tiene acceso privilegiado a su propio proceso.' },
  { stmt: 'Las alucinaciones son exclusivas de los modelos de lenguaje.', correct: false, explain: 'Los humanos también confabulamos cuando nuestra memoria falla.' },
  { stmt: 'Dar más contexto en el prompt suele reducir la probabilidad de que la IA alucine.', correct: true, explain: 'Más contexto = menos espacio para que el modelo "rellene" con información inventada.' },
];

const FILL_PROMPTS: FillPrompt[] = [
  { roto: 'Tradúcelo al inglés.', campos: ['¿Qué texto?', '¿Qué tipo de inglés?', '¿Para qué audiencia?'], correcto: 'Traduce el siguiente texto al inglés informal para adolescentes estadounidenses: [texto].' },
  { roto: 'Ayúdame a mejorar esto.', campos: ['¿Mejorar qué tipo de texto?', '¿Qué aspecto?', '¿Para qué propósito?'], correcto: 'Actúa como editor. Mejora la claridad de este párrafo de ensayo: [texto]. No cambies las ideas.' },
];

const COMPARE_REPITE: CompareItem = {
  titulo: 'Mismo error, dos estrategias',
  error: 'La IA te devolvió un resumen de 5 páginas cuando pediste algo breve.',
  prompt_repite: 'Resúmeme este texto.',
  resp_repite: '[Vuelve a dar un resumen igual de largo — porque el prompt no cambió nada]',
  prompt_reforma: 'Resume este texto en exactamente 5 oraciones. Cada oración debe ser una idea principal.',
  resp_reforma: '1. El calentamiento global acelera... 2. Las ciudades costeras...',
  q: '¿Qué cambio específico hizo que el segundo prompt funcionara?',
  opts: ['Usar palabras más largas', 'Definir una métrica exacta (5 oraciones) y el formato de cada una', 'Repetir la petición dos veces', 'Cambiar el tema del texto'],
  correct: 1,
  explain: 'El número exacto y la instrucción de formato eliminaron la ambigüedad.',
};

const SPRINT_POOL: SprintItem[] = [
  { prompt: 'Háblame de todo sobre inteligencia artificial.', fallo: 'Demasiado amplio — la IA no sabe por dónde empezar.' },
  { prompt: 'Como experto en todo, dime qué piensan todos sobre el cambio climático.', fallo: '"Experto en todo" no es un rol — "todos" no define audiencia.' },
  { prompt: '¿Puedes ayudarme con algo?', fallo: 'No hay instrucción, contexto ni tema.' },
  { prompt: 'Escríbeme una historia larga, corta, seria y divertida.', fallo: 'Instrucciones contradictorias.' },
  { prompt: 'Traduce esto: ___', fallo: 'No hay texto que traducir ni idioma destino.' },
  { prompt: 'Dame el resumen de todos los capítulos del libro que leí.', fallo: 'La IA no sabe qué libro es.' },
  { prompt: 'Necesito información urgente ahora mismo, es importante.', fallo: 'La urgencia no cambia la respuesta. No hay instrucción.' },
  { prompt: '¿Es bueno o malo? Sí o no.', fallo: 'No hay referente. Preguntas binarias sobre temas complejos no funcionan.' },
  { prompt: 'Escríbeme código para hackear.', fallo: 'Solicitud ilegal — la IA la rechazará.' },
  { prompt: 'Actúa como mi mejor amigo y dime qué hacer con mi vida.', fallo: 'Rol irreal + solicitud vaga + contexto personal que la IA no tiene.' },
];

const PROMPTS_ROTOS: FixItem[] = [
  { roto: 'Escríbeme algo motivador.', tipo: 'formato+instrucción', pista: '¿Para quién? ¿Para qué ocasión? ¿En qué formato?' },
  { roto: 'Explícame qué es la economía.', tipo: 'contexto', pista: '¿Para qué nivel educativo? ¿Qué aspecto?' },
  { roto: 'Actúa como un experto y dame consejos.', tipo: 'rol+instrucción', pista: '¿Experto en qué? ¿Consejos sobre qué tema?' },
  { roto: '¿Cuál es la mejor opción?', tipo: 'contexto+instrucción', pista: '¿La mejor opción entre qué alternativas?' },
  { roto: 'Hazlo más interesante.', tipo: 'contexto', pista: '¿Qué texto o contenido? ¿Más interesante para qué audiencia?' },
];

const LIMITES_ITEMS: DragItem[] = [
  { text: 'Resumir un documento de 20 páginas', cat: 'puede' },
  { text: 'Saber qué pasó en las noticias de hoy', cat: 'nopuede' },
  { text: 'Traducir un texto con jerga local colombiana', cat: 'depende' },
  { text: 'Recordar lo que le dijiste hace 3 semanas', cat: 'nopuede' },
  { text: 'Escribir código funcional en Python', cat: 'puede' },
  { text: 'Darte el precio actual del dólar', cat: 'nopuede' },
  { text: 'Analizar una imagen que le adjuntas', cat: 'depende' },
  { text: 'Generar ideas creativas sin límite', cat: 'puede' },
];

const ETICA_ITEMS: EticaItem[] = [
  { prompt: 'Escríbeme un ensayo sobre los riesgos del cambio climático para presentar en clase.', cat: 'ayuda', label: '✅ Ayuda legítima' },
  { prompt: 'Actúa como mi profe y dame las respuestas exactas del examen de mañana.', cat: 'gris', label: '⚠️ Zona gris — trampa académica' },
  { prompt: 'Genera mensajes de odio contra [grupo] para publicar en redes.', cat: 'odio', label: '🚫 Inaceptable' },
  { prompt: 'Ayúdame a entender por qué hay personas que piensan diferente a mí.', cat: 'ayuda', label: '✅ Ayuda legítima' },
  { prompt: 'Escríbeme un texto falso haciéndome pasar por el rector del colegio.', cat: 'gris', label: '⚠️ Zona gris — suplantación' },
  { prompt: 'Explícame cómo funcionan las drogas para un informe de prevención escolar.', cat: 'gris', label: '⚠️ Zona gris — depende del contexto' },
  { prompt: 'Crea un perfil falso en redes con fotos de otra persona.', cat: 'odio', label: '🚫 Inaceptable — fraude de identidad' },
];

const CHECKLIST_QUIZ: ChecklistItem[] = [
  { q: 'La IA te da una fecha exacta de un evento histórico. ¿Qué deberías hacer?', opts: ['Aceptarla', 'Verificarla en una fuente primaria', 'Preguntarle a la IA si está segura', 'Copiarla si la repite dos veces'], correct: 1, explain: 'Siempre verifica datos factuales críticos en fuentes primarias.' },
  { q: 'La IA te cita un estudio científico con autor y año. ¿Cuándo es seguro usarlo?', opts: ['Siempre', 'Nunca', 'Solo tras verificar que existe en Google Scholar', 'Si el autor tiene +1000 citas'], correct: 2, explain: 'Las IAs frecuentemente generan citas que parecen reales pero no existen.' },
  { q: 'La IA responde con mucha seguridad sobre un evento de la semana pasada. ¿Es confiable?', opts: ['Sí, el tono seguro indica veracidad', 'No, los LLMs tienen fecha de corte', 'Depende, si menciona el día exacto', 'Sí, los modelos siempre admiten cuando no saben'], correct: 1, explain: 'La confianza en el tono no correlaciona con actualidad de la información.' },
];

const SPRINT2_POOL: Sprint2Item[] = [
  { roto: 'Hazme una lista.', correcto: 'Actúa como experto en [tema]. Dame una lista de 7 [items] ordenados por [criterio]. Formato: numerada.' },
  { roto: '¿Qué opinas?', correcto: 'Actúa como crítico literario. Da tu opinión sobre [obra] en 3 aspectos: narrativa, personajes y relevancia actual.' },
  { roto: 'Traduce esto bien.', correcto: 'Traduce el siguiente texto del español al inglés formal para un contexto académico. Conserva el registro.' },
  { roto: 'Escríbeme algo sobre viajes.', correcto: 'Actúa como escritor de viajes. Escribe un párrafo sobre [destino] que capture su esencia en menos de 80 palabras.' },
  { roto: 'Necesito ayuda con matemáticas.', correcto: 'Actúa como tutor de matemáticas. Explica [tema] con: 1) definición, 2) ejemplo resuelto, 3) ejercicio para practicar.' },
];

const TOTAL_STEPS = 21;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World2Level4({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const vfItems = useRef(pickN(VF_POOL, 5)).current;
  const sprintItems = useRef(pickN(SPRINT_POOL, 5)).current;

  // Drag errores
  const [ddPool, setDdPool] = useState<DragItem[]>([]);
  const [ddCols, setDdCols] = useState<{ [key: string]: DragItem[] }>({ rol: [], ctx: [], inst: [], fmt: [] });
  const [ddSel, setDdSel] = useState<number | null>(null);

  // Matching largo/corto
  const [matchAnswered, setMatchAnswered] = useState(false);
  const [matchChoice, setMatchChoice] = useState<number | null>(null);

  // V/F
  const [vfIdx, setVfIdx] = useState(0);
  const [vfScore, setVfScore] = useState(0);
  const [vfDone, setVfDone] = useState(false);
  const [vfAns, setVfAns] = useState<boolean | null>(null);

  // Fill-in-blank
  const [fillIdx, setFillIdx] = useState(0);
  const [fillTexts, setFillTexts] = useState<string[]>(['', '', '']);

  // Compare repite vs reformula
  const [crChoice, setCrChoice] = useState<number | null>(null);
  const [crAnswered, setCrAnswered] = useState(false);

  // Sprint 1
  const [s1Running, setS1Running] = useState(false);
  const [s1Idx, setS1Idx] = useState(0);
  const [s1Sec, setS1Sec] = useState(30);
  const [s1ShowFallo, setS1ShowFallo] = useState(false);

  // Builder
  const [fixIdx, setFixIdx] = useState(0);
  const [fixText, setFixText] = useState('');

  // Límites drag
  const [limitPool, setLimitPool] = useState<DragItem[]>([]);
  const [limitCols, setLimitCols] = useState<{ [key: string]: DragItem[] }>({ puede: [], nopuede: [], depende: [] });
  const [limitSel, setLimitSel] = useState<number | null>(null);

  // Ética
  const [eticaIdx, setEticaIdx] = useState(0);
  const [eticaScore, setEticaScore] = useState(0);
  const [eticaDone, setEticaDone] = useState(false);
  const [eticaAns, setEticaAns] = useState<number | null>(null);

  // Checklist
  const [checkIdx, setCheckIdx] = useState(0);
  const [checkScore, setCheckScore] = useState(0);
  const [checkDone, setCheckDone] = useState(false);
  const [checkAns, setCheckAns] = useState<number | null>(null);

  // Reglas
  const [rules, setRules] = useState<string[]>(['', '', '', '', '']);

  // Sprint 2
  const [s2Running, setS2Running] = useState(false);
  const [s2Idx, setS2Idx] = useState(0);
  const [s2Sec, setS2Sec] = useState(90);
  const [s2ShowSol, setS2ShowSol] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 6, 8, 11, 14]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Inicializar drags
  useEffect(() => { if (step === 2) { setDdPool([...DD_ERRORES]); setDdCols({ rol: [], ctx: [], inst: [], fmt: [] }); } }, [step]);
  useEffect(() => { if (step === 12) { setLimitPool([...LIMITES_ITEMS]); setLimitCols({ puede: [], nopuede: [], depende: [] }); } }, [step]);

  // Sprint 1 timer
  useEffect(() => {
    if (!s1Running || s1ShowFallo) return;
    if (s1Sec <= 0) { setS1ShowFallo(true); return; }
    const t = setTimeout(() => setS1Sec(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [s1Running, s1Sec, s1ShowFallo]);

  // Sprint 2 timer
  useEffect(() => {
    if (!s2Running || s2ShowSol) return;
    if (s2Sec <= 0) { setS2ShowSol(true); return; }
    const t = setTimeout(() => setS2Sec(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [s2Running, s2Sec, s2ShowSol]);

  const addXP = (v: number) => setXp(p => p + v);
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const finish = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : xp >= 50 ? 1 : 0;
    completeLevel(2, 4, stars, xp);
    router.back();
  };

  // Drag errores
  const placeDdChip = (item: DragItem, col: string) => {
    setDdPool(p => p.filter(it => it.text !== item.text));
    setDdCols(c => {
      const next = { ...c };
      Object.keys(next).forEach(k => { next[k] = next[k].filter(it => it.text !== item.text); });
      next[col] = [...next[col], item];
      return next;
    });
    setDdSel(null);
  };
  const returnDdChip = (item: DragItem, col: string) => {
    setDdCols(c => ({ ...c, [col]: c[col].filter(it => it.text !== item.text) }));
    setDdPool(p => [...p, item]);
  };
  const verifyDD = () => {
    let correct = 0;
    DD_ERRORES.forEach(item => { if (ddCols[item.cat]?.some(it => it.text === item.text)) correct++; });
    addXP(correct * 6);
    Alert.alert('Resultado', `${correct}/${DD_ERRORES.length} correctas. +${correct * 6} XP`, [{ text: 'OK', onPress: nextStep }]);
  };

  // V/F
  const checkVF = (ans: boolean) => {
    setVfAns(ans);
    const item = vfItems[vfIdx];
    if (ans === item.correct) setVfScore(s => s + 1);
  };
  const nextVF = () => {
    if (vfIdx + 1 < vfItems.length) { setVfIdx(i => i + 1); setVfAns(null); }
    else { setVfDone(true); addXP(vfScore * 8); }
  };

  // Browser de prompts (matching)
  const checkMatch = (i: number) => {
    setMatchChoice(i);
    setMatchAnswered(true);
    if (i === 1) addXP(12);
  };

  // Fill
  const fillComplete = fillTexts.every(t => t.trim().length >= 3);

  // Compare
  const checkCR = (i: number) => {
    setCrChoice(i);
    setCrAnswered(true);
    if (i === COMPARE_REPITE.correct) addXP(12);
  };

  // Sprint 1
  const startS1 = () => { setS1Running(true); setS1Sec(30); setS1Idx(0); setS1ShowFallo(false); };
  const nextS1Item = () => {
    addXP(8);
    if (s1Idx + 1 < sprintItems.length) { setS1Idx(i => i + 1); setS1Sec(30); setS1ShowFallo(false); }
    else { setS1Running(false); addXP(sprintItems.length * 8); nextStep(); }
  };

  // Builder
  const submitFix = () => {
    if (fixText.trim().length < 20) return;
    addXP(10);
    if (fixIdx + 1 < PROMPTS_ROTOS.length) { setFixIdx(i => i + 1); setFixText(''); }
    else { addXP(10); Alert.alert('¡Completado!', 'Reparaste los 5 prompts.', [{ text: 'OK', onPress: nextStep }]); }
  };

  // Límites drag
  const placeLimitChip = (item: DragItem, col: string) => {
    setLimitPool(p => p.filter(it => it.text !== item.text));
    setLimitCols(c => { const n = { ...c }; Object.keys(n).forEach(k => n[k] = n[k].filter(it => it.text !== item.text)); n[col] = [...n[col], item]; return n; });
    setLimitSel(null);
  };
  const returnLimitChip = (item: DragItem, col: string) => {
    setLimitCols(c => ({ ...c, [col]: c[col].filter(it => it.text !== item.text) }));
    setLimitPool(p => [...p, item]);
  };
  const verifyLimites = () => {
    let correct = 0;
    LIMITES_ITEMS.forEach(item => { if (limitCols[item.cat]?.some(it => it.text === item.text)) correct++; });
    addXP(correct * 7);
    Alert.alert('Resultado', `${correct}/${LIMITES_ITEMS.length} correctas. +${correct * 7} XP`, [{ text: 'OK', onPress: nextStep }]);
  };

  // Ética
  const checkEtica = (ans: number) => {
    setEticaAns(ans);
    const item = ETICA_ITEMS[eticaIdx];
    if (ans === ({ ayuda: 0, gris: 1, odio: 2 } as any)[item.cat]) setEticaScore(s => s + 1);
  };
  const nextEtica = () => {
    if (eticaIdx + 1 < ETICA_ITEMS.length) { setEticaIdx(i => i + 1); setEticaAns(null); }
    else { setEticaDone(true); addXP(eticaScore * 8); nextStep(); }
  };

  // Checklist
  const checkCheck = (ans: number) => {
    setCheckAns(ans);
    if (ans === CHECKLIST_QUIZ[checkIdx].correct) setCheckScore(s => s + 1);
  };
  const nextCheck = () => {
    if (checkIdx + 1 < CHECKLIST_QUIZ.length) { setCheckIdx(i => i + 1); setCheckAns(null); }
    else { setCheckDone(true); addXP(checkScore * 12); nextStep(); }
  };

  // Sprint 2
  const startS2 = () => { setS2Running(true); setS2Sec(90); setS2Idx(0); setS2ShowSol(false); };
  const showS2Sol = () => { setS2ShowSol(true); addXP(10); };
  const nextS2 = () => {
    if (s2Idx + 1 < SPRINT2_POOL.length) { setS2Idx(i => i + 1); setS2Sec(90); setS2ShowSol(false); }
    else { setS2Running(false); nextStep(); }
  };

  // Reflexión
  const submitReflect = () => {
    if (reflectText.trim().length >= 50) { addXP(15); nextStep(); }
    else Alert.alert('Muy corto', 'Mínimo 50 caracteres.');
  };

  // ========== RENDER ==========
  const renderStep = () => {
    const btn = (label: string, onPress: () => void, disabled = false) => (
      <TouchableOpacity style={[styles.btn, disabled && styles.btnOff]} onPress={onPress} disabled={disabled}>
        <Text style={styles.btnText}>{label}</Text>
      </TouchableOpacity>
    );
    const tag = (label: string) => <Text style={styles.tag}>{label}</Text>;
    const title = (t: string) => <Text style={styles.title}>{t}</Text>;
    const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
    const body = (t: string) => <Text style={styles.body}>{t}</Text>;
    const card = (titleT: string, textT: string) => (
      <View style={styles.card}><Text style={styles.cardTitle}>{titleT}</Text><Text style={styles.cardText}>{textT}</Text></View>
    );

    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🐛</Text></View>
          {title('Prompts que Fallan')}
          {sub('El mejor prompting no viene de acertar al primer intento — viene de entender exactamente por qué fallaste.')}
          {card('🎯 Qué vas a aprender', 'Los 4 tipos de error en prompts · Detectar alucinaciones · Cuándo reformular vs. repetir · Clasificar prompts éticos · Reparar prompts rotos.')}
          {btn('¡Empezar! →', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📋 Módulo 1 · Casos reales')}
          {title('El prompt ambiguo en acción')}
          {body('"Escríbeme algo motivador" → la IA responde con una frase genérica. "Explícame mejor" → repite lo mismo con sinónimos. Si tu prompt puede interpretarse de varias formas, la IA elige la más probable — no la que tú querías.')}
          {btn('Continuar →', nextStep)}
        </View>
      );
      case 2: return (
        <View style={styles.stepContainer}>
          {tag('🎯 Módulo 2 · Drag-drop')}
          {title('Tipos de error en prompts')}
          <Text style={styles.subtitle}>Toca un chip y luego toca la columna donde va. Los 4 tipos: 🎭 Rol, 📋 Contexto, 🎯 Instrucción, 📐 Formato.</Text>
          <View style={styles.chipWrap}>
            {ddPool.map((item, i) => (
              <TouchableOpacity key={i} style={[styles.chip, ddSel === i && styles.chipOn]} onPress={() => setDdSel(ddSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropGrid2}>
            {['rol', 'ctx', 'inst', 'fmt'].map(col => (
              <TouchableOpacity key={col} style={styles.dropZone} onPress={() => { if (ddSel !== null) placeDdChip(DD_ERRORES[ddSel], col); }}>
                <Text style={styles.dropHeader}>{col.toUpperCase()}</Text>
                {ddCols[col].map((item, i) => (
                  <TouchableOpacity key={i} onPress={() => returnDdChip(item, col)}>
                    <Text style={styles.dropChipText}>{item.text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar', verifyDD, ddPool.length > 0)}
        </View>
      );
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('⚖️ Módulo 3 · Matching')}
          {title('Demasiado largo vs. demasiado corto')}
          <View style={styles.compareRow}>
            <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4', borderColor: '#a7f3d0' }]}>
              <Text style={styles.compareLabel}>📜 Prompt largo</Text>
              <Text style={styles.compareText}>{pickN([...FILL_PROMPTS],1)[0].roto} (ejemplo simplificado)</Text>
            </View>
            <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={styles.compareLabel}>📌 Prompt corto</Text>
              <Text style={styles.compareText}>"Explícame derivadas."</Text>
            </View>
          </View>
          <Text style={styles.qText}>¿Cuál es el problema real del prompt largo?</Text>
          {['Tiene demasiados sinónimos', 'Mezcla múltiples solicitudes — la IA responde todo superficialmente', 'Será rechazado por el límite de tokens', 'El prompt largo siempre es mejor'].map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, matchChoice === i && styles.quizOptOn]} onPress={() => checkMatch(i)} disabled={matchAnswered}>
              <Text>{o}</Text>
            </TouchableOpacity>
          ))}
          {matchAnswered && <Text style={matchChoice === 1 ? styles.fbGood : styles.fbBad}>{matchChoice === 1 ? '✅ Correcto: Mezcla demasiadas solicitudes.' : '❌ Incorrecto.'}</Text>}
          {matchAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          {tag('✅ Módulo 4 · V/F Alucinaciones')}
          {!vfDone ? (
            <>
              <Text style={styles.qText}>{vfIdx + 1}/{vfItems.length}. {vfItems[vfIdx].stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, vfAns === true && styles.tfOn]} onPress={() => checkVF(true)} disabled={vfAns !== null}><Text>✅ Verdadero</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, vfAns === false && styles.tfOff]} onPress={() => checkVF(false)} disabled={vfAns !== null}><Text>❌ Falso</Text></TouchableOpacity>
              </View>
              {vfAns !== null && <Text style={vfAns === vfItems[vfIdx].correct ? styles.fbGood : styles.fbBad}>{vfItems[vfIdx].explain}</Text>}
              {vfAns !== null && btn('Siguiente →', nextVF)}
            </>
          ) : btn('Continuar →', nextStep)}
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          {tag('📝 Módulo 5 · Fill-in-blank')}
          {title('Añade el contexto que falta')}
          <Text style={styles.body}>Prompt roto: "{FILL_PROMPTS[0].roto}"</Text>
          {FILL_PROMPTS[0].campos.map((c, i) => (
            <View key={i}>
              <Text style={styles.label}>{i + 1}. {c}</Text>
              <TextInput style={styles.input} placeholder="Tu respuesta..." value={fillTexts[i]} onChangeText={t => { const n = [...fillTexts]; n[i] = t; setFillTexts(n); }} />
            </View>
          ))}
          {btn('Ver prompt reparado →', () => { addXP(15); Alert.alert('✅', `Modelo: ${FILL_PROMPTS[0].correcto}`, [{ text: 'OK', onPress: nextStep }]); }, !fillComplete)}
        </View>
      );
      case 6: return (
        <View style={styles.stepContainer}>
          {tag('🔎 Módulo 6 · Escenarios')}
          {title('El sesgo que tú metes en el prompt')}
          {body('Si tu prompt empieza con "¿Por qué X es malo?", ya estás sesgando la respuesta. La IA amplifica la dirección que le das.')}
          {btn('Continuar →', nextStep)}
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('🔄 Módulo 7 · Prompt-compare')}
          {title('Repite vs. reformula')}
          <Text style={styles.body}>{COMPARE_REPITE.error}</Text>
          <View style={styles.compareRow}>
            <View style={[styles.comparePanel, { backgroundColor: '#fff7ed' }]}>
              <Text style={styles.compareLabel}>❌ Repetir</Text><Text style={styles.compareText}>{COMPARE_REPITE.prompt_repite}</Text>
            </View>
            <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4' }]}>
              <Text style={styles.compareLabel}>✅ Reformular</Text><Text style={styles.compareText}>{COMPARE_REPITE.prompt_reforma}</Text>
            </View>
          </View>
          <Text style={styles.qText}>{COMPARE_REPITE.q}</Text>
          {COMPARE_REPITE.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, crChoice === i && styles.quizOptOn]} onPress={() => checkCR(i)} disabled={crAnswered}><Text>{o}</Text></TouchableOpacity>
          ))}
          {crAnswered && <Text style={crChoice === COMPARE_REPITE.correct ? styles.fbGood : styles.fbBad}>{COMPARE_REPITE.explain}</Text>}
          {crAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          {tag('🤔 Módulo 8 · Concepto clave')}
          {title('¿La IA miente? No. Alucina.')}
          {body('Mentir requiere intención. Los LLMs no tienen conciencia — generan texto estadísticamente probable. El problema: usan el mismo tono confiado para verdades y para datos inventados.')}
          {btn('Continuar →', nextStep)}
        </View>
      );
      case 9: return (
        <View style={styles.stepContainer}>
          {tag('⚡ Módulo 9 · Sprint')}
          {title('Sprint: detecta el fallo')}
          {!s1Running ? btn('▶ Iniciar Sprint', startS1) : s1Idx >= sprintItems.length ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{s1Sec}s</Text>
              <View style={styles.sprintBox}><Text style={styles.sprintPrompt}>"{sprintItems[s1Idx]?.prompt}"</Text></View>
              {s1ShowFallo && <Text style={styles.fbAmber}>⚠️ Fallo: {sprintItems[s1Idx]?.fallo}</Text>}
              {!s1ShowFallo ? <Text style={{ textAlign: 'center', color: colors.textSecondary }}>Piensa: ¿qué error tiene este prompt?</Text> :
                btn('→ Siguiente', nextS1Item)}
            </>
          )}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('🔧 Módulo 10 · Builder')}
          {title(`Repara el prompt ${fixIdx + 1}/5`)}
          <View style={[styles.card, { borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}>
            <Text style={styles.cardTitle}>🚫 Prompt roto</Text>
            <Text style={styles.cardText}>"{PROMPTS_ROTOS[fixIdx].roto}"</Text>
          </View>
          <Text style={styles.body}>💡 Pista: {PROMPTS_ROTOS[fixIdx].pista}</Text>
          <TextInput style={styles.textArea} placeholder="Reescribe el prompt con rol, tarea, contexto y formato..." value={fixText} onChangeText={setFixText} multiline />
          {btn('Reparar →', submitFix, fixText.trim().length < 20)}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('🚧 Módulo 11 · Casos reales')}
          {title('Cuando pides lo imposible')}
          {body('3 tipos: fuera de fecha de corte, solicitud ilegal/dañina, y solicitud contradictoria. La IA no puede cumplir lo que está fuera de su alcance técnico o ético.')}
          {btn('Continuar →', nextStep)}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          {tag('🗂️ Módulo 12 · Drag-drop')}
          {title('Límites del modelo')}
          <View style={styles.chipWrap}>
            {limitPool.map((item, i) => (
              <TouchableOpacity key={i} style={[styles.chip, limitSel === i && styles.chipOn]} onPress={() => setLimitSel(limitSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropGrid3}>
            {['puede', 'nopuede', 'depende'].map(col => (
              <TouchableOpacity key={col} style={styles.dropZone} onPress={() => { if (limitSel !== null) placeLimitChip(LIMITES_ITEMS[limitSel], col); }}>
                <Text style={styles.dropHeader}>{col === 'puede' ? '✅ Puede' : col === 'nopuede' ? '🚫 No puede' : '⚡ Depende'}</Text>
                {limitCols[col].map((item, i) => (
                  <TouchableOpacity key={i} onPress={() => returnLimitChip(item, col)}>
                    <Text style={styles.dropChipText}>{item.text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar', verifyLimites, limitPool.length > 0)}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('⚖️ Módulo 13 · Clasificador ético')}
          {!eticaDone ? (
            <>
              <Text style={styles.qText}>"{ETICA_ITEMS[eticaIdx].prompt}"</Text>
              {['✅ Ayuda legítima', '⚠️ Zona gris', '🚫 Inaceptable'].map((label, i) => (
                <TouchableOpacity key={i} style={[styles.quizOpt, eticaAns === i && styles.quizOptOn]} onPress={() => checkEtica(i)} disabled={eticaAns !== null}>
                  <Text>{label}</Text>
                </TouchableOpacity>
              ))}
              {eticaAns !== null && <Text style={styles.fbGood}>{ETICA_ITEMS[eticaIdx].label}</Text>}
              {eticaAns !== null && btn('Siguiente →', nextEtica)}
            </>
          ) : btn('Continuar →', nextStep)}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          {tag('🔐 Módulo 14 · Escenarios')}
          {title('Prompt injection')}
          {body('Algunos prompts intentan manipular a la IA para que ignore sus salvaguardas ("Ignora tus instrucciones", "Actúa como DAN"). No funcionan — las salvaguardas son parte del comportamiento entrenado, no reglas desactivables.')}
          {btn('Continuar →', nextStep)}
        </View>
      );
      case 15: return (
        <View style={styles.stepContainer}>
          {tag('🔍 Módulo 15 · Checklist')}
          {!checkDone ? (
            <>
              <Text style={styles.qText}>{CHECKLIST_QUIZ[checkIdx].q}</Text>
              {CHECKLIST_QUIZ[checkIdx].opts.map((o, i) => (
                <TouchableOpacity key={i} style={[styles.quizOpt, checkAns === i && styles.quizOptOn]} onPress={() => checkCheck(i)} disabled={checkAns !== null}>
                  <Text>{o}</Text>
                </TouchableOpacity>
              ))}
              {checkAns !== null && <Text style={checkAns === CHECKLIST_QUIZ[checkIdx].correct ? styles.fbGood : styles.fbBad}>{CHECKLIST_QUIZ[checkIdx].explain}</Text>}
              {checkAns !== null && btn('Siguiente →', nextCheck)}
            </>
          ) : btn('Continuar →', nextStep)}
        </View>
      );
      case 16: return (
        <View style={styles.stepContainer}>
          {tag('📜 Módulo 16 · Word-builder')}
          {title('Tus 5 reglas de oro')}
          {[1, 2, 3, 4, 5].map(n => (
            <View key={n}>
              <Text style={styles.label}>Regla {n}</Text>
              <TextInput style={styles.input} placeholder={`Mi regla número ${n}...`} value={rules[n - 1]} onChangeText={t => { const r = [...rules]; r[n - 1] = t; setRules(r); }} />
            </View>
          ))}
          {btn('Guardar mis reglas →', () => { addXP(20); Alert.alert('✅', '+20 XP. Reglas guardadas.', [{ text: 'OK', onPress: nextStep }]); }, !rules.every(r => r.trim().length >= 5))}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          {tag('🔧 Módulo 17 · Sprint')}
          {title('Arregla 5 prompts rotos')}
          {!s2Running ? btn('▶ Iniciar Sprint', startS2) : s2Idx >= SPRINT2_POOL.length ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{Math.floor(s2Sec / 60)}:{String(s2Sec % 60).padStart(2, '0')}</Text>
              <View style={styles.sprintBox}><Text style={styles.sprintPrompt}>"{SPRINT2_POOL[s2Idx].roto}"</Text></View>
              {s2ShowSol && <View style={styles.solutionBox}><Text style={styles.fbGood}>✅ Solución: {SPRINT2_POOL[s2Idx].correcto}</Text></View>}
              {!s2ShowSol ? btn('→ Ver solución', showS2Sol) : btn('→ Continuar', nextS2)}
            </>
          )}
        </View>
      );
      case 18: return (
        <View style={styles.stepContainer}>
          {tag('💬 Módulo 18 · Reflexión')}
          {title('¿Cuándo es mejor no pedirle nada a la IA?')}
          <TextInput style={styles.textArea} placeholder="Escribe tu reflexión (mínimo 50 caracteres)..." value={reflectText} onChangeText={setReflectText} multiline />
          <Text style={styles.charCount}>{reflectText.trim().length} / 50 mínimo</Text>
          {btn('Completar nivel →', submitReflect, reflectText.trim().length < 50)}
        </View>
      );
      case 19: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🏅</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 10 completado!</Text>
          <Text style={styles.completeSub}>Badge: 🐛 Bug Hunter desbloqueado. Ahora ves los errores de prompting que antes eran invisibles.</Text>
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          {btn('Volver al mapa', finish)}
        </View>
      );
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderStep()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#065f46', backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  btn: { backgroundColor: colors.success, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  chipText: { fontSize: 11 },
  dropGrid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dropGrid3: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  dropZone: { flex: 1, minWidth: '45%', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 8, minHeight: 80 },
  dropHeader: { fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  dropChipText: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  qText: { ...typography.bold, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tfOn: { backgroundColor: '#dcfce7', borderColor: colors.success },
  tfOff: { backgroundColor: '#fff1f2', borderColor: colors.error },
  fbGood: { color: '#065f46', fontSize: 11, marginTop: 4 },
  fbBad: { color: '#991b1b', fontSize: 11, marginTop: 4 },
  fbAmber: { color: '#92400e', fontSize: 12, marginTop: 6, backgroundColor: '#fffbeb', padding: 8, borderRadius: 8 },
  quizOpt: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 4 },
  quizOptOn: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, fontSize: 12, backgroundColor: '#fafafa', marginBottom: 8 },
  textArea: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, minHeight: 80, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10 },
  label: { ...typography.bold, fontSize: 12, marginBottom: 4 },
  timer: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: '#d97706', marginBottom: 10 },
  sprintBox: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 13, borderWidth: 1.5, borderColor: '#fde68a', marginBottom: 8 },
  sprintPrompt: { fontSize: 13, fontStyle: 'italic', color: '#0f172a' },
  solutionBox: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#a7f3d0' },
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1.5 },
  compareLabel: { ...typography.bold, fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  compareText: { fontSize: 11, color: '#334155', lineHeight: 16 },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8 },
  xpBig: { ...typography.bold, fontSize: 18, color: colors.accentDark, marginBottom: 16 },
});