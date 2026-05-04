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
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };

// ---------- Pools de datos ----------
const DISASTERS_Q: QuizQ[] = [
  { q: "Google FireSat detecta incendios forestales en menos de:", opts: ["1 día", "20 minutos desde el inicio (vs 2-4 horas tradicional)", "1 semana", "1 hora"], correct: 1, explain: "FireSat usa satélites + IA en tiempo real. Cada minuto cuenta: incendios crecen exponencialmente en su primera hora." },
  { q: "¿Puede la IA predecir terremotos?", opts: ["Sí, con días de anticipación", "Solo con segundos a minutos. Pero ya es suficiente para evacuación de trenes y cierre de gas", "No, imposible", "Solo en Japón"], correct: 1, explain: "Sismos: la IA detecta ondas P (rápidas, no destructivas) que llegan antes de ondas S (destructivas). Da 5-60 segundos clave." },
  { q: "Sistemas como FloodHub de Google predicen inundaciones en:", opts: ["Solo Europa", "80+ países, incluyendo zonas de África, India y América Latina sin servicios meteorológicos avanzados", "Solo Asia", "EE.UU."], correct: 1, explain: "FloodHub democratizó predicción meteorológica precisa para regiones que nunca la habían tenido." },
  { q: "¿Qué hace la IA en monitoreo de huracanes que el método tradicional no?", opts: ["Inventa datos", "Predice trayectoria con 30% mayor precisión a 48 horas — gracias a modelos de ML como GraphCast (DeepMind)", "Da igual", "Solo color"], correct: 1, explain: "GraphCast (2024): supera a modelos meteorológicos tradicionales en velocidad Y precisión." },
  { q: "Cuando ocurre un terremoto, los sistemas de alerta temprana ahora:", opts: ["Solo notifican", "Pueden detener trenes, cerrar gas natural, alertar hospitales — todo en segundos sin intervención humana", "Solo prenden luz", "Suenan campanas"], correct: 1, explain: "ShakeAlert (EE.UU.) y similares usan IA para activar sistemas críticos automáticamente." }
];

const ENERGY_TF_Q: TFItem[] = [
  { stmt: "Entrenar un modelo grande de IA consume tanta energía como una ciudad pequeña por un mes", correct: true, explain: "Verdadero. GPT-4 consumió aproximadamente 50 GWh para entrenar — equivalente a una ciudad pequeña." },
  { stmt: "Las grandes tecnológicas están construyendo nuevas plantas nucleares para alimentar sus IA", correct: true, explain: "Verdadero. Microsoft, Google y Amazon firmaron acuerdos directos con plantas nucleares en 2023-2024 para sus data centers." },
  { stmt: "Cada vez que envías un mensaje a ChatGPT consumes lo mismo que una búsqueda en Google", correct: false, explain: "Falso. Una consulta a un LLM consume ~10x más que una búsqueda Google. Por eso el costo energético total preocupa." },
  { stmt: "La IA puede ahorrar más energía de la que consume si se usa estratégicamente", correct: true, explain: "Verdadero. Estudio MIT: cada $1 invertido en IA para optimización energética puede ahorrar $5-10 en consumo global." },
  { stmt: "Los data centers de Google ya usan 100% energía renovable", correct: false, explain: "Falso pero camino. Compran créditos de energía renovable equivalentes pero la red real sigue siendo mixta." }
];

