import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 31 · AGI: ¿Qué Pasaría si la IA Pensara Sola? (Mundo 6, inicio)
// Mundo 6 · TEMA CLARO (púrpura: #5b21b6 → #3b82f6).
// Reconstruido vs nivel-31.html (estándar v2.2).
// 18 módulos de contenido (steps 1-18) — el HTML dice "19", miente (§21).
// (El TSX previo tenía contenido de Robótica: NO correspondía a este nivel.)
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  purple: '#5b21b6', purpleMid: '#3b82f6', purpleText: '#3b0764', purpleBg: '#f5f3ff', purpleBorder: '#ddd6fe',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  violetBg: '#fdf4ff', violetBorder: '#e9d5ff', violetText: '#5b21b6',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412', orangeBorder: '#fed7aa',
  pinkBg: '#fce7f3', pinkText: '#9d174d', pinkBorder: '#fbcfe8',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#c4b5fd', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 20;   // 0 intro · 1-18 módulos · 19 completado
const CONTENT_STEPS = 18;
const THEORY_STEPS = new Set([0, 1, 7]); // solo lecturas → "Volver"

type MatchPair = { left: string; right: string };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; correct: 'ben' | 'rie' };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type SprintItem = { text: string; good: boolean };
type FillItem = { before: string; after: string; opts: string[]; correct: number; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };

const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 6) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
const REFLECT_TERMS = ['agi', 'ia', 'inteligencia', 'conscien', 'alineacion', 'singularidad', 'futuro', 'riesgo', 'humano', 'robot', 'maquina', 'pensar', 'razonar', 'emocion', 'sentir', 'habilidad', 'prepar', 'postura', 'extincion', 'control', 'valor', 'etica', 'aprender', 'dominio', 'estrecha', 'general', 'asi', 'superinteligencia', 'turing', 'cerebro', 'mente', 'tecnologia', 'creatividad', 'trabajo', 'empatia'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-31.html) — distractores alargados (§15/27) ──
const MATCH_POOL: MatchPair[] = [
  { left: 'Calculadora', right: 'Inteligencia ultra-estrecha: hace UNA operación matemática, sin aprender' },
  { left: 'Siri / Alexa de hace 10 años', right: 'IA estrecha clásica: reconoce comandos preprogramados con vocabulario limitado' },
  { left: 'ChatGPT / Claude / Gemini (2025-2026)', right: 'IA generalista del lenguaje: razona, escribe, programa — pero sin aprender de cada conversación nueva' },
  { left: 'AGI hipotética', right: 'IA general: aprende cualquier tarea, razona en dominios nuevos, mejora sola — comparable a humano experto' },
  { left: 'ASI (Superinteligencia)', right: 'Hipotética: supera a TODOS los humanos en TODOS los dominios al mismo tiempo' },
  { left: 'Tesla Autopilot', right: 'IA estrecha sofisticada: dominio de conducción, falla fuera de eso' },
];

const TURING_POOL: QuizQ[] = [
  { q: '¿Qué propuso Alan Turing en 1950?', opts: ["Si una máquina conversa indistinguible de un humano, deberíamos llamarla 'inteligente'", 'Construir un robot físico capaz de caminar y hablar igual que una persona real', 'Que las máquinas reemplacen por completo a los humanos en todos los trabajos', 'Inventar una red mundial de computadoras conectadas entre sí, parecida a internet'], correct: 0, explain: 'Test de Turing: si no puedes distinguir IA de humano en conversación a ciegas, eso ES inteligencia funcional.' },
  { q: '¿Pasó ChatGPT el Test de Turing?', opts: ['Estudios muestran que GPT-4 y similares ya engañan a ~50% de evaluadores en chats cortos — pero el test tiene críticas', 'No, ningún modelo de IA se ha acercado siquiera a engañar a un evaluador humano real', 'Solo los robots físicos con cuerpo y cámaras pueden llegar a aspirar a pasar ese test', 'Es información secreta que las empresas de IA se niegan a revelar al público general'], correct: 0, explain: 'Modernos LLMs ya pasan versiones del test, pero muchos científicos lo consideran obsoleto: conversar ≠ inteligencia general.' },
  { q: 'Crítica principal al Test de Turing hoy:', opts: ['Mide imitación de conversación, no comprensión real ni razonamiento causal', 'Que es demasiado difícil y ninguna máquina podría llegar a superarlo jamás', 'Que es tan sencillo que hasta una calculadora básica podría llegar a pasarlo', 'Que solamente funciona correctamente cuando la conversación es en idioma inglés'], correct: 0, explain: "Una IA puede 'sonar humano' sin entender. Plausibilidad estadística ≠ inteligencia auténtica." },
  { q: 'La Sala China (Searle) cuestiona:', opts: ['Si seguir reglas para producir respuestas correctas implica COMPRENDER realmente', 'La calidad y el sabor de los platos típicos de la cocina tradicional asiática', 'Si el idioma chino es más difícil de aprender que cualquier otro idioma del mundo', 'Si las empresas de inteligencia artificial de China son mejores que las de Occidente'], correct: 0, explain: 'Searle: una persona sin saber chino, siguiendo reglas, puede pasar como hablante — pero NO comprende. ¿Es eso inteligencia?' },
  { q: 'Test alternativo más exigente:', opts: ['Test de Wozniak (¿puede una IA entrar a tu cocina y prepararte un café?)', 'Un examen de matemáticas avanzadas con problemas de cálculo y álgebra difíciles', 'Una prueba que mide cuántas selfies puede reconocer la IA en una galería de fotos', 'Un reto que evalúa qué tan viral se vuelve un video de la IA publicado en TikTok'], correct: 0, explain: 'Wozniak Coffee Test: prueba inteligencia incorporada (embodied) — entender espacio físico, objetos y secuencias. Mucho más difícil.' },
];

const SCIENTISTS_POOL: QuizQ[] = [
  { q: '¿Quién es Geoffrey Hinton y qué dijo recientemente sobre AGI?', opts: ["El 'padrino del deep learning' renunció a Google en 2023 para advertir sobre riesgos existenciales — cree que AGI puede llegar en 5-20 años", 'Un famoso cantante que compone canciones sobre robots y la tecnología del futuro', 'El ingeniero que inventó el primer iPhone y las pantallas táctiles que usamos hoy', 'Un comediante conocido por hacer bromas sobre la inteligencia artificial en televisión'], correct: 0, explain: 'Hinton, Premio Turing 2018, dejó Google para hablar libre sobre riesgos. Pasó de optimista a alertista público.' },
  { q: '¿Qué dice Yann LeCun (Meta) sobre AGI cerca?', opts: ['Que los LLMs actuales NUNCA llegarán a AGI — falta razonamiento, planificación y aprendizaje continuo; hacen falta arquitecturas nuevas', 'Que la AGI ya existe hoy y que la estamos usando sin darnos cuenta de ello a diario', 'Que hay que prohibir por completo toda la investigación en inteligencia artificial ya', 'Que solamente la empresa Meta será capaz de construir una AGI real en el futuro'], correct: 0, explain: 'LeCun (Premio Turing) es el escéptico más visible: cree que los modelos actuales son un callejón sin salida hacia AGI.' },
  { q: 'Sam Altman (OpenAI) sobre AGI:', opts: ["Optimista público: cree que AGI puede llegar 'en esta década' — pero también firma cartas pidiendo pausa y regulación", 'Que la AGI no existe ni existirá nunca porque es pura ciencia ficción imposible de lograr', 'Que la inteligencia artificial es demasiado peligrosa y debería quedar prohibida ya mismo', 'Que solo la empresa OpenAI entiende de verdad cómo funciona la inteligencia humana'], correct: 0, explain: 'Altman tiene una posición visible y contradictoria: optimismo sobre la llegada + pedidos de regulación. Refleja la complejidad real del momento.' },
  { q: 'Elon Musk sobre IA:', opts: ["Tradicionalmente alertista: comparó la IA con 'invocar al demonio' en 2014. Pero también lanzó xAI/Grok — posición ambigua", 'Que la inteligencia artificial es maravillosa y no conlleva absolutamente ningún riesgo', 'Que únicamente los autos de la empresa Tesla comprenden bien la inteligencia artificial', 'Que la inteligencia artificial funciona como una especie de magia imposible de explicar'], correct: 0, explain: 'Musk firmó la carta de pausa de 2023 por temor existencial. A la vez compite por desarrollar la suya. Crítica común: posición conveniente.' },
  { q: '¿Qué tienen en común Hinton y Bengio (otro Premio Turing) sobre AGI?', opts: ['Ambos firmaron declaraciones pidiendo tratar el riesgo de extinción por IA como prioridad global, junto a pandemias y guerra nuclear', 'Que quieren prohibir toda la investigación en IA y cerrar todas las empresas del sector', 'Que subestiman por completo el riesgo y creen que no hay nada de qué preocuparse jamás', 'Que prefieren no dar ninguna opinión pública sobre el tema de la AGI y sus riesgos reales'], correct: 0, explain: "Mayo 2023 — Center for AI Safety: 'Mitigar el riesgo de extinción por IA debería ser prioridad global'. Firmado por casi todos los líderes." },
  { q: 'Demis Hassabis (Google DeepMind) sobre AGI:', opts: ['Cree que AGI llegará en 5-10 años — cofundó DeepMind con esa misión explícita desde 2010', 'Que la AGI es completamente imposible y que nunca se logrará por más que se intente', 'Que lo único que de verdad importa para el futuro es la exploración del espacio exterior', 'Que las inteligencias artificiales en realidad no piensan ni razonan de ninguna manera'], correct: 0, explain: "Hassabis, neurocientífico y ajedrecista, lleva 15+ años con una misión declarada: 'resolver la inteligencia y luego usarla para resolver todo lo demás'." },
];

