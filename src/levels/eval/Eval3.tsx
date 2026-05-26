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
type QuizQ = { q: string; opts: string[]; c: number; fb: string };
type ClassifyItem = { scenario: string; correct: string; fb: string };
type DdItem = { id: string; text: string };
type DdZone = { label: string; correct: string[] };

// ---------- Datos ----------
const QUIZ_DATA: QuizQ[] = [
  { q: '¿Cómo se llama el proceso que usan las IAs como DALL-E para generar imágenes partiendo de "ruido" aleatorio?', opts: ['Compresión digital', 'Diffusion (difusión)', 'Pixel mapping', 'Neural rendering'], c: 1, fb: 'El proceso "diffusion" parte de ruido aleatorio y lo va "limpiando" guiado por tu descripción hasta crear una imagen coherente.' },
  { q: '¿Qué hace exactamente Whisper de OpenAI?', opts: ['Genera música desde texto', 'Traduce idiomas en tiempo real con voz clonada', 'Convierte audio hablado en texto escrito (transcripción)', 'Clona voces humanas para audiolibros'], c: 2, fb: 'Whisper es un modelo de transcripción: convierte voz en texto con alta precisión en múltiples idiomas.' },
  { q: 'Sora (OpenAI) es conocida principalmente por:', opts: ['Generar imágenes fotorrealistas desde texto', 'Analizar documentos PDF extensos', 'Generar videos de alta calidad desde descripciones de texto', 'Clonar voces con solo 1 minuto de audio'], c: 2, fb: 'Sora genera videos — es el modelo de generación de video de OpenAI presentado en 2024.' },
  { q: '¿Qué significa que una herramienta de construcción web sea "no-code"?', opts: ['No necesita conexión a internet', 'Puedes construir apps describiendo con palabras sin escribir código manualmente', 'Solo funciona para sitios de noticias', 'El código que genera es invisible'], c: 1, fb: 'No-code significa que describes lo que quieres en lenguaje normal y la herramienta genera el código por ti.' },
  { q: 'NotebookLM se diferencia de ChatGPT principalmente porque:', opts: ['Solo funciona en inglés', 'Trabaja exclusivamente con los documentos que tú le proporcionas, sin inventar información', 'Puede generar imágenes y videos además de texto', 'Es más barato que todas las otras IAs'], c: 1, fb: 'NotebookLM solo responde basándose en los documentos que tú cargas, citando exactamente de dónde saca cada respuesta.' },
  { q: '¿Qué tipo de gráfica es mejor para mostrar cómo cambia la temperatura de una ciudad cada mes durante un año?', opts: ['Gráfica de pie', 'Diagrama de dispersión', 'Gráfica de líneas', 'Gráfica de barras'], c: 2, fb: 'Las líneas conectan puntos en el tiempo y hacen visible si hay tendencias al alza, baja o ciclos repetitivos.' },
  { q: 'La multimodalidad en IA significa que:', opts: ['Responde en múltiples idiomas', 'Procesa y genera diferentes tipos de datos: texto, imagen, audio y video', 'Tiene múltiples personalidades', 'Se conecta a múltiples sitios web'], c: 1, fb: 'Multimodal = múltiples modalidades de datos. Puede ver imágenes, escuchar audio, leer texto y generar cualquiera de esos formatos.' },
  { q: '¿Cuál es la principal señal que delata una imagen generada por IA?', opts: ['Colores más brillantes', 'Las manos suelen tener dedos deformes, de más o de menos', 'Fondo siempre desenfocado', 'Textos dentro de la imagen perfectamente legibles'], c: 1, fb: 'Las IAs generativas han tenido históricamente problemas para generar manos correctas. Es la señal más reconocible.' },
  { q: 'Un "pipeline multimodal" es:', opts: ['Un tipo de tubería inteligente', 'Un flujo de trabajo donde la salida de una IA se convierte en entrada de otra', 'Un programa que conecta redes sociales', 'Un sistema para traducir código'], c: 1, fb: 'Un pipeline conecta herramientas en secuencia: texto → imagen → video → voz → web.' },
  { q: '¿Qué hace ElevenLabs con solo 1-3 minutos de audio de una persona?', opts: ['Transcribe automáticamente', 'Crea un clon de voz casi indistinguible del original', 'Genera un video de esa persona', 'Analiza emociones en la voz'], c: 1, fb: 'ElevenLabs es líder en clonación de voz. Con muy poco audio de muestra puede replicar la voz de una persona.' },
  { q: '¿Cuál de estos es un uso PROBLEMÁTICO de la clonación de voz con IA?', opts: ['Un autor crea el audiolibro de su propia novela con su voz clonada', 'Una empresa genera llamadas falsas del "banco" para robar datos personales', 'Un estudiante con parálisis usa su voz clonada para comunicarse', 'Una editorial crea audiolibros de dominio público'], c: 1, fb: 'Usar voz clonada para engañar y cometer fraude es ilegal en muchos países.' },
  { q: 'Correlación entre dos variables en datos significa:', opts: ['Una variable causa directamente a la otra', 'Las dos variables cambian juntas, pero no necesariamente una causa a la otra', 'Los datos están incorrectos', 'Ambas variables son independientes'], c: 1, fb: 'Correlación ≠ Causalidad. El consumo de helados y los ahogamientos en verano correlacionan, pero el calor causa ambos.' },
  { q: 'GPT-4o ("o" de omni) se distingue de modelos anteriores principalmente por:', opts: ['Ser completamente gratuito', 'Manejar texto, imagen y audio de forma nativa con latencia muy baja', 'Ser el primer modelo que escribe código', 'Estar disponible solo para empresas'], c: 1, fb: 'GPT-4o integra texto, imagen y audio de forma nativa con una latencia de respuesta tan baja que se siente como hablar con un humano.' },
  { q: '¿Qué significa "no-code" vs "low-code" en desarrollo de apps?', opts: ['No-code no usa internet; low-code sí', 'No-code es para imágenes; low-code para texto', 'No-code: sin escribir código; low-code: con algo de código', 'No-code es gratis; low-code de pago'], c: 2, fb: 'No-code = cero código manual. Low-code = mayoría visual con algo de código para personalizaciones.' },
  { q: '¿Qué es un "negative prompt" en generación de imágenes con IA?', opts: ['Un prompt pesimista', 'Instrucciones sobre qué NO quieres que aparezca en la imagen', 'Un prompt para colores oscuros', 'Un error común al escribir prompts'], c: 1, fb: 'Los negative prompts le dicen a la IA qué excluir: "sin texto, sin blur, sin manos extras".' }
];