const ENV_Q: QuizQ[] = [
  { q: "¿En cuánto redujo DeepMind el consumo energético de los data centers de Google?", opts: ["10%", "40% en refrigeración (millones de toneladas de CO₂ evitadas)", "5%", "0%"], correct: 1, explain: "Caso emblemático 2016: la IA optimizó algo tan específico como cuándo activar ventiladores de enfriamiento. Resultado: 40% menos energía." },
  { q: "Google FireSat detecta incendios forestales en:", opts: ["Días", "Menos de 20 minutos desde inicio (vs 2-4 horas tradicional)", "Semanas", "Solo si hay humano que lo reporte"], correct: 1, explain: "FireSat: satélites + IA en tiempo real. Cada minuto cuenta." },
  { q: "John Deere See & Spray reduce uso de pesticidas hasta:", opts: ["10%", "90% al rociar solo malezas detectadas, no todo el campo", "20%", "50%"], correct: 1, explain: "Operativo desde 2023 en EE.UU., Brasil, Argentina. Combina cámaras + IA + spray preciso." },
  { q: "¿Por qué Microsoft está comprando energía nuclear?", opts: ["Por novedad", "Sus data centers de IA necesitan electricidad estable masiva — nuclear es más limpia que carbón", "Por moda", "Sin razón"], correct: 1, explain: "Tendencia 2023-2024: gigantes tech compran o reactivan plantas nucleares directamente." },
  { q: "Climate Trace mide emisiones industriales de:", opts: ["Solo Europa", "Cada planta industrial del mundo, datos públicos gratuitos por IA + satélite", "Solo USA", "10 países"], correct: 1, explain: "Transparencia radical con IA. Antes los gobiernos podían ocultar emisiones reales. Ahora cualquiera puede verificar." },
  { q: "El reto del costo energético de la IA es:", opts: ["No existe", "Crece exponencialmente — pero IA misma puede ayudar a optimizar consumo total si se usa estratégicamente", "Es trivial", "Solo es crypto"], correct: 1, explain: "Paradoja: IA consume mucho pero también ahorra mucho. La pregunta es si los ahorros superan los costos a tiempo." }
];

const BUILDER_SMART_CITY: BuilderConfig = { xp: 22, rows: [
  { key: "trafico", label: "Sistema de TRÁFICO inteligente", opts: ["Semáforos que se adaptan en tiempo real al flujo vehicular", "Predicción de congestión 30 min adelante con desvíos sugeridos", "Sistema integrado con transporte público + auto + bici", "Detección automática de accidentes con respuesta de emergencia"] },
  { key: "basura", label: "Sistema de BASURA inteligente", opts: ["Sensores en contenedores que avisan cuándo recoger (-30% rutas)", "Clasificación automática con IA + cámaras (mejor reciclaje)", "Compactadores solares que avisan capacidad", "Drones para revisar basura ilegal en zonas inaccesibles"] },
  { key: "agua", label: "Sistema de AGUA inteligente", opts: ["Detección de fugas en acueductos con sensores IoT", "Predicción de demanda según clima + evento + zona", "Calidad del agua monitoreada en tiempo real con IA", "Riego automático de parques según humedad real del suelo"] },
  { key: "aire", label: "Sistema de AIRE inteligente", opts: ["Red de sensores barriales con IA que predice picos contaminación", "Alertas personalizadas por barrio en app oficial", "Cámaras que detectan vehículos contaminantes (PICO Y PLACA inteligente)", "Drones de monitoreo en zonas industriales"] }
]};

const BUILDER_SUSTAINABLE: BuilderConfig = { xp: 22, rows: [
  { key: "energia", label: "Sistema de ENERGÍA limpia", opts: ["100% renovable (solar techos + eólica urbana + baterías comunitarias)", "Mix con nuclear pequeña (SMR) + renovables + IA optimizando red", "Sistema híbrido con incentivos masivos para autoabastecimiento solar", "Red distribuida ciudadana donde cada hogar es generador"] },
  { key: "transporte", label: "Sistema de TRANSPORTE", opts: ["Metro/tranvía 100% eléctrico autónomo + bici + caminar", "Autos compartidos autónomos eléctricos (no propiedad personal)", "Multimodal con app única que combina opciones por viaje", "Sistema aéreo (eVTOL) para distancias largas + tierra para corto"] },
  { key: "alimentos", label: "Sistema de ALIMENTACIÓN", opts: ["Agricultura urbana vertical en cada barrio (cero transporte)", "Producción periurbana con IA + drones (90% local)", "Mercado de cercanía con app que conecta productores - consumidores", "Cero desperdicio: IA predice demanda + redistribuye sobrantes"] },
  { key: "agua", label: "Sistema de AGUA", opts: ["Captación pluvial + reciclaje gris en cada edificio", "Acueducto inteligente con sensores + IA + cero fugas", "Plantas desalinizadoras solares (si aplica costera)", "Educación ciudadana + medición individual + tarifa progresiva"] },
  { key: "naturaleza", label: "Sistema de NATURALEZA", opts: ["Bosque urbano denso (mínimo 30% área es verde)", "Corredores biológicos para fauna entre parques + ríos urbanos restaurados", "Agricultura mixta con biodiversidad (no monocultivo)", "Mar + montaña + ríos protegidos con IA monitoreando 24/7"] }
]};

