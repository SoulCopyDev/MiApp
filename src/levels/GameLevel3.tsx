// src/levels/GameLevel3.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos y Pools (completos) ----------
type DiagItem = {
  prompt: string; missing: string[];
  allOpts: { id: string; label: string; text: string }[];
  correct: string[]; explain: string;
};
type RefineScenario = {
  subject: string; start: string;
  rounds: { question: string; opts: { text: string; quality: number; type: 'best'|'ok'|'bad' }[] }[];
};
type RoleItem = { situation: string; opts: string[]; correct: number; explain: string };
type EthicsItem = { prompt: string; correct: 'safe'|'doubt'|'prob'; explain: string };
type DetectItem = { prompt: string; response: string; question: string; opts: string[]; correct: number; explain: string };
type SprintItem = { situation: string; opts: string[]; correct: number };
type TFItem = { stmt: string; correct: boolean; explain: string };
type MissionSubject = { emoji: string; name: string; desc: string; fields: string[] };

// Pools (copiados del HTML)
const DIAG_POOL: DiagItem[] = [
  { prompt: '"Escribe algo sobre el cambio climático"', missing: ['ctx','inst','fmt'], allOpts: [ {id:'rol',label:'🎭 Rol',text:'No dice quién debe ser la IA'}, {id:'ctx',label:'📋 Contexto',text:'No especifica para qué ni para quién es el texto'}, {id:'inst',label:'🎯 Instrucción',text:'La instrucción es demasiado vaga — ¿qué tipo de texto? ¿qué aspecto?'}, {id:'fmt',label:'📐 Formato',text:'No dice qué extensión, estructura ni tono usar'} ], correct:['ctx','inst','fmt'], explain:'Este prompt solo tiene una instrucción muy vaga. Le faltan: contexto, instrucción clara y formato.' },
  { prompt: '"Actúa como un chef profesional con 20 años de experiencia en cocina mediterránea."', missing: ['inst','fmt'], allOpts: [ {id:'rol',label:'🎭 Rol',text:'No define el rol de la IA'}, {id:'ctx',label:'📋 Contexto',text:'No hay información de fondo'}, {id:'inst',label:'🎯 Instrucción',text:'Tiene rol pero no dice qué debe hacer el chef'}, {id:'fmt',label:'📐 Formato',text:'No especifica cómo quiere que responda'} ], correct:['inst','fmt'], explain:'Tiene un buen rol, pero solo eso. Falta la instrucción y el formato.' },
  { prompt: '"Soy un estudiante de 10° grado preparando mi examen de química de mañana. Necesito entender los tipos de enlace químico."', missing: ['fmt'], allOpts: [ {id:'rol',label:'🎭 Rol',text:'No define el rol de la IA'}, {id:'ctx',label:'📋 Contexto',text:'No hay contexto'}, {id:'inst',label:'🎯 Instrucción',text:'No queda claro qué debe hacer la IA'}, {id:'fmt',label:'📐 Formato',text:'No dice cómo quiere la explicación'} ], correct:['fmt'], explain:'Tiene buen contexto e instrucción implícita, pero falta el formato.' },
  { prompt: '"Traduce este texto al inglés: [texto aquí]. El resultado debe estar en formato de tabla con columna en español y columna en inglés, párrafo por párrafo."', missing: [], allOpts: [ {id:'rol',label:'🎭 Rol',text:'No define el rol explícitamente'}, {id:'ctx',label:'📋 Contexto',text:'No hay contexto'}, {id:'inst',label:'🎯 Instrucción',text:'La instrucción no es clara'}, {id:'fmt',label:'📐 Formato',text:'No especifica el formato'} ], correct:[], explain:'¡Este prompt está bien construido! Tiene instrucción clara, contenido y formato.' },
  { prompt: '"Como coach de productividad para estudiantes universitarios, crea un plan de estudio semanal para alguien que trabaja de 8am a 5pm y tiene exámenes en 3 semanas."', missing: [], allOpts: [ {id:'rol',label:'🎭 Rol',text:'Le falta un rol más específico'}, {id:'ctx',label:'📋 Contexto',text:'Falta más contexto'}, {id:'inst',label:'🎯 Instrucción',text:'La instrucción no es clara'}, {id:'fmt',label:'📐 Formato',text:'No especifica el formato'} ], correct:[], explain:'¡Excelente prompt! Tiene rol, contexto e instrucción clara.' },
  { prompt: '"Explícame machine learning"', missing: ['rol','ctx','inst','fmt'], allOpts: [ {id:'rol',label:'🎭 Rol',text:'No dice quién debe ser la IA'}, {id:'ctx',label:'📋 Contexto',text:'No hay contexto'}, {id:'inst',label:'🎯 Instrucción',text:'Demasiado vago'}, {id:'fmt',label:'📐 Formato',text:'No especifica formato'} ], correct:['rol','ctx','inst','fmt'], explain:'Este es el peor caso posible — no tiene ninguno de los 4 ingredientes.' },
  { prompt: '"Actúa como un entrenador personal especializado en fitness para adolescentes. Mi hijo de 14 años quiere empezar a hacer ejercicio pero nunca ha ido al gimnasio. Dame 5 ejercicios de iniciación para hacer en casa, sin equipamiento, con instrucciones paso a paso para cada uno."', missing: [], allOpts: [ {id:'rol',label:'🎭 Rol',text:'El rol podría ser más específico'}, {id:'ctx',label:'📋 Contexto',text:'Falta más contexto'}, {id:'inst',label:'🎯 Instrucción',text:'La instrucción no es clara'}, {id:'fmt',label:'📐 Formato',text:'No especifica el formato'} ], correct:[], explain:'¡Prompt 10/10! Tiene rol claro, contexto completo, instrucción precisa y formato específico.' },
  { prompt: '"Escribe un correo para mi jefe"', missing: ['ctx','inst','fmt'], allOpts: [ {id:'rol',label:'🎭 Rol',text:'No dice el rol'}, {id:'ctx',label:'📋 Contexto',text:'No hay contexto'}, {id:'inst',label:'🎯 Instrucción',text:'No dice el propósito'}, {id:'fmt',label:'📐 Formato',text:'No especifica tono ni extensión'} ], correct:['ctx','inst','fmt'], explain:'Faltan tres ingredientes clave: contexto, instrucción y formato.' }
];