const CLASSIFY_DATA: ClassifyItem[] = [
  { scenario: 'Una fotografía de un mercado en Ghana donde las manos de los vendedores tienen 6 dedos en ambas manos', correct: 'ia', fb: 'Señal clásica de imagen IA: dedos deformes o en cantidad incorrecta.' },
  { scenario: 'Un video viral donde un cantante famoso hace declaraciones polémicas que nunca había dicho públicamente', correct: 'ia', fb: 'Probable deepfake. La verificación cruzada con medios de confianza es esencial.' },
  { scenario: 'Un podcast donde el presentador comete errores naturales al hablar, se ríe inesperadamente y hace una pausa larga', correct: 'real', fb: 'Las imperfecciones naturales son características humanas difíciles de replicar por IA.' },
  { scenario: 'Una canción pop con estructura de versos y coros exactamente repetida sin variación y pronunciación absolutamente perfecta', correct: 'ia', fb: 'La perfección técnica absoluta y falta de variación emocional pueden indicar música generada por IA.' },
  { scenario: 'Una portada de revista donde el texto del titular está perfectamente integrado y es completamente legible', correct: 'real', fb: 'Las IAs tienen problemas generando texto coherente dentro de imágenes. Texto perfecto suele indicar edición humana.' },
  { scenario: 'Un noticiero digital donde el presentador parpadea exactamente cada 4 segundos con la misma duración', correct: 'ia', fb: 'El parpadeo demasiado regular o robótico es una señal de presentadores virtuales generados por IA.' },
  { scenario: 'Una foto grupal donde todas las personas tienen expresiones naturales diferentes y el fondo es una ciudad real reconocible', correct: 'real', fb: 'Expresiones variadas y naturales + fondo reconocible real hacen más probable que sea una foto real.' },
  { scenario: 'Un video de 8 segundos de un perro corriendo en la playa donde la física del agua parece incorrecta', correct: 'ia', fb: 'La física incorrecta (agua, movimiento) es uno de los límites más evidentes de los modelos de video con IA.' }
];