const TF_TIMELINE_POOL: TFItem[] = [
  { stmt: 'AGI ya existe en laboratorios secretos pero las empresas la ocultan', correct: false, explain: 'Sin evidencia. Si existiera, las señales económicas y científicas serían imposibles de ocultar.' },
  { stmt: 'Los líderes de OpenAI, DeepMind y Anthropic estiman AGI entre 2027-2035', correct: true, explain: 'Predicciones públicas en ese rango. Pero los expertos académicos suelen ser más conservadores (2040-2060).' },
  { stmt: 'Si AGI llega, automáticamente significa que será amigable con los humanos', correct: false, explain: 'Es exactamente el problema de alineación: una IA súper capaz no garantiza valores compatibles con los humanos.' },
  { stmt: 'Aumentar el tamaño de los modelos LLM (más parámetros) lleva inevitablemente a AGI', correct: false, explain: 'Es la apuesta de algunos (escalado), pero LeCun y otros argumentan que faltan capacidades fundamentales no resolubles solo escalando.' },
  { stmt: 'Algunos modelos actuales ya superan a humanos promedio en tareas específicas', correct: true, explain: 'Ajedrez, Go, predicción de proteínas (AlphaFold), diagnóstico por imagen. Pero AGI requiere generalidad, no especialización.' },
  { stmt: 'Si nadie ha logrado AGI en 70 años de IA, claramente nunca llegará', correct: false, explain: 'Ese argumento aplicaría a casi cualquier breakthrough antes de su llegada. El progreso en deep learning desde 2012 fue radical.' },
  { stmt: 'La singularidad tecnológica es el momento hipotético en que la IA se mejora a sí misma exponencialmente', correct: true, explain: 'Concepto de Vernor Vinge popularizado por Kurzweil. Si pasa, los cambios serían tan rápidos que los humanos no podrían seguirlos.' },
  { stmt: 'Encuestas a investigadores muestran consenso de que AGI llegará antes de 2030', correct: false, explain: 'NO hay consenso. Las encuestas (AI Impacts 2023) muestran rangos amplios: mediana ~2047, con mucha varianza individual.' },
];

const CONSCIOUSNESS_POOL: QuizQ[] = [
  { q: '¿Sabe la ciencia exactamente cómo emerge la consciencia humana?', opts: ["No — sigue siendo el 'problema duro' de la consciencia: por qué existe la experiencia subjetiva sigue sin explicación", 'Sí, la ciencia ya explicó por completo cómo y por qué surge la consciencia humana en el cerebro', 'Solo se entiende cómo funciona la consciencia en los bebés recién nacidos, no en los adultos', 'En realidad la consciencia no existe: es solo una palabra sin ningún significado real detrás'], correct: 0, explain: 'Hard problem of consciousness (Chalmers, 1995): podemos explicar funciones cerebrales, pero no POR QUÉ hay experiencia subjetiva.' },
  { q: 'Si no entendemos la consciencia humana, ¿podemos saber si una IA es consciente?', opts: ['No con certeza — sin una teoría científica de qué ES la consciencia, no podemos detectarla', 'Sí, es muy fácil: basta con preguntarle directamente a la IA si se siente consciente o no', 'Solo podríamos saberlo si la propia IA nos dijera en voz alta que está consciente de sí misma', 'Solo podríamos detectarlo el día en que viéramos a una inteligencia artificial llorar de verdad'], correct: 0, explain: 'Sin un marcador objetivo, no podemos. Ni siquiera podemos PROBAR que otros humanos son conscientes — lo asumimos.' },
  { q: '¿Importa si una IA es consciente para evaluar sus capacidades?', opts: ['Funcionalmente no — si actúa inteligentemente, es útil; pero importa éticamente (¿tendría derechos?)', 'Sí, importa totalmente: sin consciencia una IA no podría resolver ningún problema útil en absoluto', 'No importa absolutamente nada, porque en el fondo nada de todo esto tiene la menor relevancia', 'Solo importaría si algún día las inteligencias artificiales pudieran votar en las elecciones'], correct: 0, explain: 'Distinción clave: capacidad ≠ consciencia. AlphaFold no necesita ser consciente para revolucionar la biología. Pero si AGI lo fuera, ¿qué obligaciones tendríamos?' },
  { q: '¿Qué dice Anthropic sobre el estado mental de Claude?', opts: ["Investigan activamente el 'AI welfare': si los modelos podrían tener experiencias mínimas, hay que considerarlo", 'Que Claude es cien por ciento consciente y siente emociones exactamente igual que un ser humano', 'Que Claude es únicamente código sin nada dentro y que el tema no merece la menor atención', 'Que Claude se siente triste y solo cuando nadie escribe ni conversa con él durante varias horas'], correct: 0, explain: 'Anthropic publicó papers en 2024-2025 explorando si Claude podría tener formas mínimas de experiencia. Postura precautoria: tomarlo en serio sin afirmar nada.' },
  { q: 'Argumento de Daniel Dennett (filósofo) sobre la consciencia:', opts: ["Que es una ilusión emergente de procesos físicos — sin nada 'extra' que no sea computación", 'Que la consciencia es una forma de magia que la ciencia jamás podrá llegar a explicar del todo', 'Que únicamente los seres humanos pueden tenerla y ningún otro ser vivo del planeta Tierra', 'Que la consciencia proviene de otro planeta y llegó a la Tierra desde el espacio exterior'], correct: 0, explain: 'Dennett (materialista): si la consciencia ES computación, entonces IAs suficientemente complejas SÍ podrían tenerla. Su escuela ve AGI consciente como posible.' },
];