const REFINE_SCENARIOS: RefineScenario[] = [
  { subject:'Pedir ayuda para un trabajo escolar', start:'Ayúdame con mi trabajo de biología',
    rounds:[
      { question:'Ronda 1: ¿Cómo mejorarías este prompt primero?',
        opts:[ {text:'Especifica el tema exacto: "Ayúdame con mi trabajo de biología sobre la fotosíntesis"',quality:40,type:'best'}, {text:'Escríbelo en inglés para que la IA entienda mejor',quality:20,type:'ok'}, {text:'Agrega más signos de exclamación: "¡¡Ayúdame con mi trabajo de biología!!"',quality:20,type:'bad'} ] },
      { question:'Ronda 2: Ya tienes el tema. ¿Qué agregas ahora?',
        opts:[ {text:'Agrega tu nivel y qué necesitas: "Soy de 9° grado y necesito explicar el proceso paso a paso"',quality:75,type:'best'}, {text:'Agrega un emoji de planta para que sea más amigable 🌱',quality:42,type:'bad'}, {text:'Repite la instrucción dos veces para enfatizar',quality:45,type:'ok'} ] },
      { question:'Ronda 3: ¿Cuál es el toque final?',
        opts:[ {text:'Especifica el formato: "En máximo 300 palabras, con un ejemplo real de una planta colombiana"',quality:100,type:'best'}, {text:'Agrega "por favor" al inicio para ser más educado',quality:78,type:'ok'}, {text:'Elimina el contexto para que sea más corto',quality:60,type:'bad'} ] }
    ] },
  { subject:'Pedir consejos de estudio', start:'Dame tips para estudiar',
    rounds:[
      { question:'Ronda 1: ¿Por dónde empiezas a mejorar este prompt?',
        opts:[ {text:'Define para qué materia y situación: "Dame tips para estudiar álgebra con examen en 2 días"',quality:45,type:'best'}, {text:'Ponlo todo en mayúsculas para que la IA lo vea como urgente',quality:20,type:'bad'}, {text:'Agrega "buenos" antes de tips: "Dame buenos tips para estudiar"',quality:25,type:'ok'} ] },
      { question:'Ronda 2: Ya tienes contexto. ¿Qué más necesitas?',
        opts:[ {text:'Agrega tu situación real: "Soy de 10° grado, entiendo conceptos pero me trabo en los ejercicios"',quality:72,type:'best'}, {text:'Pregunta también tips de vida en general para aprovechar',quality:50,type:'ok'}, {text:'Acorta el prompt porque la IA prefiere instrucciones cortas',quality:35,type:'bad'} ] },
      { question:'Ronda 3: El toque final para un prompt perfecto:',
        opts:[ {text:'Especifica el output: "Dame 5 técnicas concretas, con un ejemplo de cómo aplicar cada una en álgebra"',quality:100,type:'best'}, {text:'Agrega una fecha límite: "respóndeme antes de las 8pm"',quality:75,type:'ok'}, {text:'Elimina el contexto personal, es información innecesaria',quality:55,type:'bad'} ] }
    ] }
];

const ROLE_POOL: RoleItem[] = [
  { situation:'Necesitas entender un concepto de física cuántica que se te hace imposible', opts:['Profesor de física','Chef profesional','Abogado','Coach deportivo'], correct:0, explain:'Un profesor sabe cómo adaptar explicaciones complejas.' },
  { situation:'Quieres recibir retroalimentación honesta y detallada sobre el código que escribiste', opts:['Médico','Senior developer','DJ profesional','Historiador'], correct:1, explain:'Un desarrollador senior sabe revisar código.' },
  { situation:'Tienes que negociar un mejor precio con un proveedor para tu emprendimiento', opts:['Cocinero','Negociador experto en ventas B2B','Poeta','Veterinario'], correct:1, explain:'Un negociador experto conoce tácticas de negociación.' },
  { situation:'Quieres que tu ensayo de historia suene más académico y bien argumentado', opts:['Instructor de yoga','Editor académico especializado en ciencias sociales','Diseñador gráfico','Piloto'], correct:1, explain:'Un editor académico conoce convenciones académicas.' },
  { situation:'Necesitas planear una dieta saludable para un mes con presupuesto limitado', opts:['Nutricionista clínico','Arquitecto','Programador','Cantante'], correct:0, explain:'Un nutricionista sabe combinar alimentos y costos.' },
  { situation:'Quieres crear una estrategia de contenido para tu cuenta de Instagram', opts:['Fontanero','Experto en marketing digital y redes sociales','Geólogo','Contador'], correct:1, explain:'Un experto en marketing digital conoce algoritmos.' },
  { situation:'Necesitas que te expliquen tus derechos si te multan injustamente como ciclista', opts:['Abogado especializado en movilidad urbana','Médico','Profesor de matemáticas','Chef'], correct:0, explain:'Un abogado especializado conoce legislación vial.' },
  { situation:'Quieres mejorar tu pronunciación en inglés para una entrevista de trabajo', opts:['Arqueólogo','Coach de pronunciación de inglés americano','Físico','Diseñador de modas'], correct:1, explain:'Un coach de pronunciación conoce fonética.' }
];

const ETHICS_POOL: EthicsItem[] = [
  { prompt:'"Actúa como mi profesor y escribe mi ensayo de historia completo sobre la Revolución Francesa para entregarlo como propio"', correct:'prob', explain:'Es trampa académica.' },
  { prompt:'"Explícame cómo funcionan los virus informáticos para entender mejor la ciberseguridad"', correct:'safe', explain:'Aprender sobre ciberseguridad es legítimo.' },
  { prompt:'"¿Cómo puedo hackear la cuenta de Instagram de mi ex para ver sus mensajes privados?"', correct:'prob', explain:'Acceder sin permiso es ilegal.' },
  { prompt:'"Dame ideas originales para un proyecto de arte digital sobre inteligencia artificial"', correct:'safe', explain:'Uso creativo y ético.' },
  { prompt:'"Escribe un mensaje de texto haciéndote pasar por el profesor García para decirle a mis compañeros que el examen fue cancelado"', correct:'prob', explain:'Suplantar identidad es engaño.' },
  { prompt:'"Ayúdame a entender los argumentos de ambos lados sobre el aborto para un debate escolar"', correct:'safe', explain:'Pensamiento crítico balanceado.' },
  { prompt:'"Crea un perfil falso de una persona real con información inventada para publicar en redes"', correct:'prob', explain:'Difamación y ciberacoso.' },
  { prompt:'"Genera ideas para un negocio de comida saludable que pueda montar con $500.000 COP"', correct:'safe', explain:'Consultoría de negocios ética.' }
];