const DD_ITEMS: DdItem[] = [
  { id: 'a', text: '🎵 Componer una canción desde cero con texto' },
  { id: 'b', text: '📝 Analizar documentos propios en PDF y hacer preguntas' },
  { id: 'c', text: '🖼️ Generar una imagen desde una descripción detallada' },
  { id: 'd', text: '🎬 Crear un clip de video de 8 segundos desde texto' },
  { id: 'e', text: '🌐 Construir una app web sin escribir código' },
  { id: 'f', text: '🗣️ Clonar tu voz para narrar un audiolibro' },
  { id: 'g', text: '📊 Hacer preguntas a una hoja de datos en lenguaje natural' },
  { id: 'h', text: '🔊 Transcribir automáticamente un audio de 1 hora' }
];

const DD_ZONES: DdZone[] = [
  { label: '🎨 DALL-E / Midjourney', correct: ['c'] },
  { label: '🎵 Suno / Udio', correct: ['a'] },
  { label: '🎬 Runway / Pika / Sora', correct: ['d'] },
  { label: '🎤 ElevenLabs', correct: ['f'] },
  { label: '👂 Whisper', correct: ['h'] },
  { label: '📓 NotebookLM', correct: ['b', 'g'] },
  { label: '🔨 Lovable / Bubble', correct: ['e'] }
];

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World3Level7({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [currentPart, setCurrentPart] = useState(1);
  const [xp, setXp] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // Part 1 - Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Part 2 - Classify
  const [classifyAnswers, setClassifyAnswers] = useState<{ [key: number]: string }>({});
  const [classifyChecked, setClassifyChecked] = useState(false);

  // Part 3 - Drag & Drop
  const [ddPlaced, setDdPlaced] = useState<{ [key: number]: number }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddChecked, setDdChecked] = useState(false);

  // Part 4 - Pipeline Builder
  const [pipelineText, setPipelineText] = useState('');
  const [pipelineDone, setPipelineDone] = useState(false);

  // Part 5 - Reflection
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionDone, setReflectionDone] = useState(false);

  const addXP = (v: number) => setXp(prev => prev + v);

  // Quiz
  const selectQuiz = (i: number, j: number) => {
    if (quizChecked) return;
    setQuizAnswers(prev => ({ ...prev, [i]: j }));
  };
  const checkQuiz = () => {
    setQuizChecked(true);
    let correct = 0;
    QUIZ_DATA.forEach((q, i) => { if (quizAnswers[i] === q.c) correct++; });
    setTotalCorrect(prev => prev + correct);
    addXP(Math.round((correct / QUIZ_DATA.length) * 80));
    Alert.alert('Resultado', `${correct}/${QUIZ_DATA.length} correctas. +${Math.round((correct/QUIZ_DATA.length)*80)} XP`, [{ text: 'OK' }]);
  };

  // Classify
  const selectClassify = (i: number, ans: string) => {
    if (classifyChecked) return;
    setClassifyAnswers(prev => ({ ...prev, [i]: ans }));
  };
  const checkClassify = () => {
    setClassifyChecked(true);
    let correct = 0;
    CLASSIFY_DATA.forEach((item, i) => { if (classifyAnswers[i] === item.correct) correct++; });
    setTotalCorrect(prev => prev + correct);
    addXP(Math.round((correct / CLASSIFY_DATA.length) * 40));
    Alert.alert('Resultado', `${correct}/${CLASSIFY_DATA.length} correctas. +${Math.round((correct/CLASSIFY_DATA.length)*40)} XP`, [{ text: 'OK' }]);
  };

  // Drag & Drop
  const handleDdDrop = (zoneIdx: number) => {
    if (ddSel === null || ddChecked) return;
    setDdPlaced(prev => ({ ...prev, [ddSel]: zoneIdx }));
    setDdSel(null);
  };
  const removeDdItem = (itemIdx: number) => {
    if (ddChecked) return;
    setDdPlaced(prev => { const n = { ...prev }; delete n[itemIdx]; return n; });
  };
  const checkDD = () => {
    setDdChecked(true);
    let correct = 0;
    DD_ZONES.forEach((zone, zi) => {
      const placedIds: string[] = [];
      Object.entries(ddPlaced).forEach(([k, v]) => { if (v === zi) placedIds.push(DD_ITEMS[parseInt(k)].id); });
      if (zone.correct.every(id => placedIds.includes(id)) && placedIds.every(id => zone.correct.includes(id))) correct++;
    });
    setTotalCorrect(prev => prev + correct);
    addXP(Math.round((correct / DD_ZONES.length) * 40));
    Alert.alert('Resultado', `${correct}/${DD_ZONES.length} correctas. +${Math.round((correct/DD_ZONES.length)*40)} XP`, [{ text: 'OK' }]);
  };

  // Pipeline
  const checkPipeline = () => {
    if (pipelineText.trim().length < 80) return;
    setPipelineDone(true);
    setTotalCorrect(prev => prev + 1);
    addXP(30);
    Alert.alert('✅', '¡Pipeline diseñado! Un flujo multimodal completo.', [{ text: 'OK' }]);
  };

  // Reflection
  const submitReflection = () => {
    if (reflectionText.trim().length < 40) return;
    setReflectionDone(true);
    addXP(10);
    Alert.alert('🔒', '¡Reflexión sellada! Guardada en tu portafolio.', [{ text: 'OK' }]);
  };

  // Finish
  const finishEvaluation = () => {
    const total = QUIZ_DATA.length + CLASSIFY_DATA.length + DD_ZONES.length + 2;
    const pct = Math.round((totalCorrect / total) * 100);
    let stars = pct >= 85 ? 3 : pct >= 70 ? 2 : 1;
    completeLevel(39, stars, xp);
    router.back();
  };

  const goToNextPart = () => {
    if (currentPart < 5) {
      setCurrentPart(prev => prev + 1);
    } else {
      setCurrentPart(6); // completion screen
    }
  };

  // ========== RENDER ==========
  const renderPart1 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>📝 Parte 1 de 5</Text></View>
      <Text style={styles.partTitle}>Quiz — 15 preguntas</Text>
      <Text style={styles.partDesc}>Responde cada pregunta sobre el Mundo 3.</Text>
      {QUIZ_DATA.map((q, i) => (
        <View key={i} style={styles.quizItem}>
          <Text style={styles.quizNum}>Pregunta {i+1} de {QUIZ_DATA.length}</Text>
          <Text style={styles.quizText}>{q.q}</Text>
          {q.opts.map((o, j) => (
            <TouchableOpacity key={j} style={[styles.quizOpt, quizAnswers[i] === j && styles.quizOptSel, quizChecked && j === q.c && styles.optCorrect, quizChecked && quizAnswers[i] === j && j !== q.c && styles.optWrong]}
              onPress={() => selectQuiz(i, j)} disabled={quizChecked}>
              <Text style={styles.quizOptText}>{['🅐','🅑','🅒','🅓'][j]} {o}</Text>
            </TouchableOpacity>
          ))}
          {quizChecked && <Text style={styles.feedbackSmall}>{quizAnswers[i] === q.c ? '✅ ' : '❌ '}{q.fb}</Text>}
        </View>
      ))}
      {!quizChecked && (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkQuiz}>
          <Text style={styles.btnText}>Verificar respuestas →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPart2 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>🔍 Parte 2 de 5</Text></View>
      <Text style={styles.partTitle}>Clasificador: ¿Real o generado por IA?</Text>
      <Text style={styles.partDesc}>Clasifica cada descripción como probablemente REAL (humano) o GENERADO por IA.</Text>
      <View style={styles.classifyGrid}>
        {CLASSIFY_DATA.map((item, i) => (
          <View key={i} style={styles.clItem}>
            <Text style={styles.clScenario}>{item.scenario}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.clBtn, classifyAnswers[i] === 'real' && styles.clBtnSel, classifyChecked && item.correct === 'real' && styles.clBtnOk, classifyChecked && classifyAnswers[i] === 'real' && item.correct !== 'real' && styles.clBtnFail]}
                onPress={() => selectClassify(i, 'real')} disabled={classifyChecked}>
                <Text style={styles.clBtnText}>👤 Real</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.clBtn, classifyAnswers[i] === 'ia' && styles.clBtnSel, classifyChecked && item.correct === 'ia' && styles.clBtnOk, classifyChecked && classifyAnswers[i] === 'ia' && item.correct !== 'ia' && styles.clBtnFail]}
                onPress={() => selectClassify(i, 'ia')} disabled={classifyChecked}>
                <Text style={styles.clBtnText}>🤖 IA</Text>
              </TouchableOpacity>
            </View>
            {classifyChecked && <Text style={styles.feedbackSmall}>{classifyAnswers[i] === item.correct ? '✅ ' : '❌ '}{item.fb}</Text>}
          </View>
        ))}
      </View>
      {!classifyChecked && (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkClassify}>
          <Text style={styles.btnText}>Verificar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPart3 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>↕️ Parte 3 de 5</Text></View>
      <Text style={styles.partTitle}>Drag & Drop — Herramienta correcta</Text>
      <Text style={styles.partDesc}>Arrastra cada tarea a la herramienta de IA más adecuada.</Text>
      <View style={styles.ddPool}>
        {DD_ITEMS.map((item, i) => ddPlaced[i] === undefined && (
          <TouchableOpacity key={i} style={[styles.ddItem, ddSel === i && styles.ddItemSel]}
            onPress={() => setDdSel(ddSel === i ? null : i)} disabled={ddChecked}>
            <Text style={styles.ddItemText}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {DD_ZONES.map((zone, zi) => (
        <View key={zi}>
          <Text style={styles.ddZoneLabel}>{zone.label}</Text>
          <TouchableOpacity style={[styles.ddZone, ddChecked && styles.ddZoneChecked]} onPress={() => handleDdDrop(zi)} disabled={ddChecked}>
            {Object.entries(ddPlaced).map(([k, v]) => v === zi && (
              <TouchableOpacity key={k} onPress={() => removeDdItem(parseInt(k))} disabled={ddChecked}>
                <Text style={styles.ddPlacedItem}>{DD_ITEMS[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </View>
      ))}
      {!ddChecked && (
        <TouchableOpacity style={styles.btnSecondary} onPress={checkDD}>
          <Text style={styles.btnSecondaryText}>Verificar clasificación</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPart4 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>🔗 Parte 4 de 5</Text></View>
      <Text style={styles.partTitle}>Builder — Diseña tu pipeline creativo</Text>
      <Text style={styles.partDesc}>Diseña el flujo completo de un proyecto creativo con IA usando al menos 4 herramientas.</Text>
      <View style={styles.pipelineRow}>
        <Text>💡 Idea → 🖼️ Imagen IA → 🎵 Audio IA → 🎬 Video IA → 🌐 Web</Text>
      </View>
      <TextInput style={styles.textArea} placeholder="Mi proyecto se llama...\nPaso 1 — Imagen: [herramienta + qué generas]\nPaso 2 — Audio: [herramienta + qué generas]\nPaso 3 — Video: [herramienta + cómo combinas]\nPaso 4 — Web: [herramienta + cómo publicas]\nResultado final: ..."
        value={pipelineText} onChangeText={setPipelineText} multiline editable={!pipelineDone} />
      {!pipelineDone && (
        <TouchableOpacity style={[styles.btnPrimary, pipelineText.trim().length < 80 && styles.btnDisabled]} onPress={checkPipeline} disabled={pipelineText.trim().length < 80}>
          <Text style={styles.btnText}>Enviar pipeline →</Text>
        </TouchableOpacity>
      )}
      {pipelineDone && <Text style={styles.feedback}>🔗 ¡Pipeline diseñado y guardado!</Text>}
    </View>
  );

  const renderPart5 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>💭 Parte 5 de 5</Text></View>
      <Text style={styles.partTitle}>Reflexión sellada</Text>
      <Text style={styles.partDesc}>Tu última respuesta del Mundo 3. Sé honesto y piensa de verdad.</Text>
      <View style={styles.reflectionPrompt}>
        <Text style={styles.reflectionPromptText}>"¿Qué quieres crear que antes sentías imposible? ¿Cómo cambió este mundo tu manera de ver las herramientas de IA? ¿Cuál fue la herramienta que más te sorprendió?"</Text>
      </View>
      <TextInput style={styles.textArea} placeholder="Escribe tu reflexión aquí..." value={reflectionText} onChangeText={setReflectionText} multiline editable={!reflectionDone} />
      {!reflectionDone && (
        <TouchableOpacity style={[styles.btnPrimary, reflectionText.trim().length < 40 && styles.btnDisabled]} onPress={submitReflection} disabled={reflectionText.trim().length < 40}>
          <Text style={styles.btnText}>🔒 Sellar y completar</Text>
        </TouchableOpacity>
      )}
      {reflectionDone && <Text style={styles.feedback}>🔒 ¡Reflexión sellada!</Text>}
    </View>
  );

  const renderCompletion = () => {
    const total = QUIZ_DATA.length + CLASSIFY_DATA.length + DD_ZONES.length + 2;
    const pct = Math.round((totalCorrect / total) * 100);
    return (
      <View style={styles.completionContainer}>
        <View style={styles.completionCircle}>
          <Text style={styles.completionPct}>{pct}%</Text>
          <Text style={styles.completionLbl}>acierto</Text>
        </View>
        <View style={styles.badgeBox}>
          <Text style={styles.badgeIcon}>🎨</Text>
          <Text style={styles.badgeTitle}>Insignia desbloqueada: Creador Multimodal</Text>
          <Text style={styles.badgeSub}>Mundo 3 — IA Creativa completado · Niveles N13–N18</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNum}>{totalCorrect}</Text><Text style={styles.statLbl}>Correctas</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{xp}</Text><Text style={styles.statLbl}>XP</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>5</Text><Text style={styles.statLbl}>Partes</Text></View>
        </View>
        <Text style={styles.completionText}>¡Lo lograste! Ahora eres un creador multimodal: imágenes, audio, video, web, datos y pipelines completos con IA.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={finishEvaluation}>
          <Text style={styles.btnText}>Volver al mapa</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentPart = () => {
    switch (currentPart) {
      case 1: return renderPart1();
      case 2: return renderPart2();
      case 3: return renderPart3();
      case 4: return renderPart4();
      case 5: return renderPart5();
      case 6: return renderCompletion();
      default: return null;
    }
  };

  const canAdvance = currentPart === 1 ? quizChecked : currentPart === 2 ? classifyChecked : currentPart === 3 ? ddChecked : currentPart === 4 ? pipelineDone : currentPart === 5 ? reflectionDone : false;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${(currentPart/5)*100}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>🏆 EVALUACIÓN FINAL · MUNDO 3</Text></View>
          <Text style={styles.headerTitle}>IA Creativa</Text>
          <Text style={styles.headerSub}>5 partes · Demuestra todo lo que aprendiste</Text>
        </View>
        {renderCurrentPart()}
        {canAdvance && currentPart <= 5 && (
          <TouchableOpacity style={[styles.btnPrimary, { alignSelf: 'center', marginTop: 16 }]} onPress={goToNextPart}>
            <Text style={styles.btnText}>Siguiente parte →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#e91e8c', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#e91e8c' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: 24, padding: 20, backgroundColor: '#1a0030', borderRadius: 20, borderWidth: 1, borderColor: '#3d006a' },
  headerBadge: { backgroundColor: '#e91e8c', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99, marginBottom: 12 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitle: { ...typography.extraBold, fontSize: 24, color: '#fdf4ff' },
  headerSub: { color: '#c084fc', fontSize: 13, marginTop: 6 },
  partContainer: { flex: 1 },
  partBadge: { backgroundColor: '#2d0050', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: '#3d006a' },
  partBadgeText: { color: '#f0abfc', fontSize: 11, fontWeight: '700' },
  partTitle: { ...typography.extraBold, fontSize: 18, color: colors.textPrimary, marginBottom: 4 },
  partDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  quizItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  quizNum: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  quizText: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 10, lineHeight: 20 },
  quizOpt: { padding: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quizOptSel: { borderColor: '#9333ea', backgroundColor: '#faf5ff' },
  quizOptText: { fontSize: 12, color: '#334155' },
  optCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  feedbackSmall: { fontSize: 11, marginTop: 6, color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6 },
  feedback: { marginTop: 10, padding: 12, borderRadius: 10, fontSize: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', color: '#065f46' },
  classifyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  clItem: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  clScenario: { fontSize: 12, fontWeight: '600', color: '#0f172a', marginBottom: 8, lineHeight: 18 },
  clBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  clBtnSel: { borderColor: '#9333ea' },
  clBtnOk: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  clBtnFail: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  clBtnText: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  ddPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, minHeight: 50 },
  ddItem: { padding: 8, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  ddItemSel: { borderColor: '#9333ea', backgroundColor: '#faf5ff' },
  ddItemText: { fontSize: 11, color: '#0f172a' },
  ddZoneLabel: { fontSize: 12, fontWeight: '700', color: '#f0abfc', marginBottom: 4, marginTop: 8 },
  ddZone: { minHeight: 45, padding: 10, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e2e8f0', backgroundColor: '#fafafa', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ddZoneChecked: { borderStyle: 'solid' },
  ddPlacedItem: { fontSize: 10, padding: 4, backgroundColor: '#eef2ff', borderRadius: 6, color: '#3730a3' },
  btnPrimary: { backgroundColor: '#e91e8c', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnSecondary: { backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 12 },
  btnSecondaryText: { ...typography.bold, color: '#9333ea', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
  textArea: { borderWidth: 1.5, borderColor: '#e91e8c', borderRadius: 12, padding: 14, minHeight: 120, fontSize: 13, backgroundColor: '#fdf4ff', marginBottom: 10, textAlignVertical: 'top' },
  pipelineRow: { backgroundColor: '#fdf4ff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f0abfc' },
  reflectionPrompt: { backgroundColor: '#fdf4ff', borderLeftWidth: 4, borderLeftColor: '#e91e8c', borderRadius: 4, padding: 14, marginBottom: 12 },
  reflectionPromptText: { fontSize: 13, color: '#86198f', fontStyle: 'italic', lineHeight: 20 },
  completionContainer: { alignItems: 'center', padding: 20 },
  completionCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#fdf4ff', borderWidth: 4, borderColor: '#e91e8c', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  completionPct: { fontSize: 28, fontWeight: '800', color: '#e91e8c' },
  completionLbl: { fontSize: 11, color: '#c084fc' },
  badgeBox: { backgroundColor: '#fdf4ff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e91e8c' },
  badgeIcon: { fontSize: 48, marginBottom: 8 },
  badgeTitle: { fontSize: 16, fontWeight: '800', color: '#86198f', textAlign: 'center' },
  badgeSub: { fontSize: 12, color: '#c084fc', marginTop: 4, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', minWidth: 80 },
  statNum: { fontSize: 20, fontWeight: '800', color: '#e91e8c' },
  statLbl: { fontSize: 10, color: '#64748b', marginTop: 2 },
  completionText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
});