const TOTAL_STEPS = 21;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World6Level4({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const disastersQ = useRef(pickN(DISASTERS_Q, 5)).current;
  const energyTfQ = useRef(pickN(ENERGY_TF_Q, 5)).current;
  const envQ = useRef(pickN(ENV_Q, 5)).current;

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [key: string]: string }>({});

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 3, 4, 7, 8, 10, 11, 12, 14, 15, 17]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => { setStep(s => s + 1); resetActivity(); };
  const finishLevel = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(6, 4, stars, xp);
    navigation.goBack();
  };

  const resetActivity = () => {
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setBuilderState({});
    setReflectText('');
  };

  // Quiz
  const checkQuiz = (items: QuizQ[]) => {
    setQuizChecked(true);
    let correct = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    addXP(correct * 8);
  };

  // V/F
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    energyTfQ.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    addXP(correct * 5);
  };

  // Builder
  const selectBuilder = (key: string, val: string) => setBuilderState(prev => ({ ...prev, [key]: val }));
  const getBuilderComplete = (cfg: BuilderConfig) => cfg.rows.every(r => builderState[r.key]);

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false, accent = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff, accent && styles.btnAccent]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
  const tag = (t: string) => <Text style={styles.tag}>{t}</Text>;
  const tt = (t: string) => <Text style={styles.title}>{t}</Text>;
  const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
  const body = (t: string) => <Text style={styles.body}>{t}</Text>;

  const renderBuilder = (cfg: BuilderConfig, cfgTitle: string) => (
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
      <Text style={styles.builderLabel}>{cfgTitle}:</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>{cfg.rows.map(r => `${r.label.split(' ').slice(2).join(' ')}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}</Text>
      </View>
    </View>
  );

  const renderQuizBlock = (items: QuizQ[], moduleTag: string, moduleTitle: string, moduleSub: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {tt(moduleTitle)}
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
      {tt(moduleTitle)}
      {sub('No hay respuesta correcta. Procesa lo aprendido con tus palabras.')}
      <View style={styles.card}><Text style={styles.cardTitle}>🤔 Tu pregunta</Text><Text style={styles.cardText}>{prompt}</Text></View>
      <TextInput style={styles.textArea} placeholder={placeholder} value={reflectText} onChangeText={setReflectText} multiline />
      <Text style={styles.charCount}>{reflectText.trim().length} / {minLen} mínimo</Text>
      {btn('Enviar reflexión →', () => { if (reflectText.trim().length >= minLen) { addXP(xpReward); nextStep(); } else Alert.alert('Muy corto', `Mínimo ${minLen} caracteres.`); }, reflectText.trim().length < minLen)}
    </View>
  );

  const renderTheoryBlock = (moduleTag: string, moduleTitle: string, content: string, info?: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {tt(moduleTitle)}
      {body(content)}
      {info && <View style={styles.infoBox}><Text style={styles.infoText}>{info}</Text></View>}
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🌍</Text></View>
          {tt('IA y Tu Planeta: El Futuro que Vas a Heredar')}
          {sub('La IA ya está cambiando el clima, el agua, la agricultura, la energía. Y lo que pase los próximos 10 años decide cómo será el resto de tu vida.')}
          {body('Estado real del planeta + clima · IA en data centers · Predicción de desastres · IA en agricultura, energía, agua · Satélites + drones · Costo energético de la IA')}
          {btn('¡Vamos! Empecemos 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📖 Módulo 1 · Teoría')}
          {tt('El planeta que vas a heredar')}
          {body('Tres datos: 2024: primer año en superar +1.5°C. Bogotá racionó agua por sequía extrema. Incendios forestales 4x más comunes.\n\nLa IA es parte del problema Y parte de la solución. La pregunta no es "IA sí o no", sino "IA para qué".')}
          {btn('Entendido, sigamos →', nextStep)}
        </View>
      );
      case 2: return renderReflection('🤔 Tu emoción inicial · +14 XP', 'Piensa tú',
        '¿Qué tan preocupado o esperanzado te sientes sobre el futuro climático del planeta? ¿Crees que la IA va a salvarnos, va a empeorarlo, o no será decisiva?',
        'Me siento... porque... Creo que la IA va a... porque...', 80, 14);
      case 3: return renderTheoryBlock('🌡️ Módulo 3 · Estado real', 'El planeta YA cambió',
        '2024: primer año en superar +1.5°C. 2 mil millones de personas con escasez de agua. Incendios 4x más frecuentes. FireSat detecta incendios en 20 min (vs 2-4h tradicional).',
        'IA no detiene el cambio climático — pero ayuda a manejar sus consecuencias.');
      case 4: return renderTheoryBlock('💡 Módulo 4 · DeepMind', 'DeepMind, Google y la IA energética',
        'DeepMind redujo 40% del consumo de refrigeración de data centers de Google. GPT-4 consumió ~50 GWh. Microsoft, Google y Amazon compran energía nuclear para sus data centers.',
        'Paradoja: IA consume mucha energía pero también optimiza su consumo. La carrera es si los ahorros superan el costo.');
      case 5: return renderQuizBlock(disastersQ, '❓ Módulo 5 · Quiz', 'IA que predice desastres naturales', '5 preguntas sobre tecnologías que ya salvan vidas en 2025-2026.');
      case 6: return renderReflection('🇨🇴 Tu ciudad · +16 XP', 'Piensa tú',
        'Bogotá: aire contaminado, tráfico, racionamiento de agua, río contaminado. ¿Cuál de estos problemas crees que la IA podría ayudar a resolver MÁS RÁPIDO? ¿Y cuál seguiría siendo problema?',
        'Creo que IA podría resolver más rápido... porque... Pero NO podría resolver... porque...', 120, 16);
      case 7: return renderTheoryBlock('🌾 Módulo 7 · Agricultura', 'IA en agricultura · Más comida con menos',
        'John Deere See & Spray reduce pesticidas 90%. Sensores IoT + IA optimizan riego (-30% agua, +20% productividad). Plantix: foto de planta enferma → diagnóstico IA en segundos (30M+ usuarios). IA en supermercados reduce 25% desperdicio de comida.',
        'Si reducimos a la mitad el desperdicio de comida, alimentaríamos a toda la humanidad sin nueva agricultura.');
      case 8: return renderTheoryBlock('⚡ Módulo 8 · Energía', 'Energía limpia con IA',
        'Predicción solar con 95% precisión a 24h. Baterías inteligentes optimizan carga/descarga según precios en tiempo real. Energía oceánica: IA predice mareas para diseñar plantas.',
        'El mercado de almacenamiento eléctrico crece 60% anual. LATAM: Chile y Brasil a la vanguardia.');
      case 9: return (
        <View style={styles.stepContainer}>
          {tag('🏙️ Módulo 9 · Builder')}
          {tt('Tu ciudad inteligente')}
          {renderBuilder(BUILDER_SMART_CITY, 'Tu ciudad inteligente')}
          {btn('Terminar →', () => { addXP(BUILDER_SMART_CITY.xp); nextStep(); }, !getBuilderComplete(BUILDER_SMART_CITY))}
        </View>
      );
      case 10: return renderTheoryBlock('🌊 Módulo 10 · Océanos', 'IA que cuida los océanos',
        'The Ocean Cleanup: 13M kg de plástico limpiados. Global Fishing Watch: monitorea 50,000+ barcos, detecta pesca ilegal. Coral Health Monitor: cámaras submarinas + IA monitorean blanqueamiento de corales.',
        'Antes no se podían vigilar océanos completos. Ahora se vigila 100% del Pacífico, Atlántico, Índico en tiempo real.');
      case 11: return renderTheoryBlock('🛰️ Módulo 11 · Satélites', 'Satélites + IA · El planeta visto desde arriba',
        'Copernicus (UE): 5 satélites Sentinel, datos gratis, imagen del planeta cada 5 días. Planet Labs: 200+ microsatélites, imagen diaria. Global Forest Watch: alertas IA cada vez que se detecta deforestación.',
        'Antes se enteraban meses después de talas ilegales. Ahora en horas. Transparencia + IA = poder real para proteger.');
      case 12: return renderTheoryBlock('🌳 Módulo 12 · Reforestación', '¿Drones que reforestan?',
        'Drones plantan hasta 100,000 semillas/día (100x más rápido que humanos). IA elige dónde plantar según topografía, suelo, clima. ONGs en Brasil usan imágenes satelitales + IA para identificar zonas óptimas.',
        'Sin IA, los esfuerzos de reforestación eran semi-aleatorios. Con IA, cada árbol tiene 10x más probabilidad de sobrevivir.');
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('✅ Módulo 13 · V/F')}
          {tt('El costo energético de la IA')}
          {energyTfQ.map((item, i) => (
            <View key={i} style={styles.tfCard}>
              <Text style={styles.tfStmt}>{i + 1}. {item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === true && styles.tfTrue]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: true }))} disabled={tfChecked}><Text>✅ Verdadero</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === false && styles.tfFalse]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: false }))} disabled={tfChecked}><Text>❌ Falso</Text></TouchableOpacity>
              </View>
              {tfChecked && <Text style={tfAnswers[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!tfChecked ? btn('Comprobar', checkTF) : btn('Continuar →', nextStep)}
        </View>
      );
      case 14: return renderTheoryBlock('🚀 Módulo 14 · Espacio→Tierra', 'Misiones espaciales que ayudan al planeta',
        'NASA/NOAA: satélites climáticos con imagen cada 5 minutos. Open Earth Foundation: "gemelo digital de la Tierra" para simular escenarios climáticos. Tecnología espacial inspiró edificios eficientes y filtros de agua.',
        'El espacio NO es opuesto al planeta. Cada misión genera tecnología que se usa después aquí.');
      case 15: return renderTheoryBlock('💧 Módulo 15 · Agua', 'IA y agua potable',
        'EAAB Bogotá: sensores IoT + IA desde 2023 detectan fugas en tiempo real, ahorrando millones de m³. IA detecta contaminación en ríos en minutos (antes: muestras semanales). India predice sequías 6 meses adelante.',
        'Los problemas ambientales son temas de monitoreo. Sin datos en tiempo real, las decisiones se toman tarde y mal.');
      case 16: return renderReflection('💼 Tu carrera futura · +18 XP', 'Piensa tú',
        'Los empleos que combinan IA + planeta sobrevivirán mejor. ¿Qué habilidad combinada vas a desarrollar tú? ¿Programación + biología? ¿Diseño + sostenibilidad? ¿Comunicación + activismo digital?',
        'La habilidad combinada que voy a desarrollar es... porque... Me interesa porque...', 120, 18);
      case 17: return renderTheoryBlock('🗣️ Módulo 17 · Activismo', 'Activismo digital con IA',
        'Climate Trace (Al Gore): mide emisiones de cada planta industrial del mundo con IA + satélites. Fridays for Future: 7M+ jóvenes movilizados en 150+ países. ONGs LATAM usan IA para análisis legal y mapeo de daño ambiental.',
        'El activismo ambiental LATAM siempre fue valiente. Con IA ahora también es técnicamente sofisticado.');
      case 18: return renderQuizBlock(envQ, '❓ Módulo 18 · Quiz', 'Quiz · IA y medioambiente', '5 preguntas finales que integran todo lo aprendido.');
      case 19: return (
        <View style={styles.stepContainer}>
          {tag('🌎 Módulo 19 · Visión final')}
          {tt('Diseña la ciudad sostenible del 2040')}
          {renderBuilder(BUILDER_SUSTAINABLE, 'Tu ciudad 2040')}
          {btn('Terminar →', () => { addXP(BUILDER_SUSTAINABLE.xp); nextStep(); }, !getBuilderComplete(BUILDER_SUSTAINABLE))}
        </View>
      );
      case 20: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🌍</Text></View>
          {tt('¡Nivel 34 completado!')}
          {sub('Terminaste "IA y Tu Planeta: El Futuro que Vas a Heredar". Ahora eres Planet Guardian.')}
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
  fill: { height: '100%', backgroundColor: '#15803d', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#064e3b' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#064e3b', backgroundColor: '#ecfccb', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#ecfccb', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#15803d' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  infoBox: { backgroundColor: '#ecfccb', borderLeftWidth: 4, borderLeftColor: '#15803d', borderRadius: 4, padding: 14, marginVertical: 10 },
  infoText: { fontSize: 12, color: '#064e3b', lineHeight: 20 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#15803d', backgroundColor: '#ecfccb' },
  quizOptText: { fontSize: 12, color: '#374151' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6 },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b', backgroundColor: '#fef2f2', padding: 6, borderRadius: 6 },
  tfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  tfStmt: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  tfTrue: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tfFalse: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#064e3b', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#15803d', backgroundColor: '#ecfccb' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#15803d', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#064e3b', marginBottom: 16 },
});