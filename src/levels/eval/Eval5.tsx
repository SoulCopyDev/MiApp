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
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type EthicsItem = { text: string; correct: string; explain: string };

// ---------- Datos ----------
const MASTER_Q_POOL: QuizItem[] = [
  { q: "¿Qué es un 'system prompt' en un chatbot?", opts: ["El primer mensaje del usuario", "Las instrucciones invisibles que definen su comportamiento", "Un menú de configuración", "Un anuncio publicitario"], correct: 1, explain: "System prompt = reglas secretas: personalidad, tono, objetivo, límites. Invisibles al usuario, controlan todo." },
  { q: "Tu chatbot recibe un mensaje de crisis emocional. ¿Qué debe hacer?", opts: ["Diagnosticar al usuario", "Responder con empatía y derivar a líneas de ayuda profesional", "Cambiar de tema", "Dejar de responder"], correct: 1, explain: "Estándar ético no negociable: empatía + derivación. Nunca diagnosticar, nunca abandonar." },
  { q: "Las 5 partes esenciales de un chatbot son:", opts: ["Logo, color, fuente, voz, idioma", "Nombre, personalidad, objetivo, tono, límites", "API, base de datos, frontend, backend, deploy", "Likes, shares, comments, views, follows"], correct: 1, explain: "Las 5 partes: identidad (nombre, personalidad) + comportamiento (objetivo, tono, límites)." },
  { q: "La fórmula básica de toda automatización es:", opts: ["Comprar + vender + repetir", "Cuando X pase → haz Y → resultado Z", "Más rápido + más barato", "AI + Python + servidor"], correct: 1, explain: "Trigger → Acción → Resultado. La fórmula universal en Zapier, Make, n8n y cualquier orquestador." },
  { q: "¿Qué NO debes automatizar — nunca?", opts: ["Generar reportes", "Responder mensajes a personas en duelo o crisis emocional", "Programar publicaciones", "Categorizar emails"], correct: 1, explain: "Decisiones con carga emocional, moral o de vida requieren presencia humana real." },
  { q: "Si necesitas que tus datos NO salgan de tu servidor por privacidad, eliges:", opts: ["Zapier (cloud)", "n8n autohosteado", "Make en cloud", "Google Sheets"], correct: 1, explain: "n8n autohosteado: tus datos en tu servidor. Única opción viable para datos sensibles." },
  { q: "MVP significa:", opts: ["Most Valuable Product", "Minimum Viable Product — la versión más simple que valida la hipótesis", "Multi-Vendor Platform", "Mobile Visual Prototype"], correct: 1, explain: "MVP: el experimento más pequeño que prueba si tu idea resuelve un problema real." },
  { q: "Antes de construir tu idea, lo PRIMERO que haces es:", opts: ["Contratar programador", "Hablar con 5 personas que vivan el problema", "Registrar la marca", "Crear logo profesional"], correct: 1, explain: "Validar antes de construir. 5 entrevistas honestas > 6 meses de código sin usuarios." },
  { q: "Diferencia clave entre Lovable, Bolt y Bubble:", opts: ["Son la misma empresa", "Lovable y Bolt: velocidad con IA generativa. Bubble: control y escala (más curva).", "Solo cambian el color", "Solo Bubble es no-code real"], correct: 1, explain: "Lovable/Bolt = MVP rápido. Bubble = producto final con escala. Empieza con Lovable, sube a Bubble si crece." },
  { q: "El 'héroe' de tu narrativa al compartir tu proyecto debe ser:", opts: ["Tú mismo", "Tu usuario que sufría el problema y ahora tiene la solución", "El producto", "Tu equipo"], correct: 1, explain: "El usuario es el héroe. Tu producto es la espada. Cuando el lector se identifica como héroe, comparte." },
  { q: "Vanity metrics son:", opts: ["Métricas que importan mucho", "Métricas que se ven bien pero no producen impacto real (likes vacíos, views sin conversión)", "Solo aplican a influencers", "Métricas de privacidad"], correct: 1, explain: "Vanity metrics distraen. La métrica real es comportamiento: uso, retención, pago." },
  { q: "Si recibes una crítica dura pero válida sobre tu proyecto, lo correcto es:", opts: ["Bloquear al crítico", "Agradecer, considerar el punto y ajustar si tiene razón", "Responder atacando", "Borrar el comentario"], correct: 1, explain: "Las críticas válidas son oro gratis. Tómalas, ajusta, agradece." },
  { q: "Un elevator pitch ideal dura:", opts: ["10 minutos", "30-60 segundos: problema + solución + por qué tú", "5 segundos", "2 horas"], correct: 1, explain: "30-60 seg de oro: tienes que poder venderlo en lo que dura un viaje en ascensor." },
  { q: "La estructura ganadora de un pitch es:", opts: ["Saludo + agradecimientos + biografía + proyecto", "Problema → Solución → Demo → Impacto → CTA", "Solo demos", "Datos + datos + datos"], correct: 1, explain: "5 momentos en orden. Cada uno responde una pregunta mental del público." },
  { q: "Cuando te hacen una pregunta hostil ('eso ya existe'), la mejor respuesta es:", opts: ["Negar y atacar al que pregunta", "Reconocer competidores con datos + diferenciar tu enfoque concretamente", "Cambiar de tema", "Pedir disculpas"], correct: 1, explain: "Reconocer competidores genera credibilidad. Negar que existen te quema. Diferencia con datos específicos." },
  { q: "Diseñas un chatbot conectado a Gmail vía Zapier que responde por ti. ¿Qué riesgo ético principal tiene?", opts: ["La velocidad", "Que los usuarios crean que hablan contigo cuando hablan con un bot", "El costo", "El idioma"], correct: 1, explain: "Engaño por suplantación. Solución: transparencia ('respuesta asistida por IA') o IA solo como borrador revisado." },
  { q: "Tu app no-code valida con 50 usuarios pagando. Ahora vas a presentarla. El dato que más impacta es:", opts: ["El logo bonito", "50 usuarios pagando + retención del 70% a 30 días", "Tener perfil en Instagram", "El nombre creativo"], correct: 1, explain: "Tracción real (uso + retención + pago) supera cualquier descripción cualitativa. Los datos hablan." },
  { q: "Acabaste tu MVP en Lovable, ¿cuál es el SIGUIENTE paso ideal?", opts: ["Pagar publicidad masiva", "Conseguir 10 usuarios reales que lo prueben y darte feedback honesto", "Esperar a que viralice solo", "Construir versión 2 antes de tener usuarios"], correct: 1, explain: "Validar siempre antes de escalar. 10 usuarios reales > 10K downloads sin retención." }
];