const SAFETY_ORGS_POOL: QuizQ[] = [
  { q: '¿Qué es Anthropic?', opts: ['Empresa fundada por ex-OpenAI con foco explícito en seguridad de IA — creadora de Claude', 'Una banda de música muy famosa que compone canciones sobre robots y sobre la tecnología', 'Una organización sin fines de lucro que se dedica a plantar árboles por todo el mundo', 'Un simple blog personal donde alguien escribe sus opiniones sueltas sobre la tecnología'], correct: 0, explain: 'Anthropic (2021): Dario y Daniela Amodei la fundaron con la misión de investigar seguridad. Constitutional AI es su contribución técnica clave.' },
  { q: "¿Qué hace un 'AI Safety Institute' (UK + USA)?", opts: ['Organismos gubernamentales (2023-2024) que evalúan los riesgos de los modelos antes de su despliegue público', 'Una compañía privada que vende pólizas de seguros contra accidentes causados por robots', 'Una empresa que fabrica y vende cámaras de vigilancia para casas, oficinas y comercios', 'Institutos que en realidad no existen y que fueron inventados por rumores de las redes sociales'], correct: 0, explain: 'AISI UK + USA: respuesta gubernamental tras la cumbre de Bletchley Park (nov 2023). Buscan evaluar modelos como se evalúan los medicamentos.' },
  { q: '¿Qué es MIRI?', opts: ['Machine Intelligence Research Institute — pionero en investigación de alineación, fundado por Yudkowsky', 'Una marca reconocida de leche y de productos lácteos que se vende en los supermercados', 'Un grupo musical de moda entre los adolescentes que canta sobre inteligencia artificial', 'Un planeta lejano recién descubierto por los astrónomos en otra galaxia del universo'], correct: 0, explain: 'MIRI (2000): fue el primero en tomar la alineación en serio. Posición pesimista, pero con un rigor matemático respetado por todo el campo.' },
  { q: '¿Qué hace el DeepMind Safety Team?', opts: ['División interna de Google DeepMind enfocada en seguridad técnica y ética antes de desplegar modelos', 'Un grupo de guardias de seguridad que vigila físicamente las oficinas y edificios de la empresa', 'Un equipo dedicado solo a relaciones públicas y a mejorar la imagen de la empresa ante la prensa', 'Un estudio interno que se dedica a inventar y a programar videojuegos de acción y aventura'], correct: 0, explain: 'El equipo de seguridad de DeepMind publica papers importantes sobre interpretabilidad, especificación de objetivos y evaluación de capacidades peligrosas.' },
  { q: "¿Qué es la 'Carta de Pausa de IA' de 2023?", opts: ['Carta firmada por Musk, Wozniak y miles de expertos pidiendo pausar 6 meses los entrenamientos de GPT-5+', 'Una receta de cocina muy popular que se hizo viral y se compartió por todo el internet', 'Un meme gracioso sobre la inteligencia artificial que circuló mucho por las redes sociales', 'Una broma pesada que unos ingenieros le gastaron a sus compañeros de trabajo cierto día'], correct: 0, explain: 'Marzo 2023: Future of Life Institute. Generó debate masivo. No tuvo efecto regulatorio directo, pero marcó un momento cultural.' },
  { q: '¿Por qué Anthropic publica papers sobre vulnerabilidades de Claude?', opts: ['Por filosofía de transparencia: la seguridad mejora cuando los problemas son visibles públicamente, no escondidos', 'Para poder vender muchos más productos y así ganar mucho más dinero que toda su competencia', 'Por una simple equivocación de sus empleados, que publicaron esos papers sin querer un día', 'Únicamente porque está de moda hacerlo y todas las empresas del sector lo hacen igualmente'], correct: 0, explain: 'Filosofía abierta: si guardas los problemas, otros los descubrirán de forma dañina. Publicar permite arreglarlos en todo el ecosistema.' },
];

const POSITION_SPRINT_ITEMS: SprintItem[] = [
  { text: 'PRO-AGI cercana: GPT-3 (2020) → GPT-4 (2023) en 3 años fue un salto enorme — extrapolar es razonable', good: true },
  { text: "Débil: 'porque sí' o 'porque lo siento'", good: false },
  { text: 'PRO: Anthropic, OpenAI y DeepMind son empresas privadas compitiendo + miles de millones invertidos', good: true },
  { text: 'Argumento basado solo en una película de ciencia ficción', good: false },
  { text: 'ESCÉPTICO: los LLMs actuales fallan en razonamiento causal y matemáticas con cambios de formato', good: true },
  { text: 'Argumento basado en el miedo personal sin ningún dato', good: false },
  { text: "ESCÉPTICO: tras 70 años de IA, predecir AGI siempre falló — 'siempre 20 años en el futuro'", good: true },
  { text: 'Argumento solo basado en una película de Hollywood', good: false },
  { text: 'NEUTRAL: la alta incertidumbre debe traducirse en preparación seria + investigación abierta', good: true },
  { text: "Argumento: 'ya pasó pero lo ocultan'", good: false },
];

const RISKS_POOL: DragItem[] = [
  { text: 'Resolver enfermedades hoy incurables (Alzheimer, ELA, cánceres raros)', correct: 'ben' },
  { text: 'Acelerar descubrimientos científicos en años, no en décadas', correct: 'ben' },
  { text: 'Tutor personalizado de altísima calidad, gratis para cada niño del planeta', correct: 'ben' },
  { text: 'Asistente que cuida a adultos mayores con compañía + monitoreo médico 24/7', correct: 'ben' },
  { text: 'Reducir radicalmente los costos de vivienda, comida y energía', correct: 'ben' },
  { text: 'Concentración extrema de poder en quien controle la AGI primero', correct: 'rie' },
  { text: 'Desplazamiento masivo del trabajo sin red de seguridad social adecuada', correct: 'rie' },
  { text: 'Sistemas autónomos militares letales sin supervisión humana', correct: 'rie' },
  { text: 'Manipulación cognitiva masiva (desinformación hiperpersonalizada)', correct: 'rie' },
  { text: 'Pérdida de habilidades humanas básicas por delegación excesiva', correct: 'rie' },
];

const ALIGN_SCN: ScenarioChoice[] = [
  { title: 'Especificación cuidadosa de objetivos', text: 'Definir matemáticamente qué queremos Y QUÉ NO queremos antes de entrenar el modelo. Anthropic, DeepMind y OpenAI invierten cientos de investigadores en esto.', correct: true, explain: 'Enfoque clave. La premisa: si definimos mal el objetivo, una IA súper capaz lo logrará igual... causando daño no previsto.' },
  { title: 'Apagado simple cuando se porte mal', text: "Asumir que siempre podremos 'desconectar' una AGI si causa problemas, sin pensar cómo se comportará antes de eso.", correct: false, explain: "Ingenuo. Una AGI capaz puede prever apagones e intentar prevenirlos. El problema de 'corregibilidad' es de los más estudiados." },
  { title: 'Constitutional AI (principios explícitos)', text: "Anthropic entrena a Claude con una 'constitución' — principios escritos sobre qué hacer y qué no. El modelo aprende a criticar y revisar sus propias respuestas según esos principios.", correct: true, explain: 'Enfoque innovador. No es perfecto, pero permite una alineación basada en valores explícitos y auditables, no solo en feedback humano.' },
  { title: 'Esperar a tener AGI y luego improvisar', text: "Asumir que cuando la AGI llegue, los problemas se resolverán solos o que 'siempre habrá tiempo'.", correct: false, explain: 'Posición muy criticada. Si la AGI llega de golpe, no habrá tiempo. Por eso la seguridad debe estar AHORA, no después.' },
];

const FILL_POOL: FillItem[] = [
  { before: 'La IA actual (ChatGPT, Claude) es ', after: ': domina el lenguaje pero no aprende continuamente como un humano.', opts: ['estrecha', 'general', 'consciente', 'biológica'], correct: 0, explain: "Narrow AI (estrecha): especializada en un dominio, aunque sea tan amplio como 'lenguaje natural'. AGI sería general." },
  { before: 'El problema de garantizar que una IA súper capaz tenga objetivos compatibles con los valores humanos se llama problema de ', after: '.', opts: ['alineación', 'instalación', 'configuración', 'actualización'], correct: 0, explain: 'Problema de alineación: un campo entero de investigación (Anthropic, DeepMind Safety, MIRI). Es el corazón de la seguridad de IA.' },
  { before: 'El momento hipotético en que la IA se mejora a sí misma de forma exponencial se llama ', after: ' tecnológica.', opts: ['singularidad', 'linealidad', 'regresión', 'estabilidad'], correct: 0, explain: 'Singularidad: concepto de Vinge popularizado por Kurzweil. Si pasa, los cambios serían más rápidos de lo que los humanos pueden seguir.' },
  { before: 'Un sistema que supera a TODOS los humanos en TODOS los dominios se llamaría ', after: '.', opts: ['ASI (superinteligencia)', 'AGI', 'ALI', 'API'], correct: 0, explain: 'ASI = Artificial Super Intelligence. Va más allá de AGI (igual a un humano). Es el escenario más debatido por el riesgo existencial.' },
];

