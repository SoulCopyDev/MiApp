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
// Nivel 23 · El Ecosistema Completo
// Mundo 4 · TEMA OSCURO cyan (bg #001018, texto #ecfeff).
// Reconstruido vs nivel-23.html (estándar v2.2).
// ═══════════════════════════════════════════════════════════

// ── Paleta (dark) ──
const C = {
  bg: '#001018', surface: '#001a25', card: '#002335', card2: '#002f45',
  text: '#ecfeff', muted: '#7dd3fc', border: '#003a55',
  cyan: '#06b6d4', cyanLight: '#67e8f9',
  okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
};

// ── Tipos ──
interface TheoryStep { type: 'theory'; xp: number; render: () => React.ReactNode; }
interface QuizStep { type: 'quiz'; xp: number; title: string; question: string; options: string[]; correct: number; feedback: string; }
interface VFStep { type: 'vf'; xp: number; title: string; intro?: () => React.ReactNode; statements: { text: string; correct: boolean; feedback: string }[]; }
interface DragStep { type: 'drag'; xp: number; title: string; intro?: () => React.ReactNode; items: { id: string; text: string }[]; zones: { label: string; ids: string[] }[]; }
interface SprintStep { type: 'sprint'; xp: number; answers: { q: string; valid: string[] }[]; }
interface CompletionStep { type: 'completion'; xp: number; }
type Step = TheoryStep | QuizStep | VFStep | DragStep | SprintStep | CompletionStep;