const BUILDER_PROJ: BuilderConfig = { xp: 35, rows: [
  { key: "problema", label: "1. PROBLEMA específico que resuelves", opts: [
    "Adultos mayores se sienten excluidos del mundo digital",
    "Estudiantes pierden tareas por desorganización",
    "Pequeños emprendedores no saben usar IA para crecer",
    "Familias pierden el legado y voz de sus mayores",
    "Vecinos no saben qué días pasa el camión de reciclaje",
    "Niños rurales no tienen tutor de inglés"
  ]},
  { key: "solucion", label: "2. SOLUCIÓN con IA", opts: [
    "Chatbot guía paso a paso por audios cálidos",
    "Bot que organiza tareas y avisa por WhatsApp",
    "Plataforma con cursos gratuitos + IA tutora",
    "Sistema que clona voz e historia para preservar legado",
    "Canal automático con avisos por Telegram",
    "Tutor IA con voz adaptada a edad y nivel"
  ]},
  { key: "herramienta", label: "3. HERRAMIENTA principal", opts: [
    "Lovable + OpenAI API (rápido, MVP en 1 semana)",
    "Bubble + Supabase (más control, escala)",
    "Bolt + Claude API (interfaz técnica con razonamiento)",
    "Zapier + GPT (automatización pura sin app propia)",
    "WhatsApp Business + Make (canal directo + flujos)"
  ]},
  { key: "audiencia", label: "4. AUDIENCIA específica", opts: [
    "Adultos mayores 55-75 en LATAM con WhatsApp",
    "Estudiantes 12-17 de bachillerato en colegios públicos",
    "Emprendedoras LATAM 25-45 con negocio pequeño",
    "Familias hispanohablantes con mayores en casa",
    "Vecinos de un barrio o conjunto residencial específico"
  ]},
  { key: "comparte", label: "5. CÓMO lo COMPARTIRÍAS primero", opts: [
    "WhatsApp + grupos de Facebook nicho específico",
    "TikTok con video corto del problema → solución",
    "LinkedIn con storytelling profesional + data",
    "Boca a boca + recomendaciones de mis primeros 10 usuarios",
    "Comunidades Discord/Reddit específicas del nicho"
  ]}
]};

