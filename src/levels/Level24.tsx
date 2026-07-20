import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Nivel 24 · ¿Cuál Herramienta Uso? Elige como un Pro
// Mundo 4 · TEMA OSCURO violeta (bg #0a0418, texto #f5f3ff).
// Reconstruido vs nivel-24.html (estándar v2.2).
// ═══════════════════════════════════════════════════════════

// ── Paleta (dark) ──
const C = {
  bg: '#0a0418', surface: '#140828', card: '#1a0f36', card2: '#241548',
  text: '#f5f3ff', muted: '#c4b5fd', border: '#3b2470',
  primary: '#8b5cf6', light: '#c4b5fd', accent: '#6366f1', deep: '#7c3aed',
  okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
};

// ── Tipos ──
interface TheoryStep { type: 'theory'; xp: number; render: () => React.ReactNode; }
interface QuizStep { type: 'quiz'; xp: number; title: string; question: string; options: string[]; correct: number; feedback: string; }
interface VFStep { type: 'vf'; xp: number; title: string; intro?: () => React.ReactNode; statements: { text: string; correct: boolean; feedback: string }[]; }
interface SprintStep { type: 'sprint'; xp: number; answers: { q: string; valid: string[] }[]; }
interface CompletionStep { type: 'completion'; xp: number; }
type Step = TheoryStep | QuizStep | VFStep | SprintStep | CompletionStep;

