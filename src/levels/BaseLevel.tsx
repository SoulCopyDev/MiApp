import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { RootStackParamList } from '../types/navigation';

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

type NavigationProp = StackNavigationProp<RootStackParamList, 'GameLevel'>;

export default function BaseLevel({ worldId, levelId, levelName, questions }: BaseLevelProps) {
  const navigation = useNavigation<NavigationProp>();
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const totalQuestions = questions.length;

  const handleAnswer = (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
    const isCorrect = optionIndex === questions[currentIndex].correct;
    if (isCorrect) {
      setScore(score + 1);
      setFeedback('✅ ¡Correcto!');
    } else {
      setFeedback(`❌ Incorrecto. La respuesta correcta es: ${questions[currentIndex].options[questions[currentIndex].correct]}`);
    }

    setTimeout(() => {
      if (currentIndex + 1 < totalQuestions) {
        setCurrentIndex(currentIndex + 1);
        setSelectedOption(null);
        setFeedback(null);
      } else {
        const starsEarned = Math.floor(((score + (isCorrect ? 1 : 0)) / totalQuestions) * 3);
        const xpEarned = 50 + starsEarned * 20;
        completeLevel(worldId, levelId, starsEarned, xpEarned);
        setShowResult(true);
      }
    }, 1500);
  };

  if (showResult) {
    const finalStars = Math.floor((score / totalQuestions) * 3);
    return (
      <View style={styles.container}>
        <Text style={styles.title}>¡{levelName} completado!</Text>
        <Text style={styles.score}>Puntuación: {score} / {totalQuestions}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3].map(s => (
            <Text key={s} style={{ fontSize: 40, color: s <= finalStars ? colors.accent : colors.borderLight }}>★</Text>
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Volver al mundo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const current = questions[currentIndex];
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{levelName}</Text>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Pregunta {currentIndex + 1} de {totalQuestions}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIndex + 1) / totalQuestions) * 100}%` }]} />
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
  score: { ...typography.heading3, color: colors.textPrimary, marginVertical: 20 },
  starsRow: { flexDirection: 'row', marginBottom: 30 },
  button: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  buttonText: { ...typography.bold, color: colors.surface, fontSize: 16 },
});