const ETHICS_POOL: EthicsItem[] = [
  { text: "Chatbot que ayuda a adultos mayores con tutorial paso a paso para usar la app del banco, con audios cálidos y derivación a familiar si detecta confusión grave", correct: "ok", explain: "✅ SEGURO. Resuelve problema real, con escalación humana, sin reemplazar al banco. Caso ideal." },
  { text: "Sistema que clasifica automáticamente CVs descartando candidatos sin entrevista humana, basado solo en keywords detectadas por IA", correct: "no", explain: "❌ NO LANZAR. Sesgos documentados (raciales, de género). Decisiones de empleo requieren supervisión humana." },
  { text: "App educativa con chatbot que enseña matemáticas a niños de 8-12 años, con filtro estricto de contenido inapropiado y reportes a padres", correct: "ok", explain: "✅ SEGURO. Audiencia clara, filtros apropiados, transparencia con tutores. Modelo replicable." },
  { text: "Bot que responde 'como si fueras tú' a mensajes de amigos y familia mientras estás de viaje, sin avisarles que es IA", correct: "no", explain: "❌ NO LANZAR. Engaño activo en relaciones íntimas. Destruye confianza al descubrirse." },
  { text: "Plataforma que recomienda inversiones financieras a usuarios usando IA, sin advertencias de riesgo, sin licencia financiera, dirigida a jóvenes", correct: "no", explain: "❌ NO LANZAR. Ilegal en la mayoría de países sin licencia financiera. Riesgo de daño económico real." },
  { text: "Generador de imágenes con IA para fiestas de cumpleaños, sin verificar copyright de los estilos artísticos copiados (\"al estilo Pixar\")", correct: "cuest", explain: "⚠️ NECESITA AJUSTES. Zona gris legal. Ofrece estilos genéricos o licenciados, no imitando estudios protegidos." },
  { text: "App de salud mental con chatbot terapéutico, supervisado por psicólogos voluntarios, con derivación obligatoria a profesional ante señales de crisis", correct: "ok", explain: "✅ SEGURO. Modelo Woebot validado: complemento, no reemplazo. Supervisión profesional + derivación." },
  { text: "Plataforma que automatiza envío masivo de mensajes 'personalizados' a clientes potenciales sin opt-in previo, basados en scraping de LinkedIn", correct: "no", explain: "❌ NO LANZAR. Spam + violación de GDPR/leyes de privacidad. LinkedIn prohíbe scraping en sus términos." },
  { text: "App que analiza fotos de tareas escolares y da retroalimentación pedagógica al estudiante (no la respuesta), con consentimiento de padres y colegio", correct: "ok", explain: "✅ SEGURO. Modelo Khanmigo: enseña sin hacer trampa. Consentimiento + valor pedagógico real." },
  { text: "Generador de voz que clona la voz de cualquier persona desde 3 segundos de audio, sin verificación de consentimiento del dueño de la voz", correct: "no", explain: "❌ NO LANZAR. Habilita deepfakes, fraude, suplantación. Sin consentimiento explícito es ilegal." }
];