// ── Helpers ──
const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const shuffleOpts = <T extends { options: string[]; correct: number }>(item: T): T => {
  const paired = item.options.map((opt, i) => ({ opt, isCorrect: i === item.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...item, options: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ── Pools ──
// Distractores alargados para que la correcta no sea la más larga (§15/27).
const QUIZ_ARBOL_POOL = [
  {
    question: 'Sofía tiene 13 años. Su profesora le pidió un trabajo sobre las elecciones presidenciales de Colombia del año pasado, citando al menos 5 fuentes periodísticas de medios distintos. Siguiendo el árbol de decisión, ¿qué herramienta es la más apropiada?',
    options: [
      'ChatGPT — es la más famosa y conversacional, así que sirve para cualquier tarea',
      'Claude — para escribir con estilo cuidado el ensayo final de la investigación',
      'Perplexity — necesita datos verificables con fuentes reales citables',
      'NotebookLM — para estudiar sus apuntes y diapositivas de clase',
    ],
    correct: 2,
    feedback: '¡Exacto! Perplexity es la única que cita fuentes reales con links [1][2][3]. Para una tarea académica con requisito de fuentes, es imbatible. Después puede usar Claude para redactar el ensayo con estilo cuidado.',
  },
  {
    question: 'Tomás tiene examen de biología mañana. Tiene 3 PDFs de capítulos, sus apuntes escaneados y las diapositivas de la profe. Quiere hacerle preguntas a TODO ese material. Siguiendo el árbol, ¿qué herramienta usar?',
    options: [
      'ChatGPT — le pega todo el texto de sus apuntes en el chat y ya está',
      'NotebookLM — diseñado para eso: subes documentos y responde solo con ellos',
      'Perplexity — busca en internet la información de esos temas de biología',
      'Grok — tiene la información más reciente sobre biología en tiempo real',
    ],
    correct: 1,
    feedback: 'NotebookLM es la respuesta perfecta. Subes todos tus materiales y te responde citando el documento y la página exacta, sin inventar nada fuera de lo que le diste.',
  },
  {
    question: 'Camila escribe un discurso para la graduación de su curso. Quiere que suene personal, emocional, no cliché. Siguiendo el árbol, ¿qué herramienta usar?',
    options: [
      'ChatGPT — la más rápida para escribir cualquier cosa en segundos',
      'Claude — la mejor para escritura cuidada con tono personal',
      'Perplexity — busca frases bonitas de discursos ya escritos por otros',
      'Gemini — porque es de Google y por eso escribe mejor que todas',
    ],
    correct: 1,
    feedback: 'Claude es famosa por respetar el tono que le pides y evitar los clichés típicos. Escribe con más "alma" y menos fórmula de manual. Ideal para textos donde la voz personal importa mucho.',
  },
];

const QUIZ_MAESTRO_POOL = [
  {
    question: 'Eres un estudiante de 13 años. Tu mejor amigo te pregunta: "¿Cuál es la IA que debería usar?". Usando TODO lo que aprendiste, ¿cuál es la mejor respuesta?',
    options: [
      'ChatGPT siempre, porque es la más famosa, la usa todo el mundo y con una sola herramienta resuelves cualquier tarea',
      'Depende completamente de para qué la necesite. Una sola IA no es la mejor; lo correcto es armar un kit de 3-5 herramientas según el uso',
      'La más cara que pueda pagar, porque el precio alto garantiza el mejor resultado en absolutamente todas las tareas',
      'Claude sin dudarlo, porque al ser la más nueva y avanzada supera a las demás en cualquier cosa que le pidas',
    ],
    correct: 1,
    feedback: '¡Exactamente! Este es EL aprendizaje del Mundo 4. Responder "depende" no es evasión — es la respuesta de un experto. La pregunta correcta es "¿para qué?", no "¿cuál es la mejor?". Y la solución casi nunca es una sola IA.',
  },
  {
    question: 'Un amigo te dice: "Llevo dos horas peleando con ChatGPT para que me haga una portada para YouTube y las miniaturas quedan horribles". ¿Qué le aconsejas?',
    options: [
      'Que siga intentando con ChatGPT sin rendirse, porque al final es solo cuestión de insistir y reescribir el prompt muchas veces',
      'Que cambie a Midjourney — está diseñada específicamente para imágenes artísticas y miniaturas con buena estética',
      'Que pague la versión ChatGPT Plus, porque con el plan de pago las miniaturas le van a salir mucho mejor al instante',
      'Que se olvide de la IA y haga la miniatura a mano en Paint, que para eso no hace falta nada más complicado',
    ],
    correct: 1,
    feedback: 'Exacto. Si la herramienta no es la correcta, por más que pagues o insistas no vas a obtener buenos resultados. Midjourney es la mejor para miniaturas artísticas. La lección del Mundo 4: cambia de herramienta, no fuerces la equivocada.',
  },
  {
    question: 'Tu mamá te pregunta si vale la pena pagar Claude Pro o ChatGPT Plus. ¿Qué es más importante saber antes de responder?',
    options: [
      'Cuál de las dos opciones es la más barata del mercado, porque el precio es lo único que de verdad importa aquí',
      'Cuál de las dos se parece más a Siri, para poder darle órdenes por voz igual que en el teléfono',
      'Para qué la quiere usar: investigar con fuentes, escribir cuidado, hacer imágenes, analizar PDFs, etc.',
      'Cuál de las dos está más de moda ahora mismo en TikTok, porque eso indica cuál es objetivamente la mejor',
    ],
    correct: 2,
    feedback: 'Perfecto. Antes de recomendar herramienta, hay que entender el uso. Si es para investigar → Perplexity. Si es escritura cuidada → Claude. Si es versatilidad general → ChatGPT Plus. "Depende del uso" es siempre la respuesta del experto.',
  },
];

const VF_POOL = [
  { text: 'ChatGPT gratis y ChatGPT Plus (USD 20/mes) te dan exactamente los mismos resultados, solo cambia el límite de uso.', correct: false, feedback: 'Falso. Plus te da el modelo más potente, generación de imágenes incluida, modo de voz avanzado y puedes subirle archivos para que los analice. La versión gratis es mucho más limitada en todo eso.' },
  { text: 'Para un estudiante que usa IA 30 min al día en tareas simples, la versión gratis es suficiente.', correct: true, feedback: 'Cierto. Para resolver dudas, resumir textos cortos o redactar mensajes, las versiones gratis de ChatGPT, Claude o Meta AI cubren eso sobradamente.' },
  { text: 'Vale la pena pagar cuando vas a usar la IA para un proyecto largo, creativo o profesional (publicar contenido, hacer una app, escribir un libro).', correct: true, feedback: 'Cierto. Ahí las limitaciones de las versiones gratis (cortes, modelos inferiores, sin imagen/voz) se vuelven frustración real. USD 20 mensuales compensan por horas de productividad.' },
  { text: 'Si pagas una IA, pagar las demás es redundante — todas hacen lo mismo.', correct: false, feedback: 'Falso. Si creas contenido, tiene sentido pagar Claude + Midjourney + Suno. Si investigas, Perplexity Pro + NotebookLM. Cada herramienta especializada rinde en su área.' },
  { text: 'Perplexity tiene una versión gratis útil que te permite hacer muchas búsquedas con fuentes al día.', correct: true, feedback: 'Cierto. Perplexity gratis permite muchas búsquedas básicas. Solo las búsquedas "Pro" (con razonamiento más profundo) tienen límite en la versión gratis.' },
  { text: 'NotebookLM es completamente gratis si tienes cuenta de Google.', correct: true, feedback: 'Cierto. Google ofrece NotebookLM gratis con tu cuenta de Gmail. Solo hay límites razonables sobre cuántos documentos puedes subir por proyecto.' },
  { text: 'Gastar USD 20 en ChatGPT Plus solo tiene sentido si vas a programar o hacer cosas muy complejas.', correct: false, feedback: 'Falso. Muchos estudiantes pagan Plus para tener acceso sin cortes al mejor modelo, subir PDFs, generar imágenes y usar modo de voz. Depende de tu uso real, no de qué tan "técnico" seas.' },
];

const SPRINT_ANSWERS = [
  { q: 'Investigar datos del cambio climático con fuentes citadas', valid: ['perplexity'] },
  { q: 'Generar miniatura llamativa para YouTube', valid: ['midjourney', 'dall-e', 'dalle', 'dall e', 'firefly'] },
  { q: 'Corregir tu redacción en un ensayo importante', valid: ['claude', 'chatgpt', 'gpt'] },
  { q: 'Preguntarle a tus apuntes de biología', valid: ['notebooklm', 'notebook'] },
  { q: 'Escribir código JavaScript desde cero', valid: ['cursor', 'copilot', 'chatgpt', 'github copilot', 'gpt', 'claude'] },
  { q: 'Crear música de fondo para un reel', valid: ['suno', 'udio'] },
  { q: 'Resumir un PDF de 50 páginas dentro de Word', valid: ['copilot', 'microsoft copilot'] },
  { q: 'Video de 5 segundos para tu historia de Instagram', valid: ['runway', 'sora', 'pika', 'kling'] },
  { q: 'Clonar tu voz para una grabación', valid: ['elevenlabs', 'eleven labs'] },
  { q: 'Saber qué dice Elon Musk en X hoy', valid: ['grok', 'xai'] },
];

// ── Componentes de texto ──
const ModTag = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.modTag}><Text style={styles.modTagText}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.body}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;
const Info = ({ children }: { children: React.ReactNode }) => <View style={styles.infoBox}><Text style={styles.infoText}>{children}</Text></View>;
const Case = ({ title, text }: { title: string; text: React.ReactNode }) => (
  <View style={styles.caseCard}><Text style={styles.caseTitle}>{title}</Text><Text style={styles.caseText}>{text}</Text></View>
);
const DecisionStep = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.decisionStep}><Text style={styles.decisionText}>{children}</Text></View>
);

