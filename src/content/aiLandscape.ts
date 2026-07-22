/**
 * aiLandscape — capa única de datos volátiles sobre el ecosistema de IA.
 *
 * ⚠️ REGLA DEL PROYECTO (ver AUDIT-CONTENIDO.md §9):
 *   1. Ningún nivel debe hardcodear nombres de modelos, versiones, precios ni "el año actual".
 *      Todo eso vive aquí y se importa.
 *   2. Todo dato lleva `revisadoEn` y `fuente`. Sin fuente, no entra.
 *   3. Preferir ejes que no caduquen. Un nivel construido sobre "GPT-3.5 vs GPT-4o" duró 14 meses;
 *      uno construido sobre "respuesta rápida vs. razonamiento" sobrevive a los renombramientos.
 *   4. Evitar números de versión en el texto visible. "Gemini" envejece bien; "Gemini 2.0", no.
 */

/** Año/periodo que el curso declara como "hoy". Una sola edición actualiza todo el material. */
export const ANIO_REVISION = 2026;

/** Fecha de la última revisión completa del panorama. Formato ISO. */
export const REVISADO_EN = '2026-07-22';

/** Meses tras los cuales un dato se considera sospechoso (lo usa scripts/check-stale.mjs). */
export const VENTANA_FRESCURA_MESES = 6;

export type Confianza = 'primaria' | 'prensa' | 'sin-confirmar';

export interface Asistente {
  /** Nombre del producto tal como lo ve el estudiante. Sin número de versión. */
  nombre: string;
  empresa: string;
  /** Fortaleza duradera, no una capacidad de una versión concreta. */
  fortaleza: string;
  revisadoEn: string;
  fuente: string;
  confianza: Confianza;
}

/**
 * Los cuatro asistentes generalistas que un estudiante encuentra hoy.
 * Deliberadamente SIN números de versión: cambian cada pocos meses y no aportan
 * nada pedagógico. Lo que enseñamos es a elegir herramienta, no a memorizar versiones.
 */
export const ASISTENTES: Asistente[] = [
  {
    nombre: 'ChatGPT',
    empresa: 'OpenAI',
    fortaleza: 'El más conocido y versátil. Generación de imágenes, voz y asistentes personalizados integrados.',
    revisadoEn: '2026-07-22',
    fuente: 'https://openai.com',
    confianza: 'sin-confirmar',
  },
  {
    nombre: 'Claude',
    empresa: 'Anthropic',
    fortaleza: 'Fuerte en escritura, análisis de documentos largos y programación.',
    revisadoEn: '2026-07-22',
    fuente: 'https://www.anthropic.com/news',
    confianza: 'primaria',
  },
  {
    nombre: 'Gemini',
    empresa: 'Google',
    fortaleza: 'Integrado en los productos de Google y con ventana de contexto muy grande.',
    revisadoEn: '2026-07-22',
    fuente: 'https://techcrunch.com/2026/07/21/google-releases-three-new-gemini-models-but-no-3-5-pro/',
    confianza: 'prensa',
  },
  {
    nombre: 'Grok',
    empresa: 'xAI',
    fortaleza: 'Conectado a X en tiempo real, útil para lo que está pasando ahora mismo.',
    revisadoEn: '2026-07-22',
    fuente: 'https://x.ai',
    confianza: 'sin-confirmar',
  },
];

/**
 * Herramientas de creación por modalidad.
 * Igual que arriba: familias de producto, sin versión.
 */
export const HERRAMIENTAS = {
  imagen: ['DALL-E (en ChatGPT)', 'Midjourney', 'Firefly (Adobe)', 'Flux', 'Ideogram'],
  video: ['Veo (Google)', 'Runway', 'Kling', 'Luma', 'Pika'],
  audio: ['Suno', 'Udio', 'ElevenLabs', 'Stable Audio'],
  datos: ['NotebookLM', 'ChatGPT', 'Claude'],
  revisadoEn: '2026-07-22',
  fuente: 'AUDIT-CONTENIDO.md §8.4 y §8.5 — mayoría sin confirmar en fuente primaria',
  confianza: 'sin-confirmar' as Confianza,
};

/**
 * El eje que reemplaza a "GPT-3.5 vs GPT-4o" en N19.
 *
 * Por qué este eje: todas las plataformas mayores ofrecen hoy un modo instantáneo y un modo
 * de razonamiento extendido. Los NOMBRES de esos modos cambian por plataforma y por trimestre;
 * la DISTINCIÓN lleva años estable y es la que el estudiante ve al elegir cómo preguntar.
 */
export const MODOS_RESPUESTA = {
  rapido: {
    nombre: 'Modo rápido',
    descripcion: 'Responde al instante. La IA contesta con lo primero que "sabe", sin detenerse a pensar.',
    bueno: [
      'Preguntas directas con una respuesta clara',
      'Resumir, traducir o corregir un texto',
      'Lluvia de ideas y primeros borradores',
      'Conversar y practicar un idioma',
    ],
  },
  razona: {
    nombre: 'Modo que razona',
    descripcion: 'Se toma más tiempo y va paso a paso antes de responder. Suele mostrar su proceso.',
    bueno: [
      'Problemas de matemáticas con varios pasos',
      'Encontrar el error en algo y explicar por qué falla',
      'Comparar varias opciones y recomendar una',
      'Acertijos y problemas de lógica',
    ],
  },
  revisadoEn: '2026-07-22',
  fuente: 'AUDIT-CONTENIDO.md §8.2',
};

/**
 * Casos de productos discontinuados. Material pedagógico de primera:
 * enseñan que la herramienta es prescindible y el criterio no.
 */
export const HERRAMIENTAS_DISCONTINUADAS = [
  {
    nombre: 'Sora',
    empresa: 'OpenAI',
    vivio: 'febrero 2024 – abril 2026',
    queFue: 'El primer generador de video que asombró al mundo. Videos de hasta un minuto desde texto.',
    porQueCerro:
      'Costaba alrededor de un millón de dólares al día en operación y generó mucho menos que eso en toda su vida. OpenAI cambió de prioridades.',
    leccion: 'Ser el más impresionante no garantiza sobrevivir. Las herramientas van y vienen; el criterio para elegirlas, no.',
    revisadoEn: '2026-07-22',
    fuente: 'https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation',
    confianza: 'primaria' as Confianza,
  },
];

/** Helper: lista de nombres de asistentes, para textos tipo "ChatGPT, Claude, Gemini o Grok". */
export const nombresAsistentes = (): string => {
  const n = ASISTENTES.map(a => a.nombre);
  return `${n.slice(0, -1).join(', ')} o ${n[n.length - 1]}`;
};