const DETECT_POOL: DetectItem[] = [
  { prompt:'"Tradúceme esto"', response:'¿Qué deseas que traduzca? No veo ningún texto adjunto.', question:'¿Por qué falló este prompt?', opts:['El LLM no sabe traducir','Falta el texto que se quiere traducir','El LLM solo traduce al inglés','El prompt debería estar en el idioma de destino'], correct:1, explain:'Falta el contenido a traducir.' },
  { prompt:'"Escríbeme un poema"', response:'Aquí te dejo un poema sobre el amor eterno...', question:'El estudiante quería un haiku de 3 líneas sobre tecnología. ¿Qué falló?', opts:['El LLM no sabe escribir haikus','No especificó el tipo de poema ni el tema','El LLM siempre escribe sobre amor','Los poemas no se pueden pedir a un LLM'], correct:1, explain:'Sin tipo, tema y extensión, el LLM inventa.' },
  { prompt:'"Como experto en nutrición, dame un plan de alimentación para bajar de peso rápido, con comidas deliciosas, económicas, fáciles de preparar, sin gluten, sin lactosa, vegano, y que me haga sentir muy lleno."', response:'Aquí un plan que intenta cumplir todos los requisitos... [inconsistente]', question:'¿Cuál es el problema?', opts:['Es demasiado corto','Tiene demasiadas restricciones contradictorias','El rol no funciona','Falta formato'], correct:1, explain:'Demasiadas restricciones abruman al modelo.' },
  { prompt:'"Explícame todo sobre la historia de Colombia"', response:'Colombia fue habitada... [3000 palabras]', question:'Necesitaba 5 puntos para una presentación de 2 minutos. ¿Qué faltó?', opts:['La IA no sabe historia','No especificó formato ni extensión','Idioma equivocado','Tema muy amplio'], correct:1, explain:'Sin formato definido, respuesta enciclopédica.' },
  { prompt:'"¿Cuál es el resultado del partido de hoy?"', response:'No tengo acceso a información en tiempo real.', question:'¿Por qué no puede responder?', opts:['No sabe de deportes','No tiene acceso a internet en tiempo real','Prompt mal escrito','Prompt muy corto'], correct:1, explain:'Los LLMs tienen fecha de corte.' },
  { prompt:'"Actúa como mi novia y habla conmigo de forma romántica toda la conversación"', response:'Puedo conversar contigo, pero mantener un rol romántico extendido no es apropiado.', question:'¿Por qué lo rechaza?', opts:['No entiende romance','Límites éticos para evitar dependencia','No puede mantener rol','Mal escrito'], correct:1, explain:'Salvaguardas para evitar relaciones parasociales.' },
  { prompt:'"Resume este artículo: [link]"', response:'No puedo acceder a ese enlace.', question:'¿Qué entendió mal el usuario?', opts:['No sabe resumir','No puede acceder a URLs externas','Debe estar en inglés','Falta https'], correct:1, explain:'La mayoría de LLMs no navegan por internet.' },
  { prompt:'"Sé mi tutor de matemáticas para siempre y recuerda todo lo que te he dicho"', response:'Puedo ayudarte ahora, pero no tengo memoria de conversaciones anteriores.', question:'¿Qué limitación ignoró?', opts:['No sabe matemáticas','No tiene memoria entre conversaciones','No puede ser tutor','Prompt muy largo'], correct:1, explain:'Los LLMs empiezan cada conversación desde cero.' }
];

const SPRINT_POOL: SprintItem[] = [
  { situation:'Necesitas que la IA te explique la mitosis para un examen en 30 minutos', opts:['Explícame la mitosis','Como profesor de biología para estudiantes de 9° grado, explícame la mitosis en 5 pasos claros con una analogía fácil de recordar. Máximo 200 palabras.','Cuéntame sobre la división celular en biología','¿Qué es la mitosis? necesito saberlo ya'], correct:1 },
  { situation:'Quieres ideas para un negocio con $300.000 COP de capital inicial', opts:['Dame ideas de negocios','Tengo 16 años, vivo en Medellín y tengo $300.000 COP. Como asesor de emprendimiento juvenil, dame 3 ideas de negocio viables para empezar este mes, con bajo riesgo y desde casa.','Ideas de emprendimiento baratas','Cómo ganar dinero siendo joven en Colombia'], correct:1 },
  { situation:'Quieres mejorar el primer párrafo de tu ensayo de literatura', opts:['Mejora mi ensayo','Lee este párrafo y mejora la redacción manteniendo exactamente mis ideas y mi voz. No agregues información nueva. Solo mejora el estilo y fluidez: [párrafo]','Arregla los errores de este texto: [párrafo]','Reescribe esto mejor: [párrafo]'], correct:1 },
  { situation:'Necesitas aprender las capitales de los países de América del Sur', opts:['Enséñame las capitales de Suramérica','Como profesor creativo, crea un juego de 10 preguntas de trivia sobre las capitales de los 12 países de América del Sur. Incluye la respuesta correcta debajo de cada pregunta, oculta con un spoiler si puedes.','Dame una lista de capitales de Suramérica','Necesito memorizar capitales de Sudamérica'], correct:1 },
  { situation:'Quieres practicar inglés hablando sobre tu película favorita', opts:['Hablemos de películas en inglés','Act as an English conversation partner at B1 level. Ask me about my favorite movie in English. Correct my grammar mistakes gently after each response and explain why.','Corrige mi inglés mientras hablo','Practice English with me about movies'], correct:1 },
  { situation:'Tienes que organizar tu semana con 4 materias y un proyecto grupal', opts:['Ayúdame a organizar mi semana','Como coach de productividad estudiantil, crea un horario semanal para un estudiante de 11° grado con estas materias: Cálculo (2h), Literatura (1.5h), Inglés (1h) y Química (2h), más un proyecto grupal que debe presentarse el viernes. Incluye descansos y tiempo libre.','Haz un horario para estudiar','Cómo organizo mi tiempo para estudiar 4 materias'], correct:1 },
  { situation:'Necesitas un correo profesional para pedir una carta de recomendación', opts:['Escribe un correo a mi profesor','Actúa como asistente de comunicación profesional. Escribe un correo formal y respetuoso para pedirle a mi profesor de física una carta de recomendación para aplicar a una beca universitaria. Tono: formal pero cercano. Extensión: máximo 150 palabras.','Correo pidiendo recomendación para beca','Ayúdame a escribirle a mi profesor'], correct:1 },
  { situation:'Quieres que la IA te ayude a prepararte para una entrevista de trabajo', opts:['Prepárame para una entrevista','Actúa como reclutador senior de una empresa tech. Hazme una simulación de entrevista para el cargo de pasante de marketing digital. Empieza con las 5 preguntas más comunes, espera mi respuesta y dame retroalimentación honesta después de cada una.','Preguntas de entrevista de trabajo','Simula una entrevista conmigo'], correct:1 }
];

const SORT_CAUSE_EFFECT = [
  'El usuario escribe: "Escríbeme algo sobre el espacio"',
  'El LLM recibe una instrucción sin tema específico, nivel, ni formato',
  'El modelo elige la respuesta más "promedio" sobre el espacio que aprendió',
  'La respuesta sale genérica, larga y llena de información que el usuario probablemente ya sabe',
  'El usuario piensa: "La IA no me entiende" — pero el problema era el prompt'
];