// ═══════════════════════════════════════════════════════════
const buildSteps = (): Step[] => [
  // 0 INTRO
  { type: 'theory', xp: 0, render: () => (
    <View>
      <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🎯</Text></View>
      <ModTag icon="🎯" label="Introducción" />
      <Title>El problema de tener demasiadas opciones</Title>
      <Body>En el nivel 23 viste el mapa completo. Ahora viene la pregunta difícil: <B>¿con cuál me quedo?</B></Body>
      <Body>La gente que mejor usa IA hoy no tiene una sola herramienta favorita. Tiene un <B>criterio</B> para elegir la correcta según la tarea. Como un carpintero tiene martillo, sierra y taladro — no usa el martillo para todo.</Body>
      <Info><B>La regla de oro de este nivel:</B> "La herramienta correcta hace la tarea en 10 minutos. La equivocada tarda 2 horas y da mal resultado". Al final vas a poder mirar cualquier tarea y saber en 5 segundos cuál IA usar.</Info>
    </View>
  ) },
  // 1 MAPA RÁPIDO
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🗺️" label="Panorama general" />
      <Title>Cada tarea tiene su herramienta ideal</Title>
      <Body>Antes de entrar en comparaciones, ten este mapa mental. En los próximos módulos profundizamos en cada una, pero si quisieras un "cheat sheet" de 10 segundos, es este:</Body>
      <Case title="📝 Escribir ensayo cuidado → 🟣 Claude" text="Es la que mejor respeta tu tono personal." />
      <Case title="🔎 Buscar con fuentes reales → 🔎 Perplexity" text="Cita cada dato con links verificables." />
      <Case title="🎨 Imagen artística → 🎨 Midjourney" text="La estética más cuidada del mercado." />
      <Case title="💻 Corregir código → 💻 Cursor" text="Editor con IA dentro para programadores." />
      <Case title="🎵 Canción con letra → 🎵 Suno" text="Música completa desde una descripción de texto." />
      <Case title="📚 Preguntar a mis apuntes → 📓 NotebookLM" text="Solo responde con lo que subiste tú." />
      <Case title="🎬 Clip de video → 🎬 Runway" text="Genera videos cortos desde texto o imagen." />
      <Case title="🗣️ Clonar mi voz → 🎤 ElevenLabs" text="Replica tu voz con muy poca muestra de audio." />
      <Info><B>No intentes memorizar todo ahora.</B> En los módulos que siguen, cada una se explica con ejemplos. Al final del nivel lo vas a tener claro sin esforzarte.</Info>
    </View>
  ) },
  // 2 ESCRIBIR
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="📝" label="Comparación real" />
      <Title>Escribir: ChatGPT vs Claude, la misma tarea</Title>
      <Body>Tarea: "Escribe un discurso de 200 palabras para mi graduación de sexto grado. Soy tímida pero quiero que suene genuino, no cliché."</Body>
      <Case title="💬 ChatGPT responde así:" text={<>"Queridos compañeros, hoy marcamos el fin de una etapa inolvidable. A través de los años hemos compartido risas, lágrimas y sueños..." <Text style={styles.quote}>(continúa con frases estándar de graduación)</Text></>} />
      <Case title="🟣 Claude responde así:" text={<>"No soy la que más habla en el salón. De hecho, muchos de ustedes no saben cómo sueno. Pero hoy quería decirles algo real: lo que más voy a extrañar no son las clases, es el ruido del recreo..." <Text style={styles.quote}>(tono personal, respeta la timidez)</Text></>} />
      <Info><B>Conclusión:</B> ChatGPT genera volumen rápido pero tiende a sonar genérico. Claude capta mejor el <B>tono personal</B> que le pides. Para un ensayo largo o cuidado, Claude. Para lluvia de ideas rápida, ChatGPT.</Info>
    </View>
  ) },
  // 3 BUSCAR
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🔎" label="Comparación real" />
      <Title>Buscar info actualizada: ¿Perplexity o Gemini?</Title>
      <Body>Ambas buscan en internet en tiempo real. ¿Entonces cuál es la diferencia? Depende de qué tipo de búsqueda haces.</Body>
      <Case title="🔎 Perplexity gana cuando..." text="Necesitas citar fuentes específicas en un trabajo académico. Siempre muestra [1][2][3] con links clickeables. Un trabajo de colegio con fuentes de Perplexity queda profesional." />
      <Case title="✨ Gemini gana cuando..." text='La búsqueda es visual y relacionada con Google: "encuentra el mejor restaurante japonés cerca de mí con reseñas", "muéstrame imágenes del Louvre". Está integrado con Google Maps, Images y YouTube.' />
    </View>
  ) },
  // 4 IAs DE IMAGEN
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🎨" label="IAs de imagen" />
      <Title>4 formas distintas de crear una imagen con IA</Title>
      <Body>No todas las IAs de imagen hacen lo mismo. Cada una tiene una personalidad visual y un caso de uso distinto:</Body>
      <Case title="🖼️ DALL-E 3 (dentro de ChatGPT)" text="La más fácil de usar porque ya viene incluida en ChatGPT. Ideal para imágenes realistas desde una descripción simple. Si recién empiezas, esta es tu primera opción." />
      <Case title="🎨 Midjourney" text="La más artística del mercado. Sus imágenes se reconocen por su estilo cinematográfico, como escenas de película. Ideal para portadas, miniaturas y arte digital." />
      <Case title="🔓 Stable Diffusion" text="Es open source. La puedes instalar en tu propio PC y personalizar hasta el último detalle. La usan mucho los artistas digitales que quieren control total." />
      <Case title="🖌️ Adobe Firefly (dentro de Photoshop)" text="Vive dentro de Photoshop. Ideal para edición profesional: cambiar el fondo, quitar objetos, rellenar partes que faltan. Sin problemas legales de derechos de autor." />
    </View>
  ) },
  // 5 PROGRAMAR
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="💻" label="Comparación real" />
      <Title>Programar: tres opciones, tres casos distintos</Title>
      <Body>Si quieres aprender a programar o ya programas, hay tres opciones dominantes y cada una sirve para algo distinto:</Body>
      <Case title="💬 ChatGPT — el tutor paciente" text="Para aprender. Le pegas código que no entiendes, te lo explica línea por línea, te enseña conceptos. Ideal cuando recién empiezas." />
      <Case title="🐙 GitHub Copilot — el asistente silencioso" text="Vive dentro de tu editor. Mientras escribes, te sugiere la siguiente línea automáticamente. Para programadores que ya saben y quieren ir más rápido." />
      <Case title="🖱️ Cursor — el editor con IA incorporada" text='Un editor completo construido alrededor de IA. Marcas un pedazo de código, presionas Ctrl+K y le pides "reescríbelo mejor" o "revisa si tiene errores". Lo que prefieren los programadores hoy.' />
    </View>
  ) },
  // 6 NOTEBOOKLM
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="📓" label="Herramienta destacada" />
      <Title>NotebookLM: cargas tus materiales, te enseña</Title>
      <Body>Imagina que tienes 50 diapositivas de historia + 3 PDFs de capítulos + tus apuntes escaneados. Tienes examen en 3 días. <B>NotebookLM es la IA diseñada para ese momento exacto.</B></Body>
      <Body>Subes TODO al proyecto. NotebookLM lo lee. Luego le preguntas: "¿Cuál fue la causa real de la Primera Guerra Mundial según estos materiales?" — y te responde <B>solo con lo que está en tus documentos</B>, citando la diapositiva o página exacta.</Body>
      <Info><B>Función secreta:</B> NotebookLM puede generar un <B>podcast de 15 minutos</B> con dos voces IA discutiendo tu material. Ideal para repasar en el bus camino al colegio.</Info>
    </View>
  ) },
  // 7 AUTOMATIZAR
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="⚙️" label="Escenarios" />
      <Title>Automatización: Zapier vs Make vs n8n</Title>
      <Body>Estas no son "IAs" en sí, sino plataformas que <B>conectan apps y usan IA para ejecutar tareas automáticas</B>. Son el futuro de "no tener que hacer manualmente lo mismo 100 veces".</Body>
      <Case title="🔗 Zapier — el más fácil" text='"Cuando llegue un email con factura en el asunto, extrae el PDF con ChatGPT, guárdalo en Google Drive y avísame por WhatsApp". Se configura con clicks, sin programar.' />
      <Case title="⚙️ Make (antes Integromat) — el más poderoso visual" text="Similar a Zapier pero con lógica más compleja: condiciones, bucles, filtros. Ideal para negocios pequeños." />
      <Case title="🔧 n8n — el de los programadores" text="Open source y autohospedable. Lo corres en tu propio servidor. Para quien no quiere depender de ninguna empresa y prefiere control total." />
    </View>
  ) },
  // 8 IAs DE VIDEO
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🎬" label="IAs de video" />
      <Title>Crear video con IA: 4 opciones distintas</Title>
      <Body>Generar video con IA todavía es difícil (más que imágenes), pero en los últimos meses los resultados son impresionantes. Estas son las 4 principales:</Body>
      <Case title="🎬 Runway (Gen-3)" text="La más usada en 2026. Calidad cinematográfica, videos de hasta 10 segundos. Ideal para un reel o video corto profesional. Tiene versión gratis con pocos segundos al mes." />
      <Case title="🌟 Sora (de OpenAI)" text="La más realista del mercado, hace videos largos con detalle increíble. Viene en ChatGPT Pro ($200/mes) o Plus con límites. No es fácil de usar sin ese plan." />
      <Case title="🎭 Pika Labs" text="Más orientada a videos cortos para redes (TikTok, Instagram). Fácil de usar, rápida, pensada para creadores de contenido diario." />
      <Case title="📽️ Kling AI" text="Alternativa china sorprendentemente buena. Tiene un plan gratuito bastante generoso comparado con las otras. Ideal si quieres probar sin pagar." />
    </View>
  ) },
  // 9 SPRINT
  { type: 'sprint', xp: 25, answers: SPRINT_ANSWERS },
  // 10 ERRORES REALES
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="⚠️" label="Casos reales" />
      <Title>3 errores de personas que usaron la IA incorrecta</Title>
      <Case title="❌ Error 1: Abogado de Nueva York, 2023" text={<>Usó ChatGPT para preparar argumentos legales citando casos anteriores. ChatGPT inventó 6 casos inexistentes — "alucinó" las referencias. El juez detectó el fraude y fue multado. <B>Herramienta correcta:</B> una IA legal como Lexis+AI o bases reales como Westlaw.</>} />
      <Case title="❌ Error 2: Estudiante de arquitectura, 2024" text={<>Usó DALL-E para generar renders de su proyecto final. Los profesores detectaron inconsistencias en la física del edificio (ventanas y sombras imposibles). Reprobó. <B>Herramienta correcta:</B> software especializado como Midjourney + edición manual en AutoCAD.</>} />
      <Case title="❌ Error 3: Periodista colombiano, 2025" text={<>Usó Grok para escribir un reportaje sobre un evento reciente. Grok dio información con sesgo político marcado. Publicó sin verificar y el medio tuvo que corregir. <B>Herramienta correcta:</B> Perplexity con fuentes plurales + verificación cruzada manual.</>} />
    </View>
  ) },
  // 11 ÁRBOL DE DECISIÓN
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🌲" label="Framework" />
      <Title>¿Y si no sé cuál usar? Sigue este árbol</Title>
      <DecisionStep><B>Paso 1:</B> ¿Necesito datos actuales y verificables? → <B>Perplexity</B></DecisionStep>
      <DecisionStep><B>Paso 2:</B> ¿Tengo que analizar documentos MÍOS? → <B>NotebookLM</B></DecisionStep>
      <DecisionStep><B>Paso 3:</B> ¿Es una tarea de escritura cuidada y larga? → <B>Claude</B></DecisionStep>
      <DecisionStep><B>Paso 4:</B> ¿Necesito generar imagen / voz / video / música? → <B>Herramientas específicas</B> (Midjourney, ElevenLabs, Runway, Suno)</DecisionStep>
      <DecisionStep><B>Paso 5:</B> ¿Es algo rápido y conversacional? → <B>ChatGPT</B> (o Meta AI en WhatsApp)</DecisionStep>
      <DecisionStep><B>Paso 6:</B> ¿Es programación? → <B>Cursor</B> o <B>Copilot</B></DecisionStep>
      <Info><B>Hack:</B> Si después de esto sigues dudando, usa ChatGPT por default. Es lo más versátil aunque no lo mejor en ninguna categoría.</Info>
    </View>
  ) },
  // 12 QUIZ ÁRBOL
  { type: 'quiz', xp: 15, title: 'Usa el árbol', ...shuffleOpts(pickN(QUIZ_ARBOL_POOL, 1)[0]) },
  // 13 COMBINA
  { type: 'theory', xp: 15, render: () => (
    <View>
      <ModTag icon="🔀" label="Flujo avanzado" />
      <Title>La técnica Pro: combinar IAs</Title>
      <Body>Los usuarios más avanzados no usan <B>una</B> IA — combinan varias en una cadena. Ejemplo real de un estudiante de 14 años creando un TikTok educativo:</Body>
      <DecisionStep><B>1. Perplexity:</B> "Dame 3 datos curiosos verificados sobre el cerebro humano"</DecisionStep>
      <DecisionStep><B>2. Claude:</B> "Con estos datos, escribe un guión de 30 segundos, tono informal, para TikTok"</DecisionStep>
      <DecisionStep><B>3. ElevenLabs:</B> Clona la voz del estudiante y narra el guión</DecisionStep>
      <DecisionStep><B>4. Midjourney:</B> Genera 3 imágenes del cerebro con estilo artístico</DecisionStep>
      <DecisionStep><B>5. Runway:</B> Anima las imágenes con leve movimiento</DecisionStep>
      <DecisionStep><B>6. CapCut:</B> Junta todo, agrega texto y subtítulos</DecisionStep>
      <Info><B>Resultado:</B> TikTok educativo profesional en 45 minutos. Un equipo humano tardaría días. Esto es "pensar como un director de IAs" — tu rol es el de coordinador.</Info>
    </View>
  ) },
  // 14 VF GRATIS VS PAGO
  { type: 'vf', xp: 15, title: 'Gratis vs pago', statements: pickN(VF_POOL, 4),
    intro: () => (
      <View>
        <ModTag icon="✓" label="Verdadero o Falso" />
        <Title>Gratis vs pago: ¿cuándo conviene pagar?</Title>
        <Body>Decide si cada afirmación es verdadera o falsa. Al responder verás por qué.</Body>
      </View>
    ) },
  // 15 KIT ESTUDIANTE
  { type: 'theory', xp: 15, render: () => (
    <View>
      <ModTag icon="🎓" label="Builder" />
      <Title>Arma tu toolkit de estudiante IA (5 herramientas)</Title>
      <Body>Basado en lo que aprendiste, este es el kit óptimo para un estudiante de 12-15 años hoy en día:</Body>
      <Case title="1. 🔎 Perplexity (gratis) — Investigar" text="Para todas las tareas que requieren datos con fuentes verificables." />
      <Case title="2. 🟣 Claude (gratis) — Escribir y razonar" text="Para ensayos, resúmenes largos, análisis de textos, redacción cuidada." />
      <Case title="3. 📓 NotebookLM (gratis con cuenta Google) — Estudiar tus materiales" text="Subes apuntes, diapositivas, PDFs de clase — te explica todo basándose solo en eso." />
      <Case title="4. 💬 ChatGPT (gratis) — Conversación general" text="Para dudas rápidas, ideas creativas, explicar conceptos de forma simple." />
      <Case title="5. 🎨 DALL-E dentro de ChatGPT (gratis) — Imágenes simples" text="Cuando necesites una imagen para un trabajo, presentación o cuento. Sin pagar nada extra." />
      <Info><B>Costo total del kit: $0.</B> Todo gratis. Con estas 5, cualquier estudiante hace el 95% de sus tareas mejor que antes.</Info>
    </View>
  ) },
  // 16 KIT CREADOR
  { type: 'theory', xp: 15, render: () => (
    <View>
      <ModTag icon="🎬" label="Builder alternativo" />
      <Title>Arma tu toolkit de creador IA (alternativa)</Title>
      <Body>Si en lugar de estudiar, tu pasión es crear contenido para redes (YouTube Shorts, TikTok, Instagram), este es el kit:</Body>
      <Case title="1. 💬 ChatGPT — Guiones e ideas" text="Títulos virales, hooks, guiones de 30 segundos, descripciones." />
      <Case title="2. 🎨 Midjourney o DALL-E — Miniaturas y visuales" text="Miniaturas que destaquen, arte de canal, fondos para clips." />
      <Case title="3. 🎵 Suno — Música e intros" text="Jingle de canal personalizado, música de fondo sin copyright." />
      <Case title="4. 🎤 ElevenLabs — Voz" text="Para clonar tu voz (si quieres grabar sin grabarte) o narraciones profesionales." />
      <Case title="5. 🎬 Runway o Pika — Clips de video" text="Transiciones originales, clips imposibles de grabar con cámara, efectos creativos." />
    </View>
  ) },
  // 17 REFLEXIÓN FUTURA
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🔮" label="Reflexión" />
      <Title>Todo esto cambiará en 2 años</Title>
      <Body>Seamos honestos: el mapa que aprendiste va a estar <B>desactualizado en 18-24 meses</B>. Habrá nuevas herramientas dominantes, otras desaparecerán, los precios cambiarán.</Body>
      <Body>Pero lo que <B>no va a cambiar</B> es tu habilidad para evaluarlas. Si hoy sabes comparar ChatGPT con Claude, mañana vas a saber comparar la nueva IA de 2027 con la que domine. <B>El criterio se queda contigo para siempre.</B></Body>
      <Info><B>Cómo mantenerte actualizado sin volverte loco:</B>{'\n'}• Sigue a <B>@simonw</B> (Simon Willison) o <B>@ethanmollick</B> (Ethan Mollick) en X — de los mejores curadores del mundo IA.{'\n'}• Lee el newsletter <B>"The Rundown AI"</B> — gratis, 5 minutos, solo lo importante.{'\n'}• Prueba 1 herramienta nueva al mes. Solo una. No te ahogues.</Info>
    </View>
  ) },
  // 18 QUIZ MAESTRO
  { type: 'quiz', xp: 25, title: 'Quiz maestro', ...shuffleOpts(pickN(QUIZ_MAESTRO_POOL, 1)[0]) },
  // 19 COMPLETION
  { type: 'completion', xp: 0 },
];