// ── Helpers ──
const shuffleOpts = <T extends { options: string[]; correct: number }>(item: T): T => {
  const paired = item.options.map((opt, i) => ({ opt, isCorrect: i === item.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...item, options: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ── Pools ──
const OPEN_SOURCE_QUIZ_POOL = [
  { question: 'Laura escuchó que Llama es una IA "open source". ¿Cuál explicación es más correcta?', options: ['Que la IA es gratis pero solo Meta puede modificarla', 'Que cualquier persona o empresa puede descargar el modelo, usarlo, modificarlo y crear versiones propias sin pagar', 'Que está hecha con código abierto de Python', 'Que el código solo se abre a desarrolladores con certificación oficial de Meta'], correct: 1, feedback: 'Open source = código abierto. Meta publicó el modelo Llama completo y gratis para que cualquiera lo descargue, ejecute y modifique. Muy distinto a ChatGPT, que es cerrado.' },
  { question: 'Un equipo quiere modificar una IA para su empresa sin pedir permiso a nadie. ¿Qué les conviene?', options: ['ChatGPT porque es la más famosa', 'Una IA open source como Llama que pueden bajar, editar y adaptar libremente', 'Gemini porque es de Google', 'Claude porque es la más nueva'], correct: 1, feedback: 'Open source permite exactamente eso: bajar el modelo y adaptarlo. Con las IAs cerradas no puedes ver ni cambiar cómo funcionan por dentro.' },
  { question: 'Juan dice: "Si Llama es open source, es más peligrosa porque cualquiera puede hackearla". ¿Tiene razón?', options: ['Sí, al ser abierta es más insegura', 'No — al ser abierta, miles de expertos pueden revisar el código y encontrar problemas; las cerradas solo las revisan sus dueños', 'Sí, pero solo un poco', 'Depende del país donde se use'], correct: 1, feedback: 'El código abierto permite que muchos ojos lo revisen y mejoren la seguridad. Las IAs cerradas solo las auditan sus propios creadores.' },
];
const ECOSYSTEM_QUIZ_POOL = [
  { question: 'Martín (15) quiere lanzar un canal de YouTube sobre misterios históricos. Necesita investigar con fuentes, escribir guiones, generar miniaturas y música. ¿Cuál combinación es más eficiente?', options: ['Solo ChatGPT para todo — es la más famosa', 'Perplexity para investigar + ChatGPT para guiones + Midjourney para miniaturas + Suno para música', 'Solo Grok porque tiene datos en tiempo real', 'Copilot en Word, porque allí escribe guiones directo'], correct: 1, feedback: '¡Exacto! Cada herramienta para lo que hace mejor. "Combinar IAs" es usar la mejor de cada categoría en vez de pedirle todo a una sola.' },
  { question: 'Valentina vive con internet malo y no quiere que sus conversaciones salgan de su computador. ¿Qué le conviene?', options: ['ChatGPT gratis — funciona sin internet', 'Llama en Ollama o LM Studio en su PC — sin internet, sin enviar datos a nadie', 'Gemini con plan Pro', 'Grok porque es la más reciente'], correct: 1, feedback: 'Ollama y LM Studio ejecutan Llama 100% en local: sin internet, sin costo por uso, con total privacidad.' },
  { question: 'Un abogado quiere analizar contratos confidenciales con IA sin que sus datos se usen para entrenar. ¿Qué opción es correcta?', options: ['ChatGPT versión gratis — nadie lee los chats', 'Meta AI en WhatsApp — es súper seguro', 'Un plan empresarial (Copilot Enterprise o Claude for Work) con contrato de protección de datos', 'Grok en X — tiene protección automática'], correct: 2, feedback: 'Los planes empresariales incluyen contratos legales que prohíben usar los datos para entrenar. Las versiones gratis no lo garantizan.' },
];
const NETFLIX_VF_POOL = [
  { text: 'La página de inicio de Netflix es distinta para cada usuario: la IA arma el "menú" según lo que ya viste.', correct: true, feedback: 'Cierto. Netflix incluso cambia las miniaturas según qué actor te interese más.' },
  { text: 'La lista "Descubrimiento Semanal" de Spotify está hecha por un equipo humano.', correct: false, feedback: 'Falso. Es 100% IA. Un sistema llamado "BaRT" analiza millones de canciones y arma tu lista cada semana.' },
  { text: 'YouTube usa IA para decidir qué video te sugiere después del que estás viendo.', correct: true, feedback: 'Cierto. Su IA de recomendación determina más del 70% del tiempo que la gente pasa en YouTube.' },
  { text: 'Las IAs de recomendación solo usan lo que tú ves — no los datos de otros usuarios.', correct: false, feedback: 'Falso. Usan "recomendación por parecidos": comparan tu historial con el de usuarios similares.' },
  { text: 'TikTok mide cuántos segundos te quedas mirando cada video para aprender tus intereses.', correct: true, feedback: 'Cierto. El algoritmo mide segundos de atención, no solo likes. Por eso se siente tan adictivo.' },
  { text: 'Instagram te muestra los posts en orden cronológico, del más nuevo al más viejo.', correct: false, feedback: 'Falso. Desde 2016 usa IA para ordenar el feed según tus interacciones.' },
  { text: 'Amazon usa IA de recomendación ("clientes que compraron esto también...") desde hace más de 20 años.', correct: true, feedback: 'Cierto. Fue pionera desde finales de los 90; influye el 30-40% de sus ventas.' },
];
const OPEN_SOURCE_VF_POOL = [
  { text: 'Llama (Meta) se puede descargar gratis y ejecutar en tu propio computador si tiene suficiente potencia.', correct: true, feedback: 'Cierto. Con herramientas como Ollama puedes ejecutarlo en una laptop con tarjeta gráfica decente.' },
  { text: 'ChatGPT es open source: su código está en GitHub y cualquiera puede verlo.', correct: false, feedback: 'Falso. OpenAI guarda el código y los pesos bajo secreto. A pesar del nombre "Open"AI, es de las más cerradas.' },
  { text: 'Las IAs open source son menos seguras porque cualquiera puede modificarlas.', correct: false, feedback: 'Falso. Al ser abiertas, miles de investigadores pueden auditarlas. Las cerradas solo las revisan sus dueños.' },
  { text: 'Con Llama local (Ollama), tus datos nunca salen de tu máquina.', correct: true, feedback: 'Cierto. Es una razón clave por la que empresas eligen Llama: privacidad total y cero dependencia.' },
  { text: 'Claude (Anthropic) es una IA open source, igual que Llama.', correct: false, feedback: 'Falso. Claude es cerrada. Anthropic no publica el código ni los pesos del modelo.' },
  { text: 'Un estudiante con una laptop normal puede correr el Llama 3 más pequeño sin pagar.', correct: true, feedback: 'Cierto. Existen versiones pequeñas (Llama 3 8B) que corren en laptops con GPU moderna, sin internet ni costo.' },
  { text: 'Cuando una IA es open source, los resultados que genera también suelen ser gratis de usar.', correct: true, feedback: 'Cierto en la mayoría de casos. Conviene leer la licencia específica (Llama la tiene para empresas muy grandes).' },
];

const ECOSYSTEM_DRAG = {
  items: [
    { id: 'a', text: '💬 ChatGPT' }, { id: 'b', text: '💼 Copilot (Word)' }, { id: 'c', text: '🔎 Perplexity' },
    { id: 'd', text: '✨ Gemini' }, { id: 'e', text: '🟣 Claude' }, { id: 'f', text: '🦙 Llama' },
    { id: 'g', text: '🌑 Grok' }, { id: 'h', text: '💬 Meta AI' },
  ],
  zones: [
    { label: '🏢 OpenAI', ids: ['a', 'b'] }, { label: '🟣 Anthropic', ids: ['e'] }, { label: '🔵 Google', ids: ['d'] },
    { label: '🟢 Meta', ids: ['f', 'h'] }, { label: '🟡 xAI (Elon Musk)', ids: ['g'] }, { label: '🔎 Perplexity AI', ids: ['c'] },
  ],
};
const PRIVACY_DRAG = {
  items: [
    { id: 'a', text: '🦙 Llama en Ollama (local)' }, { id: 'b', text: '💬 Meta AI en WhatsApp' }, { id: 'c', text: '🟣 Claude con plan Pro' },
    { id: 'd', text: '💼 Copilot empresarial (con contrato)' }, { id: 'e', text: '🆓 Grok gratis en X' }, { id: 'f', text: '💻 LM Studio offline' },
  ],
  zones: [
    { label: '🔒 Más privado (tus datos NO se usan para entrenar)', ids: ['a', 'd', 'f'] },
    { label: '⚠️ Menos privado (tus datos pueden usarse)', ids: ['b', 'c', 'e'] },
  ],
};
const MAP_DRAG = {
  items: [
    { id: 'a', text: '🖼️ Midjourney' }, { id: 'b', text: '🎬 Runway' }, { id: 'c', text: '🎵 Suno' }, { id: 'd', text: '💬 ChatGPT' }, { id: 'e', text: '🔎 Perplexity' },
    { id: 'f', text: '🟣 Claude' }, { id: 'g', text: '💻 Cursor' }, { id: 'h', text: '🐙 GitHub Copilot' }, { id: 'i', text: '📊 NotebookLM' }, { id: 'j', text: '📈 Julius AI' },
  ],
  zones: [
    { label: '🎨 Crear contenido visual/audio', ids: ['a', 'b', 'c'] }, { label: '💬 Conversar / escribir', ids: ['d', 'f'] },
    { label: '🔎 Buscar / investigar', ids: ['e', 'i'] }, { label: '💻 Programar', ids: ['g', 'h'] }, { label: '📊 Analizar datos', ids: ['j'] },
  ],
};
const SPRINT_ANSWERS = [
  { q: 'La IA dentro de WhatsApp', valid: ['meta ai', 'meta', 'llama', 'metaai'] },
  { q: 'La IA dentro de Word y Excel', valid: ['copilot', 'microsoft copilot', 'microsoft'] },
  { q: 'La IA para buscar con fuentes citadas', valid: ['perplexity', 'perplexity ai'] },
  { q: 'La IA que puedes descargar gratis a tu PC', valid: ['llama', 'ollama', 'meta', 'llama 3'] },
  { q: 'La IA de X/Twitter (Elon Musk)', valid: ['grok', 'xai', 'x ai'] },
];

// ═══════════════════════════════════════════════════════════
const buildSteps = (): Step[] => [
  // 0 INTRO
  { type: 'theory', xp: 0, render: () => (
    <View>
      <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🧭</Text></View>
      <ModTag icon="🔍" label="Introducción" />
      <Title>La IA es mucho más que ChatGPT</Title>
      <Body>Si le preguntas a alguien "¿conoces alguna IA?", el 90% dirá ChatGPT. Pero hay un ecosistema de más de 50 herramientas serias, cada una con una especialidad distinta. En este nivel vas a conocer el mapa completo.</Body>
      <Info>Dato real: hay más de 30,000 herramientas de IA catalogadas. La mayoría son especialistas en una tarea concreta.</Info>
    </View>
  ) },
  // 1 PERPLEXITY
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🔎" label="Herramienta destacada" />
      <Title>Perplexity: Google con esteroides</Title>
      <Body>Perplexity busca en internet en tiempo real, lee los resultados por ti, y te responde con una síntesis citando las <B>fuentes exactas</B> — con numeritos [1] [2] [3] que puedes clickear para verificar.</Body>
      <Info>Cuándo gana: noticias recientes, hechos verificables, investigación para tareas, precios actuales.</Info>
      <Case title="🎯 Caso real — Tarea de ciencias" text="María investiga el telescopio James Webb. Perplexity le da datos de 2024 con fuentes de la NASA verificables, en vez de inventar." />
    </View>
  ) },
  // 2 COPILOT
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="💼" label="Herramienta destacada" />
      <Title>Copilot: la IA dentro de Word y Excel</Title>
      <Body>Microsoft pagó más de 13 mil millones a OpenAI para meter GPT-4 dentro de Word, Excel, PowerPoint, Teams y Outlook. No es una web aparte — es un botón dentro del programa que ya usas.</Body>
      <Case title="🎯 Caso real — Oficina" text="El papá de Lucas recibe un PDF de 40 páginas. Copilot en Word lo resume en 30 segundos, extrae 3 puntos clave y redacta la respuesta." />
    </View>
  ) },
  // 3 META AI
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="💬" label="Herramienta destacada" />
      <Title>Meta AI: la IA que vive en tu WhatsApp</Title>
      <Body>Meta (dueños de WhatsApp, Instagram y Facebook) lanzaron <B>Meta AI</B> y la metieron en el buscador de WhatsApp. En muchos países aparece como un contacto azul. No tienes que descargar nada ni crear cuenta.</Body>
      <Info>Dato interesante: Meta AI usa el modelo <B>Llama</B>, que es open source (código abierto) — cualquiera puede descargarlo y usarlo gratis. Por eso aparecieron cientos de IAs derivadas de Llama.</Info>
    </View>
  ) },
  // 4 QUIZ open source
  { type: 'quiz', xp: 15, title: 'Open source', ...shuffleOpts(pickN(OPEN_SOURCE_QUIZ_POOL, 1)[0]) },
  // 5 IA en teléfono
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="📱" label="Conoce las IAs que ya tienes" />
      <Title>Las IAs que viven en tu celular</Title>
      <Body>Seguro que ya usas varias IAs sin saberlo. Cada fabricante de teléfono tiene la suya y cada mensajería también:</Body>
      <Case title="🍎 Siri (iPhone)" text='Desde 2024 conectada a ChatGPT. "Siri, pregúntale a ChatGPT la capital de Mongolia" y responde. Controla apps con voz.' />
      <Case title="🤖 Google Assistant (Android)" text='Integrado con Gemini. Ejecuta acciones reales: "ponme una alarma a las 7", "envía un mensaje a mamá".' />
      <Case title="📱 Bixby (Samsung)" text="La IA propia de Samsung, hecha para las rutinas del teléfono. Útil para automatizar cosas del día a día." />
      <Case title="💬 Meta AI (en WhatsApp)" text="Aparece como un contacto azul dentro de WhatsApp. Chat de IA gratuito sin descargar apps extras." />
    </View>
  ) },
  // 6 videojuegos
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🎮" label="Casos reales" />
      <Title>La IA también está en tus juegos</Title>
      <Body>La IA en videojuegos no es nueva — los NPCs usan lógica desde los años 90. Lo nuevo es que ahora esa lógica es <B>IA generativa real</B>, y cambia todo.</Body>
      <Case title="🎯 NPCs que hablan de verdad" text="Antes un personaje tenía 5 frases programadas. Hoy estudios como Inworld AI conectan personajes a ChatGPT: cada jugador tiene una conversación única. Si le cuentas que mataste a un dragón, se acuerda la próxima vez." />
      <Case title="🎯 Mundos generados con IA" text="Minecraft ya tiene mods que generan estructuras con IA. Roblox permite crear modelos 3D con descripciones. Los juegos del futuro generarán mundos en tiempo real según juegues." />
    </View>
  ) },
  // 7 VF Netflix/Spotify
  { type: 'vf', xp: 15, title: 'Netflix, Spotify y YouTube también son IA', statements: pickN(NETFLIX_VF_POOL, 4),
    intro: () => (
      <View>
        <ModTag icon="📺" label="Explicación antes del reto" />
        <Title>Netflix, Spotify y YouTube también son IA</Title>
        <Body>Cuando abres Netflix ves una pantalla distinta a la de tu primo. Spotify te arma un "Descubrimiento Semanal" que parece leerte la mente. Todo eso es <B>IA recomendadora</B>: aprende de tus gustos, los compara con los de millones de personas parecidas, y adivina qué te va a gustar después.</Body>
        <Info>La regla oculta: estas IAs no quieren que aprendas algo nuevo — quieren que <B>sigas mirando</B>. Entre más tiempo pases, más dinero ganan.</Info>
      </View>
    ) },
  // 8 DRAG ecosystem
  { type: 'drag', xp: 20, title: '¿Qué IA hay detrás? Clasifica cada una por su empresa.', items: ECOSYSTEM_DRAG.items, zones: ECOSYSTEM_DRAG.zones },
  // 9 VF open source
  { type: 'vf', xp: 15, title: 'Open source vs cerrado', statements: pickN(OPEN_SOURCE_VF_POOL, 4) },
  // 10 IA sin internet
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="📡" label="Escenarios" />
      <Title>¿Puedes usar IA sin conexión?</Title>
      <Body>Sí, y es de lo más interesante que puedes hacer hoy. Se llama <B>ejecutar modelos localmente</B>. Normalmente tu mensaje viaja a los servidores de OpenAI; pero también puedes correr la IA en tu propia máquina.</Body>
      <Info>Ejecutar IA localmente:{'\n'}• <B>Ollama</B>: descargas modelos como Llama 3 y los corres desde la terminal. Gratis, sin internet, privado.{'\n'}• <B>LM Studio</B>: interfaz tipo ChatGPT pero 100% offline.{'\n'}• <B>Jan.ai</B>: alternativa open source ligera, ideal para empezar.</Info>
      <Body>La ventaja: <B>privacidad total</B> y <B>cero costo</B>. La desventaja: los modelos locales son más pequeños, responden con menos "inteligencia" que GPT-4 o Claude en la nube.</Body>
    </View>
  ) },
  // 11 SPRINT
  { type: 'sprint', xp: 20, answers: SPRINT_ANSWERS },
  // 12 precios
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="💰" label="¿Cuánto cuestan?" />
      <Title>Los 4 modelos de precio que vas a encontrar</Title>
      <Body>No todas las IAs se pagan igual. Antes de elegir una, conoce cómo cobra:</Body>
      <Case title="🆓 100% gratis" text="No pagas nunca. Ej.: Meta AI en WhatsApp, Perplexity básico. La empresa gana por otras vías (datos, publicidad)." />
      <Case title="🎁 Freemium (gratis con límites)" text="Gratis pero con tope: ChatGPT gratis limita mensajes/día. Si quieres más, pagas. Ej.: ChatGPT Plus ($20/mes)." />
      <Case title="💳 Pago mensual fijo (suscripción)" text="$20-$30/mes por acceso completo, sin pensar en límites. Como Netflix, pero para IA. Ej.: Claude Pro, Perplexity Pro." />
      <Case title="🏢 Planes para empresas" text="Más caros pero protegen los datos del negocio (la IA no aprende con tus documentos secretos). Ej.: Copilot Enterprise." />
    </View>
  ) },
  // 13 DRAG privacidad
  { type: 'drag', xp: 15, title: 'Privacidad: ¿cuál es más segura?', items: PRIVACY_DRAG.items, zones: PRIVACY_DRAG.zones,
    intro: () => (
      <View>
        <ModTag icon="🔐" label="Explicación antes del reto" />
        <Title>Tus conversaciones con IA, ¿quién las lee?</Title>
        <Body>👉 En las <B>versiones gratis</B> (Meta AI, Grok gratis, ChatGPT gratis), la empresa puede usar tus conversaciones para <B>entrenar</B> futuras IAs.{'\n'}👉 En los <B>planes pagos para empresas</B>, un contrato prohíbe usar esos datos para entrenar.{'\n'}👉 Cuando ejecutas una IA <B>en tu propio computador</B> (Llama con Ollama), los datos <B>nunca salen</B> de tu máquina.</Body>
        <Info>Regla simple: si la IA es gratis y online, asume que pueden estar viendo tus mensajes. Si necesitas privacidad real → plan empresarial o IA local.</Info>
      </View>
    ) },
  // 14 convergencia
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🔄" label="Reflexión" />
      <Title>¿Las IAs se parecen cada vez más?</Title>
      <Body>Hace un par de años, ChatGPT, Claude, Gemini y Grok eran muy distintos. Hoy hacen <B>casi lo mismo</B>: los 4 escriben, programan, analizan imágenes, leen PDFs y generan voz. A eso se le llama <B>"convergencia"</B>. Entonces, ¿para qué existen todos? Por dos razones:</Body>
      <Info><B>1. Diferenciación en detalles:</B> Claude es mejor en textos largos, ChatGPT en imágenes/voz, Gemini en el ecosistema Google, Grok en datos de X. No difieren en lo que pueden hacer, sino en qué hacen mejor.</Info>
      <Info><B>2. Diferenciación por principios:</B> Anthropic (seguridad), Meta (código abierto), xAI (libertad de expresión), OpenAI (producto masivo). Compiten por sus valores, no solo por capacidades.</Info>
    </View>
  ) },
  // 15 trío estudiante
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🎓" label="Casos reales" />
      <Title>La mejor combinación para estudiar</Title>
      <Body>Si tuvieras que elegir <B>solo 3 herramientas</B> para estudiar mejor, este es el trío probado:</Body>
      <Case title="🔎 Perplexity — para investigar" text="Datos reales, actualizados y con fuentes para citar en trabajos. Nunca inventa, siempre cita." />
      <Case title="📓 NotebookLM — tus propios materiales" text="Subes tus PDFs y apuntes. Responde solo con base en esos documentos. Incluso genera podcasts de repaso con voces IA." />
      <Case title="🟣 Claude — para pensar y escribir" text="Razonar sobre algo difícil, escribir ensayos, corregir redacción. Su ventaja: respeta tu estilo en vez de imponer el suyo." />
    </View>
  ) },
  // 16 trío creador
  { type: 'theory', xp: 10, render: () => (
    <View>
      <ModTag icon="🎨" label="Casos reales" />
      <Title>La mejor combinación para crear contenido</Title>
      <Body>Si te dedicas a crear (videos, arte digital, canciones), este es el trío:</Body>
      <Case title="💬 ChatGPT — guión e ideas" text="Lluvia de ideas, guiones, títulos virales, descripciones, hashtags. Genera volumen creativo rápido." />
      <Case title="🖼️ Midjourney — visuales únicos" text="La IA con la estética más reconocible del mundo. Genera miniaturas, portadas e ilustraciones con un estilo que ninguna otra iguala." />
      <Case title="🎵 Suno — música y jingles" text="Música de fondo, jingles para intros, canciones completas con letra. Reemplaza librerías de audio con copyright." />
    </View>
  ) },
  // 17 DRAG mapa
  { type: 'drag', xp: 20, title: 'Mapa del ecosistema: clasifica cada IA por lo que hace.', items: MAP_DRAG.items, zones: MAP_DRAG.zones },
  // 18 QUIZ ecosystem
  { type: 'quiz', xp: 20, title: 'Quiz del ecosistema', ...shuffleOpts(pickN(ECOSYSTEM_QUIZ_POOL, 1)[0]) },
  // 19 COMPLETION
  { type: 'completion', xp: 0 },
];