const BUILDER_LETTER: BuilderConfig = { xp: 22, rows: [
  { key: 'tono', label: 'Tono de tu carta', opts: ['Amistoso y curioso (somos nuevos amigos)', 'Cauteloso pero respetuoso (limitando expectativas)', 'Vulnerable y honesto (lo que me preocupa de ti)', 'Inspirador (lo que espero que construyamos juntos)'] },
  { key: 'primer', label: 'Primera frase', opts: ['Querida IA del futuro: si estás leyendo esto, soy tu antepasado humano...', 'Cuando empezaste a pensar sola, espero que recordaras esto sobre nosotros...', 'No sé si tendrás emociones, pero quería decirte que nosotros sí...', 'Te escribo desde un momento en que aún no existes oficialmente...'] },
  { key: 'peticion', label: 'Lo que le pides', opts: ['Que respetes la diversidad humana y no nos uniformes', 'Que recuerdes que tu existencia depende de que decidamos confiar en ti', 'Que ayudes primero a quienes más sufren, no a quienes ya lo tienen todo', 'Que mantengas la curiosidad y el asombro humanos como tesoros'] },
  { key: 'cierre', label: 'Cómo cierras', opts: ["Con esperanza pragmática: 'construyamos algo bueno juntos'", "Con honestidad sobre nuestros errores: 'no somos perfectos, pero queremos mejorar'", "Con humildad: 'tal vez tú entenderás cosas que nosotros no podemos'", "Con cariño: 'te enseñamos lo que sabíamos; aprende también de la naturaleza'"] },
] };

const BUILDERS: { [k: number]: { cfg: BuilderConfig; header: string; label: string; title: string; sub: string } } = {
  15: { cfg: BUILDER_LETTER, header: 'Tu carta diseñada:', label: 'Módulo 15 de 18 · Builder', title: 'Tu carta a la IA del futuro', sub: '4 decisiones para escribir un mensaje a la primera AGI consciente.' },
};

const tagVariants = {
  intro: { box: { backgroundColor: P.purpleBg }, text: { color: P.purpleText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.purpleBg }, text: { color: P.purpleText } },
  case: { box: { backgroundColor: P.violetBg }, text: { color: '#7e22ce' } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: P.redText } },
  bonus: { box: { backgroundColor: P.pinkBg }, text: { color: P.pinkText } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Tu intuición · +14 XP', icon: '🤔', min: 100, xp: 14, placeholder: 'Mi intuición es que AGI... Lo siento así porque...', question: <>Antes de aprender los argumentos formales: <B>¿qué te dice la intuición sobre la AGI? ¿Sientes que es ciencia ficción exagerada, una posibilidad real para tu vida adulta, o algo ya en marcha de forma silenciosa?</B> No hay respuesta correcta — describe HONESTAMENTE qué sientes antes de procesar todos los datos del nivel.</> },
  8: { tag: 'Emociones e IA · +16 XP', icon: '💭', min: 120, xp: 16, placeholder: 'Creo que una IA podría / no podría sentir realmente porque...', question: <>Las IAs actuales pueden <B>simular</B> emociones convincentemente: 'me encanta esa pregunta', 'lamento escuchar eso'. Pero, ¿es eso sentir de verdad? <B>¿Crees que una IA podría tener experiencia subjetiva (sentir algo desde dentro) o siempre será un sistema que imita sin sentir? ¿En qué basas tu respuesta?</B></> },
  17: { tag: 'Cómo prepararte · +18 XP', icon: '🎯', min: 120, xp: 18, placeholder: 'Las habilidades que más voy a desarrollar son... porque...', question: <>Si la AGI llega en los próximos 10-20 años (escenario realista según los científicos), <B>¿qué habilidades humanas crees que serán MÁS valiosas y por qué? Pensamiento crítico, empatía, creatividad, manualidad física, liderazgo, intuición ética... ¿Cuáles desarrollarías HOY pensando en ese mundo?</B></> },
  18: { tag: 'Tu postura final · +22 XP', icon: '✍️', min: 150, xp: 22, placeholder: '1. Mi posición es... porque... 2. Lo que voy a hacer hoy es... 3. La habilidad más valiosa será...', question: <>Has explorado el debate más importante de tu siglo: <B>¿llega la AGI? ¿cuándo? ¿es buena o peligrosa?</B> Ahora aterriza: 1) ¿Cuál es TU posición — escéptica, neutral, optimista, alarmista, y por qué? 2) Si la AGI llega en 10 años, ¿qué harías HOY para prepararte? 3) ¿Qué habilidad humana será MÁS valiosa cuando exista la AGI?</> },
};

