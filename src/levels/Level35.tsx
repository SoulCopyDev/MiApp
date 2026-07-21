import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 35 · IA y Tu Salud: La Medicina que Viene por Ti (Mundo 6)
// Mundo 6 · TEMA CLARO (rosa: #be185d / #831843 / #db2777).
// Reconstruido vs nivel-35.html (estándar v2.2). Fuente de verdad = HTML.
// 21 módulos de contenido (steps 1-21) — el HTML dice "19" y hasta rotula
// "Módulo 20 de 19" (§21). Máx XP real ≈ 293; el header del HTML dice 230 (§25).
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  pink: '#be185d', pinkDark: '#831843', pinkBright: '#db2777',
  pinkBg: '#fdf2f8', pinkBorder: '#fbcfe8',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412',
  violetBg: '#fdf4ff', violetBorder: '#e9d5ff', violetText: '#7e22ce',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#f9a8d4', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 23;   // 0 intro · 1-21 módulos · 22 completado
const CONTENT_STEPS = 21;
// "Volver" solo en lecturas puras: teoría (1) + tarjetas expandibles
const THEORY_STEPS = new Set([0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 18]);
const MAX_XP = 293;       // 88 reflexiones + 40 + 25 sprint + 40 + 30 ético + 48 + 22 builder

type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type EthicsItem = { text: string; correct: 'ok' | 'cuest' | 'no'; explain: string };
type SprintItem = { text: string; good: boolean };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type ExCard = { emoji: string; name: string; how: React.ReactNode; fact: string };

const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 5) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
// Diccionario del tema del nivel: salud + medicina + IA (§14)
const REFLECT_TERMS = ['salud', 'medicina', 'medico', 'doctor', 'hospital', 'clinica', 'enfermedad', 'enfermo', 'paciente', 'cancer', 'tumor', 'diabetes', 'alzheimer', 'parkinson', 'infarto', 'corazon', 'cardiaco', 'ia', 'diagnostico', 'diagnosticar', 'radiologia', 'radiologo', 'wearable', 'reloj', 'crispr', 'gen', 'genetica', 'genetico', 'adn', 'embrion', 'alphafold', 'proteina', 'vacuna', 'covid', 'pandemia', 'cirugia', 'cirujano', 'robot', 'terapia', 'terapeuta', 'psicologo', 'salud mental', 'ansiedad', 'depresion', 'chatbot', 'longevidad', 'envejecimiento', 'vida', 'curar', 'cura', 'tratamiento', 'medicamento', 'farmaco', 'acceso', 'desigual', 'desigualdad', 'seguro', 'costo', 'caro', 'publico', 'privado', 'familia', 'abuela', 'abuelo', 'madre', 'padre', 'hermano', 'etica', 'bioetica', 'consentimiento', 'privacidad'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-35.html) — distractores alargados y plausibles (§15/27) ──
const DIAGNOSIS_Q: QuizQ[] = [
  { q: 'Cuando un médico moderno usa IA para diagnóstico, lo correcto es:', opts: ['La IA asiste al médico — sugiere posibilidades, el médico decide con su contexto', 'La IA reemplaza al médico en el diagnóstico y este solo firma el informe final', 'La IA decide sola y el médico queda como observador del proceso clínico', 'El médico ignora la IA porque sus sugerencias no son fiables en la práctica'], correct: 0, explain: 'Asistencia, no reemplazo. El médico tiene contexto del paciente que la IA no tiene.' },
  { q: 'Una IA puede detectar enfermedades a partir de:', opts: ['Imágenes médicas + síntomas + historia clínica + datos de wearables — análisis multimodal', 'Solo la lista de síntomas que el paciente describe durante la consulta médica', 'Solo la edad y el sexo del paciente, cruzados con estadísticas de población', 'Solo la dieta y el estilo de vida registrados en un cuestionario inicial'], correct: 0, explain: 'IA médica multimodal: combina radiografías, análisis de sangre, historia clínica y hábitos de vida.' },
  { q: 'La IA puede detectar Parkinson antes que un médico humano por:', opts: ['Cambios sutiles en el habla y el patrón de tipeo en el celular, invisibles para un humano', 'El temblor visible de las manos, que la IA identifica con la cámara del celular', 'Un análisis de sangre específico que solo los algoritmos saben interpretar bien', 'La historia familiar del paciente, cruzada con grandes bases de datos genéticas'], correct: 0, explain: 'Apps experimentales detectan micro-cambios en tono y ritmo de voz. Detectan Parkinson 2-3 años antes que un neurólogo.' },
  { q: '¿Por qué los hospitales son cautelosos al adoptar IA en diagnóstico?', opts: ['Los errores tienen consecuencias de vida o muerte: exigen validación clínica rigurosa', 'Porque el costo de las licencias de software supera el presupuesto anual del área', 'Porque los médicos con más años se niegan a aprender herramientas nuevas', 'Porque la ley prohíbe usar software en decisiones clínicas de cualquier tipo'], correct: 0, explain: 'Validación clínica = años de pruebas. La FDA exige evidencia en miles de pacientes.' },
  { q: 'El campo médico donde la IA tiene mayor avance hoy es:', opts: ['Radiología: las imágenes médicas son el terreno natural de la visión por computador', 'Psiquiatría, porque las entrevistas clínicas se transcriben y analizan como texto', 'Cirugía cerebral, porque los robots ya operan sin supervisión humana directa', 'Nutrición, porque las dietas se calculan con fórmulas simples y datos abundantes'], correct: 0, explain: 'Visión por computador + imágenes médicas = combinación natural. Radiología, dermatología y oftalmología lideran la adopción.' },
];

const PROTEIN_Q: QuizQ[] = [
  { q: '¿Para qué sirven las proteínas en tu cuerpo?', opts: ['Son los "trabajadores" moleculares: digieren, defienden, transportan oxígeno y dan estructura', 'Solo construyen músculo cuando haces ejercicio de fuerza con suficiente intensidad', 'Solo forman uñas y cabello; el resto del cuerpo funciona con grasas y azúcares', 'Solo almacenan energía de reserva para cuando el cuerpo se queda sin glucosa'], correct: 0, explain: 'Proteínas: enzimas (digestión), anticuerpos (defensa), hemoglobina (oxígeno), colágeno (estructura).' },
  { q: '¿Por qué importa la FORMA 3D de una proteína?', opts: ['Las proteínas funcionan según su forma: si está mal plegada, sencillamente no trabaja', 'Porque la forma determina el color que tendrá el tejido donde se encuentra', 'Porque solo sirve para clasificarlas en el laboratorio, no para su función real', 'Porque la forma define cuánta energía aporta al cuerpo al ser digerida'], correct: 0, explain: 'Forma 3D = función. Las proteínas mal plegadas causan Alzheimer, Parkinson y otras enfermedades.' },
  { q: 'Antes de AlphaFold, predecir la estructura de UNA proteína tomaba:', opts: ['Años de trabajo experimental, a veces décadas de cristalografía y resonancia', 'Unos diez minutos con un programa de computador de escritorio común', 'Un día de cálculo, siempre que se conociera la secuencia de aminoácidos', 'Una hora en el microscopio electrónico de cualquier laboratorio universitario'], correct: 0, explain: 'Cristalografía de rayos X y resonancia magnética: caro, lento y no siempre exitoso. AlphaFold lo hace en horas.' },
  { q: '¿Qué hace AlphaFold con las proteínas?', opts: ['Predice su estructura 3D desde la secuencia de aminoácidos, con precisión experimental', 'Las colorea en 3D para que los biólogos las distingan mejor en el microscopio', 'Inventa proteínas nuevas que no existen en ningún organismo vivo conocido', 'Mide la cantidad de proteína presente en una muestra de sangre del paciente'], correct: 0, explain: 'Input: secuencia de letras (aminoácidos). Output: forma 3D. Tan preciso como los métodos experimentales.' },
  { q: 'AlphaFold ha resuelto la estructura de:', opts: ['200 millones de proteínas — esencialmente todas las conocidas en organismos vivos', 'Unas diez proteínas humanas, las más estudiadas por la industria farmacéutica', 'Solo las proteínas del cuerpo humano, dejando fuera plantas, bacterias y virus', 'Ninguna todavía: sigue siendo un proyecto experimental sin resultados publicados'], correct: 0, explain: '200M de proteínas catalogadas y publicadas en abierto en el EBI. Revolucionó la biomedicina globalmente.' },
  { q: 'Una aplicación directa de AlphaFold para tu salud:', opts: ['Diseño rápido de medicamentos personalizados para una enfermedad concreta', 'Cálculo de la dieta ideal según el tipo de proteína que consumes a diario', 'Mejora de cosméticos con colágeno para el cuidado diario de la piel', 'Ninguna directa: por ahora solo sirve para investigación académica básica'], correct: 0, explain: 'AlphaFold permite diseñar moléculas que encajan exactamente con la proteína defectuosa de una enfermedad.' },
];