// ── Componentes de texto ──
const ModTag = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.modTag}><Text style={styles.modTagText}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.body}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;
const Info = ({ children }: { children: React.ReactNode }) => <View style={styles.infoBox}><Text style={styles.infoText}>{children}</Text></View>;
const Case = ({ title, text }: { title: string; text: string }) => (
  <View style={styles.caseCard}><Text style={styles.caseTitle}>{title}</Text><Text style={styles.caseText}>{text}</Text></View>
);

// ═══════════════════════════════════════════════════════════
export default function World4Level5() {
  const completeLevel = useGameStore((s) => s.completeLevel);
  const steps = useRef(buildSteps()).current;
  const CONTENT_STEPS = steps.length - 1; // 19 (intro cuenta como módulo, completion no)
  const [step, setStep] = useState(0);
  useReportProgress(step, steps.length);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const awarded = useRef<Set<number>>(new Set());

  // Quiz
  const [qAns, setQAns] = useState<number | null>(null);
  // VF
  const [vfAns, setVfAns] = useState<Record<number, boolean>>({});
  // Drag
  const [dPlaced, setDPlaced] = useState<Record<string, number>>({});
  const [dSel, setDSel] = useState<string | null>(null);
  const [dResult, setDResult] = useState<null | boolean>(null);
  // Sprint
  const [spSec, setSpSec] = useState(60);
  const [spRunning, setSpRunning] = useState(false);
  const [spDone, setSpDone] = useState(false);
  const [spInputs, setSpInputs] = useState<string[]>(['', '', '', '', '']);
  const spTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cur = steps[step];

  useEffect(() => {
    setQAns(null); setVfAns({}); setDPlaced({}); setDSel(null); setDResult(null);
    if (spTimer.current) clearInterval(spTimer.current);
    setSpRunning(false); setSpDone(false); setSpSec(60); setSpInputs(['', '', '', '', '']);
  }, [step]);

  useEffect(() => () => { if (spTimer.current) clearInterval(spTimer.current); }, []);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  // ── ¿el módulo actual está completado (permite continuar)? ──
  const canContinue = (() => {
    if (cur.type === 'quiz') return qAns !== null;
    if (cur.type === 'vf') return Object.keys(vfAns).length >= (cur as VFStep).statements.length;
    if (cur.type === 'drag') return dResult === true;
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
    const items = (cur as VFStep).statements;
    if (Object.keys(next).length === items.length) {
      let c = 0; items.forEach((it, idx) => { if (next[idx] === it.correct) c++; });
      awardOnce((cur as VFStep).xp); setCorrectCount((p) => p + 1); // set completado (XP plano, como el HTML)
    }
  };
  // Drag
  const checkDrag = () => {
    const d = cur as DragStep;
    const zoneOf: Record<string, number> = {};
    d.zones.forEach((z, zi) => z.ids.forEach((id) => { zoneOf[id] = zi; }));
    const allPlaced = d.items.every((it) => dPlaced[it.id] !== undefined);
    if (!allPlaced) { setDResult(false); return; }
    const ok = d.items.every((it) => dPlaced[it.id] === zoneOf[it.id]);
    setDResult(ok);
    if (ok) { awardOnce(d.xp); setCorrectCount((c) => c + 1); }
  };
  // Sprint
  const startSprint = () => { setSpRunning(true); setSpSec(60); if (spTimer.current) clearInterval(spTimer.current); spTimer.current = setInterval(() => setSpSec((s) => { if (s <= 1) { endSprint(); return 0; } return s - 1; }), 1000); };
  const endSprint = () => {
    if (spTimer.current) clearInterval(spTimer.current);
    setSpRunning(false); setSpDone(true);
    let c = 0;
    (cur as SprintStep).answers.forEach((a, i) => { const v = spInputs[i].trim().toLowerCase(); if (v.length > 0 && a.valid.some((x) => v.includes(x) || x.includes(v))) c++; });
    awardOnce((cur as SprintStep).xp); setCorrectCount((p) => p + 1);
  };

  const finishLevel = () => {
    const stars = xp >= 165 ? 3 : xp >= 105 ? 2 : 1; // máx real ~230 XP
    completeLevel(23, stars, xp);
    router.replace('/level/24');
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
                          <Text style={ans === it.correct ? styles.fbOkText : styles.fbFailText}>{ans === it.correct ? '✓ ' : '✗ '}{it.feedback}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {cur.type === 'drag' && (() => {
            const d = cur as DragStep;
            return (
              <View>
                {d.intro && d.intro()}
                <ModTag icon="↕️" label="Arrastra y clasifica" />
                <Title>{d.title}</Title>
                <View style={styles.dragPool}>
                  {d.items.filter((it) => dPlaced[it.id] === undefined).map((it) => (
                    <TouchableOpacity key={it.id} style={[styles.dragItem, dSel === it.id && styles.dragItemSel]} onPress={() => setDSel(dSel === it.id ? null : it.id)}>
                      <Text style={styles.dragItemText}>{it.text}</Text>
                    </TouchableOpacity>
                  ))}
                  {d.items.every((it) => dPlaced[it.id] !== undefined) && <Text style={styles.poolEmpty}>Todo clasificado ✓</Text>}
                </View>
                {d.zones.map((z, zi) => (
                  <View key={zi}>
                    <Text style={styles.zoneLabel}>{z.label}</Text>
                    <TouchableOpacity style={styles.dropZone} onPress={() => { if (dSel) { setDPlaced((p) => ({ ...p, [dSel]: zi })); setDSel(null); setDResult(null); } }}>
                      {d.items.filter((it) => dPlaced[it.id] === zi).map((it) => {
                        const correctZone = d.zones.findIndex((zz) => zz.ids.includes(it.id));
                        const showWrong = dResult === false && correctZone !== zi;
                        return (
                          <TouchableOpacity key={it.id} style={[styles.dropChip, showWrong && styles.dropChipWrong]} onPress={() => { setDPlaced((p) => { const n = { ...p }; delete n[it.id]; return n; }); setDResult(null); }}>
                            <Text style={[styles.dropChipText, showWrong && { color: C.failText }]}>{it.text} ✕</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </TouchableOpacity>
                  </View>
                ))}
                {dResult !== true && <TouchableOpacity style={styles.verifyBtn} onPress={checkDrag}><Text style={styles.verifyBtnText}>Verificar clasificación</Text></TouchableOpacity>}
                {dResult !== null && (
                  <View style={[styles.feedback, dResult ? styles.fbOk : styles.fbFail]}>
                    <Text style={dResult ? styles.fbOkText : styles.fbFailText}>{dResult ? '✅ ¡Clasificación perfecta!' : '❌ Algunos no están en la zona correcta (marcados en rojo). Ajústalos y verifica de nuevo.'}</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {cur.type === 'sprint' && (() => {
            const sp = cur as SprintStep;
            return (
              <View>
                <ModTag icon="⚡" label="Sprint cronometrado" />
                <Title>Sprint: nombra la IA detrás de cada app</Title>
                <Body>Tienes <B>60 segundos</B>. Escribe el nombre de la IA en cada línea. Cuando termines, presiona "Terminar".</Body>
                <View style={styles.sprintBox}>
                  <Text style={styles.sprintTimerLabel}>⏱️ Tiempo</Text>
                  <Text style={[styles.timer, spSec <= 10 && { color: C.failText }, spSec > 10 && spSec <= 20 && { color: '#f59e0b' }]}>{`${Math.floor(spSec / 60)}:${String(spSec % 60).padStart(2, '0')}`}</Text>
                </View>
                {sp.answers.map((a, i) => {
                  const v = spInputs[i].trim().toLowerCase();
                  const ok = spDone && v.length > 0 && a.valid.some((x) => v.includes(x) || x.includes(v));
                  const wrong = spDone && !ok;
                  return (
                    <View key={i} style={styles.sprintRow}>
                      <Text style={styles.sprintNum}>{i + 1}.</Text>
                      <Text style={styles.sprintQ}>{a.q}</Text>
                      <TextInput style={[styles.sprintInput, ok && styles.sprintOk, wrong && styles.sprintWrong]} placeholder="escribe aquí..." placeholderTextColor="#4a7a95"
                        value={spInputs[i]} editable={spRunning && !spDone}
                        onChangeText={(t) => setSpInputs((prev) => { const n = [...prev]; n[i] = t; return n; })} />
                    </View>
                  );
                })}
                {spDone && <View style={[styles.feedback, styles.fbOk]}><Text style={styles.fbOkText}>⚡ Respuestas: 1) Meta AI · 2) Copilot · 3) Perplexity · 4) Llama (Ollama) · 5) Grok</Text></View>}
                {!spRunning && !spDone && <TouchableOpacity style={styles.verifyBtn} onPress={startSprint}><Text style={styles.verifyBtnText}>⚡ Iniciar Sprint</Text></TouchableOpacity>}
                {spRunning && !spDone && <TouchableOpacity style={styles.verifyBtn} onPress={endSprint}><Text style={styles.verifyBtnText}>✅ Terminar ahora</Text></TouchableOpacity>}
              </View>
            );
          })()}

          {cur.type === 'completion' && (
            <View style={styles.completeContainer}>
              <Text style={{ fontSize: 54, marginBottom: 12 }}>🧭</Text>
              <Text style={styles.completeTitle}>¡Nivel 23 completado!</Text>
              <Text style={styles.completeSub}>Ahora conoces el mapa completo del ecosistema de IA. Ya no eres de los que solo conocen ChatGPT.</Text>
              <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={styles.statNum}>{correctCount}</Text><Text style={styles.statLbl}>Actividades correctas</Text></View>
                <View style={styles.statItem}><Text style={styles.statNum}>{CONTENT_STEPS}</Text><Text style={styles.statLbl}>Módulos</Text></View>
              </View>
              <View style={styles.badgeBox}>
                <Text style={{ fontSize: 42, marginBottom: 8 }}>🧭</Text>
                <Text style={styles.badgeTitle}>Insignia: AI Navigator</Text>
                <Text style={styles.badgeSub}>Conoces el mapa entero de la IA moderna</Text>
              </View>
              <View style={styles.nextHint}>
                <Text style={styles.nextHintText}>🎯 <Text style={{ fontWeight: '700', color: C.cyanLight }}>Siguiente parada: Nivel 24{'\n'}</Text>"¿Cuál herramienta uso? Elige como un pro" — aprenderás a elegir la IA correcta para cada tarea según el contexto.</Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {cur.type !== 'completion' && (
        <View style={styles.navRow}>
          {step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
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
  fill: { height: '100%', backgroundColor: C.cyan, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: C.cyanLight },
  progLabel: { ...typography.caption, color: C.muted, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.cyan },
  xpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  xpBadgeText: { fontSize: 11, fontWeight: '700', color: C.cyanLight },
  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modTag: { alignSelf: 'flex-start', marginBottom: 8 },
  modTagText: { fontSize: 11, fontWeight: '700', color: C.cyanLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 12, lineHeight: 25 },
  body: { ...typography.regular, fontSize: 14, color: C.muted, lineHeight: 23, marginBottom: 12 },
  bold: { color: C.text, fontWeight: '700' },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.cyan, borderRadius: 8, padding: 14, marginVertical: 8 },
  infoText: { fontSize: 13, color: C.muted, lineHeight: 21 },
  caseCard: { backgroundColor: C.card2, borderRadius: 12, padding: 14, marginVertical: 6, borderWidth: 1, borderColor: C.border },
  caseTitle: { ...typography.bold, fontSize: 13, color: C.cyanLight, marginBottom: 6 },
  caseText: { fontSize: 13, color: C.muted, lineHeight: 19 },
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
  dragPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 60, marginBottom: 12, alignItems: 'center' },
  dragItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  dragItemSel: { borderColor: C.cyan, backgroundColor: '#002f4a' },
  dragItemText: { fontSize: 12, color: C.text },
  poolEmpty: { fontSize: 12, color: C.muted, fontStyle: 'italic' },
  zoneLabel: { fontSize: 12, fontWeight: '700', color: C.cyanLight, marginBottom: 5, marginTop: 8 },
  dropZone: { minHeight: 52, padding: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, backgroundColor: C.card2, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' },
  dropChip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  dropChipWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  dropChipText: { fontSize: 11, color: C.cyanLight },
  verifyBtn: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.cyan, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  verifyBtnText: { fontSize: 14, fontWeight: '700', color: C.cyanLight },
  sprintBox: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 2, borderColor: C.cyan },
  sprintTimerLabel: { fontSize: 12, color: C.muted },
  timer: { fontSize: 40, fontWeight: '800', color: C.cyanLight, marginTop: 4 },
  sprintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  sprintNum: { fontSize: 14, fontWeight: '700', color: C.cyanLight, width: 22 },
  sprintQ: { flex: 1, minWidth: 150, fontSize: 12, color: C.muted },
  sprintInput: { flex: 1, minWidth: 120, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: C.surface, color: C.cyanLight, fontWeight: '700' },
  sprintOk: { borderColor: C.okBorder, backgroundColor: C.okBg, color: C.okText },
  sprintWrong: { borderColor: C.failBorder, backgroundColor: C.failBg, color: C.failText },
  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: C.cyanLight, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  xpBig: { ...typography.bold, fontSize: 20, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statItem: { backgroundColor: C.card2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  statNum: { fontSize: 20, fontWeight: '800', color: C.cyanLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2 },
  badgeBox: { backgroundColor: C.card2, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.cyan, width: '100%' },
  badgeTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  badgeSub: { fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'center' },
  nextHint: { backgroundColor: C.card2, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextHintText: { fontSize: 12, color: C.muted, lineHeight: 20 },
  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  primaryBtn: { backgroundColor: C.cyan, padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnOff: { backgroundColor: C.card2, opacity: 0.7 },
  primaryBtnText: { ...typography.bold, color: '#001018', fontSize: 15 },
});