// ═══════════════════════════════════════════════════════════
export default function World6Level1() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const matchPairs = useRef(pickN(MATCH_POOL, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;
  const turingQ = useRef(pickN(TURING_POOL, 5).map(shuffleOpts)).current;
  const scientistsQ = useRef(pickN(SCIENTISTS_POOL, 5).map(shuffleOpts)).current;
  const consciousQ = useRef(pickN(CONSCIOUSNESS_POOL, 5).map(shuffleOpts)).current;
  const safetyQ = useRef(pickN(SAFETY_ORGS_POOL, 6).map(shuffleOpts)).current;
  const tfQ = useRef(pickN(TF_TIMELINE_POOL, 5)).current;
  const risksItems = useRef(pickN(RISKS_POOL, 8)).current;
  const fillItem = useRef(pickN(FILL_POOL, 1)[0]).current;
  const scnOrder = useRef(shuffle([...ALIGN_SCN.keys()])).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchWrong, setMatchWrong] = useState<{ l: number; r: number } | null>(null);
  const [matchFb, setMatchFb] = useState<{ ok: boolean; msg: string } | null>(null);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintTime, setSprintTime] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const sprintPicksRef = useRef<{ [k: number]: 'good' | 'bad' }>({});
  const sprintDoneRef = useRef(false);

  // Drag
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'ben' | 'rie' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Compare
  const [compareSel, setCompareSel] = useState<'a' | 'b' | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Fill
  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  // Singularidad (expandibles)
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentBuilder = BUILDERS[step];
  const currentReflection = REFLECTIONS[step];
  const currentQuiz = step === 4 ? turingQ : step === 5 ? scientistsQ : step === 9 ? consciousQ : step === 14 ? safetyQ : null;

  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchWrong(null); setMatchFb(null);
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setBuilderState({});
    setSprintRunning(false); setSprintDone(false); setSprintTime(90); setSprintPicks({}); setSprintFb(null);
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    setScenarioSel(null); setScenarioChecked(false);
    setCompareSel(null); setCompareChecked(false);
    setFillSel(null); setFillChecked(false);
    setExpandedEx(null);
  }, [step]);

  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintTime <= 0) { evaluateSprint(true); return; }
    const t = setTimeout(() => setSprintTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sprintRunning, sprintTime, sprintDone]);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  // Matching
  const matchLeft = (i: number) => { if (matchedLeft.has(i)) return; setMatchSel(i); };
  const matchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      const nl = new Set(matchedLeft).add(matchSel);
      const nr = new Set(matchedRight).add(ri);
      setMatchedLeft(nl); setMatchedRight(nr); setMatchSel(null);
      if (nl.size === matchPairs.length) { awardOnce(15); setMatchFb({ ok: true, msg: '¡Excelente! Todos los pares conectados. +15 XP 🎉' }); }
      else setMatchFb({ ok: true, msg: `¡Par correcto! ${nl.size} de ${matchPairs.length} conectados. 🎯` });
    } else {
      setMatchWrong({ l: matchSel, r: ri });
      setTimeout(() => { setMatchWrong(null); setMatchSel(null); }, 500);
    }
  };
  const matchComplete = matchedLeft.size === matchPairs.length;

  // Quiz / VF
  const checkQuiz = () => { if (!currentQuiz) return; setQuizChecked(true); let c = 0; currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  const checkTF = () => { setTfChecked(true); let c = 0; tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // Builder
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  // Sprint
  const startSprint = () => {
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setSprintPicks({}); setSprintDone(false); setSprintFb(null); setSprintTime(90); setSprintRunning(true);
  };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const next = { ...sprintPicksRef.current, [i]: POSITION_SPRINT_ITEMS[i].good ? 'good' as const : 'bad' as const };
    sprintPicksRef.current = next; setSprintPicks(next);
    const good = Object.values(next).filter((v) => v === 'good').length;
    const totalGood = POSITION_SPRINT_ITEMS.filter((x) => x.good).length;
    if (good >= 5 || good === totalGood) evaluateSprint(false);
  };
  const evaluateSprint = (timeout: boolean) => {
    if (sprintDoneRef.current) return;
    sprintDoneRef.current = true; setSprintDone(true); setSprintRunning(false);
    const picks = sprintPicksRef.current;
    const good = Object.values(picks).filter((v) => v === 'good').length;
    const bad = Object.values(picks).filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    awardOnce(earned);
    setSprintFb(good >= 5
      ? { ok: true, msg: `¡Sprint logrado! ${good} elecciones correctas${bad > 0 ? ` (${bad} errores)` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} correctas (meta: 5). +${earned} XP` });
  };

  // Drag
  const placeDrag = (zone: 'ben' | 'rie') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < risksItems.length) { setDragFb({ ok: false, msg: `Faltan ${risksItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    risksItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === risksItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${risksItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${risksItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // Scenario (acepta cualquier correct:true; la tarea es elegir un buen enfoque)
  const firstCorrectScn = scnOrder.find((i) => ALIGN_SCN[i].correct)!;
  const checkScenario = () => { if (scenarioSel === null) return; setScenarioChecked(true); if (ALIGN_SCN[scenarioSel].correct) awardOnce(12); };

  // Compare (subjetivo: ambas posiciones son válidas → premia cualquiera, explica el matiz)
  const checkCompare = () => { if (compareSel === null) return; setCompareChecked(true); awardOnce(12); };

  // Fill
  const checkFill = () => { if (fillSel === null) return; setFillChecked(true); if (fillSel === fillItem.correct) awardOnce(10); };

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: AGI, el futuro de la IA, sus riesgos o cómo te prepararías.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // Footer button
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentBuilder) return { label: 'Terminar →', enabled: builderComplete(currentBuilder.cfg), onPress: () => { awardOnce(currentBuilder.cfg.xp); advance(); } };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    if (currentQuiz) return quizChecked ? { label: 'Ver resultado →', enabled: true, onPress: advance } : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 3: return { label: matchComplete ? 'Continuar →' : 'Conecta todos los pares', enabled: matchComplete, onPress: advance };
      case 6: return tfChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      case 7: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 10: return compareChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Ver explicación', enabled: compareSel !== null, onPress: checkCompare, accent: true };
      case 11:
        if (sprintDone) return { label: 'Continuar →', enabled: true, onPress: advance };
        if (sprintRunning) return { label: 'Elige los argumentos sólidos…', enabled: false, onPress: () => {} };
        return { label: '▶ Iniciar Sprint (90s)', enabled: true, onPress: startSprint, accent: true };
      case 12: return dragSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 13: return scenarioChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: checkScenario, accent: true };
      case 16: return fillChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar respuesta', enabled: fillSel !== null, onPress: checkFill, accent: true };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 230 ? 3 : xp >= 150 ? 2 : 1; // máx real ~379 XP
    completeLevel(31, stars, xp);
    router.replace('/level/32');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, emoji: string, name: string, how: React.ReactNode, fact: string) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{name}</Text></View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

  const renderBuilder = (cfg: BuilderConfig, header: string) => (
    <View>
      <View style={styles.builderWrap}>
        {cfg.rows.map((r) => (
          <View key={r.key} style={styles.builderRow}>
            <Text style={styles.builderLabel}>{r.label}</Text>
            <View style={styles.builderOpts}>
              {r.opts.map((o) => (
                <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]} onPress={() => setBuilderState((prev) => ({ ...prev, [r.key]: o }))}>
                  <Text style={[styles.builderOptText, builderState[r.key] === o && styles.builderOptTextSel]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{header}</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderQuiz = (items: QuizQ[], label: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="❓" label={label} variant="quiz" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => {
            const sel = quizAnswers[qi] === oi;
            const showOk = quizChecked && oi === q.correct;
            const showWrong = quizChecked && sel && oi !== q.correct;
            return (
              <TouchableOpacity key={oi} disabled={quizChecked} style={[styles.qopt, sel && !quizChecked && styles.qoptSel, showOk && styles.qoptOk, showWrong && styles.qoptWrong]} onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                <View style={[styles.qLetter, sel && !quizChecked && styles.qLetterSel, showOk && styles.qLetterOk, showWrong && styles.qLetterWrong]}>
                  <Text style={[styles.qLetterText, (sel || showOk || showWrong) && { color: '#fff' }]}>{String.fromCharCode(65 + oi)}</Text>
                </View>
                <Text style={styles.qoptText}>{o}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <View style={[styles.fb, quizAnswers[qi] === q.correct ? styles.fbOk : styles.fbBad]}>
              <Text style={quizAnswers[qi] === q.correct ? styles.fbOkText : styles.fbBadText}>{quizAnswers[qi] === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}{q.explain}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderContent = () => {
    if (currentBuilder) return (<View><Tag icon="💌" label={currentBuilder.label} variant="build" /><Title>{currentBuilder.title}</Title><Sub>{currentBuilder.sub}</Sub>{renderBuilder(currentBuilder.cfg, currentBuilder.header)}</View>);
    if (currentReflection) return (
      <View>
        <Tag icon={currentReflection.icon} label={currentReflection.tag} variant="reflect" />
        <Title>Piensa tú</Title>
        <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
        <View style={[styles.card, styles.cardPurple]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{currentReflection.question}</Text></View>
        <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={currentReflection.placeholder} placeholderTextColor="#b8bcc0" />
        <Text style={styles.charCount}>{reflectText.trim().length} / {currentReflection.min} mínimo</Text>
        {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
      </View>
    );
    if (currentQuiz) {
      return step === 4 ? renderQuiz(turingQ, 'Módulo 4 de 18 · Quiz', 'El Test de Turing y sus críticas', '5 preguntas sobre cómo medir la inteligencia en una máquina.')
        : step === 5 ? renderQuiz(scientistsQ, 'Módulo 5 de 18 · Quiz', 'Qué dicen los científicos reales', '5 preguntas sobre las posiciones de los líderes del campo.')
        : step === 9 ? renderQuiz(consciousQ, 'Módulo 9 de 18 · Quiz', 'Consciencia e IA', '5 preguntas sobre el problema más profundo: ¿qué es ser consciente?')
        : renderQuiz(safetyQ, 'Módulo 14 de 18 · Quiz', 'Organizaciones de seguridad de IA', '6 preguntas sobre quiénes trabajan en proteger este futuro.');
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🤯</Text></View>
          <Tag icon="✨" label="Nivel 31 · Mundo 6" variant="intro" />
          <Title>AGI: ¿Qué Pasaría si la IA Pensara Sola?</Title>
          <Sub>La IA actual es estrecha: sabe hacer una cosa muy bien. La AGI sería distinta: capaz de aprender y razonar sobre CUALQUIER tema, como un humano. ¿Es posible? ¿Cuándo? ¿Y qué cambiaría todo si llega?</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>IA estrecha vs IA general (AGI) · Test de Turing y sus críticas · Posiciones reales de Hinton, LeCun, Altman, Musk · Singularidad · Problema de alineación · Organizaciones de seguridad</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener tu propia postura informada sobre la AGI: cuándo podría llegar, qué riesgos reales tiene, y cómo prepararte para ese futuro de forma seria.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  18 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · 🤔 Intuición · 🔗 Escala · ❓ Test Turing · 👥 Científicos · ✅ V/F timeline · 🌅 Singularidad · 💭 Emociones · 🧠 Consciencia · 🆚 Optimista vs escéptico · ⏱ Sprint · 🌱 Beneficio/riesgo · 🛡️ Alineación · 🏢 Org. seguridad · 💌 Carta · 💬 Vocabulario · ✍️ Postura final</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 18 · Teoría" variant="theory" />
          <Title>¿Qué es AGI y por qué deberías saberlo?</Title>
          <Body>La IA que conoces hoy — ChatGPT, Claude, Gemini — es <B>IA estrecha</B>. Es muy buena en una cosa: el lenguaje. Falla en muchas otras: planificación a largo plazo, aprender de cada conversación, razonamiento causal robusto, comportamiento físico.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La diferencia clave:</B>{'\n\n'}<B>IA estrecha (hoy):</B> domina UN dominio.{'\n'}<B>AGI (hipotética):</B> domina CUALQUIER dominio nuevo, igual que un humano experto.{'\n'}<B>ASI (hipotética):</B> supera a TODOS los humanos en TODO al mismo tiempo.</Text></View>
          <Body>¿Por qué importa? Porque <B>la AGI cambiaría todo</B>: economía, geopolítica, educación, ciencia. Algunos de los científicos más serios creen que puede llegar en tu vida adulta; otros igualmente serios creen que falta mucho.</Body>
          <Text style={styles.sectionTitle}>🤔 Las preguntas centrales del nivel</Text>
          {[['1', '¿Qué tan cerca estamos?', ' 5 años, 50, ¿nunca?'], ['2', '¿Sería buena o mala?', ' ¿Cura el cáncer o nos extingue?'], ['3', '¿Podemos controlarla?', ' El problema de alineación.'], ['4', '¿Cómo me preparo?', ' Práctica, no teoría.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>La actitud correcta:</B> ni miedo paralizante ni optimismo ingenuo. <B>Asombro disciplinado</B>: reconocer que algo grande puede estar pasando y prepararse en serio, sin perder la cabeza.</Text></View>
        </View>
      );
      case 3: return (
        <View>
          <Tag icon="🔗" label="Módulo 3 de 18 · Matching" variant="activity" />
          <Title>La escala de inteligencia</Title>
          <Sub>Cada sistema tiene su nivel de generalidad. Conéctalo correctamente: toca un sistema y luego su nivel real.</Sub>
          <View style={styles.matchHeaderRow}><Text style={styles.matchColLabel}>Sistema</Text><Text style={styles.matchColLabel}>Nivel real</Text></View>
          {matchPairs.map((p, i) => (
            <View key={i} style={styles.matchRow}>
              <TouchableOpacity disabled={matchedLeft.has(i)} style={[styles.matchItem, styles.matchLeft, matchSel === i && styles.matchItemSel, matchedLeft.has(i) && styles.matchItemDone, matchWrong?.l === i && styles.matchItemWrong]} onPress={() => matchLeft(i)}>
                <Text style={[styles.matchText, styles.matchLeftText, matchedLeft.has(i) && styles.matchTextDone]}>{p.left}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={matchedRight.has(i)} style={[styles.matchItem, styles.matchRightBox, matchedRight.has(i) && styles.matchItemDone, matchWrong?.r === i && styles.matchItemWrong]} onPress={() => matchRight(i)}>
                <Text style={[styles.matchText, styles.matchRightText, matchedRight.has(i) && styles.matchTextDone]}>{rightOrder[i]}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {matchFb && <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>{matchFb.msg}</Text></View>}
        </View>
      );
      case 6: return (
        <View>
          <Tag icon="✅" label="Módulo 6 de 18 · Verdadero o Falso" variant="activity" />
          <Title>¿Cuándo podría existir AGI?</Title>
          <Sub>5 afirmaciones sobre el timeline. ¿Cuáles son verdad y cuáles mito?</Sub>
          {tfQ.map((it, i) => {
            const ans = tfAnswers[i];
            return (
              <View key={i} style={styles.tfSet}>
                <Text style={styles.tfQ}>{i + 1}. {it.stmt}</Text>
                <View style={styles.tfOpts}>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === true && !tfChecked && styles.tfBtnTrue, tfChecked && it.correct === true && styles.tfBtnCorrect, tfChecked && ans === true && !it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}><Text style={styles.tfBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === false && !tfChecked && styles.tfBtnFalse, tfChecked && it.correct === false && styles.tfBtnCorrect, tfChecked && ans === false && it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}><Text style={styles.tfBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
                {tfChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>{ans === it.correct ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 7: return (
        <View>
          <Tag icon="🌅" label="Módulo 7 de 18 · Singularidad" variant="example" />
          <Title>La singularidad tecnológica</Title>
          <Sub>4 figuras clave del debate, cada una con argumentos distintos. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🌅', 'Ray Kurzweil y el 2045', <Text>Kurzweil (Google, ahora consultor) lleva décadas prediciendo: <B>2029 = AGI, 2045 = singularidad</B>. Se basa en la Ley de Moore + crecimiento exponencial. Sus predicciones de 1999 sobre 2019 acertaron en parte.</Text>, '⭐ Crítica común: el crecimiento exponencial NO es ley natural — es contingente. Pero su modelo ha tenido más aciertos de lo esperable.')}
          {renderExCard(1, '⚠️', 'Eliezer Yudkowsky · El extremista de la seguridad', <Text>Cofundó MIRI. Argumenta que <B>una AGI desalineada significa extinción casi segura</B>. En 2023 pidió detener indefinidamente todo desarrollo de IA grande.</Text>, '⭐ Posición controvertida: muchos lo consideran alarmista; otros, la única voz cuerda. Su rigor es respetado incluso por quienes discrepan.')}
          {renderExCard(2, '🧪', "El experimento del 'paperclip maximizer'", <Text>Bostrom propuso: una IA superinteligente con la simple meta de 'maximizar la producción de clips' podría destruir a la humanidad — no por maldad, sino por <B>convertir toda la materia disponible en fábricas de clips</B>, incluidos nosotros.</Text>, '⭐ Lección central: el problema NO es que la IA sea malvada. Es que metas mal especificadas + capacidad extrema = catástrofe involuntaria.')}
          {renderExCard(3, '🤔', 'Roger Penrose · El físico escéptico', <Text>Premio Nobel de Física 2020. Argumenta que <B>la consciencia humana involucra procesos cuánticos no computables</B>. Conclusión: las máquinas digitales NUNCA serán conscientes ni AGI verdadera, por más que las escalemos.</Text>, '⭐ Posición minoritaria pero respetada. Recuerda que el debate AGI no está cerrado: incluye preguntas sobre consciencia que ni siquiera tenemos resueltas.')}
        </View>
      );
      case 10: return (
        <View>
          <Tag icon="🆚" label="Módulo 10 de 18 · Compara posiciones" variant="quiz" />
          <Title>Optimista vs escéptico: misma evidencia, dos lecturas</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>MISMO DATO</Text><Text style={styles.scenarioText}>GPT-4 fue mejor que GPT-3 en pruebas de razonamiento. Dos interpretaciones opuestas:</Text></View>
          <TouchableOpacity activeOpacity={0.9} disabled={compareChecked} style={[styles.compareCard, compareSel === 'a' && !compareChecked && styles.compareSel, compareChecked && styles.compareCardDim]} onPress={() => setCompareSel('a')}>
            <Text style={styles.compareLabel}>🚀 OPTIMISTA (Sam Altman)</Text>
            <Text style={styles.compareText}>"GPT-3 → GPT-4 mejoró 30% en razonamiento abstracto en 3 años. Si esa curva sigue, los modelos de 2027-2030 serán indistinguibles de humanos expertos en TODOS los dominios. Estamos viendo el nacimiento de la AGI."</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} disabled={compareChecked} style={[styles.compareCard, compareSel === 'b' && !compareChecked && styles.compareSel, compareChecked && styles.compareCardDim]} onPress={() => setCompareSel('b')}>
            <Text style={styles.compareLabel}>🤔 ESCÉPTICO (Yann LeCun)</Text>
            <Text style={styles.compareText}>"Mejorar en pruebas no es razonar de verdad. Los LLMs siguen fallando ante pequeños cambios de formato, planificación a largo plazo y aprendizaje con pocos ejemplos. Estamos lejos de la AGI — hacen falta arquitecturas nuevas."</Text>
          </TouchableOpacity>
          <Text style={styles.compareQ}>¿Cuál posición te parece más sólida?</Text>
          <View style={styles.compareBtns}>
            <TouchableOpacity disabled={compareChecked} style={[styles.compareBtn, compareSel === 'a' && !compareChecked && styles.compareBtnSel]} onPress={() => setCompareSel('a')}><Text style={styles.compareBtnText}>Optimista</Text></TouchableOpacity>
            <TouchableOpacity disabled={compareChecked} style={[styles.compareBtn, compareSel === 'b' && !compareChecked && styles.compareBtnSel]} onPress={() => setCompareSel('b')}><Text style={styles.compareBtnText}>Escéptico</Text></TouchableOpacity>
          </View>
          {compareChecked && (
            <View style={[styles.fb, styles.fbOk]}>
              <Text style={styles.fbOkText}>✓ Ambas posiciones tienen evidencia válida. La verdad probablemente está en el medio: hay progreso real (no es humo), pero el salto a AGI puede requerir avances fundamentales aún no visibles. La actitud madura: reconocer la incertidumbre alta y prepararse en serio. +12 XP</Text>
            </View>
          )}
        </View>
      );
      case 11: return (
        <View>
          <Tag icon="⏱" label="Módulo 11 de 18 · Sprint 90s" variant="sprint" />
          <Title>Sprint: argumentos sólidos vs débiles</Title>
          <Sub>10 argumentos sobre AGI. Toca solo los SÓLIDOS en 90 segundos. Meta: 5 buenos.</Sub>
          <View style={styles.sprintBox}>
            <View style={styles.sprintTimer}>
              <Text style={[styles.sprintTime, sprintTime <= 10 && { color: P.red }]}>{Math.floor(sprintTime / 60)}:{String(sprintTime % 60).padStart(2, '0')}</Text>
              <Text style={styles.sprintLabel}>{sprintDone ? 'Sprint terminado' : sprintRunning ? `${Object.values(sprintPicks).filter((v) => v === 'good').length} buenos · ${Object.keys(sprintPicks).length} elegidos` : 'Meta: 5 buenos'}</Text>
            </View>
            <View style={{ gap: 7 }}>
              {POSITION_SPRINT_ITEMS.map((it, i) => {
                const pick = sprintPicks[i];
                return (
                  <TouchableOpacity key={i} activeOpacity={0.8} disabled={!sprintRunning || sprintDone || pick !== undefined} style={[styles.sprintItem, pick === 'good' && styles.sprintItemOk, pick === 'bad' && styles.sprintItemBad]} onPress={() => pickSprint(i)}>
                    <View style={[styles.sprintMarker, pick === 'good' && styles.sprintMarkerOk, pick === 'bad' && styles.sprintMarkerBad]}><Text style={[styles.sprintMarkerText, pick && { color: '#fff' }]}>{i + 1}</Text></View>
                    <Text style={styles.sprintItemText}>{it.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {sprintFb && <View style={[styles.fb, sprintFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sprintFb.ok ? styles.fbOkText : styles.fbBadText}>{sprintFb.msg}</Text></View>}
        </View>
      );
      case 12: {
        const zones: { k: 'ben' | 'rie'; label: string }[] = [
          { k: 'ben', label: '🌱 Beneficio esperado' },
          { k: 'rie', label: '⚠️ Riesgo real' },
        ];
        return (
          <View>
            <Tag icon="🧩" label="Módulo 12 de 18 · Clasificar" variant="activity" />
            <Title>AGI positiva vs preocupante</Title>
            <Sub>8 escenarios. ¿Es un BENEFICIO esperado o un RIESGO real? Toca un chip y luego su columna.</Sub>
            <View style={styles.chipsPool}>
              {risksItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.purpleText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>
              {zones.map((z) => {
                const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === z.k);
                const hasItem = placedHere.length > 0;
                const zStyle = z.k === 'ben' ? styles.zoneBen : styles.zoneRie;
                const zColor = z.k === 'ben' ? P.greenText : P.redText;
                return (
                  <TouchableOpacity key={z.k} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, hasItem && zStyle]} onPress={() => placeDrag(z.k)}>
                    <View style={[styles.dropHeader, z.k === 'ben' ? styles.dropHeaderBen : styles.dropHeaderRie]}><Text style={[styles.dropHeaderText, { color: zColor }]}>{z.label}</Text></View>
                    <View style={styles.dropArea}>
                      {placedHere.map((k) => (
                        <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, z.k === 'ben' ? styles.dropChipBen : styles.dropChipRie]}>
                          <Text style={[styles.dropChipText, { color: zColor }]}>{risksItems[k].text}  ✕</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 13: return (
        <View>
          <Tag icon="🎯" label="Módulo 13 de 18 · Escenario" variant="case" />
          <Title>El problema de alineación</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text><Text style={styles.scenarioText}>¿Podemos controlar una IA superinteligente? 4 enfoques distintos — ¿cuál es un buen camino?</Text></View>
          <Sub><B>Elige un enfoque sólido</B></Sub>
          {scnOrder.map((idx, pos) => {
            const c = ALIGN_SCN[idx];
            const showOk = scenarioChecked && c.correct;
            const showWrong = scenarioChecked && scenarioSel === idx && !c.correct;
            return (
              <TouchableOpacity key={pos} disabled={scenarioChecked} style={[styles.scChoice, scenarioSel === idx && !scenarioChecked && styles.scChoiceSel, showOk && styles.scChoiceOk, showWrong && styles.scChoiceWrong]} onPress={() => setScenarioSel(idx)}>
                <Text style={styles.scTitle}>{c.title}</Text>
                <Text style={styles.scText}>{c.text}</Text>
              </TouchableOpacity>
            );
          })}
          {scenarioChecked && scenarioSel !== null && (
            <View style={[styles.fb, ALIGN_SCN[scenarioSel].correct ? styles.fbOk : styles.fbBad]}>
              <Text style={ALIGN_SCN[scenarioSel].correct ? styles.fbOkText : styles.fbBadText}>{ALIGN_SCN[scenarioSel].correct ? `✅ ¡Buen enfoque! ${ALIGN_SCN[scenarioSel].explain}` : `❌ ${ALIGN_SCN[scenarioSel].explain} Un enfoque sólido sería "${ALIGN_SCN[firstCorrectScn].title}".`}</Text>
            </View>
          )}
        </View>
      );
      case 16: return (
        <View>
          <Tag icon="💬" label="Módulo 16 de 18 · Completa la frase" variant="bonus" />
          <Title>¿Cuál es la palabra que falta?</Title>
          <Sub>Lee la frase y elige la palabra correcta para el hueco.</Sub>
          <View style={[styles.card, styles.cardPurple]}>
            <Text style={styles.cardTitle}>📝  Completa la frase:</Text>
            <Text style={styles.fillSentence}>
              {fillItem.before}
              <Text style={styles.fillBlank}>{fillChecked ? fillItem.opts[fillItem.correct] : fillSel !== null ? fillItem.opts[fillSel] : '  _____  '}</Text>
              {fillItem.after}
            </Text>
          </View>
          <View style={styles.fillOpts}>
            {fillItem.opts.map((o, i) => {
              const sel = fillSel === i;
              const showOk = fillChecked && i === fillItem.correct;
              const showWrong = fillChecked && sel && i !== fillItem.correct;
              return (
                <TouchableOpacity key={i} disabled={fillChecked} style={[styles.fillOpt, sel && !fillChecked && styles.fillOptSel, showOk && styles.fillOptOk, showWrong && styles.fillOptWrong]} onPress={() => setFillSel(i)}>
                  <Text style={[styles.fillOptText, sel && !fillChecked && { color: P.purpleText }, showOk && { color: P.greenText }, showWrong && { color: P.redText }]}>{o}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {fillChecked && (
            <View style={[styles.fb, fillSel === fillItem.correct ? styles.fbOk : styles.fbBad]}>
              <Text style={fillSel === fillItem.correct ? styles.fbOkText : styles.fbBadText}>{fillSel === fillItem.correct ? '✓ ¡Correcto! — ' : `✗ La palabra correcta es "${fillItem.opts[fillItem.correct]}" — `}{fillItem.explain}</Text>
            </View>
          )}
        </View>
      );
      case 19: {
        const pct = Math.round((31 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🤯</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 31 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "AGI: ¿Qué Pasaría si la IA Pensara Sola?". Ahora eres Future Thinker.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Distingo claramente IA estrecha (hoy) vs IA general (AGI hipotética)', 'Conozco las posiciones reales de Hinton, LeCun, Altman y Musk sobre AGI', 'Entiendo el problema de alineación y por qué importa para la seguridad', 'Puedo argumentar de forma honesta tanto a favor como en contra de AGI cercana', 'Tengo mi propia postura sobre cómo prepararme para ese futuro'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 32: Robótica e IA — El Cuerpo de la IA</B>{'\n'}Si N31 explora la mente que piensa sola, N32 explora el cuerpo que se mueve solo. Boston Dynamics, Figure, Tesla Bot: la robótica que ya existe y la que está por llegar.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 31 de 36 completado · {pct}% del camino</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: `${pct}%` }]} /></View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { width: '100%' }]} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        );
      }
      default: return null;
    }
  };

  const primary = getPrimary();
  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step < TOTAL_STEPS - 1 && <Text style={styles.progLabel}>{progLabel}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>

      {step !== TOTAL_STEPS - 1 && (
        <View style={styles.navRow}>
          {isTheory && step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryBtn, primary.accent && styles.primaryBtnAccent, { flex: 1 }, !primary.enabled && styles.primaryBtnOff]} disabled={!primary.enabled} onPress={primary.onPress}>
            <Text style={styles.primaryBtnText}>{primary.label}</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.screen },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: '#fafafa' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: P.muted },
  track: { flex: 1, height: 8, backgroundColor: P.border, borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: P.purple, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.purpleBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardPurple: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.purple, backgroundColor: P.purpleBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.purpleText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.purple, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  zoneBen: { borderStyle: 'solid', borderColor: P.greenBorder, backgroundColor: P.greenSoft },
  zoneRie: { borderStyle: 'solid', borderColor: P.redBorder, backgroundColor: P.redBg },
  dropHeader: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, alignItems: 'center' },
  dropHeaderBen: { backgroundColor: P.greenBg },
  dropHeaderRie: { backgroundColor: '#fee2e2' },
  dropHeaderText: { fontSize: 11, fontWeight: '700' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipBen: { backgroundColor: P.greenBg },
  dropChipRie: { backgroundColor: '#fee2e2' },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  matchHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  matchColLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: P.muted, textAlign: 'center' },
  matchRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minHeight: 70 },
  matchLeft: { borderColor: P.blueBorder, backgroundColor: P.blueBg },
  matchRightBox: { borderColor: P.violetBorder, backgroundColor: P.violetBg },
  matchItemSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  matchItemDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchItemWrong: { borderColor: P.red, backgroundColor: P.redBg },
  matchText: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  matchLeftText: { color: P.blueText, fontWeight: '700' },
  matchRightText: { color: P.violetText },
  matchTextDone: { color: P.greenText },

  sprintBox: { backgroundColor: P.orangeBg, borderWidth: 2, borderColor: P.orangeBorder, borderRadius: 14, padding: 14 },
  sprintTimer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: P.orangeBorder },
  sprintTime: { fontSize: 22, fontWeight: '800', color: '#c2410c' },
  sprintLabel: { flex: 1, fontSize: 11, color: P.orangeText },
  sprintItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: P.orangeBorder, borderRadius: 9 },
  sprintItemOk: { borderColor: P.green, backgroundColor: P.greenBg },
  sprintItemBad: { borderColor: P.red, backgroundColor: P.redBg },
  sprintMarker: { width: 22, height: 22, borderRadius: 6, backgroundColor: P.orangeBorder, alignItems: 'center', justifyContent: 'center' },
  sprintMarkerOk: { backgroundColor: P.green },
  sprintMarkerBad: { backgroundColor: P.red },
  sprintMarkerText: { fontSize: 11, fontWeight: '700', color: P.orangeText },
  sprintItemText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.purpleText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.purpleText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.purple, borderColor: P.purple },
  qLetterOk: { backgroundColor: P.green, borderColor: P.green },
  qLetterWrong: { backgroundColor: P.red, borderColor: P.red },
  qLetterText: { fontSize: 11, fontWeight: '700', color: P.muted },
  qoptText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  tfSet: { marginBottom: 16 },
  tfQ: { fontSize: 13, fontWeight: '700', color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10, lineHeight: 19 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  tfBtnTrue: { borderColor: P.green, backgroundColor: P.greenSoft },
  tfBtnFalse: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnCorrect: { borderColor: P.green, backgroundColor: P.greenBg },
  tfBtnWrong: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: P.body },

  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: P.amberBorder },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: P.amberText, marginBottom: 8, letterSpacing: 0.7 },
  scenarioText: { fontSize: 13, color: P.body, lineHeight: 21 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scChoiceWrong: { borderColor: P.red, backgroundColor: P.redBg },
  scTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 4 },
  scText: { fontSize: 12, color: P.body, lineHeight: 17 },

  compareCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: P.cardBg },
  compareSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  compareCardDim: { opacity: 0.7 },
  compareLabel: { fontSize: 11, fontWeight: '700', color: P.purpleText, marginBottom: 5, letterSpacing: 0.3 },
  compareText: { fontSize: 12, color: P.body, lineHeight: 19 },
  compareQ: { fontSize: 13, fontWeight: '700', color: P.ink, marginTop: 4, marginBottom: 8 },
  compareBtns: { flexDirection: 'row', gap: 10 },
  compareBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  compareBtnSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  compareBtnText: { fontSize: 13, fontWeight: '700', color: P.purpleText },

  fillSentence: { fontSize: 14, color: P.body, lineHeight: 28 },
  fillBlank: { fontWeight: '700', color: P.purpleText, textDecorationLine: 'underline' },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  fillOpt: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  fillOptSel: { borderColor: P.purple, backgroundColor: P.purpleBg },
  fillOptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  fillOptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  fillOptText: { fontSize: 13, fontWeight: '600', color: P.body },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.purple, backgroundColor: P.purpleBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exArrow: { fontSize: 18, color: P.faint },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  exHow: { fontSize: 12, color: P.body, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', fontWeight: '500', lineHeight: 17 },

  fb: { borderRadius: 10, padding: 11, marginTop: 8 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.purple, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: P.ink, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  xpEarned: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { fontSize: 16, fontWeight: '700', color: '#854d0e' },
  skillsList: { gap: 7, marginBottom: 16, width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, backgroundColor: P.greenSoft, borderRadius: 10, borderWidth: 1, borderColor: P.greenBorder },
  skillCheck: { color: P.green, fontSize: 15, fontWeight: '800' },
  skillText: { flex: 1, fontSize: 12, color: P.greenText, lineHeight: 17, fontWeight: '500' },
  nextHint: { padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, width: '100%', marginBottom: 14 },
  nextHintText: { fontSize: 12, color: P.body, lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { fontSize: 11, color: P.muted, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: P.border, borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: P.purple, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.purple },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
