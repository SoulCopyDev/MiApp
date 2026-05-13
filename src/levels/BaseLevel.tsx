import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface BaseLevelProps {
  worldId: number;
  levelId: number;
  levelName: string;
  questions: Question[];
}

export default function BaseLevel({ worldId, levelId, levelName, questions }: BaseLevelProps) {
  const completeLevel = useGameStore(s => s.completeLevel);

  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [score,         setScore]         = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback,      setFeedback]      = useState<string | null>(null);
  const [showResult,    setShowResult]    = useState(false);

  const breakpoint   = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && breakpoint !== 'mobile';
  const totalQuestions = questions.length;

  const handleAnswer = (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
    const isCorrect = optionIndex === questions[currentIndex].correct;
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('✅ ¡Correcto!');
    } else {
      setFeedback(`❌ Incorrecto. Respuesta correcta: "${questions[currentIndex].options[questions[currentIndex].correct]}"`);
    }
    setTimeout(() => {
      if (currentIndex + 1 < totalQuestions) {
        setCurrentIndex(i => i + 1);
        setSelectedOption(null);
        setFeedback(null);
      } else {
        const finalScore  = score + (isCorrect ? 1 : 0);
        const starsEarned = Math.floor((finalScore / totalQuestions) * 3);
        const xpEarned    = 50 + starsEarned * 20;
        completeLevel(worldId, levelId, starsEarned, xpEarned);
        setShowResult(true);
      }
    }, 1500);
  };

  /* ── Pantalla de resultado ── */
  if (showResult) {
    const finalStars = Math.floor((score / totalQuestions) * 3);
    return (
      <View style={[styles.resultContainer, isWebDesktop && styles.resultContainerDesktop]}>
        {isWebDesktop && (
          <View style={styles.webHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backBtnText}>Volver al mundo</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.resultCard, isWebDesktop && styles.resultCardDesktop]}>
          <View style={styles.resultIconWrap}>
            <Text style={styles.resultTrophy}>🏆</Text>
          </View>
          <Text style={styles.resultTitle}>¡{levelName} completado!</Text>
          <Text style={styles.resultScore}>
            {score} de {totalQuestions} correctas
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3].map(s => (
              <Text key={s} style={{ fontSize: 44, color: s <= finalStars ? colors.accent : colors.borderLight }}>
                ★
              </Text>
            ))}
          </View>
          <Text style={styles.resultXP}>+{50 + finalStars * 20} XP ganados</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={20} color={colors.surface} />
            <Text style={styles.backButtonText}>Volver al mundo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const current  = questions[currentIndex];
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  /* ── Quiz desktop ── */
  if (isWebDesktop) {
    return (
      <View style={styles.desktopRoot}>
        {/* Header fijo */}
        <View style={styles.webHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backBtnText}>Salir del nivel</Text>
          </TouchableOpacity>
          <Text style={styles.webHeaderTitle}>{levelName}</Text>
          <Text style={styles.webHeaderProgress}>
            {currentIndex + 1}/{totalQuestions}
          </Text>
        </View>

        {/* Contenido centrado */}
        <ScrollView
          contentContainerStyle={styles.desktopContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.desktopQuizCard}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarDesktop}>
                <View style={[styles.progressFillDesktop, { width: `${progress}%` as any }]} />
              </View>
              <Text style={styles.progressLabel}>Pregunta {currentIndex + 1} de {totalQuestions}</Text>
            </View>

            {/* Pregunta */}
            <Text style={styles.questionDesktop}>{current.question}</Text>

            {/* Opciones */}
            <View style={styles.optionsGrid}>
              {current.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect  = idx === current.correct;
                let optStyle = styles.optionDesktop;
                if (selectedOption !== null) {
                  if (isCorrect)              optStyle = styles.optionCorrect;
                  else if (isSelected)        optStyle = styles.optionWrong;
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={optStyle}
                    onPress={() => handleAnswer(idx)}
                    disabled={selectedOption !== null}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionLetter, isCorrect && selectedOption !== null && styles.optionLetterCorrect, isSelected && idx !== current.correct && styles.optionLetterWrong]}>
                      <Text style={styles.optionLetterText}>{String.fromCharCode(65 + idx)}</Text>
                    </View>
                    <Text style={styles.optionTextDesktop}>{opt}</Text>
                    {selectedOption !== null && isCorrect && (
                      <MaterialIcons name="check-circle" size={20} color={colors.success} />
                    )}
                    {isSelected && !isCorrect && (
                      <MaterialIcons name="cancel" size={20} color={colors.error} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Feedback */}
            {feedback && (
              <View style={[
                styles.feedbackBox,
                feedback.startsWith('✅') ? styles.feedbackCorrect : styles.feedbackWrong,
              ]}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            )}

            {/* Explicación */}
            {selectedOption !== null && current.explanation && (
              <View style={styles.explanationBox}>
                <MaterialIcons name="info-outline" size={18} color={colors.primary} />
                <Text style={styles.explanationText}>{current.explanation}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ── Quiz móvil ── */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{levelName}</Text>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Pregunta {currentIndex + 1} de {totalQuestions}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>
      </View>
      <Text style={styles.question}>{current.question}</Text>
      {current.options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            styles.option,
            selectedOption !== null && idx === current.correct && styles.correctOption,
            selectedOption === idx && idx !== current.correct && styles.wrongOption,
          ]}
          onPress={() => handleAnswer(idx)}
          disabled={selectedOption !== null}
        >
          <Text style={styles.optionText}>{opt}</Text>
        </TouchableOpacity>
      ))}
      {feedback && <Text style={styles.feedback}>{feedback}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* ── Mobile ── */
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 20, alignItems: 'center' },
  title: { ...typography.heading2, color: colors.textPrimary, marginBottom: 20, textAlign: 'center' },
  progressContainer: { width: '100%', marginBottom: 20 },
  progressText: { ...typography.body, color: colors.textSecondary, marginBottom: 5 },
  progressBar: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  question: { ...typography.heading3, color: colors.textPrimary, marginBottom: 20, textAlign: 'center' },
  option: { backgroundColor: colors.surface, padding: 15, borderRadius: 12, marginBottom: 10, width: '100%', borderWidth: 1, borderColor: colors.borderLight },
  optionText: { ...typography.body, color: colors.textPrimary },
  correctOption: { backgroundColor: colors.success, borderColor: colors.success },
  wrongOption: { backgroundColor: '#d32f2f', borderColor: '#d32f2f' },
  feedback: { ...typography.body, marginTop: 20, color: colors.textPrimary, textAlign: 'center' },

  /* ── Result (shared) ── */
  resultContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultContainerDesktop: { justifyContent: 'flex-start', alignItems: 'stretch', padding: 0 },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    width: '100%',
    maxWidth: 480,
  },
  resultCardDesktop: {
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: 40,
  },
  resultIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center' },
  resultTrophy: { fontSize: 46 },
  resultTitle: { ...typography.extraBold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' },
  resultScore: { ...typography.bold, fontSize: 16, color: colors.textSecondary },
  starsRow: { flexDirection: 'row', gap: 6 },
  resultXP: { ...typography.bold, fontSize: 14, color: colors.primary },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 30,
    marginTop: 8,
  },
  backButtonText: { ...typography.bold, color: colors.surface, fontSize: 15 },

  /* ── Desktop quiz ── */
  desktopRoot: { flex: 1, backgroundColor: colors.background },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: { ...typography.bold, fontSize: 13, color: colors.primary },
  webHeaderTitle: { ...typography.extraBold, fontSize: 18, color: colors.textPrimary, flex: 1 },
  webHeaderProgress: { ...typography.bold, fontSize: 14, color: colors.textSecondary },

  desktopContent: {
    padding: 40,
    alignItems: 'center',
    flexGrow: 1,
  },
  desktopQuizCard: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 36,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    gap: 20,
  },
  progressBarDesktop: { height: 10, backgroundColor: colors.borderLight, borderRadius: 30, overflow: 'hidden', marginBottom: 6 },
  progressFillDesktop: { height: '100%', backgroundColor: colors.primary, borderRadius: 30 },
  progressLabel: { ...typography.bold, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
  questionDesktop: { ...typography.extraBold, fontSize: 20, color: colors.textPrimary, lineHeight: 30, textAlign: 'center' },
  optionsGrid: { gap: 10 },
  optionDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  optionCorrect: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14,
    borderWidth: 2, borderColor: colors.success, backgroundColor: '#dcfce7',
  },
  optionWrong: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14,
    borderWidth: 2, borderColor: colors.error, backgroundColor: '#fee2e2',
  },
  optionLetter: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceVariant,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  optionLetterCorrect: { backgroundColor: colors.success },
  optionLetterWrong: { backgroundColor: colors.error },
  optionLetterText: { ...typography.extraBold, fontSize: 14, color: colors.textPrimary },
  optionTextDesktop: { ...typography.bold, fontSize: 15, color: colors.textPrimary, flex: 1 },
  feedbackBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  feedbackCorrect: { backgroundColor: '#dcfce7', borderColor: colors.success },
  feedbackWrong: { backgroundColor: '#fee2e2', borderColor: colors.error },
  feedbackText: { ...typography.bold, fontSize: 14, color: colors.textPrimary },
  explanationBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#eef3ff',
    borderRadius: 14,
    alignItems: 'flex-start',
  },
  explanationText: { ...typography.regular, fontSize: 14, color: colors.textPrimary, flex: 1, lineHeight: 22 },
});