const HEALTH_Q: QuizQ[] = [
  { q: 'AlphaFold ganó el Nobel de Química 2024 por:', opts: ['Predecir la estructura 3D de las proteínas: aceleró la biomedicina 50 años en 4', 'Inventar una nueva familia de antibióticos contra bacterias multirresistentes', 'Desarrollar una cura efectiva para varios tipos de cáncer en fase avanzada', 'Diseñar genes sintéticos capaces de reemplazar tejidos humanos dañados'], correct: 0, explain: 'Hassabis y Jumper, de DeepMind. Un Nobel a un sistema de IA: marca un antes y un después.' },
  { q: '¿Cuál vacuna fue desarrollada con ayuda significativa de IA?', opts: ['Las vacunas COVID de mRNA (Pfizer, Moderna): 11 meses frente a 10-15 años tradicionales', 'La vacuna de la polio, reformulada con algoritmos en la década de los noventa', 'Ninguna todavía: la IA aún no participa en el diseño real de vacunas humanas', 'Solo vacunas veterinarias, porque la regulación humana no permite usar IA'], correct: 0, explain: 'La COVID validó la IA en biomedicina como nada antes. La velocidad fue posible porque la IA optimizó cada etapa.' },
  { q: 'El Apple Watch detecta:', opts: ['Fibrilación auricular (ECG), caídas y ritmo cardíaco anormal, aprobado por la FDA', 'Solo los pasos y las calorías, como cualquier podómetro deportivo básico', 'El nivel de glucosa en sangre sin necesidad de pinchar el dedo del usuario', 'La presión arterial exacta, con precisión de tensiómetro clínico certificado'], correct: 0, explain: 'Series 4 en adelante tiene ECG aprobado por la FDA. Hay casos documentados de infartos detectados antes de los síntomas.' },
  { q: 'El primer medicamento aprobado por la FDA basado en CRISPR cura:', opts: ['La anemia falciforme: Casgevy, aprobado en 2023, con un costo de $2.2M USD', 'La diabetes tipo 1, devolviendo al páncreas su capacidad de producir insulina', 'Varios tipos de cáncer de sangre en pacientes que no responden a la quimio', 'La calvicie hereditaria, reactivando los folículos capilares ya inactivos'], correct: 0, explain: 'Casgevy: hito histórico de la medicina genética. Es una cura definitiva, no un tratamiento crónico.' },
  { q: 'El reto principal de los chatbots terapéuticos como Woebot es:', opts: ['Distinguir cuándo derivar a un profesional humano: en casos graves no lo reemplazan', 'Traducir bien las conversaciones a los idiomas de cada país donde se usan', 'Reducir el precio de la suscripción para que más personas puedan pagarla', 'Conseguir que la conversación suene natural y no repetitiva para el usuario'], correct: 0, explain: 'Buen diseño = un chatbot que reconoce sus límites y deriva. Mal diseño = un chatbot que crea dependencia.' },
  { q: 'El gran dilema de la medicina del futuro es:', opts: ['El acceso desigual: tratamientos millonarios para pocos vs sistemas públicos colapsados', 'La falta de médicos dispuestos a trabajar con herramientas modernas de IA', 'El idioma de los sistemas, casi todos desarrollados originalmente en inglés', 'La velocidad de internet que los hospitales necesitan para usar estas apps'], correct: 0, explain: 'La medicina avanza más rápido que los sistemas de salud pública. Sin políticas valientes, será solo para élites.' },
];

const BIOETHICS_POOL: EthicsItem[] = [
  { text: 'Usar IA para detectar cáncer mejor en países con escasos radiólogos', correct: 'ok', explain: 'Aceptable: democratiza el diagnóstico de calidad. Beneficio claro, sin reemplazar al médico humano.' },
  { text: 'CRISPR para curar a un niño de anemia falciforme con su autorización', correct: 'ok', explain: 'Aceptable: cura una enfermedad grave existente, con consentimiento informado.' },
  { text: 'Editar embriones para hacerlos más inteligentes o atléticos', correct: 'no', explain: 'Inaceptable: es eugenesia genética. Línea ética cruzada — convierte a los humanos en productos diseñados.' },
  { text: 'Chatbot terapéutico para zona rural sin psicólogos disponibles, con derivación clara', correct: 'ok', explain: 'Aceptable: llena un vacío real y deriva cuando el caso es serio. Mejor que no tener nada.' },
  { text: 'Sistema que niega seguro médico basado en datos genéticos predictivos', correct: 'no', explain: 'Inaceptable: discriminación genética. Por eso muchos países lo prohíben expresamente por ley.' },
  { text: 'IA que analiza tus datos médicos para personalizar dosis de medicamentos', correct: 'ok', explain: 'Aceptable: medicina de precisión. Mejora resultados sin riesgos éticos significativos.' },
  { text: 'App que diagnostica enfermedades sin involucrar nunca a un médico humano', correct: 'cuest', explain: 'Cuestionable: depende de la enfermedad. Para un resfriado común puede bastar; para un cáncer, no.' },
  { text: 'Empresa que vende tus datos genéticos a aseguradoras sin consentimiento', correct: 'no', explain: 'Inaceptable: violación masiva de privacidad. 23andMe ha enfrentado demandas reales por esto.' },
  { text: 'IA que sugiere tratamientos pero el médico humano decide y es responsable', correct: 'ok', explain: 'Aceptable: es el modelo correcto. La IA como herramienta del médico, no como reemplazo.' },
  { text: 'Sistema que decide automáticamente quién recibe trasplante de órgano', correct: 'no', explain: 'Inaceptable: decisiones de vida o muerte sobre órganos requieren juicio humano contextual.' },
];

