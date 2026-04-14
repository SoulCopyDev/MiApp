import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

export default function BadgesScreen() {
  const badges = useGameStore((state) => state.badges);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const progressPercent = (unlockedCount / badges.length) * 100;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressTitle}>Colección de trofeos</Text>
            <Text style={styles.progressSubtitle}>{progressPercent}% Completado</Text>
          </View>
          <View style={styles.trophyIcon}>
            <MaterialIcons name="emoji-events" size={40} color={colors.accent} />
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressMessage}>
          ¡Solo {badges.length - unlockedCount} insignias más para el Rango Maestro!
        </Text>
      </View>

      <View style={styles.grid}>
        {badges.map((badge) => (
          <View
            key={badge.id}
            style={[styles.badgeCard, badge.unlocked ? styles.unlockedCard : styles.lockedCard]}
          >
            <View style={[styles.badgeIconContainer, { backgroundColor: badge.bgColor }]}>
              <MaterialIcons name={badge.icon as any} size={48} color={badge.color} />
              {!badge.unlocked && (
                <View style={styles.lockOverlay}>
                  <MaterialIcons name="lock" size={24} color={colors.surface} />
                </View>
              )}
              {badge.unlocked && (
                <View style={styles.checkOverlay}>
                  <MaterialIcons name="check-circle" size={20} color={colors.accent} />
                </View>
              )}
            </View>
            <Text style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}>
              {badge.name}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.motivationalBanner}>
        <Text style={styles.motivationalTitle}>¡Sigue así, Explorador!</Text>
        <Text style={styles.motivationalText}>Cada lección te acerca a un nuevo trofeo.</Text>
        <TouchableOpacity
          style={styles.nextLessonButton}
          onPress={() => Alert.alert('¡A la siguiente lección!')}
        >
          <Text style={styles.nextLessonText}>Siguiente lección</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressSection: {
    backgroundColor: colors.surface,
    margin: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  progressTitle: { ...typography.extraBold, fontSize: 22, color: colors.primaryDark },
  progressSubtitle: { ...typography.bold, fontSize: 16, color: colors.textSecondary },
  trophyIcon: { backgroundColor: '#fed01b20', padding: 12, borderRadius: 40, transform: [{ rotate: '12deg' }] },
  progressBarContainer: { height: 24, backgroundColor: colors.borderLight, borderRadius: 30, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 30 },
  progressMessage: { ...typography.bold, fontSize: 12, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, gap: 16 },
  badgeCard: { width: '30%', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 20, borderWidth: 4, marginBottom: 8 },
  unlockedCard: { borderColor: '#57a3ff20' },
  lockedCard: { borderColor: colors.border, opacity: 0.6 },
  badgeIconContainer: { width: 80, height: 80, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8, position: 'relative' },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000080', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  checkOverlay: { position: 'absolute', bottom: -8, right: -8, backgroundColor: colors.surface, borderRadius: 12, padding: 2 },
  badgeName: { ...typography.bold, fontSize: 12, textAlign: 'center', color: colors.primaryDark },
  badgeNameLocked: { color: colors.textDisabled },
  motivationalBanner: {
    backgroundColor: colors.primary,
    margin: 16,
    marginTop: 24,
    marginBottom: 32,
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    transform: [{ rotate: '-1deg' }],
  },
  motivationalTitle: { ...typography.extraBold, fontSize: 20, color: colors.surface, marginBottom: 4 },
  motivationalText: { ...typography.bold, fontSize: 12, color: '#eef3ff', marginBottom: 16 },
  nextLessonButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 40,
    shadowColor: colors.accentDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 4,
  },
  nextLessonText: { ...typography.extraBold, fontSize: 14, color: colors.accentDark, letterSpacing: 1 },
});