// ═══════════════════════════════════════════════════════════
export default function World4Level6() {
  const completeLevel = useGameStore((s) => s.completeLevel);
  const steps = useRef(buildSteps()).current;
  const CONTENT_STEPS = steps.length - 1; // intro cuenta; completion no → 19
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const awarded = useRef<Set<number>>(new Set());

  // Quiz
  const [qAns, setQAns] = useState<number | null>(null);
  // VF
  const [vfAns, setVfAns] = useState<Record<number, boolean>>({});
  // Sprint
  const [spSec, setSpSec] = useState(90);
  const [spRunning, setSpRunning] = useState(false);
  const [spDone, setSpDone] = useState(false);
  const [spInputs, setSpInputs] = useState<string[]>(Array(10).fill(''));
  const spTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cur = steps[step];

  useEffect(() => {
    setQAns(null); setVfAns({});
    if (spTimer.current) clearInterval(spTimer.current);
    setSpRunning(false); setSpDone(false); setSpSec(90); setSpInputs(Array(10).fill(''));
  }, [step]);

  useEffect(() => () => { if (spTimer.current) clearInterval(spTimer.current); }, []);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  const canContinue = (() => {
    if (cur.type === 'quiz') return qAns !== null;
    if (cur.type === 'vf') return Object.keys(vfAns).length >= (cur as VFStep).statements.length;
    if (cur.type === 'sprint') return spDone;
    return true; // theory
  })();

  const handleContinue = () => {
    if (cur.type === 'theory') awardOnce(cur.xp); // XP fantasma del HTML → otorgado una vez (§25)
    setStep((s) => s + 1);
  };

  // Quiz
  const answerQuiz = (idx: number) => {
    if (qAns !== null) return;
    setQAns(idx);
    if (idx === (cur as QuizStep).correct) { awardOnce((cur as QuizStep).xp); setCorrectCount((c) => c + 1); }
  };
  // VF
  const answerVF = (i: number, val: boolean) => {
    if (vfAns[i] !== undefined) return;
    const next = { ...vfAns, [i]: val };
    setVfAns(next);
    if (Object.keys(next).length === (cur as VFStep).statements.length) {
      awardOnce((cur as VFStep).xp); setCorrectCount((p) => p + 1); // set completado
    }
  };
  // Sprint
  const startSprint = () => { setSpRunning(true); setSpSec(90); if (spTimer.current) clearInterval(spTimer.current); spTimer.current = setInterval(() => setSpSec((s) => { if (s <= 1) { endSprint(); return 0; } return s - 1; }), 1000); };
  const endSprint = () => {
    if (spTimer.current) clearInterval(spTimer.current);
    setSpRunning(false); setSpDone(true);
    let c = 0;
    (cur as SprintStep).answers.forEach((a, i) => { const v = spInputs[i].trim().toLowerCase(); if (v.length > 0 && a.valid.some((x) => v.includes(x) || x.includes(v))) c++; });
    awardOnce((cur as SprintStep).xp); if (c > 0) setCorrectCount((p) => p + 1);
  };

  const finishLevel = () => {
    const stars = xp >= 165 ? 3 : xp >= 106 ? 2 : 1; // máx real 235 XP (70% / 45%)
    completeLevel(24, stars, xp);
    router.replace('/eval/4');
  };

  const progress = Math.round((step / (steps.length - 1)) * 100);

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step < steps.length - 1 && <Text style={styles.progLabel}>Módulo {step} de {CONTENT_STEPS - 1}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.moduleCard}>
          <View style={styles.cardAccent} />
          {cur.type !== 'completion' && cur.xp > 0 && <View style={styles.xpBadge}><Text style={styles.xpBadgeText}>+{cur.xp} XP</Text></View>}

          {cur.type === 'theory' && (cur as TheoryStep).render()}

          {cur.type === 'quiz' && (() => {
            const q = cur as QuizStep;
            return (
              <View>
                <ModTag icon="🎯" label="Pregunta" />
                <Title>{q.title}</Title>
                <Text style={styles.quizQ}>{q.question}</Text>
                {q.options.map((opt, i) => {
                  const letters = ['🅐', '🅑', '🅒', '🅓'];
                  let s = styles.option as any;
                  if (qAns !== null && i === q.correct) s = { ...s, ...styles.optCorrect };
                  else if (qAns === i && i !== q.correct) s = { ...s, ...styles.optWrong };
                  return (
                    <TouchableOpacity key={i} style={s} disabled={qAns !== null} onPress={() => answerQuiz(i)}>
                      <Text style={styles.optText}>{letters[i]}  {opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {qAns !== null && (
                  <View style={[styles.feedback, qAns === q.correct ? styles.fbOk : styles.fbFail]}>
                    <Text style={qAns === q.correct ? styles.fbOkText : styles.fbFailText}>{qAns === q.correct ? '✅ ' : '❌ Casi. '}{q.feedback}</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {cur.type === 'vf' && (() => {
            const v = cur as VFStep;
            return (
              <View>
                {v.intro ? v.intro() : (<><ModTag icon="✓" label="Verdadero o Falso" /><Title>{v.title}</Title></>)}
                {v.statements.map((it, i) => {
                  const ans = vfAns[i];
                  return (
                    <View key={i} style={styles.vfCard}>
                      <Text style={styles.vfStmt}>{it.text}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.vfBtn, ans !== undefined && it.correct === true && styles.vfOk, ans === true && !it.correct && styles.vfFail]} disabled={ans !== undefined} onPress={() => answerVF(i, true)}><Text style={styles.vfBtnText}>✓ Verdadero</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.vfBtn, ans !== undefined && it.correct === false && styles.vfOk, ans === false && it.correct && styles.vfFail]} disabled={ans !== undefined} onPress={() => answerVF(i, false)}><Text style={styles.vfBtnText}>✗ Falso</Text></TouchableOpacity>
                      </View>
                      {ans !== undefined && (
                        <View style={[styles.feedback, ans === it.correct ? styles.fbOk : styles.fbFail]}>
                          <Text style={ans === it.correct ? styles.fbOkText : styles.fbFailText}>{ans === it.correct ? '✅ ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.feedback}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {cur.type === 'sprint' && (() => {
            const sp = cur as SprintStep;
            return (
              <View>
                <ModTag icon="⚡" label="Sprint cronometrado" />
                <Title>Sprint: elige la herramienta correcta en 90 segundos</Title>
                <Body>Tienes <B>90 segundos</B>. Escribe qué herramienta usarías en cada caso. Cuando termines, presiona <B>"Terminar"</B>.</Body>
                <View style={styles.sprintBox}>
                  <Text style={styles.sprintTimerLabel}>⏱️ Tiempo</Text>
                  <Text style={[styles.timer, spSec <= 15 && { color: C.failText }, spSec > 15 && spSec <= 30 && { color: '#f59e0b' }]}>{`${Math.floor(spSec / 60)}:${String(spSec % 60).padStart(2, '0')}`}</Text>
                </View>
                {sp.answers.map((a, i) => {
                  const v = spInputs[i].trim().toLowerCase();
                  const ok = spDone && v.length > 0 && a.valid.some((x) => v.includes(x) || x.includes(v));
                  const wrong = spDone && !ok;
                  return (
                    <View key={i} style={styles.sprintRow}>
                      <Text style={styles.sprintNum}>{i + 1}.</Text>
                      <Text style={styles.sprintQ}>{a.q}</Text>
                      <TextInput style={[styles.sprintInput, ok && styles.sprintOk, wrong && styles.sprintWrong]} placeholder="herramienta..." placeholderTextColor="#7a6ba8"
                        value={spInputs[i]} editable={spRunning && !spDone} autoCapitalize="none" autoCorrect={false}
                        onChangeText={(t) => setSpInputs((prev) => { const n = [...prev]; n[i] = t; return n; })} />
                    </View>
                  );
                })}
                {spDone && <View style={[styles.feedback, styles.fbOk]}><Text style={styles.fbOkText}>⚡ Respuestas: 1) Perplexity · 2) Midjourney/DALL-E · 3) Claude · 4) NotebookLM · 5) Cursor/Copilot · 6) Suno · 7) Copilot · 8) Runway · 9) ElevenLabs · 10) Grok</Text></View>}
                {!spRunning && !spDone && <TouchableOpacity style={styles.verifyBtn} onPress={startSprint}><Text style={styles.verifyBtnText}>⚡ Iniciar Sprint</Text></TouchableOpacity>}
                {spRunning && !spDone && <TouchableOpacity style={styles.verifyBtn} onPress={endSprint}><Text style={styles.verifyBtnText}>✅ Terminar ahora</Text></TouchableOpacity>}
              </View>
            );
          })()}

          {cur.type === 'completion' && (
            <View style={styles.completeContainer}>
              <Text style={{ fontSize: 54, marginBottom: 12 }}>🎯</Text>
              <Text style={styles.completeTitle}>¡Nivel 24 completado!</Text>
              <Text style={styles.completeSub}>Ya no eliges IA por moda — eliges por criterio. Ahora sabes cuál herramienta usar para cada tarea, como un profesional.</Text>
              <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={styles.statNum}>{correctCount}</Text><Text style={styles.statLbl}>Actividades correctas</Text></View>
                <View style={styles.statItem}><Text style={styles.statNum}>{CONTENT_STEPS - 1}</Text><Text style={styles.statLbl}>Módulos</Text></View>
              </View>
              <View style={styles.badgeBox}>
                <Text style={{ fontSize: 42, marginBottom: 8 }}>🎯</Text>
                <Text style={styles.badgeTitle}>Insignia: AI Strategist</Text>
                <Text style={styles.badgeSub}>Eliges la IA correcta para cada tarea</Text>
              </View>
              <View style={styles.nextHint}>
                <Text style={styles.nextHintText}>🏆 <Text style={{ fontWeight: '700', color: C.light }}>Siguiente parada: Evaluación del Mundo 4{'\n'}</Text>Demuestra todo lo que aprendiste en este mundo de herramientas.</Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={finishLevel}><Text style={styles.primaryBtnText}>Ir a la evaluación →</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {cur.type !== 'completion' && (
        <View style={styles.navRow}>
          {cur.type === 'theory' && step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }, !canContinue && styles.primaryBtnOff]} onPress={handleContinue} disabled={!canContinue}>
            <Text style={styles.primaryBtnText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: C.muted },
  track: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: C.light },
  progLabel: { ...typography.caption, color: C.muted, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.primary },
  xpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  xpBadgeText: { fontSize: 11, fontWeight: '700', color: C.light },
  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modTag: { alignSelf: 'flex-start', marginBottom: 8 },
  modTagText: { fontSize: 11, fontWeight: '700', color: C.light, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 12, lineHeight: 25 },
  body: { ...typography.regular, fontSize: 14, color: C.muted, lineHeight: 23, marginBottom: 12 },
  bold: { color: C.text, fontWeight: '700' },
  quote: { color: C.muted, fontStyle: 'italic' },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.primary, borderRadius: 8, padding: 14, marginVertical: 8 },
  infoText: { fontSize: 13, color: C.muted, lineHeight: 21 },
  caseCard: { backgroundColor: C.card2, borderRadius: 12, padding: 14, marginVertical: 6, borderWidth: 1, borderColor: C.border },
  caseTitle: { ...typography.bold, fontSize: 13, color: C.light, marginBottom: 6 },
  caseText: { fontSize: 13, color: C.muted, lineHeight: 19 },
  decisionStep: { backgroundColor: C.surface, borderLeftWidth: 3, borderLeftColor: C.primary, borderRadius: 8, padding: 12, marginVertical: 5 },
  decisionText: { fontSize: 13, color: C.muted, lineHeight: 20 },
  quizQ: { fontSize: 14, color: C.text, lineHeight: 21, backgroundColor: C.card2, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  option: { backgroundColor: C.card2, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  optCorrect: { borderColor: C.okBorder, backgroundColor: C.okBg },
  optWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  optText: { fontSize: 13, color: C.text, lineHeight: 19 },
  feedback: { borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1 },
  fbOk: { backgroundColor: C.okBg, borderColor: C.okBorder },
  fbFail: { backgroundColor: C.failBg, borderColor: C.failBorder },
  fbOkText: { fontSize: 12, color: C.okText, lineHeight: 18 },
  fbFailText: { fontSize: 12, color: C.failText, lineHeight: 18 },
  vfCard: { backgroundColor: C.card2, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  vfStmt: { fontSize: 13, color: C.text, lineHeight: 19, marginBottom: 10 },
  vfBtn: { flex: 1, padding: 11, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' },
  vfBtnText: { fontSize: 13, fontWeight: '700', color: C.muted },
  vfOk: { borderColor: C.okBorder, backgroundColor: C.okBg },
  vfFail: { borderColor: C.failBorder, backgroundColor: C.failBg },
  verifyBtn: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  verifyBtnText: { fontSize: 14, fontWeight: '700', color: C.light },
  sprintBox: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 2, borderColor: C.primary },
  sprintTimerLabel: { fontSize: 12, color: C.muted },
  timer: { fontSize: 40, fontWeight: '800', color: C.light, marginTop: 4 },
  sprintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  sprintNum: { fontSize: 14, fontWeight: '700', color: C.light, width: 22 },
  sprintQ: { flex: 1, minWidth: 150, fontSize: 12, color: C.muted },
  sprintInput: { flex: 1, minWidth: 120, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: C.surface, color: C.light, fontWeight: '700' },
  sprintOk: { borderColor: C.okBorder, backgroundColor: C.okBg, color: C.okText },
  sprintWrong: { borderColor: C.failBorder, backgroundColor: C.failBg, color: C.failText },
  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: C.light, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  xpBig: { ...typography.bold, fontSize: 20, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statItem: { backgroundColor: C.card2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  statNum: { fontSize: 20, fontWeight: '800', color: C.light },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2 },
  badgeBox: { backgroundColor: C.card2, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.primary, width: '100%' },
  badgeTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  badgeSub: { fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'center' },
  nextHint: { backgroundColor: C.card2, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextHintText: { fontSize: 12, color: C.muted, lineHeight: 20 },
  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  primaryBtn: { backgroundColor: C.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnOff: { backgroundColor: C.card2, opacity: 0.7 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