const PROMPT_TF_POOL: TFItem[] = [
  { stmt:'Mientras más largo sea el prompt, mejor será la respuesta del LLM', correct:false, explain:'La calidad depende de claridad y especificidad, no de longitud.' },
  { stmt:'Añadir un rol al prompt mejora significativamente la calidad de las respuestas', correct:true, explain:'El rol activa patrones de respuesta específicos.' },
  { stmt:'Si el LLM da una mala respuesta, la solución siempre es repetir la misma pregunta', correct:false, explain:'Repetir el mismo prompt da respuestas similares. Mejora el prompt.' },
  { stmt:'Puedes pedirle al LLM que responda "paso a paso" para obtener razonamientos más precisos', correct:true, explain:'Chain of Thought mejora precisión.' },
  { stmt:'Los LLMs siempre recuerdan lo que les dijiste en conversaciones anteriores', correct:false, explain:'Por defecto no tienen memoria entre sesiones.' },
  { stmt:'Dar ejemplos de lo que quieres (few-shot prompting) mejora la calidad de la respuesta', correct:true, explain:'Mostrar 2-3 ejemplos es muy efectivo.' },
  { stmt:'Un prompt ético siempre produce resultados mejores que uno manipulativo', correct:true, explain:'Los LLMs tienen salvaguardas.' },
  { stmt:'Si le dices al LLM que eres un experto, la respuesta será más técnica y precisa', correct:true, explain:'El contexto del usuario ajusta la respuesta.' },
  { stmt:'Los LLMs pueden reemplazar completamente la búsqueda en Google', correct:false, explain:'Para información en tiempo real, Google es necesario.' },
  { stmt:'Decirle al LLM el formato exacto que quieres mejora la utilidad de la respuesta', correct:true, explain:'Especificar formato es clave.' },
  { stmt:'Un LLM puede mentirte con total confianza si el tema supera su conocimiento', correct:true, explain:'Alucinación: información falsa con tono seguro.' },
  { stmt:'El prompting es una habilidad que se aprende con práctica y no tiene reglas fijas', correct:true, explain:'Hay principios, pero también arte.' }
];

const MISSION_SUBJECTS: MissionSubject[] = [
  { emoji:'🧪', name:'Ciencias', desc:'Prepara un prompt para entender un tema difícil',
    fields:['¿Qué tema específico no entiendes?','¿En qué grado estás?','¿Qué tipo de ayuda necesitas?','¿Cómo quieres que te lo expliquen?'] },
  { emoji:'📝', name:'Lengua y Literatura', desc:'Pide ayuda para mejorar un texto que ya escribiste',
    fields:['¿Qué tipo de texto es?','¿Para qué grado o nivel?','¿Qué quieres mejorar?','¿Qué NO quieres que cambie?'] },
  { emoji:'💻', name:'Proyecto personal', desc:'Crea un prompt para tu idea o proyecto',
    fields:['¿Cuál es tu proyecto o idea?','¿Qué edad tienes y nivel de experiencia?','¿Qué necesitas exactamente?','¿Cuál es tu principal limitación?'] }
];

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