const HOSPITAL_SPRINT_ITEMS: SprintItem[] = [
  { text: 'IA detecta tu enfermedad antes de que tengas síntomas (predictiva)', good: true },
  { text: 'Solo un médico humano sin IA, como en 1985', good: false },
  { text: 'Robots cirujanos asisten en operaciones complejas', good: true },
  { text: 'IA da diagnóstico y receta sin que NUNCA hable contigo un humano', good: false },
  { text: 'Tu reloj inteligente comparte datos con tu doctor en tiempo real', good: true },
  { text: 'Salas de espera de 6 horas como hoy', good: false },
  { text: 'Recepcionista digital que entiende síntomas y te dirige al especialista correcto', good: true },
  { text: 'Solo la IA decide el tratamiento sin oír al paciente', good: false },
  { text: 'Medicamentos diseñados específicamente para TU genética', good: true },
  { text: 'Hospital sin pacientes: todo se hace en casa con telemedicina + wearables', good: true },
];
const SPRINT_GOAL = 5;
const SPRINT_SECONDS = 90;

const BUILDER_HEALTH: BuilderConfig = { xp: 22, rows: [
  { key: 'wearable', label: 'Wearable que vas a usar', opts: ['Apple Watch (ECG + caídas + actividad — el más completo)', 'Garmin/Oura (foco en sueño + recuperación + ejercicio)', 'Whoop (atletas — cargas de entrenamiento + recuperación)', 'Fitbit (más asequible, función básica completa)', 'Sin wearable por ahora — solo apps gratuitas en el celular'] },
  { key: 'monitoreo', label: 'Datos que vas a monitorear', opts: ['Sueño profundo + ritmo cardíaco en reposo (recuperación)', 'Pasos + actividad diaria (combatir el sedentarismo)', 'Variabilidad cardíaca (estrés crónico)', 'Calidad del aire local + ejercicio al aire libre', 'Glucosa con monitor continuo (si eres diabético o prediabético)'] },
  { key: 'salud_mental', label: 'Estrategia de salud MENTAL', opts: ['Meditación con app (Headspace, Calm) 10 min al día', 'Diario digital con IA que detecta patrones de estrés', 'Chatbot terapéutico estructurado (no estilo Replika)', 'Terapia humana profesional + IA como complemento', 'Sin tecnología — solo conversaciones humanas reales'] },
  { key: 'alimentacion', label: 'Sistema de ALIMENTACIÓN', opts: ['App que escanea el código de barras y analiza la nutrición', 'Diario de comidas con IA que sugiere ajustes', 'Plan personalizado según tus datos genéticos', 'Sin app — comida real y leer etiquetas de forma tradicional', 'Combinación de tecnología + cocina casera consciente'] },
] };