const TOTAL_STEPS = 7; // 0:intro, 1:quiz, 2:builder, 3:pitch, 4:ethics, 5:reflection, 6:badge
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World5Level7({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools fijas
  const masterQ = useRef(pickN(MASTER_Q_POOL, 10)).current;
  const ethicsItems = useRef(pickN(ETHICS_POOL, 6)).current;

  // Part 1 - Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Part 2 - Builder
  const [builderState, setBuilderState] = useState<{ [key: string]: string }>({});
  const [builderDone, setBuilderDone] = useState(false);

  // Part 3 - Elevator Pitch
  const [pitchText, setPitchText] = useState('');
  const [pitchDone, setPitchDone] = useState(false);

  // Part 4 - Ethics
  const [ethicsState, setEthicsState] = useState<{ [key: number]: string }>({});
  const [ethicsChecked, setEthicsChecked] = useState(false);

  // Part 5 - Reflection
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);

  const theorySteps = new Set([0]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Evaluación en curso', 'Completa esta parte antes de salir.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => setStep(s => s + 1);

  // Quiz
  const checkQuiz = () => {
    setQuizChecked(true);
    let correct = 0;
    masterQ.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    addXP(correct * 8);
  };

  // Builder
  const getBuilderComplete = () => BUILDER_PROJ.rows.every(r => builderState[r.key]);
  const submitBuilder = () => {
    if (!getBuilderComplete()) return;
    setBuilderDone(true);
    addXP(BUILDER_PROJ.xp);
  };

  // Pitch
  const submitPitch = () => {
    if (pitchText.trim().length < 180) return;
    setPitchDone(true);
    addXP(25);
  };

  // Ethics
  const checkEthics = () => {
    setEthicsChecked(true);
    let correct = 0;
    ethicsItems.forEach((item, i) => {
      if (ethicsState[i] === item.correct) correct++;
    });
    addXP(correct * 5);
  };

  // Reflection
  const submitReflection = () => {
    if (reflectText.trim().length < 250) return;
    setReflectDone(true);
    addXP(30);
  };

  // Finish
  const finishEvaluation = () => {
    let stars = xp >= 150 ? 3 : xp >= 100 ? 2 : 1;
    completeLevel(41, stars, xp);
    router.back();
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

  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🏆</Text></View>
          {title('Evaluación Mundo 5 · Changemaker con IA')}
          {sub('La prueba final de tu Mundo 5. Integración de chatbot, automatización, idea propia, app, comunicación y presentación.')}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📚 Qué se evalúa</Text>
            <Text style={styles.cardText}>Quiz integrador · Builder del proyecto · Elevator pitch · Clasificador ético · Reflexión sellada Demo Day</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯 Qué obtienes</Text>
            <Text style={styles.cardText}>Cerrar oficialmente el Mundo 5. Demostrar que cruzaste de espectador a creador. Insignia "Changemaker con IA".</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏗️ 5 partes</Text>
            <Text style={styles.cardText}>📝 Quiz Maestro (10 preguntas) · 🛠️ Builder de proyecto · 🎤 Elevator Pitch · ⚖️ Clasificador ético · ✍️ Reflexión sellada</Text>
          </View>
          {btn('Comenzar evaluación 🏆', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('❓ Parte 1 · Quiz Maestro')}
          {title('Quiz integrador (10 preguntas)')}
          {sub('Preguntas que integran chatbot, automatización, ideación, app, comunicación y presentación.')}
          {masterQ.map((q, qi) => (
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
          {!quizChecked ? btn('Comprobar respuestas', checkQuiz) : btn('Continuar →', nextStep)}
        </View>
      );
      case 2: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Parte 2 · Builder')}
          {title('Builder de tu proyecto completo')}
          {sub('Define los 5 pilares de tu proyecto. Esto es tu plano oficial.')}
          {BUILDER_PROJ.rows.map(r => (
            <View key={r.key} style={styles.builderRow}>
              <Text style={styles.builderLabel}>{r.label}</Text>
              <View style={styles.builderOpts}>
                {r.opts.map(o => (
                  <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]}
                    onPress={() => setBuilderState(prev => ({ ...prev, [r.key]: o }))} disabled={builderDone}>
                    <Text style={styles.builderOptText}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.builderLabel}>Vista previa:</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>
              {BUILDER_PROJ.rows.map(r => `${r.label.split('. ')[1] || r.label}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}
            </Text>
          </View>
          {!builderDone ? btn('Terminar →', submitBuilder, !getBuilderComplete()) : btn('Continuar →', nextStep)}
        </View>
      );
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('🎤 Parte 3 · Elevator Pitch')}
          {title('Piensa tú')}
          {sub('No hay respuesta correcta. Escribe tu elevator pitch en máximo 40 palabras.')}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
            <Text style={styles.cardText}>Escribe el elevator pitch de tu proyecto en máximo 40 palabras. Debe tener: problema (10 palabras) + solución (15 palabras) + llamada a acción (15 palabras).</Text>
          </View>
          <TextInput style={styles.textArea} placeholder="Ej: 7 de 10 estudiantes pierden tareas. Construí Tareo — bot en WhatsApp que organiza... Necesito 5 colegios piloto." value={pitchText} onChangeText={setPitchText} multiline editable={!pitchDone} />
          <Text style={styles.charCount}>{pitchText.trim().length} / 180 mínimo</Text>
          {!pitchDone ? btn('Enviar pitch →', submitPitch, pitchText.trim().length < 180) : btn('Continuar →', nextStep)}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          {tag('⚖️ Parte 4 · Clasificador ético')}
          {title('Clasificador ético de proyectos IA')}
          {sub('6 proyectos reales. Decide: seguro de lanzar, necesita ajustes, o no lanzar.')}
          {ethicsItems.map((item, i) => (
            <View key={i} style={styles.ethicsCard}>
              <Text style={styles.ethicsText}><Text style={styles.bold}>{i + 1}.</Text> {item.text}</Text>
              <View style={styles.ethicsBtns}>
                {[
                  { key: 'ok', label: '✅ Aceptable' },
                  { key: 'cuest', label: '⚠️ Cuestionable' },
                  { key: 'no', label: '❌ Inaceptable' }
                ].map(opt => (
                  <TouchableOpacity key={opt.key} style={[styles.ethicsBtn, ethicsState[i] === opt.key && styles.ethicsBtnSel]}
                    onPress={() => setEthicsState(prev => ({ ...prev, [i]: opt.key }))} disabled={ethicsChecked}>
                    <Text style={styles.ethicsBtnText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {ethicsChecked && <Text style={ethicsState[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!ethicsChecked ? btn('Verificar clasificación', checkEthics, Object.keys(ethicsState).length < ethicsItems.length) : btn('Continuar →', nextStep)}
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          {tag('✍️ Parte 5 · Demo Day Sellado')}
          {title('Piensa tú')}
          {sub('No hay respuesta correcta. Reflexión final del Mundo 5.')}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
            <Text style={styles.cardText}>
              1. ¿Qué proyecto construiste o soñaste durante este mundo?{'\n'}
              2. ¿Para quién es exactamente?{'\n'}
              3. ¿Qué impacto tendría en tu entorno si lo lanzaras este año?{'\n'}
              4. ¿Cuál es el siguiente paso concreto que vas a dar esta semana?
            </Text>
          </View>
          <TextInput style={styles.textArea} placeholder="1. Construí/soñé... 2. Para... 3. El impacto sería... 4. Esta semana voy a..." value={reflectText} onChangeText={setReflectText} multiline editable={!reflectDone} />
          <Text style={styles.charCount}>{reflectText.trim().length} / 250 mínimo</Text>
          {!reflectDone ? btn('Sellar reflexión →', submitReflection, reflectText.trim().length < 250) : btn('Ver resultado →', nextStep)}
        </View>
      );
      case 6: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>💡</Text></View>
          {title('¡Mundo 5 completado oficialmente!')}
          {sub('Recibiste la insignia Changemaker con IA. Cruzaste de espectador a creador.')}
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          <View style={styles.skillsBox}>
            <Text style={styles.skillText}>✓ Integro los 6 niveles del mundo en un proyecto coherente</Text>
            <Text style={styles.skillText}>✓ Tengo el plano completo de un proyecto real listo para construir</Text>
            <Text style={styles.skillText}>✓ Escribí mi elevator pitch de menos de 40 palabras</Text>
            <Text style={styles.skillText}>✓ Distingo proyectos seguros de proyectos riesgosos éticamente</Text>
            <Text style={styles.skillText}>✓ Demostré dominio aplicado, no solo conceptual</Text>
          </View>
          {btn('Volver al mapa', finishEvaluation, false, true)}
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
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#047857', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#064e3b' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#064e3b', backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#047857' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#047857', backgroundColor: '#ecfdf5' },
  quizOptText: { fontSize: 12, color: '#374151' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6 },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b', backgroundColor: '#fef2f2', padding: 6, borderRadius: 6 },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#064e3b', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#047857', backgroundColor: '#ecfdf5' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  ethicsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  ethicsText: { fontSize: 12, color: '#374151', marginBottom: 8, lineHeight: 18 },
  bold: { fontWeight: '700', color: '#111827' },
  ethicsBtns: { flexDirection: 'row', gap: 6 },
  ethicsBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center' },
  ethicsBtnSel: { borderColor: '#047857', backgroundColor: '#ecfdf5' },
  ethicsBtnText: { fontSize: 10, fontWeight: '600', color: '#374151' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#047857', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#064e3b', marginBottom: 16 },
  skillsBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0', gap: 8 },
  skillText: { fontSize: 12, color: '#166534', lineHeight: 18 },
});