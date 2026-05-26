import { router } from 'expo-router';
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Datos de los mundos ----------
const WORLD_DATA = [
  {
    id: 1,
    emoji: '🎨',
    name: 'MUNDO 1 · Fundamentos',
    title: 'Tu primera creación con IA',
    deliverables: [
      'Una creación real con IA: texto, imagen o análisis generado en ChatGPT/Claude — guardada en tu galería personal',
      'Un prompt construido con los 4 ingredientes (rol + tarea + contexto + formato) aplicado a un problema de tu vida real',
      'Tu código ético personal de IA: 3 compromisos escritos sobre cómo usarás la IA con responsabilidad',
      'Una reflexión escrita: "¿Qué cambió en cómo veo la tecnología después de este mundo?"',
    ],
    skills: 'Prompts efectivos · Ética básica · Pensamiento crítico',
  },
  {
    id: 2,
    emoji: '🎯',
    name: 'MUNDO 2 · Domina el Prompting',
    title: 'Tu librería de prompts dominados',
    deliverables: [
      'Una librería personal de 5 prompts reutilizables — técnicas reales (zero-shot, few-shot, CoT) listas para estudio y trabajo',
      'Un prompt maestro construido cronometrado: rol + few-shot + chain-of-thought + formato — armado en 3 minutos',
      '5 prompts rotos analizados y corregidos: comprensión profunda de por qué fallan los prompts y cómo repararlos',
      'Comprensión técnica del "cerebro" de la IA: tokens, temperatura, alucinaciones — y cómo afectan tus resultados',
    ],
    skills: 'Few-shot prompting · Chain-of-Thought · Debugging de prompts',
  },
  {
    id: 3,
    emoji: '🎬',
    name: 'MUNDO 3 · IA Creativa',
    title: 'Tu portafolio creativo multimodal',
    deliverables: [
      'Una imagen generada con IA: diseñada desde cero con prompt detallado (estilo + personaje + colores + mood)',
      'Una canción o pieza musical compuesta con IA: género + letra de primera estrofa + mood definidos por ti',
      'El guion y descripción de un cortometraje de IA: 30 segundos con escena, diálogo y estilo visual',
      'Una web o app básica diseñada con palabras: wireframe de 3 pantallas en lenguaje natural',
      'Un pipeline multimodal completo: flujo de proyecto real — texto → imagen → audio → video',
    ],
    skills: 'Imagen generativa · Audio IA · Video IA · Multimodalidad',
  },
  {
    id: 4,
    emoji: '⚡',
    name: 'MUNDO 4 · El Gran Torneo',
    title: 'Tu kit personal de herramientas IA',
    deliverables: [
      'Tu "toolkit" personal de IA: 4 herramientas elegidas con criterio (ChatGPT / Claude / Gemini / Perplexity + justificación de cada elección)',
      'Análisis de herramienta correcta vs incorrecta: 10 tareas reales con herramienta elegida y justificada',
      'Una misma tarea ejecutada en 3 herramientas diferentes: análisis comparativo con conclusiones propias',
      'Conocimiento profundo de 4 modelos líderes: ChatGPT, Claude, Gemini y Grok — fortalezas, límites y cuándo usar cada uno',
    ],
    skills: 'Selección estratégica · Comparación crítica · Toolkit personalizado',
  },
  {
    id: 5,
    emoji: '💡',
    name: 'MUNDO 5 · Tu Proyecto de Impacto',
    title: 'Tu proyecto real con IA',
    deliverables: [
      'Un chatbot diseñado por ti: con nombre, personalidad, objetivo y system prompt completo',
      'Una automatización real diseñada: flujo completo con disparador + acción + resultado (Zapier / Make)',
      'El prototipo de una idea propia: problema identificado + solución con IA + usuario definido + nombre del proyecto',
      'Una presentación de tu proyecto: deck de 5 slides + elevator pitch de 30 palabras + 3 preguntas difíciles respondidas',
      'Un post listo para publicar: contenido multimodal de tu proyecto para una red social real',
    ],
    skills: 'Diseño de chatbots · Automatización · App design no-code · Pitch profesional',
  },
  {
    id: 6,
    emoji: '🌟',
    name: 'MUNDO 6 · El Futuro de la IA',
    title: 'Tu visión personal del futuro',
    deliverables: [
      'Tu posición informada sobre AGI: argumentación con base científica, no opinión vacía',
      'Diseño del robot ideal para tu ciudad: forma + sensores + función + operación',
      'Tu sistema de movilidad inteligente: público + privado + peatonal + aéreo integrados',
      'Diseño de la ciudad sostenible 2040: energía + transporte + alimentación + agua + naturaleza',
      'Tu plan de salud personal con IA: wearable + monitoreo + salud mental + alimentación',
      'Tu manifiesto personal de IA: 5 compromisos sobre uso responsable',
      'Tu carta a ti mismo en 10 años: visión clara del futuro que quieres construir',
    ],
    skills: 'Pensamiento sistémico · Ética avanzada · Visión de futuro',
  },
];

interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World6Level8({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const totalXP = useGameStore(state => state.totalStars * 100 + state.playerLevel * 50); // estimación

  // Permitir retroceso siempre (es un nivel de solo lectura)
  React.useEffect(() => {
    setAllowBack?.(true);
  }, []);

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.screen}>
      {/* Barra de progreso */}
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}>
          <View style={[styles.fill, { width: '100%' }]} />
        </View>
        <View style={styles.xpChip}>
          <Text style={styles.xpChipText}>🎓 GRADUADO</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Encabezado */}
        <View style={styles.headerSection}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>🎓 ENTREGABLE FINAL · GRADUACIÓN</Text>
          </View>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🏆</Text>
          </View>
          <Text style={styles.title}>Tu Portafolio de Graduación</Text>
          <Text style={styles.subtitle}>
            Para padres de familia y para el estudiante: este es el resumen completo y concreto de TODO lo que produjiste durante AI Expert. No son ideas abstractas — son piezas reales, documentadas, demostrables.
          </Text>

          {/* Tarjeta explicativa */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardRow}>
              <View style={styles.infoCardIcon}>
                <Text style={styles.infoCardIconText}>📋</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>¿Qué es este documento?</Text>
                <Text style={styles.infoCardText}>
                  Una vista consolidada de los 6 entregables del curso (uno por mundo) más el portafolio final de graduación. Pensado para mostrar a familia, profesores, futuros empleadores o universidades como evidencia de habilidades reales.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Título de sección */}
        <Text style={styles.sectionHeader}>📦 Entregables por mundo</Text>

        {/* Tarjetas de mundos */}
        {WORLD_DATA.map(world => (
          <View key={world.id} style={styles.worldCard}>
            <View style={styles.worldCardHeader}>
              <View style={styles.worldCardIcon}>
                <Text style={styles.worldCardIconText}>{world.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.worldCardLabel}>{world.name}</Text>
                <Text style={styles.worldCardTitle}>{world.title}</Text>
              </View>
            </View>

            {/* Entregables */}
            <View style={styles.deliverablesList}>
              {world.deliverables.map((item, idx) => (
                <View key={idx} style={styles.deliverableRow}>
                  <Text style={styles.checkMark}>✓</Text>
                  <Text style={styles.deliverableText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Habilidades */}
            <View style={styles.skillsBar}>
              <Text style={styles.skillsText}>
                🛠️ Habilidades demostradas: <Text style={styles.skillsHighlight}>{world.skills}</Text>
              </Text>
            </View>
          </View>
        ))}

        {/* Resumen final */}
        <Text style={styles.sectionHeader}>🎓 Resumen final</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}><Text>📊</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Galería de creaciones con IA</Text>
              <Text style={styles.summaryText}>Imágenes, textos, prompts y proyectos generados durante el curso completo — organizados por mundo y técnica utilizada.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#fdf4ff', borderColor: '#e9d5ff' }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}><Text>🚀</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Tu proyecto de impacto propio</Text>
              <Text style={styles.summaryText}>Chatbot, app o solución con IA para un problema real de tu entorno — diseñado, prototipado y presentado.</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}><Text>📜</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Tu manifiesto personal de IA</Text>
              <Text style={styles.summaryText}>5 compromisos firmes sobre cómo usarás la IA con responsabilidad — honestidad, responsabilidad, crecimiento, impacto y bienestar personal.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#fefce8', borderColor: '#fde68a' }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}><Text>💌</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Tu carta a ti mismo en 10 años</Text>
              <Text style={styles.summaryText}>Reflexión sobre quién quieres ser en el mundo con IA — visión personal, logros esperados, consejo a tu yo presente.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}><Text>🎤</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Tu pitch de graduación de 60 segundos</Text>
              <Text style={styles.summaryText}>Presentación escrita del proyecto más importante del curso — problema + solución + impacto + próximo paso, listo para usar.</Text>
            </View>
          </View>
        </View>

        {/* Badge de graduación */}
        <View style={styles.graduationBadge}>
          <View style={styles.badgeCircle}>
            <Text style={styles.badgeEmoji}>🎓</Text>
          </View>
          <Text style={styles.badgeTitle}>AI Expert · Graduado</Text>
          <Text style={styles.badgeSubtitle}>36 de 36 niveles · 6 de 6 mundos · 100% completado</Text>
          <View style={styles.progressBarWrap}>
            <View style={styles.progressBarOuter}>
              <View style={[styles.progressBarInner, { width: '100%' }]} />
            </View>
          </View>
        </View>

        {/* Nota para padres */}
        <View style={styles.parentsNote}>
          <Text style={styles.parentsNoteText}>
            <Text style={styles.bold}>📖 Para padres de familia:</Text>{'\n'}
            Este portafolio es la evidencia concreta del aprendizaje de su hijo/a. Cada elemento listado es algo real, demostrable, y útil. No es teoría — son competencias aplicadas que su hijo/a puede mostrar en universidades, becas o futuros empleos. El curso AI Expert prioriza producción real sobre consumo pasivo.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fafafa',
  },
  closeBtn: { padding: 4 },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#b45309',
    borderRadius: 4,
  },
  xpChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  xpChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854d0e',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 20,
  },
  tag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350f',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    ...typography.extraBold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#fefce8',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  infoCardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef9c3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardIconText: {
    fontSize: 24,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350f',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  worldCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  worldCardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  worldCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  worldCardIconText: {
    fontSize: 28,
  },
  worldCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350f',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  worldCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  deliverablesList: {
    gap: 8,
    marginTop: 4,
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkMark: {
    color: '#16a34a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  deliverableText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  skillsBar: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  skillsText: {
    fontSize: 12,
    color: '#78350f',
  },
  skillsHighlight: {
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  graduationBadge: {
    marginTop: 30,
    padding: 30,
    alignItems: 'center',
  },
  badgeCircle: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#b45309',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeEmoji: {
    fontSize: 64,
    color: '#fff',
  },
  badgeTitle: {
    ...typography.extraBold,
    fontSize: 24,
    color: '#111827',
    marginBottom: 6,
  },
  badgeSubtitle: {
    fontSize: 13,
    color: '#78350f',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBarWrap: {
    width: '100%',
  },
  progressBarOuter: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#b45309',
  },
  parentsNote: {
    marginTop: 24,
    padding: 18,
    backgroundColor: '#fef9c3',
    borderRadius: 14,
  },
  parentsNoteText: {
    fontSize: 13,
    lineHeight: 22,
    color: '#78350f',
  },
  bold: {
    fontWeight: '700',
  },
});