const tagVariants = {
  intro: { box: { backgroundColor: P.pinkBg }, text: { color: P.pinkDark } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: '#991b1b' } },
  case: { box: { backgroundColor: P.violetBg }, text: { color: P.violetText } },
  build: { box: { backgroundColor: P.pinkBg }, text: { color: P.pinkDark } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const EXAMPLES: { [k: number]: { icon: string; label: string; title: string; sub: string; cards: ExCard[] } } = {
  3: {
    icon: '📱', label: 'Módulo 3 de 21 · Presente', title: 'La IA YA está en tu salud (aunque no lo sabías)', sub: '3 casos reales que ya operan en 2025-2026 alrededor tuyo. Toca cada tarjeta 👆',
    cards: [
      { emoji: '📱', name: 'Tu teléfono YA tiene IA médica', how: <>Apple Watch detecta <B>fibrilación auricular en tiempo real</B> desde 2018, y ha salvado vidas documentadas. Samsung Galaxy Watch monitorea la presión arterial. Garmin y Whoop predicen sobreentrenamiento y enfermedad antes de que aparezcan los síntomas.</>, fact: '⭐ Caso real: el Apple Watch ha detectado infartos antes de que el portador lo supiera. Hay decenas de casos documentados. La IA ya está en tu muñeca, hoy.' },
      { emoji: '🏥', name: 'El radiólogo que ya no trabaja solo', how: <>En hospitales serios del mundo (incluidos Colombia, México y Brasil), <B>los radiólogos ya trabajan CON IA</B>. La IA detecta cáncer en mamografías, tumores en TAC y fracturas en rayos X: encuentra lo que el ojo humano se pierde.</>, fact: '⭐ Estudios 2023-2024: la IA detecta cáncer de mama un 9% más temprano que el radiólogo solo. Pero no lo reemplaza — lo asiste. El binomio médico + IA gana.' },
      { emoji: '💊', name: 'Tu farmacia ya usa IA', how: <>Cuando consultas interacciones de medicamentos, la base de datos detrás usa IA. <B>Cuando un médico te receta, sistemas como Epic verifican con IA</B> si hay interacciones peligrosas. Tu seguro médico también usa IA para decidir aprobaciones.</>, fact: '⭐ La IA en salud no es futuro — es presente. Solo que silencioso: cada vez que pasa una receta, hay capas de IA verificando.' },
    ],
  },
  5: {
    icon: '🎗️', label: 'Módulo 5 de 21 · Cáncer', title: 'IA detecta cáncer mejor que radiólogos', sub: 'Casos reales de oncología, incluyendo Colombia y LATAM. Toca cada tarjeta 👆',
    cards: [
      { emoji: '👀', name: 'IA detecta cáncer mejor que radiólogos', how: <>Estudios publicados en Nature en 2024: <B>modelos de IA detectan cáncer de mama, pulmón y piel con 5-10% más precisión</B> que radiólogos especialistas. Reducen los falsos negativos, es decir, los cánceres no detectados a tiempo.</>, fact: '⭐ Caso real Colombia: la Fundación Santa Fe (Bogotá) y la Clínica del Country implementaron IA para mamografías desde 2022. Reportan detección 15-20% más temprana de microcalcificaciones malignas.' },
      { emoji: '🇨🇴', name: 'IA en oncología latinoamericana', how: <>El <B>Instituto Nacional de Cancerología (INC)</B> de Colombia usa IA para análisis patológico desde 2023. El INCMNSZ en México lleva más años. La inversión es enorme, pero el retorno en vidas salvadas también.</>, fact: '⭐ Reto LATAM: los hospitales privados premium tienen IA; los públicos de muchas regiones aún no. La medicina del futuro corre el riesgo de ser solo para ricos.' },
      { emoji: '🤖', name: 'Watson Health · La gran promesa que falló', how: <>IBM Watson Health prometió revolucionar la oncología e invirtió $4.000M USD entre 2014 y 2022. <B>Falló por exceso de promesas y datos pobres</B>. IBM vendió la división en 2022.</>, fact: '⭐ La caída de Watson le recordó a la industria que el hype no sustituye a la evidencia. Lo que sí funciona hoy se construyó con humildad técnica + datos masivos limpios.' },
    ],
  },
  6: {
    icon: '⌚', label: 'Módulo 6 de 21 · Wearables', title: 'Tu reloj podría salvar tu vida', sub: 'Apple Watch, Whoop, Oura, Dexcom: salud predictiva HOY. Toca cada tarjeta 👆',
    cards: [
      { emoji: '⌚', name: 'Apple Watch · El reloj que detecta infartos', how: <>El Apple Watch tiene electrocardiograma desde la Series 4 (2018) y <B>detecta fibrilación auricular</B> automáticamente. Ha alertado a usuarios de problemas cardíacos antes de cualquier síntoma. Está aprobado por la FDA como dispositivo médico.</>, fact: '⭐ Caso documentado: un hombre de 47 años en Chicago salvó su vida porque el Apple Watch detectó una arritmia que él no sentía. Llegó a urgencias antes del infarto.' },
      { emoji: '💪', name: 'Whoop y Oura · Salud predictiva', how: <>Whoop, Oura Ring y Garmin usan IA para <B>predecir cuándo te vas a enfermar</B>. Detectan cambios sutiles en variabilidad cardíaca, temperatura y sueño antes de que sientas nada. Algunos detectaron COVID 2-3 días antes de los síntomas.</>, fact: '⭐ Estudio de Stanford (2020-2023): los wearables predijeron COVID en el 70% de los casos antes de los síntomas. La medicina preventiva apenas empieza.' },
      { emoji: '🩸', name: 'Glucómetros continuos con IA', how: <>Para personas diabéticas: <B>Dexcom y Libre se conectan al teléfono con IA que predice hipoglucemias e hiperglucemias</B>. Salvan vidas reales — los jóvenes diabéticos ya no viven con el miedo al coma hipoglucémico de antes.</>, fact: '⭐ Caso real LATAM: en Argentina, México y Brasil ya hay subsidios públicos para algunos pacientes diabéticos. Su calidad de vida cambió por completo.' },
    ],
  },
  8: {
    icon: '💬', label: 'Módulo 8 de 21 · Salud mental', title: 'IA y salud mental · ¿Terapeuta de bolsillo?', sub: 'Woebot (aprobado por la FDA), Wysa, Replika. La complejidad real. Toca cada tarjeta 👆',
    cards: [
      { emoji: '💬', name: 'Woebot · Chatbot terapéutico aprobado por FDA', how: <><B>Woebot</B> fue creado por psicólogas de Stanford e implementa terapia cognitivo-conductual estructurada. La FDA lo aprobó como dispositivo médico. Si detecta una crisis, deriva de inmediato a líneas de ayuda profesional.</>, fact: '⭐ Estudio: los usuarios reportan una reducción de síntomas de depresión y ansiedad similar a la terapia humana de baja intensidad. Pero NO reemplaza al terapeuta en casos complejos.' },
      { emoji: '📱', name: 'Wysa, Replika · La complejidad', how: <><B>Wysa</B> tiene más de 5M de usuarios. <B>Replika</B> generó controversia: hubo usuarios que desarrollaron "relaciones románticas" con su IA, con casos preocupantes entre 2022 y 2024. El diseño determina el efecto: estructurado y profesional vs reemplazo emocional.</>, fact: '⭐ Lección clave: los chatbots de salud mental requieren diseño cuidadoso. No basta con "sonar empático" — necesitan límites, derivación y no promover dependencia.' },
      { emoji: '🇨🇴', name: 'Salud mental LATAM y la IA', how: <>LATAM vive una crisis de salud mental: hay zonas rurales con <B>un psicólogo por cada 50.000 habitantes</B>. Las apps con IA llegan donde no hay terapeutas, con casos en Colombia, México y Brasil impulsados por startups locales.</>, fact: '⭐ Reto ético: ¿es mejor un chatbot que NADA? Probablemente sí, con derivación clara cuando el caso es serio. ¿Es lo ideal? No. Llena un vacío donde no hay alternativa.' },
    ],
  },
  10: {
    icon: '🏆', label: 'Módulo 10 de 21 · AlphaFold', title: 'AlphaFold · El descubrimiento más importante del siglo', sub: 'Nobel 2024. 200M de proteínas resueltas. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🏆', name: 'AlphaFold · Premio Nobel 2024', how: <>Demis Hassabis y John Jumper, de DeepMind, ganaron el Nobel de Química 2024 por <B>AlphaFold: la IA que predice la estructura 3D de las proteínas</B>. Antes: más de 50 años de trabajo experimental para resolver una sola. Después: 200M de proteínas en días.</>, fact: '⭐ Por qué importa: sin conocer la forma de las proteínas no se diseñan medicamentos. AlphaFold aceleró 50 años de biomedicina en 4 años. Por eso el Nobel.' },
      { emoji: '💊', name: 'Diseño de medicamentos · De 12 años a 18 meses', how: <>Vía tradicional: descubrir un medicamento cuesta <B>10-15 años, $2.500M USD y un 90% de fracasos</B>. Con IA + AlphaFold, empresas como Insilico Medicine llevan medicamentos a fase clínica en 18-24 meses.</>, fact: '⭐ Caso real: el primer medicamento descubierto enteramente por IA está en fase clínica III desde 2024 (fibrosis pulmonar). Si funciona, será un hito de la medicina moderna.' },
      { emoji: '🧬', name: 'Aplicaciones reales hoy', how: <>AlphaFold ya se ha usado para <B>diseñar antibióticos contra bacterias resistentes</B>, buscar tratamientos de enfermedades raras y entender el Alzheimer y el Parkinson a nivel molecular. Es open source: cualquier laboratorio puede usarlo gratis.</>, fact: '⭐ Democratización masiva de la biotecnología. Antes solo las grandes farmacéuticas podían hacer este trabajo; ahora un estudiante de doctorado puede empezar.' },
    ],
  },
  12: {
    icon: '💉', label: 'Módulo 12 de 21 · COVID', title: 'La IA que aceleró las vacunas del COVID', sub: 'De 12 años a 18 meses. Cómo cambió la respuesta global a pandemias. Toca cada tarjeta 👆',
    cards: [
      { emoji: '💉', name: 'De 12 años a 18 meses', how: <>Antes de la COVID, una vacuna nueva tomaba <B>10-15 años en desarrollarse</B>. Para la COVID, la primera vacuna de mRNA estuvo lista en 11 meses. La IA fue clave en cada paso: secuenciar el virus, diseñar la proteína spike y optimizar la formulación.</>, fact: '⭐ Caso emblemático: Moderna usó IA para diseñar candidatos en un fin de semana, algo que normalmente toma 6-9 meses. La pandemia validó la IA en biomedicina como nada antes.' },
      { emoji: '🌍', name: 'Distribución global con IA', how: <>Distribuir vacunas a <B>7.000 millones de personas</B> sin romper la cadena de frío fue un problema logístico masivo. La IA optimizó rutas, predijo la demanda local y evitó desperdicio.</>, fact: '⭐ Lección: la IA no solo descubre vacunas, también las hace LLEGAR. La distribución es la mitad del problema en salud pública.' },
      { emoji: '🦠', name: 'Próxima pandemia · ¿Estamos preparados?', how: <>Programas como <B>SCAN (Seattle Coronavirus Assessment Network) y Global.Health</B> usan IA para detectar virus emergentes en tiempo real. Si llega la siguiente pandemia, la respuesta puede ser 10 veces más rápida.</>, fact: '⭐ Realidad incómoda: habrá una próxima pandemia. La pregunta es si responderemos en semanas (con IA) o en meses (sin ella). La inversión vale la pena.' },
    ],
  },
  13: {
    icon: '✂️', label: 'Módulo 13 de 21 · CRISPR', title: 'CRISPR · Cortar y pegar el ADN enfermo', sub: 'Casgevy ($2.2M USD). Curas reales para enfermedades antes incurables. Toca cada tarjeta 👆',
    cards: [
      { emoji: '✂️', name: 'CRISPR · Cortar y pegar el ADN', how: <>CRISPR es como <B>un editor de texto para tu ADN</B>: permite corregir genes específicos que causan enfermedades. Ganó el Nobel en 2020. La IA lo acelera enormemente porque encuentra con precisión dónde cortar.</>, fact: '⭐ Casos reales 2023-2024: la primera medicina aprobada por la FDA basada en CRISPR es Casgevy, para anemia falciforme ($2.2M USD por paciente). Es una cura definitiva, no un tratamiento crónico.' },
      { emoji: '💪', name: 'Enfermedades genéticas curables HOY', how: <>Anemia falciforme: <B>cura en el 90% de los pacientes</B> con CRISPR. Beta-talasemia: tratamiento único. Distrofia muscular: ensayos clínicos avanzados. Todas eran consideradas incurables hace diez años.</>, fact: '⭐ Niños latinoamericanos con anemia falciforme viajan a EE.UU. para acceder al tratamiento. Costo: $2.2M USD. Acceso desigual real, no abstracto.' },
      { emoji: '🔬', name: 'IA + CRISPR · La combinación', how: <>La IA mejora CRISPR de varias formas: <B>predice efectos no deseados</B> antes de editar, <B>optimiza la eficiencia de la edición</B> y <B>diseña secuencias guía precisas</B>. Sin IA, CRISPR sería bastante más peligroso.</>, fact: '⭐ Empresas como Verve Therapeutics combinan ambas para diseñar terapias genéticas precisas. En los próximos 10 años, entre 50 y 100 enfermedades "incurables" tendrán tratamiento real.' },
    ],
  },
  15: {
    icon: '🔬', label: 'Módulo 15 de 21 · Cirugía', title: 'Robots cirujanos · Da Vinci y lo que viene', sub: '14M de cirugías reales. Casos en Colombia. La cirugía autónoma. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🔬', name: 'Da Vinci · 14M de cirugías reales', how: <>El sistema Da Vinci, de <B>Intuitive Surgical</B>, ha realizado 14 millones de cirugías en el mundo. Son <B>brazos robóticos controlados por el cirujano</B> con precisión submilimétrica, sin temblor y con visión 3D en alta definición.</>, fact: '⭐ Caso real Colombia: la Fundación Santa Fe (Bogotá), Imbanaco (Cali) y Soma (Medellín) tienen Da Vinci. Pacientes oncológicos colombianos ya se benefician hoy.' },
      { emoji: '🧠', name: 'Próximos pasos · Cirugía autónoma', how: <><B>STAR (Smart Tissue Autonomous Robot)</B> demostró suturas más uniformes que las humanas. <B>VICAR</B> realiza cirugías oculares autónomas. Ya no es solo "humano + robot", sino un robot que decide partes del procedimiento.</>, fact: '⭐ Bioética compleja: ¿quién es responsable si una IA quirúrgica causa daño? Las regulaciones de la FDA y equivalentes se reescriben constantemente.' },
      { emoji: '🌍', name: 'Acceso desigual · El gran problema', how: <>Un Da Vinci cuesta <B>$2M USD por sistema más $200.000 anuales de mantenimiento</B>. Solo lo tienen los hospitales premium. El resultado es cirugía de precisión para una élite y cirugía estándar para la mayoría.</>, fact: '⭐ Pregunta política: ¿debería el sistema público financiar Da Vinci? Algunos países sí (España, Reino Unido) y otros no. Es una decisión que afecta la sobrevida de pacientes oncológicos.' },
    ],
  },
  18: {
    icon: '⏰', label: 'Módulo 18 de 21 · Longevidad', title: '¿Podrá la IA frenar el envejecimiento?', sub: 'Calico (Google), drogas anti-envejecimiento, el reto científico real. Toca cada tarjeta 👆',
    cards: [
      { emoji: '⏰', name: 'Calico (Google) · La empresa de la longevidad', how: <>Google fundó Calico (California Life Company) en 2013 para <B>estudiar el envejecimiento como una enfermedad</B>. Ha invertido más de $2.000M USD con la misión de extender significativamente la vida saludable.</>, fact: '⭐ Estado real 2024-2025: Calico ha publicado avances en biología del envejecimiento, pero NO ha lanzado tratamientos comerciales. La longevidad resultó más compleja de lo que sugería el optimismo inicial.' },
      { emoji: '💊', name: 'Drogas anti-envejecimiento existentes', how: <>Hay medicamentos que <B>parecen retrasar marcadores del envejecimiento</B>: rapamicina (inmunosupresor), metformina (diabetes) y suplementos de NAD+. Los resultados son modestos en humanos y prometedores en animales.</>, fact: '⭐ Realidad incómoda: mucho hype y evidencia humana limitada. La longevidad real vendrá probablemente de combinar IA + medicina genética + hábitos de vida, no de una píldora mágica.' },
      { emoji: '🧬', name: 'El reto científico real', how: <>Envejecer no es UNA sola cosa: son <B>más de 10 procesos biológicos simultáneos</B> (acortamiento de telómeros, inflamación crónica, células senescentes y otros). Resolver uno solo no extiende la vida de forma significativa.</>, fact: '⭐ Predicción honesta 2026-2050: probablemente extenderemos la vida saludable entre 10 y 15 años, pero NO habrá inmortalidad. "Morir es opcional" sigue siendo ciencia ficción para tu generación.' },
    ],
  },
};

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Tu historia personal · +14 XP', icon: '🤔', min: 80, xp: 14, placeholder: 'En mi familia... Sentí... Pienso que estadísticamente...', question: <><B>Pregunta directa antes de empezar:</B> ¿alguien en tu familia ha tenido cáncer, Alzheimer, diabetes o alguna enfermedad grave? Si sí, ¿cómo te sentiste cuando lo supiste? Si no, ¿qué SIENTES al pensar que estadísticamente a alguien cercano le tocará vivirlo? Sé honesto antes de procesar los datos del nivel.</> },
  4: { tag: 'Reflexión familiar · +16 XP', icon: '💝', min: 120, xp: 16, placeholder: 'Lo que siento es... porque... La esperanza/desconfianza viene de...', question: <><B>Pregunta directa y personal:</B> ¿alguien en tu familia ha tenido cáncer, diabetes o Alzheimer? ¿O conoces a alguien cercano que sí?{'\n\n'}Si SÍ, te toca vivir un momento en que la IA ya está trabajando sobre esa enfermedad. Si NO, vivirás 60-80 años más en los que estadísticamente sí pasará en tu círculo cercano.{'\n\n'}<B>¿Qué SIENTES al pensar que la IA podría estar ayudando a curar (o ya lo hizo) a alguien que quieres? ¿Esperanza? ¿Desconfianza? ¿Ambas? Sé honesto antes de seguir.</B></> },
  14: { tag: 'Ética genética · +18 XP', icon: '⚖️', min: 140, xp: 18, placeholder: 'Mi línea sería... Quien decide debe ser... Si fuera mi hijo...', question: <>CRISPR puede curar enfermedades genéticas, y eso pocos lo discuten. Pero también puede <B>"mejorar" personas: niños más inteligentes, más altos, con ojos azules</B>. Caso real: en 2018 un científico chino editó embriones humanos creando bebés con resistencia al VIH, y fue condenado a prisión.{'\n\n'}<B>Reflexiona honestamente: ¿dónde está la línea? ¿Curar enfermedades sí, mejorar rasgos no? ¿Quién debe decidir esa línea: los científicos, los gobiernos, cada familia? Si tu hijo pudiera nacer libre de un cáncer hereditario por edición genética, ¿lo harías?</B></> },
  17: { tag: 'Acceso y desigualdad · +18 XP', icon: '🌍', min: 140, xp: 18, placeholder: 'Es injusto/inevitable porque... Mi propuesta para LATAM sería...', question: <>La medicina del futuro es <B>brutalmente cara</B>: CRISPR cuesta $2.2M USD por paciente, un Da Vinci $2M USD, los tratamientos personalizados entre $50.000 y $500.000 USD. Quien tendrá acceso primero será quien pueda pagar: países ricos, ciudadanos con seguros premium, élites económicas.{'\n\n'}<B>Reflexiona honestamente: ¿es esto inevitable o injusto? ¿Cómo aseguramos que la medicina del futuro NO sea solo para ricos? ¿Cuál sería tu propuesta para LATAM si tuvieras poder de decisión política o tecnológica?</B></> },
  21: { tag: 'Tu reflexión final · +22 XP', icon: '✍️', min: 150, xp: 22, placeholder: 'Quisiera que cure primero... porque... Lo que siento sabiendo que ya está pasando es...', question: <>Después de explorar la IA en cáncer, wearables, AlphaFold, CRISPR, salud mental y longevidad: <B>¿qué enfermedad que afecta a alguien que quieres te gustaría que la IA cure primero?</B> ¿Por qué esa? ¿Qué SIENTES sabiendo que la medicina que podría curarla se está desarrollando ahora mismo? ¿Y qué papel quieres jugar TÚ: como paciente, como futuro profesional de la salud, como ciudadano que vota políticas?</> },
};