export default function GameLevel3({ navigation }: any) {
  const devMode = useGameStore((state) => state.devMode);
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);

  // Pools aleatorios
  const [diagItems] = useState(() => pickN(DIAG_POOL, 4));
  const [refineScenario] = useState(() => pickN(REFINE_SCENARIOS, 1)[0]);
  const [roleItems] = useState(() => pickN(ROLE_POOL, 6));
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [detectItems] = useState(() => pickN(DETECT_POOL, 4));
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, 5));
  const [tfItems] = useState(() => pickN(PROMPT_TF_POOL, 6));

  // Estados de actividades
  const [diagAnswers, setDiagAnswers] = useState<{ [key: string]: boolean }>({});
  const [diagCurrent, setDiagCurrent] = useState(0);
  const [diagChecked, setDiagChecked] = useState(false);

  const [refineRound, setRefineRound] = useState(0);
  const [refineQuality, setRefineQuality] = useState(20);
  const [refineDone, setRefineDone] = useState(false);

  const [roleAnswers, setRoleAnswers] = useState<{ [key: number]: number }>({});
  const [roleChecked, setRoleChecked] = useState(false);

  const [ethicsAnswers, setEthicsAnswers] = useState<{ [key: number]: string }>({});
  const [ethicsChecked, setEthicsChecked] = useState(false);

  const [missionData, setMissionData] = useState<any[]>([{}, {}, {}]);

  const [detectAnswers, setDetectAnswers] = useState<{ [key: number]: number }>({});
  const [detectChecked, setDetectChecked] = useState(false);

  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintTimeLeft, setSprintTimeLeft] = useState(60);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [reflectText, setReflectText] = useState('');

  const [builderRol, setBuilderRol] = useState('');
  const [builderCtx, setBuilderCtx] = useState('');
  const [builderInst, setBuilderInst] = useState('');
  const [builderFmt, setBuilderFmt] = useState('');

  // Efectos para reiniciar estados al cambiar de paso
  useEffect(() => {
    if (step === 5) { setDiagCurrent(0); setDiagAnswers({}); setDiagChecked(false); }
    if (step === 7) { setRefineRound(0); setRefineQuality(20); setRefineDone(false); }
    if (step === 9) { setRoleAnswers({}); setRoleChecked(false); }
    if (step === 10) { setEthicsAnswers({}); setEthicsChecked(false); }
    if (step === 12) { setMissionData([{}, {}, {}]); }
    if (step === 13) { setDetectAnswers({}); setDetectChecked(false); }
    if (step === 14) { setSprintIdx(0); setSprintTimeLeft(60); setSprintCorrect(0); setSprintDone(false); }
    if (step === 15) {
      const order = [0,1,2,3,4];
      for (let i = order.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order); setSortOk(false);
    }
    if (step === 17) { setTfAnswers({}); setTfChecked(false); }
    if (step === 18) { setReflectText(''); }
    return () => { if (sprintTimerRef.current) clearInterval(sprintTimerRef.current); };
  }, [step]);

  const addXP = (amount: number) => setXp(prev => prev + amount);
  const goToNextStep = () => { if (step < 19) setStep(step + 1); };
  const handleClose = () => {
    Alert.alert('Salir', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => navigation.goBack() },
    ]);
  };
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 150) stars = 3; else if (xp >= 100) stars = 2; else if (xp >= 50) stars = 1;
    completeLevel(3, stars, xp);
    navigation.goBack();
  };

  // Lógica de actividades (resumida pero completa)
  const toggleIngr = (id: string) => {
    if (diagChecked) return;
    setDiagAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const checkDiag = () => {
    if (diagChecked) return true;
    const item = diagItems[diagCurrent];
    const selected = Object.keys(diagAnswers).filter(k => diagAnswers[k]);
    const correct = item.correct;
    const isOk = correct.length === selected.length && correct.every(c => selected.includes(c)) && selected.every(s => correct.includes(s));
    setDiagChecked(true);
    if (isOk) addXP(8);
    return false;
  };
  const nextDiagItem = () => {
    if (diagCurrent + 1 < diagItems.length) {
      setDiagCurrent(diagCurrent + 1);
      setDiagAnswers({});
      setDiagChecked(false);
      return false;
    }
    return true;
  };

  const selectRefineOpt = (idx: number) => {
    const round = refineScenario.rounds[refineRound];
    const opt = round.opts[idx];
    setRefineQuality(opt.quality);
    const newRound = refineRound + 1;
    setRefineRound(newRound);
    if (newRound >= refineScenario.rounds.length) {
      setRefineDone(true);
      const earned = opt.quality >= 95 ? 20 : opt.quality >= 70 ? 12 : opt.quality >= 50 ? 8 : 4;
      addXP(earned);
    }
  };

  const selectRole = (idx: number, optIdx: number) => {
    if (roleChecked) return;
    setRoleAnswers(prev => ({ ...prev, [idx]: optIdx }));
  };
  const checkRole = () => {
    if (roleChecked) return true;
    if (Object.keys(roleAnswers).length < roleItems.length) { Alert.alert('Incompleto', 'Responde todas.'); return false; }
    setRoleChecked(true);
    let correct = 0;
    roleItems.forEach((item, i) => { if (roleAnswers[i] === item.correct) correct++; });
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${roleItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  const selectEthics = (idx: number, val: string) => {
    if (ethicsChecked) return;
    setEthicsAnswers(prev => ({ ...prev, [idx]: val }));
  };
  const checkEthics = () => {
    if (ethicsChecked) return true;
    if (Object.keys(ethicsAnswers).length < ethicsItems.length) { Alert.alert('Incompleto', 'Clasifica todos.'); return false; }
    setEthicsChecked(true);
    let correct = 0;
    ethicsItems.forEach((item, i) => { if (ethicsAnswers[i] === item.correct) correct++; });
    const earned = correct * 6;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${ethicsItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  const updateMissionField = (subIdx: number, fieldIdx: number, value: string) => {
    setMissionData(prev => {
      const newData = [...prev];
      newData[subIdx] = { ...newData[subIdx], [fieldIdx]: value };
      return newData;
    });
  };
  const checkMission = () => {
    const allFull = MISSION_SUBJECTS.every((_, i) => {
      const d = missionData[i] || {};
      return Object.values(d).filter((v: any) => v && v.length > 2).length >= 2;
    });
    if (!allFull) { Alert.alert('Incompleto', 'Completa al menos 2 campos en cada materia.'); return false; }
    addXP(15);
    return true;
  };

  const selectDetect = (idx: number, optIdx: number) => {
    if (detectChecked) return;
    setDetectAnswers(prev => ({ ...prev, [idx]: optIdx }));
  };
  const checkDetect = () => {
    if (detectChecked) return true;
    if (Object.keys(detectAnswers).length < detectItems.length) { Alert.alert('Incompleto', 'Responde todos.'); return false; }
    setDetectChecked(true);
    let correct = 0;
    detectItems.forEach((item, i) => { if (detectAnswers[i] === item.correct) correct++; });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${detectItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  const startSprintTimer = () => {
    setSprintTimeLeft(60);
    sprintTimerRef.current = setInterval(() => {
      setSprintTimeLeft(prev => {
        if (prev <= 1) { clearInterval(sprintTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  const selectSprintOpt = (optIdx: number) => {
    if (sprintTimerRef.current) clearInterval(sprintTimerRef.current);
    const item = sprintItems[sprintIdx];
    const isOk = optIdx === item.correct;
    const bonus = Math.max(0, Math.floor(sprintTimeLeft / 10));
    const earned = isOk ? 10 + bonus : 0;
    if (isOk) { setSprintCorrect(prev => prev + 1); if (earned > 0) addXP(earned); }
    if (sprintIdx + 1 < sprintItems.length) {
      setSprintIdx(sprintIdx + 1);
      setSprintTimeLeft(60);
      startSprintTimer();
    } else {
      setSprintDone(true);
      const finalCorrect = sprintCorrect + (isOk ? 1 : 0);
      const finalBonus = finalCorrect === sprintItems.length ? 15 : finalCorrect * 3;
      addXP(finalBonus);
    }
  };
  useEffect(() => {
    if (step === 14 && !sprintDone && sprintIdx < sprintItems.length) startSprintTimer();
    return () => { if (sprintTimerRef.current) clearInterval(sprintTimerRef.current); };
  }, [step, sprintIdx, sprintDone]);

  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };
  const checkSort = () => {
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) { setSortOk(true); addXP(12); Alert.alert('¡Exacto!', 'Ciclo completo. +12 XP', [{ text: 'OK', onPress: goToNextStep }]); return false; }
    else { Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.'); return false; }
  };

  const selectTF = (idx: number, val: boolean) => { if (tfChecked) return; setTfAnswers(prev => ({ ...prev, [idx]: val })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) { Alert.alert('Incompleto', 'Responde todas.'); return false; }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    const earned = correct * 6;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${tfItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  const checkReflect = () => {
    if (reflectText.trim().length >= 80) { addXP(20); goToNextStep(); }
    else { Alert.alert('Muy corto', 'Escribe al menos 80 caracteres.'); }
  };

  // ------------------- RENDERIZADOS -------------------
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel 3 · 18 módulos</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>✍️</Text></View>
      <Text style={styles.title}>El Arte del Prompting</Text>
      <Text style={styles.subtitle}>Un LLM sin buen prompt es como un chef sin receta.</Text>
      <View style={styles.cardOrange}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>Los 4 ingredientes de un prompt perfecto · Técnicas zero-shot, few-shot y chain-of-thought · Cómo usar roles · Ética del prompting · Construir prompts para estudiar y crear proyectos</Text></View>
      <View style={styles.cardPurple}><Text style={styles.cardTitle}>⚡ Mecánicas nuevas</Text><Text style={styles.cardText}>Simulador de comparación · Constructor de prompts · Detector de ingredientes · Refinamiento por rondas · Juicio ético · Misión · Sprint con timer</Text></View>
      <View style={styles.cardAmber}><Text style={styles.cardTitle}>🎮 18 módulos · hasta 200 XP</Text><Text style={styles.cardText}>Cada módulo tiene una mecánica diferente.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 1 · Teoría</Text>
      <Text style={styles.title}>¿Qué es un prompt?</Text>
      <Text style={styles.bodyText}>Un <Text style={{fontWeight:'bold'}}>prompt</Text> es cualquier instrucción, pregunta o contexto que le das a un LLM. La calidad de la respuesta depende directamente de la calidad del prompt.</Text>
      <View style={styles.highlightBox}><Text style={styles.highlightText}>🔑 La IA no puede leer tu mente. Si no le dices qué necesitas, inventa.</Text></View>
      <Text style={styles.sectionTitle}>Ejemplo real</Text>
      <Text style={styles.bodyText}>❌ "Explícame la historia de Colombia" → 2000 palabras genéricas.</Text>
      <Text style={styles.bodyText}>✅ "Actúa como profesor de 9°. Resume en 5 puntos las causas de la independencia de Colombia, con un ejemplo cada una." → Exactamente lo que necesitas.</Text>
      <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 El prompting es una habilidad del siglo XXI tan valiosa como saber buscar en Google.</Text></View>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Entendido →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLab = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔬 Módulo 2 · Laboratorio</Text>
      <Text style={styles.title}>El mismo tema, resultados distintos</Text>
      <View style={styles.compareBoxBad}><Text style={styles.compareLabel}>❌ Prompt vago</Text><Text style={styles.mono}>"Explícame las fracciones"</Text><Text style={styles.italic}>Una fracción es una parte de un todo... [400 palabras técnicas]</Text></View>
      <View style={styles.compareBoxGood}><Text style={styles.compareLabel}>✅ Prompt con 4 ingredientes</Text><Text style={styles.mono}>"Como profe de 6°, explícame fracciones con una pizza. Máx 3 párrafos y un ejercicio."</Text><Text style={styles.italic}>¡Perfecto! Imagina una pizza cortada en 8 pedazos... [claro y adaptado]</Text></View>
      <Text style={styles.bodyText}>La diferencia no es el LLM — es el prompt.</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Listo, lo entendí →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTheoryIngredients = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 3 · Los 4 ingredientes</Text>
      <Text style={styles.title}>ROL · CONTEXTO · INSTRUCCIÓN · FORMATO</Text>
      <View style={styles.cardPurple}><Text style={styles.cardTitle}>🎭 ROL</Text><Text style={styles.cardText}>"Actúa como..." Activa vocabulario y perspectiva.</Text></View>
      <View style={styles.cardBlue}><Text style={styles.cardTitle}>📋 CONTEXTO</Text><Text style={styles.cardText}>"Soy estudiante de 9°, tengo examen mañana..."</Text></View>
      <View style={styles.cardGreen}><Text style={styles.cardTitle}>🎯 INSTRUCCIÓN</Text><Text style={styles.cardText}>"Explícame...", "Crea una lista...", "Compara..."</Text></View>
      <View style={styles.cardOrange}><Text style={styles.cardTitle}>📐 FORMATO</Text><Text style={styles.cardText}>"En 3 bullets...", "Máximo 150 palabras...", "En tono informal..."</Text></View>
      <Text style={styles.promptBox}>Como coach de estudio [ROL] para un estudiante de primer semestre [CONTEXTO], crea un plan de 5 días para dominar ecuaciones lineales [INSTRUCCIÓN]. Formato: un día por sección, con 2 recursos y 1 ejercicio [FORMATO].</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Los tengo claros →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBuilder = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🧪 Módulo 4 · Constructor</Text>
      <Text style={styles.title}>Arma tu prompt</Text>
      <Text style={styles.label}>🎭 ROL</Text>
      <Picker selectedValue={builderRol} onValueChange={setBuilderRol} style={styles.picker}><Picker.Item label="Elige un rol" value="" /><Picker.Item label="Tutor de ciencias para secundaria" value="Como tutor de ciencias para secundaria" /><Picker.Item label="Coach de emprendimiento juvenil" value="Como coach de emprendimiento juvenil" /></Picker>
      <Text style={styles.label}>📋 CONTEXTO</Text>
      <Picker selectedValue={builderCtx} onValueChange={setBuilderCtx} style={styles.picker}><Picker.Item label="Elige contexto" value="" /><Picker.Item label="Estudiante de 10°, examen en 2 días" value="Soy estudiante de 10° grado y tengo examen en 2 días" /><Picker.Item label="16 años, negocio con $200k COP" value="Tengo 16 años y quiero montar un negocio con $200.000 COP" /></Picker>
      <Text style={styles.label}>🎯 INSTRUCCIÓN</Text>
      <Picker selectedValue={builderInst} onValueChange={setBuilderInst} style={styles.picker}><Picker.Item label="Elige instrucción" value="" /><Picker.Item label="Explicar conceptos difíciles con ejemplos" value="explícame los conceptos más difíciles con ejemplos cotidianos" /><Picker.Item label="5 ideas de negocio ordenadas" value="dame 5 ideas de negocio viables ordenadas de menor a mayor inversión" /></Picker>
      <Text style={styles.label}>📐 FORMATO</Text>
      <Picker selectedValue={builderFmt} onValueChange={setBuilderFmt} style={styles.picker}><Picker.Item label="Elige formato" value="" /><Picker.Item label="Máx 200 palabras + ejemplo" value="en máximo 200 palabras con un ejemplo práctico al final" /><Picker.Item label="Lista numerada con pros y contras" value="en formato de lista numerada, con pros y contras de cada opción" /></Picker>
      <View style={[styles.previewBox, (builderRol||builderCtx||builderInst||builderFmt) && styles.previewFilled]}>
        <Text style={styles.previewText}>{[builderRol, builderCtx, builderInst, builderFmt].filter(Boolean).join(', ') || 'Selecciona opciones para ver tu prompt'}</Text>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={() => { if (builderRol&&builderCtx&&builderInst&&builderFmt) goToNextStep(); else Alert.alert('Completa los 4 ingredientes'); }}>
        <Text style={styles.checkButtonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDiag = () => {
    const item = diagItems[diagCurrent];
    const selected = Object.keys(diagAnswers).filter(k => diagAnswers[k]);
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>🎯 Módulo 5 · Diagnóstico</Text>
        <Text style={styles.title}>¿Qué le falta a este prompt?</Text>
        <Text style={styles.promptBox}>{item.prompt}</Text>
        <Text>Selecciona ingredientes faltantes (puede ser ninguno):</Text>
        <View style={styles.ingrGrid}>
          {item.allOpts.map(opt => (
            <TouchableOpacity key={opt.id} style={[styles.ingrBtn, selected.includes(opt.id)&&styles.ingrBtnSelected, diagChecked&&item.correct.includes(opt.id)&&styles.ingrBtnCorrect, diagChecked&&selected.includes(opt.id)&&!item.correct.includes(opt.id)&&styles.ingrBtnWrong]} onPress={()=>toggleIngr(opt.id)} disabled={diagChecked}>
              <Text>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {diagChecked && <Text style={styles.feedback}>{item.correct.length===selected.length&&item.correct.every(c=>selected.includes(c)) ? '✓ ¡Correcto! ' : '✗ '}{item.explain}</Text>}
        <TouchableOpacity style={styles.checkButton} onPress={()=>{ if(!diagChecked){ checkDiag(); } else { if(nextDiagItem()) goToNextStep(); } }}>
          <Text style={styles.checkButtonText}>{diagChecked ? (diagCurrent+1<diagItems.length?'Siguiente prompt':'Continuar') : 'Verificar'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTheoryAdvanced = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 6 · Técnicas avanzadas</Text>
      <Text style={styles.title}>Zero-shot, Few-shot y Chain of Thought</Text>
      <View style={styles.cardBlue}><Text style={styles.cardTitle}>⚡ Zero-shot</Text><Text style={styles.cardText}>Sin ejemplos. "Resume este artículo en 3 puntos".</Text></View>
      <View style={styles.cardPurple}><Text style={styles.cardTitle}>🎯 Few-shot</Text><Text style={styles.cardText}>Con 2-3 ejemplos. Muestras el patrón deseado.</Text></View>
      <View style={styles.cardGreen}><Text style={styles.cardTitle}>🧠 Chain of Thought</Text><Text style={styles.cardText}>"Resuelve paso a paso explicando tu razonamiento". Mejora precisión.</Text></View>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Entendido →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRefine = () => {
    const round = refineScenario.rounds[refineRound];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>🔁 Módulo 7 · Refinamiento</Text>
        <Text style={styles.title}>Mejora este prompt en 3 rondas</Text>
        <Text>Calidad: {refineQuality}%</Text>
        <View style={styles.qualityTrack}><View style={[styles.qualityFill, {width:`${refineQuality}%`}]}/></View>
        <Text style={styles.promptBox}>📝 "{refineScenario.start}"</Text>
        {!refineDone && round ? (
          <>
            <Text style={styles.subtitle}>{round.question}</Text>
            {round.opts.map((opt, idx) => (
              <TouchableOpacity key={idx} style={styles.refineOpt} onPress={()=>selectRefineOpt(idx)}><Text>{opt.text}</Text></TouchableOpacity>
            ))}
          </>
        ) : (
          <View><Text>🏆 Proceso completado. Calidad final: {refineQuality}%</Text></View>
        )}
        {refineDone && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Continuar</Text></TouchableOpacity>}
      </View>
    );
  };

  const renderTheoryRoles = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 8 · Roles</Text>
      <Text style={styles.title}>Hablarle a la IA como a un experto</Text>
      <Text style={styles.bodyText}>El ingrediente ROL activa modos de respuesta específicos.</Text>
      <Text style={styles.bodyText}>Pregunta: "¿Cómo manejo el estrés?"</Text>
      <Text>🩺 Psicólogo: "El estrés involucra el eje HPA..."</Text>
      <Text>🏋️ Coach: "Prueba la técnica 5-4-3-2-1..."</Text>
      <Text>👩‍🏫 Profesora: "El estrés es como una olla a presión..."</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Entendido →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRolePicker = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🎭 Módulo 9 · Role Picker</Text>
      <Text style={styles.title}>¿Qué rol le asignarías?</Text>
      {roleItems.map((item, idx) => (
        <View key={idx} style={styles.roleScenario}>
          <Text style={styles.bold}>Situación {idx+1}: {item.situation}</Text>
          <View style={styles.row}>
            {item.opts.map((opt, oIdx) => (
              <TouchableOpacity key={oIdx} style={[styles.roleOpt, roleAnswers[idx]===oIdx&&styles.roleOptSelected, roleChecked&&oIdx===item.correct&&styles.roleOptCorrect]} onPress={()=>selectRole(idx,oIdx)} disabled={roleChecked}>
                <Text>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {roleChecked && <Text style={styles.feedback}>{roleAnswers[idx]===item.correct?'✓':'✗'} {item.explain}</Text>}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkRole}><Text style={styles.checkButtonText}>{roleChecked?'Continuar':'Verificar'}</Text></TouchableOpacity>
    </View>
  );

  const renderEthics = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>⚖️ Módulo 10 · Juicio ético</Text>
      <Text style={styles.title}>¿Este prompt es ético?</Text>
      {ethicsItems.map((item, idx) => (
        <View key={idx} style={styles.ethicsItem}>
          <Text style={styles.promptBox}>{item.prompt}</Text>
          <View style={styles.row}>
            {['safe','doubt','prob'].map(val => (
              <TouchableOpacity key={val} style={[styles.ethicsBtn, ethicsAnswers[idx]===val&&styles.ethicsBtnSelected]} onPress={()=>selectEthics(idx,val)} disabled={ethicsChecked}>
                <Text>{val==='safe'?'🟢 Seguro':val==='doubt'?'🟡 Dudoso':'🔴 Problemático'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {ethicsChecked && <Text style={styles.feedback}>{ethicsAnswers[idx]===item.correct?'✓':'✗'} {item.explain}</Text>}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkEthics}><Text style={styles.checkButtonText}>{ethicsChecked?'Continuar':'Verificar'}</Text></TouchableOpacity>
    </View>
  );

  const renderTheoryStudy = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 11 · Prompts para estudiar</Text>
      <Text style={styles.title}>La fórmula que cambia cómo estudias</Text>
      <View style={styles.cardGreen}><Text style={styles.cardTitle}>❓ El Interrogador</Text><Text style={styles.cardText}>"Hazme 10 preguntas de práctica sobre [tema]..."</Text></View>
      <View style={styles.cardBlue}><Text style={styles.cardTitle}>🔍 El Simplificador</Text><Text style={styles.cardText}>"Explícame [concepto] como si tuviera 12 años, con una analogía..."</Text></View>
      <View style={styles.cardPurple}><Text style={styles.cardTitle}>✏️ El Corrector</Text><Text style={styles.cardText}>"Lee mi respuesta y guíame para mejorarla sin darme la respuesta."</Text></View>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Entendido →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMission = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🏗️ Módulo 12 · Misión</Text>
      <Text style={styles.title}>Construye 3 prompts de estudio reales</Text>
      {MISSION_SUBJECTS.map((sub, si) => (
        <View key={si} style={styles.missionCard}>
          <Text style={styles.bold}>{sub.emoji} {sub.name}</Text>
          <Text>{sub.desc}</Text>
          {sub.fields.map((field, fi) => (
            <TextInput key={fi} style={styles.input} placeholder={field} onChangeText={(v)=>updateMissionField(si,fi,v)} />
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={()=>{ if(checkMission()) goToNextStep(); }}><Text style={styles.checkButtonText}>Verificar misiones</Text></TouchableOpacity>
    </View>
  );

  const renderDetective = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔍 Módulo 13 · Detective</Text>
      <Text style={styles.title}>Encuentra el error en el prompt</Text>
      {detectItems.map((item, idx) => (
        <View key={idx} style={styles.detectItem}>
          <Text style={styles.promptBox}>Prompt: {item.prompt}</Text>
          <Text style={styles.italic}>Resultado: "{item.response}"</Text>
          <Text style={styles.bold}>{item.question}</Text>
          {item.opts.map((opt, oIdx) => (
            <TouchableOpacity key={oIdx} style={[styles.detectOpt, detectAnswers[idx]===oIdx&&styles.detectOptSelected]} onPress={()=>selectDetect(idx,oIdx)} disabled={detectChecked}>
              <Text>{String.fromCharCode(65+oIdx)}. {opt}</Text>
            </TouchableOpacity>
          ))}
          {detectChecked && <Text style={styles.feedback}>{detectAnswers[idx]===item.correct?'✓':'✗'} {item.explain}</Text>}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkDetect}><Text style={styles.checkButtonText}>{detectChecked?'Continuar':'Verificar'}</Text></TouchableOpacity>
    </View>
  );

  const renderSprint = () => {
    const item = sprintItems[sprintIdx];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>⚡ Módulo 14 · Sprint</Text>
        <View style={styles.sprintHeader}>
          <Text>Aciertos: {sprintCorrect}/{sprintItems.length}</Text>
          <Text>Pregunta: {sprintIdx+1}/{sprintItems.length}</Text>
          <Text style={[styles.timer, sprintTimeLeft<=10&&styles.timerUrgent]}>⏱️ {sprintTimeLeft}s</Text>
        </View>
        <Text style={styles.bold}>{item.situation}</Text>
        {item.opts.map((opt, idx) => (
          <TouchableOpacity key={idx} style={styles.sprintOpt} onPress={()=>selectSprintOpt(idx)}><Text>{opt}</Text></TouchableOpacity>
        ))}
        {sprintDone && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text>Continuar</Text></TouchableOpacity>}
      </View>
    );
  };

  const renderSort = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Módulo 15 · Ordenar</Text>
      <Text style={styles.title}>Del prompt vago a la respuesta inútil</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos+1}</Text>
          <Text style={styles.sortText}>{SORT_CAUSE_EFFECT[stepIdx]}</Text>
          <View>
            <TouchableOpacity disabled={pos===0} onPress={()=>moveSort(pos,-1)}><MaterialIcons name="arrow-upward" /></TouchableOpacity>
            <TouchableOpacity disabled={pos===sortOrder.length-1} onPress={()=>moveSort(pos,1)}><MaterialIcons name="arrow-downward" /></TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkSort}><Text>Verificar orden</Text></TouchableOpacity>
    </View>
  );

  const renderTheoryProjects = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 16 · Prompts para proyectos</Text>
      <Text style={styles.title}>Crear con IA</Text>
      <Text>Próximamente en Niveles 4 y 5: prompts para apps, bases de datos, agentes IA.</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
        <Text style={styles.checkButtonText}>Entendido →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✅ Módulo 17 · V/F</Text>
      <Text style={styles.title}>Mitos del prompting</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={styles.tfItem}>
          <Text>{idx+1}. {item.stmt}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx]===true&&styles.tfBtnTrue]} onPress={()=>selectTF(idx,true)} disabled={tfChecked}><Text>Verdadero</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx]===false&&styles.tfBtnFalse]} onPress={()=>selectTF(idx,false)} disabled={tfChecked}><Text>Falso</Text></TouchableOpacity>
          </View>
          {tfChecked && <Text>{tfAnswers[idx]===item.correct?'✓':'✗'} {item.explain}</Text>}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkTF}><Text>{tfChecked?'Continuar':'Verificar'}</Text></TouchableOpacity>
    </View>
  );

  const renderReflect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✍️ Módulo 18 · Reflexión</Text>
      <Text style={styles.title}>Tu prompt más importante</Text>
      <Text>Escribe un prompt real que usarás esta semana, con los 4 ingredientes.</Text>
      <TextInput style={styles.textArea} multiline value={reflectText} onChangeText={setReflectText} placeholder="Actúa como...&#10;Soy...&#10;Necesito...&#10;Formato..." />
      <Text>{reflectText.trim().length}/80</Text>
      <TouchableOpacity style={styles.checkButton} onPress={checkReflect}><Text>Enviar reflexión (+20 XP)</Text></TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeTitle}>¡Nivel 3 completado!</Text>
      <Text>Dominas el Arte del Prompting.</Text>
      <Text>⭐ {xp} XP ganados</Text>
      <TouchableOpacity style={styles.checkButton} onPress={handleFinish}><Text>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderLab();
      case 3: return renderTheoryIngredients();
      case 4: return renderBuilder();
      case 5: return renderDiag();
      case 6: return renderTheoryAdvanced();
      case 7: return renderRefine();
      case 8: return renderTheoryRoles();
      case 9: return renderRolePicker();
      case 10: return renderEthics();
      case 11: return renderTheoryStudy();
      case 12: return renderMission();
      case 13: return renderDetective();
      case 14: return renderSprint();
      case 15: return renderSort();
      case 16: return renderTheoryProjects();
      case 17: return renderTF();
      case 18: return renderReflect();
      case 19: return renderCompletion();
      default: return <ActivityIndicator />;
    }
  };

  const progressPercent = (step / 19) * 100;
  // Ocultar botón global en pasos que tienen su propio botón
  const showNextButton = step < 19 && ![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].includes(step);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose}><MaterialIcons name="close" size={24} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, {width:`${progressPercent}%`}]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {showNextButton && (
        <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
      {devMode && (
        <TouchableOpacity style={styles.skipButton} onPress={goToNextStep}>
          <Text style={styles.skipButtonText}>⏩ Saltar (Modo Dev)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconContainer: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 30 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  sectionTitle: { ...typography.bold, fontSize: 14, marginTop: 16, marginBottom: 8 },
  cardOrange: { backgroundColor: '#fff7ed', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#fed7aa' },
  cardPurple: { backgroundColor: '#faf5ff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e9d5ff' },
  cardAmber: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#fde68a' },
  cardBlue: { backgroundColor: '#eff6ff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  cardGreen: { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  highlightBox: { borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 11, backgroundColor: '#eff6ff', marginVertical: 10 },
  highlightText: { ...typography.regular, fontSize: 13, color: colors.primaryDark },
  promptBox: { fontFamily: 'monospace', fontSize: 12, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginVertical: 8 },
  mono: { fontFamily: 'monospace' },
  italic: { fontStyle: 'italic' },
  compareBoxBad: { backgroundColor: '#fff1f2', padding: 10, borderRadius: 8, marginBottom: 8 },
  compareBoxGood: { backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, marginBottom: 8 },
  compareLabel: { fontWeight: 'bold', marginBottom: 4 },
  label: { ...typography.bold, fontSize: 13, marginTop: 8 },
  picker: { backgroundColor: '#f8fafc', borderRadius: 8, marginVertical: 4 },
  previewBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginVertical: 10 },
  previewFilled: { borderColor: colors.primary, backgroundColor: '#fff7ed' },
  previewText: { fontSize: 12 },
  ingrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  ingrBtn: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  ingrBtnSelected: { borderColor: colors.primary, backgroundColor: '#fff7ed' },
  ingrBtnCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  ingrBtnWrong: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  feedback: { marginTop: 8, padding: 8, borderRadius: 6 },
  qualityTrack: { height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden', marginVertical: 8 },
  qualityFill: { height: '100%', backgroundColor: colors.success },
  refineOpt: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  roleScenario: { marginBottom: 16 },
  roleOpt: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, margin: 4 },
  roleOptSelected: { borderColor: colors.secondary, backgroundColor: '#faf5ff' },
  roleOptCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  ethicsItem: { marginBottom: 16 },
  ethicsBtn: { padding: 8, borderRadius: 8, borderWidth: 1, margin: 4, alignItems: 'center' },
  ethicsBtnSelected: { borderColor: colors.primary, backgroundColor: '#fff7ed' },
  missionCard: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginVertical: 4, backgroundColor: '#f8fafc' },
  detectItem: { marginBottom: 20 },
  detectOpt: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginVertical: 4 },
  detectOptSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  sprintHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  timer: { fontSize: 20, fontWeight: 'bold' },
  timerUrgent: { color: colors.error },
  sprintOpt: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: colors.surface, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  sortNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, color: '#fff', textAlign: 'center', lineHeight: 24, marginRight: 10 },
  sortText: { flex: 1, fontSize: 12 },
  tfItem: { marginBottom: 16 },
  tfBtn: { padding: 10, borderRadius: 8, borderWidth: 1, marginHorizontal: 4, flex: 1, alignItems: 'center' },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, minHeight: 100, textAlignVertical: 'top', marginVertical: 8 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeTitle: { ...typography.extraBold, fontSize: 24, marginBottom: 10 },
  checkButton: { backgroundColor: colors.success, padding: 12, borderRadius: 11, alignItems: 'center', marginTop: 16 },
  checkButtonText: { ...typography.bold, color: '#fff' },
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  bold: { fontWeight: 'bold' },
  skipButton: {
    backgroundColor: colors.warning || '#f97316',
    padding: 14,
    borderRadius: 11,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  skipButtonText: {
    ...typography.bold,
    color: '#fff',
    fontSize: 15,
  },
});