const ETHICS_COLS: { key: 'ok' | 'cuest' | 'no'; label: string }[] = [
  { key: 'ok', label: '✅ Aceptable' },
  { key: 'cuest', label: '⚠️ Cuestionable' },
  { key: 'no', label: '❌ Inaceptable' },
];

// ═══════════════════════════════════════════════════════════
export default function World6Level5() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const diagnosisQ = useRef(pickN(DIAGNOSIS_Q, 5).map(shuffleOpts)).current;
  const proteinQ = useRef(pickN(PROTEIN_Q, 5).map(shuffleOpts)).current;
  const healthQ = useRef(pickN(HEALTH_Q, 6).map(shuffleOpts)).current;
  const ethicsItems = useRef(pickN(BIOETHICS_POOL, 6)).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Sprint
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintSec, setSprintSec] = useState(SPRINT_SECONDS);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintPicksRef = useRef(sprintPicks);   // refs síncronos: evita leer estado obsoleto
  const sprintDoneRef = useRef(sprintDone);
  useEffect(() => { sprintPicksRef.current = sprintPicks; }, [sprintPicks]);
  useEffect(() => { sprintDoneRef.current = sprintDone; }, [sprintDone]);

  // Clasificador ético
  const [ethicsAnswers, setEthicsAnswers] = useState<{ [k: number]: 'ok' | 'cuest' | 'no' }>({});
  const [ethicsChecked, setEthicsChecked] = useState(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Tarjetas expandibles
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentReflection = REFLECTIONS[step];
  const currentExample = EXAMPLES[step];
  const currentQuiz = step === 7 ? diagnosisQ : step === 11 ? proteinQ : step === 19 ? healthQ : null;

  const clearSprintTimer = () => { if (sprintTimer.current) { clearInterval(sprintTimer.current); sprintTimer.current = null; } };

  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    setQuizAnswers({}); setQuizChecked(false);
    setEthicsAnswers({}); setEthicsChecked(false);
    setBuilderState({});
    setExpandedEx(null);
    setSprintPicks({}); setSprintSec(SPRINT_SECONDS); setSprintStarted(false); setSprintDone(false); setSprintFb(null);
    clearSprintTimer();
  }, [step]);

  useEffect(() => () => clearSprintTimer(), []);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  const checkQuiz = () => {
    if (!currentQuiz) return;
    setQuizChecked(true);
    let c = 0;
    currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    awardOnce(c * 8);
  };

  const checkEthics = () => {
    setEthicsChecked(true);
    let c = 0;
    ethicsItems.forEach((it, i) => { if (ethicsAnswers[i] === it.correct) c++; });
    awardOnce(c * 5);
  };

  // ── Sprint: toda la evaluación lee refs, nunca estado obsoleto ──
  const finishSprint = useCallback((timeout: boolean) => {
    if (sprintDoneRef.current) return;
    sprintDoneRef.current = true;
    setSprintDone(true);
    clearSprintTimer();
    const vals = Object.values(sprintPicksRef.current);
    const good = vals.filter((v) => v === 'good').length;
    const bad = vals.filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    if (!awarded.current.has(9)) { awarded.current.add(9); if (earned > 0) addXP(earned); }
    setSprintFb(good >= SPRINT_GOAL
      ? { ok: true, msg: `¡Sprint logrado! ${good} elecciones correctas${bad > 0 ? ` (${bad} ${bad === 1 ? 'error' : 'errores'})` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} correctas (meta: ${SPRINT_GOAL}). +${earned} XP` });
  }, [addXP]);

  const startSprint = () => {
    setSprintStarted(true); setSprintSec(SPRINT_SECONDS);
    clearSprintTimer();
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { finishSprint(true); return 0; } return prev - 1; });
    }, 1000);
  };

  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const val: 'good' | 'bad' = HOSPITAL_SPRINT_ITEMS[i].good ? 'good' : 'bad';
    const next = { ...sprintPicksRef.current, [i]: val };
    sprintPicksRef.current = next;
    setSprintPicks(next);
    const good = Object.values(next).filter((v) => v === 'good').length;
    const totalGood = HOSPITAL_SPRINT_ITEMS.filter((x) => x.good).length;
    if (good >= SPRINT_GOAL || good === totalGood) finishSprint(false);
  };

  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: la salud, una enfermedad, la medicina, la genética o cómo la IA ayuda.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // Footer
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentExample) return { label: 'Sigamos →', enabled: true, onPress: advance };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    if (currentQuiz) return quizChecked
      ? { label: 'Continuar →', enabled: true, onPress: advance }
      : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 9: return { label: 'Continuar →', enabled: sprintDone, onPress: advance };
      case 16: return ethicsChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(ethicsAnswers).length === ethicsItems.length, onPress: checkEthics, accent: true };
      case 20: return { label: 'Terminar →', enabled: builderComplete(BUILDER_HEALTH), onPress: () => { awardOnce(BUILDER_HEALTH.xp); advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= MAX_XP * 0.7 ? 3 : xp >= MAX_XP * 0.45 ? 2 : 1;   // ~205 / ~132
    completeLevel(35, stars, xp);
    router.replace('/level/36');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, c: ExCard) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{c.emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{c.name}</Text></View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{c.how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{c.fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

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

  const renderBuilder = (cfg: BuilderConfig, previewLabel: string) => (
    <>
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
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{previewLabel}:</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </>
  );

  const renderContent = () => {
    if (currentExample) return (
      <View>
        <Tag icon={currentExample.icon} label={currentExample.label} variant="example" />
        <Title>{currentExample.title}</Title>
        <Sub>{currentExample.sub}</Sub>
        {currentExample.cards.map((c, i) => renderExCard(i, c))}
      </View>
    );
    if (currentReflection) return (
      <View>
        <Tag icon={currentReflection.icon} label={currentReflection.tag} variant="reflect" />
        <Title>Piensa tú</Title>
        <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
        <View style={[styles.card, styles.cardViolet]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{currentReflection.question}</Text></View>
        <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={currentReflection.placeholder} placeholderTextColor="#b8bcc0" />
        <Text style={styles.charCount}>{reflectText.trim().length} / {currentReflection.min} mínimo</Text>
        {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
      </View>
    );
    if (currentQuiz) {
      if (step === 7) return renderQuiz(diagnosisQ, 'Módulo 7 de 21 · Quiz', 'IA en diagnóstico médico', '5 preguntas sobre cómo la IA asiste (y no reemplaza) al médico.');
      if (step === 11) return renderQuiz(proteinQ, 'Módulo 11 de 21 · Quiz', '¿Qué es una proteína? (en serio, simple)', '5 preguntas para entender por qué AlphaFold lo cambió todo.');
      return renderQuiz(healthQ, 'Módulo 19 de 21 · Quiz', 'Quiz final · IA y salud', '6 preguntas que integran todo lo aprendido.');
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🧬</Text></View>
          <Tag icon="✨" label="Nivel 35 · Mundo 6" variant="intro" />
          <Title>IA y Tu Salud: La Medicina que Viene por Ti</Title>
          <Sub>La medicina más avanzada del siglo XXI no se está construyendo en hospitales del futuro. Se está construyendo HOY, con IA que ya detecta cáncer mejor que radiólogos, relojes que predicen infartos y CRISPR que cura enfermedades antes incurables. Esto va a llegar a tu familia en los próximos 10 años.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>IA YA en tu salud (Apple Watch, radiología) · Detección de cáncer · Wearables salvavidas · Salud mental con chatbots · AlphaFold (Nobel 2024) · CRISPR + IA · Vacunas COVID · Cirugía robótica · Bioética · Longevidad · Acceso desigual</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener una visión clara y honesta de cómo la IA YA cambió la medicina. Conocer casos reales de LATAM. Tener tu plan personal de salud con IA. Formar opinión sobre bioética genética y acceso desigual.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  21 módulos · 45-60 min · hasta 293 XP</Text><Text style={styles.cardText}>📖 Teoría · 🤔 Tu historia · 📱 IA YA en salud · 💝 Reflexión familiar · 🎗️ Cáncer · ⌚ Wearables · ❓ Diagnóstico · 💬 Salud mental · ⏱ Hospital del futuro · 🏆 AlphaFold · 🧬 Proteínas · 💉 COVID · ✂️ CRISPR · ⚖️ Ética genética · 🔬 Cirugía · ⚖️ Clasificador bioética · 🌍 Acceso desigual · ⏰ Longevidad · ❓ Quiz salud · 🛠️ Builder salud personal · ✍️ Reflexión final</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 21 · Teoría" variant="theory" />
          <Title>La medicina que viene por ti</Title>
          <Body>La medicina más avanzada del siglo XXI <B>no se está construyendo en hospitales del futuro</B>. Se está construyendo HOY, con IA que ya detecta cáncer mejor que radiólogos, relojes que predicen infartos y CRISPR que cura enfermedades antes incurables.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>Tres datos que cambian la perspectiva:</B>{'\n\n'}<B>2018</B>: Apple Watch aprobado por la FDA para detectar fibrilación auricular.{'\n'}<B>2024</B>: AlphaFold gana el Nobel — la IA acelera la biomedicina 50 años en 4.{'\n'}<B>2024</B>: Casgevy (CRISPR) aprobado para curar la anemia falciforme.</Text></View>
          <Body>¿Por qué importa para TI? Porque <B>tu cuerpo va a vivir 60-80 años más</B>. Estadísticamente, alguien cercano vivirá un cáncer, un Alzheimer o una diabetes. La IA está cambiando el pronóstico de cada una de esas enfermedades AHORA, no en un futuro abstracto.</Body>
          <Text style={styles.sectionTitle}>🧬 Las 4 áreas que ya cambiaron</Text>
          {[['1', 'Diagnóstico:', ' radiología, dermatología, cardiología — IA + médico gana al médico solo.'], ['2', 'Wearables:', ' Apple Watch, Whoop y Oura predicen problemas antes de los síntomas.'], ['3', 'Medicamentos:', ' AlphaFold + IA reducen de 10-15 años a 18 meses.'], ['4', 'Genética:', ' CRISPR + IA curando enfermedades antes incurables.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Verdad operativa:</B> la IA no reemplaza al médico — lo potencia. El binomio médico + IA gana siempre. Pero el reto real para LATAM no es la tecnología: es el <B>acceso desigual</B>. Esa es la conversación que importa.</Text></View>
        </View>
      );
      case 9: return (
        <View>
          <Tag icon="⏱" label="Módulo 9 de 21 · Sprint 90s" variant="sprint" />
          <Title>El hospital del futuro · ¿Qué será REAL?</Title>
          <Sub>10 características posibles. Toca solo las que serán reales en 2035. Meta: {SPRINT_GOAL} buenas.</Sub>
          <View style={styles.sprintBox}>
            <Text style={[styles.sprintTime, sprintSec <= 10 && !sprintDone && { color: P.red }]}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
            <Text style={styles.sprintLabel}>
              {sprintDone ? 'Sprint terminado' : sprintStarted ? `${Object.values(sprintPicks).filter((v) => v === 'good').length} buenos · ${Object.keys(sprintPicks).length} elegidos` : `Meta: ${SPRINT_GOAL} buenos en ${SPRINT_SECONDS}s`}
            </Text>
          </View>
          {!sprintStarted && !sprintDone && (
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { marginBottom: 12 }]} onPress={startSprint}><Text style={styles.primaryBtnText}>⚡ Iniciar Sprint</Text></TouchableOpacity>
          )}
          {(sprintStarted || sprintDone) && HOSPITAL_SPRINT_ITEMS.map((item, i) => {
            const pick = sprintPicks[i];
            const missed = sprintDone && pick === undefined && item.good;
            return (
              <TouchableOpacity key={i} disabled={sprintDone || pick !== undefined}
                style={[styles.sprintItem, pick === 'good' && styles.sprintItemGood, pick === 'bad' && styles.sprintItemBad, missed && styles.sprintItemMissed]}
                onPress={() => pickSprint(i)}>
                <View style={styles.sprintMarker}><Text style={styles.sprintMarkerText}>{i + 1}</Text></View>
                <Text style={styles.sprintItemText}>{item.text}</Text>
                <Text style={styles.sprintMark}>{pick === 'good' ? '✅' : pick === 'bad' ? '❌' : missed ? '·' : ''}</Text>
              </TouchableOpacity>
            );
          })}
          {sprintFb && <View style={[styles.fb, sprintFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sprintFb.ok ? styles.fbOkText : styles.fbBadText}>{sprintFb.msg}</Text></View>}
          {sprintDone && <Text style={styles.sprintNote}>Las marcadas con · eran buenas y no alcanzaste a elegirlas.</Text>}
        </View>
      );
      case 16: return (
        <View>
          <Tag icon="⚖️" label="Módulo 16 de 21 · Clasificador ético" variant="case" />
          <Title>Bioética · Límites de la IA en medicina</Title>
          <Sub>{ethicsItems.length} escenarios reales. ¿Aceptable, cuestionable o inaceptable? Hasta +{ethicsItems.length * 5} XP.</Sub>
          {ethicsItems.map((item, i) => {
            const ans = ethicsAnswers[i];
            const right = ethicsChecked && ans === item.correct;
            return (
              <View key={i} style={[styles.card, { marginBottom: 10 }]}>
                <Text style={styles.ethQ}>{i + 1}. {item.text}</Text>
                <View style={styles.ethOpts}>
                  {ETHICS_COLS.map((col) => {
                    const sel = ans === col.key;
                    const isCorrect = ethicsChecked && col.key === item.correct;
                    const isWrongPick = ethicsChecked && sel && col.key !== item.correct;
                    return (
                      <TouchableOpacity key={col.key} disabled={ethicsChecked}
                        style={[styles.ethOpt, sel && !ethicsChecked && styles.ethOptSel, isCorrect && styles.ethOptOk, isWrongPick && styles.ethOptWrong]}
                        onPress={() => setEthicsAnswers((prev) => ({ ...prev, [i]: col.key }))}>
                        <Text style={[styles.ethOptText, (isCorrect || isWrongPick) && { color: '#fff' }]}>{col.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {ethicsChecked && (
                  <View style={[styles.fb, right ? styles.fbOk : styles.fbBad, { marginTop: 8 }]}>
                    <Text style={right ? styles.fbOkText : styles.fbBadText}>{right ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${ETHICS_COLS.find((c) => c.key === item.correct)!.label.slice(2).trim()}". `}{item.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 20: return (
        <View>
          <Tag icon="🛠️" label="Módulo 20 de 21 · Builder" variant="build" />
          <Title>Tu plan de salud personal con IA</Title>
          <Sub>4 decisiones para los próximos 12 meses.</Sub>
          {renderBuilder(BUILDER_HEALTH, 'Tu plan de salud')}
        </View>
      );
      case 22: {
        const pct = Math.round((35 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🧬</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 35 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "IA y Tu Salud: La Medicina que Viene por Ti". Ahora eres BioTech Pioneer.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Distingo casos REALES de IA en salud HOY (no ciencia ficción)', 'Conozco AlphaFold (Nobel 2024) y por qué cambió la medicina mundial', 'Entiendo CRISPR + IA en términos simples, sin jerga biomédica', 'Reconozco el dilema de los chatbots terapéuticos: complemento vs reemplazo', 'Tengo opinión informada sobre el acceso desigual a la medicina del futuro'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 36: Tú y la IA · Tu Misión en el Mundo</B>{'\n'}El último nivel del curso. Reflexión profunda, manifiesto personal, carta a ti mismo en 10 años y certificado de graduación. El cierre del viaje completo.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 35 de 36 completado · {pct}% del camino</Text>
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
  fill: { height: '100%', backgroundColor: P.pink, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { ...typography.bold, fontSize: 11 },
  introIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: P.pinkBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 27 },
  sub: { fontSize: 13, color: P.muted, marginBottom: 14, lineHeight: 20 },
  bodyText: { fontSize: 13.5, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { ...typography.bold, color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 6, marginBottom: 10 },

  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.cardBg },
  cardAccent: { backgroundColor: P.pinkBg, borderColor: P.pinkBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
  cardViolet: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 5 },
  cardText: { fontSize: 13, color: P.body, lineHeight: 20 },

  highlightBox: { backgroundColor: P.pinkBg, borderLeftWidth: 3, borderLeftColor: P.pink, borderRadius: 8, padding: 12, marginBottom: 14 },
  highlightText: { fontSize: 13, color: P.pinkDark, lineHeight: 21 },
  tipBox: { backgroundColor: P.greenSoft, borderWidth: 1, borderColor: P.greenBorder, borderRadius: 10, padding: 12, marginTop: 6 },
  tipText: { fontSize: 12.5, color: P.greenText, lineHeight: 20 },
  stepLi: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.pink, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { ...typography.bold, color: '#fff', fontSize: 11 },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  exCard: { borderWidth: 1, borderColor: P.border, borderRadius: 12, marginBottom: 9, backgroundColor: '#fff', overflow: 'hidden' },
  exCardOpen: { borderColor: P.pinkBorder, backgroundColor: P.pinkBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  exEmoji: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  exName: { ...typography.bold, fontSize: 13, color: P.ink, lineHeight: 18 },
  exArrow: { fontSize: 17, color: P.faint, fontWeight: '700' },
  exBody: { paddingHorizontal: 12, paddingBottom: 12 },
  exHow: { fontSize: 12.5, color: P.body, lineHeight: 20 },
  exFact: { marginTop: 9, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: P.amberBorder, borderRadius: 8, padding: 10 },
  exFactText: { fontSize: 12, color: P.amberText, lineHeight: 18 },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, backgroundColor: P.cardBg, borderRadius: 10, padding: 11, marginBottom: 9, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1.5, borderColor: P.border, borderRadius: 11, marginBottom: 7, backgroundColor: '#fff' },
  qoptSel: { borderColor: P.pink, backgroundColor: P.pinkBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  qLetterSel: { backgroundColor: P.pink },
  qLetterOk: { backgroundColor: P.green },
  qLetterWrong: { backgroundColor: P.red },
  qLetterText: { ...typography.bold, fontSize: 11, color: P.muted },
  qoptText: { flex: 1, fontSize: 12.5, color: P.body, lineHeight: 18 },

  sprintBox: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  sprintTime: { ...typography.extraBold, fontSize: 30, color: P.pinkBright },
  sprintLabel: { fontSize: 12, color: P.muted, marginTop: 3 },
  sprintItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1.5, borderColor: P.border, borderRadius: 11, marginBottom: 7, backgroundColor: '#fff' },
  sprintItemGood: { borderColor: P.green, backgroundColor: P.greenSoft },
  sprintItemBad: { borderColor: P.red, backgroundColor: P.redBg },
  sprintItemMissed: { borderColor: P.amberBorder, backgroundColor: '#fffbeb' },
  sprintMarker: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  sprintMarkerText: { ...typography.bold, fontSize: 11, color: P.muted },
  sprintItemText: { flex: 1, fontSize: 12.5, color: P.body, lineHeight: 18 },
  sprintMark: { fontSize: 13 },
  sprintNote: { fontSize: 11, color: P.faint, marginTop: 8, lineHeight: 16 },

  ethQ: { ...typography.bold, fontSize: 12.5, color: P.ink, marginBottom: 9, lineHeight: 19 },
  ethOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ethOpt: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  ethOptSel: { borderColor: P.pink, backgroundColor: P.pinkBg },
  ethOptOk: { borderColor: P.green, backgroundColor: P.green },
  ethOptWrong: { borderColor: P.red, backgroundColor: P.red },
  ethOptText: { fontSize: 11.5, color: P.body, fontWeight: '600' },

  builderWrap: { gap: 12 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 12 },
  builderLabel: { ...typography.bold, fontSize: 12, color: P.pinkDark, marginBottom: 8, textTransform: 'uppercase' },
  builderOpts: { gap: 6 },
  builderOpt: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.pink, backgroundColor: P.pinkBg },
  builderOptText: { fontSize: 12, color: P.body, lineHeight: 17 },
  builderOptTextSel: { color: P.pinkDark, fontWeight: '600' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 12, padding: 13 },
  codeLine: { fontSize: 11.5, lineHeight: 19, marginBottom: 3 },
  codeKey: { color: P.codeKey, fontWeight: '700' },
  codeText: { color: P.codeText },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic' },

  reflectArea: { borderWidth: 1.5, borderColor: P.border, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 110, textAlignVertical: 'top', backgroundColor: '#fff', color: P.ink },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 5 },

  fb: { borderRadius: 10, padding: 11, marginTop: 4 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.pink, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  lvlBarInner: { height: '100%', backgroundColor: P.pink, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.pink, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.pinkBright },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
