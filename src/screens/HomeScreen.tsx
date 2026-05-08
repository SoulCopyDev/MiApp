import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { HomeScreenProps } from '../types/navigation';
import { getRankInfo } from '../utils/rankSystem';
import { getMissionProgress } from '../utils/dailyMission';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { profile, playerLevel, currentXP, maxXP, streak, totalStars, worlds } = useGameStore();
  const dailyMission  = useGameStore(s => s.dailyMission);
  const updateStreak        = useGameStore(s => s.updateStreak);
  const refreshDailyMission = useGameStore(s => s.refreshDailyMission);

  const porcentajeXP = maxXP > 0 ? (currentXP / maxXP) * 100 : 0;
  const stackNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Rango calculado dinámicamente desde totalStars. Se recalcula si totalStars sube o baja.
  const rankInfo = useMemo(() => getRankInfo(totalStars), [totalStars]);

  // Anima la barra de rango suavemente cada vez que el progreso cambia
  const animRankProgress = useRef(new Animated.Value(rankInfo.progress)).current;
  useEffect(() => {
    Animated.timing(animRankProgress, {
      toValue: rankInfo.progress,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [rankInfo.progress]);

  // Actualiza racha y misión diaria cada vez que el usuario vuelve a esta pantalla
  useFocusEffect(
    useCallback(() => {
      updateStreak();
      refreshDailyMission();
    }, [updateStreak, refreshDailyMission])
  );

  // Detecta el nivel al que debe ir el botón JUGAR según el progreso del jugador.
  // Busca el primer nivel con status 'current' (ya sea en progreso o desbloqueado).
  // Si todos los niveles están completados, apunta al último nivel del último mundo.
  const resumeTarget = useMemo(() => {
    for (const world of worlds) {
      const level = world.levels.find(l => l.status === 'current');
      if (level) {
        return { worldId: world.id, levelId: level.id, worldName: world.name, levelName: level.name };
      }
    }
    const lastWorld = worlds[worlds.length - 1];
    const lastLevel = lastWorld.levels[lastWorld.levels.length - 1];
    return { worldId: lastWorld.id, levelId: lastLevel.id, worldName: lastWorld.name, levelName: lastLevel.name };
  }, [worlds]);

  // Valores derivados de la misión diaria
  const missionProgress = useMemo(
    () => (dailyMission ? getMissionProgress(dailyMission, worlds) : 0),
    [dailyMission, worlds]
  );

  const missionConfig = useMemo(() => {
    const status = dailyMission?.status ?? 'pending';
    if (status === 'completed') return { bg: '#dcfce7', accent: '#16a34a', border: '#16a34a25', icon: 'check-circle' as const, label: 'COMPLETADA' };
    if (status === 'in_progress') return { bg: '#fff4ed', accent: '#f97316', border: '#f9731625', icon: 'flag' as const, label: 'EN PROGRESO' };
    return { bg: '#eef3ff', accent: colors.primary, border: '#57a3ff25', icon: 'track-changes' as const, label: 'PENDIENTE' };
  }, [dailyMission?.status]);

  const handlePlay = () => {
    stackNavigation.navigate('GameLevel', {
      worldId: resumeTarget.worldId,
      levelId: resumeTarget.levelId,
    });
  };

  const handlePlayMission = () => {
    if (!dailyMission) return;
    // Si el nivel objetivo está desbloqueado o es el actual, ir directo; si no, ir al nivel actual
    const targetWorld = worlds.find(w => w.id === dailyMission.targetWorldId);
    const targetLevel = targetWorld?.levels.find(l => l.id === dailyMission.targetLevelId);
    const canGoDirectly = targetLevel?.status === 'current' || targetLevel?.status === 'completed';
    stackNavigation.navigate('GameLevel', {
      worldId: canGoDirectly ? dailyMission.targetWorldId : resumeTarget.worldId,
      levelId: canGoDirectly ? dailyMission.targetLevelId : resumeTarget.levelId,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Barra superior */}
      <View style={styles.topBar}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
          </View>
          <Text style={styles.appTitle}>AI Explorer</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <MaterialIcons name="whatshot" size={20} color={colors.warning} />
            <Text style={styles.statText}>{streak} 🔥</Text>
          </View>
          <View style={styles.statBadge}>
            <MaterialIcons name="star" size={20} color={colors.accent} />
            <Text style={styles.statText}>{totalStars} ⭐</Text>
          </View>
        </View>
      </View>

      {/* Tarjeta de perfil */}
      <View style={[styles.profileCard, { borderColor: rankInfo.tier.color + '55' }]}>
        <View style={styles.robotContainer}>
          <View style={styles.robotImage}>
            <Text style={styles.robotEmoji}>{profile.avatarEmoji}</Text>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: rankInfo.tier.color }]}>
            <Text style={styles.levelText}>LVL {playerLevel}</Text>
          </View>
        </View>

        <Text style={styles.userName}>{profile.name}</Text>

        {/* Píldora de rango */}
        <View style={[styles.rankPill, { backgroundColor: rankInfo.tier.bgColor }]}>
          <MaterialIcons name={rankInfo.tier.icon as any} size={15} color={rankInfo.tier.color} />
          <Text style={[styles.rankPillLabel, { color: rankInfo.tier.color }]}>
            Rango {rankInfo.tier.level} — {rankInfo.tier.name}
          </Text>
        </View>

        {/* Barra de progreso de rango (animada) */}
        <View style={styles.rankBarBg}>
          <Animated.View
            style={[
              styles.rankBarFill,
              {
                width: animRankProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: rankInfo.tier.color,
              },
            ]}
          />
        </View>

        {/* Info de estrellas y siguiente rango */}
        <Text style={styles.rankSubtext}>
          {rankInfo.isMax
            ? `⭐ ${totalStars} estrellas · ¡Rango máximo!`
            : `⭐ ${totalStars} · Faltan ${rankInfo.starsNeeded} para ${rankInfo.nextTierName}`}
        </Text>

        {/* Barra de XP (indicador secundario) */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressFill, { width: `${porcentajeXP}%` }]} />
        </View>
        <Text style={styles.xpText}>
          {currentXP} / {maxXP} XP · NIVEL {playerLevel + 1}
        </Text>
      </View>

      {/* Misión diaria */}
      {dailyMission ? (
        <View style={[styles.missionCard, { backgroundColor: missionConfig.bg, borderColor: missionConfig.border }]}>
          {/* Cabecera */}
          <View style={styles.missionHeader}>
            <View style={[styles.missionIconBg, { backgroundColor: missionConfig.accent + '20' }]}>
              <MaterialIcons name={missionConfig.icon} size={24} color={missionConfig.accent} />
            </View>
            <Text style={[styles.missionTitle, { color: missionConfig.accent }]}>Misión del día</Text>
            <View style={[styles.missionStatusPill, { backgroundColor: missionConfig.accent + '20' }]}>
              <Text style={[styles.missionStatusText, { color: missionConfig.accent }]}>{missionConfig.label}</Text>
            </View>
          </View>

          {/* Objetivo */}
          <Text style={styles.missionObjectiveLabel}>Objetivo: completa este nivel</Text>
          <Text style={styles.missionLevelName} numberOfLines={2}>{dailyMission.targetLevelName}</Text>
          <Text style={styles.missionWorldName}>{dailyMission.targetWorldName}</Text>

          {/* Barra de progreso */}
          <View style={styles.missionProgressBg}>
            <View style={[styles.missionProgressFill, { width: `${Math.round(missionProgress * 100)}%`, backgroundColor: missionConfig.accent }]} />
          </View>
          <View style={styles.missionProgressRow}>
            <Text style={[styles.missionProgressPct, { color: missionConfig.accent }]}>
              {Math.round(missionProgress * 100)}% completado
            </Text>
            <Text style={styles.missionRewardText}>{dailyMission.reward.label}</Text>
          </View>

          {/* CTA */}
          {dailyMission.status === 'completed' ? (
            <View style={[styles.missionCompletedBanner, { backgroundColor: missionConfig.accent + '18' }]}>
              <MaterialIcons name="workspace-premium" size={18} color={missionConfig.accent} />
              <Text style={[styles.missionCompletedText, { color: missionConfig.accent }]}>
                ¡Recompensa obtenida! {dailyMission.reward.label}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.missionCTA, { backgroundColor: missionConfig.accent }]}
              activeOpacity={0.8}
              onPress={handlePlayMission}
            >
              <Text style={styles.missionCTAText}>IR AL NIVEL</Text>
              <MaterialIcons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Botón PLAY */}
      <View style={styles.playSection}>
        <TouchableOpacity
          style={styles.playButton}
          activeOpacity={0.7}
          onPress={handlePlay}
        >
          <MaterialIcons name="play-arrow" size={80} color={colors.accentDark} />
          <Text style={styles.playText}>JUGAR</Text>
        </TouchableOpacity>
        <Text style={styles.resumeWorld}>{resumeTarget.worldName}</Text>
        <Text style={styles.resumeLevel} numberOfLines={1}>{resumeTarget.levelName}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 100 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffffcc',
    borderBottomWidth: 4,
    borderBottomColor: colors.surfaceVariant,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primaryLight, backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 24 },
  appTitle: { ...typography.extraBold, fontSize: 20, color: colors.primary },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBadge: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 30,
    alignItems: 'center',
    gap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statText: { ...typography.bold, fontSize: 14, color: colors.primary },
  profileCard: {
    backgroundColor: colors.surface,
    margin: 20,
    padding: 20,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  robotContainer: { position: 'relative', marginBottom: 12 },
  robotImage: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surfaceVariant, borderWidth: 6, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  robotEmoji: { fontSize: 68 },
  levelBadge: { position: 'absolute', bottom: -8, right: -8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 30, borderWidth: 2, borderColor: 'white' },
  levelText: { ...typography.bold, color: 'white', fontSize: 12 },
  userName: { ...typography.extraBold, fontSize: 22, color: colors.textPrimary, marginTop: 8 },
  // -- Rango --
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 30, marginTop: 10, marginBottom: 14 },
  rankPillLabel: { ...typography.bold, fontSize: 13 },
  rankBarBg: { width: '100%', height: 18, backgroundColor: colors.borderLight, borderRadius: 30, overflow: 'hidden' },
  rankBarFill: { height: '100%', borderRadius: 30 },
  rankSubtext: { ...typography.bold, fontSize: 12, color: colors.textSecondary, marginTop: 6, marginBottom: 14 },
  // -- XP (indicador secundario) --
  progressBarContainer: { width: '100%', height: 12, backgroundColor: colors.borderLight, borderRadius: 30, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 30 },
  xpText: { ...typography.bold, fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  missionCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 18,
    borderRadius: 24,
    borderWidth: 3,
    gap: 8,
  },
  missionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  missionIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  missionTitle: { ...typography.extraBold, fontSize: 15, flex: 1 },
  missionStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  missionStatusText: { ...typography.bold, fontSize: 10, letterSpacing: 0.5 },
  missionObjectiveLabel: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  missionLevelName: { ...typography.extraBold, fontSize: 15, color: colors.textPrimary, lineHeight: 20 },
  missionWorldName: { ...typography.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  missionProgressBg: { width: '100%', height: 12, backgroundColor: '#00000012', borderRadius: 30, overflow: 'hidden' },
  missionProgressFill: { height: '100%', borderRadius: 30 },
  missionProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missionProgressPct: { ...typography.bold, fontSize: 12 },
  missionRewardText: { ...typography.bold, fontSize: 12, color: colors.textSecondary },
  missionCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 40, marginTop: 4 },
  missionCTAText: { ...typography.extraBold, fontSize: 14, color: 'white', letterSpacing: 1 },
  missionCompletedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, marginTop: 4 },
  missionCompletedText: { ...typography.bold, fontSize: 13 },
  playButton: {
    backgroundColor: colors.accent,
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#b29100',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
    borderWidth: 6,
    borderColor: 'white',
  },
  playText: { ...typography.extraBold, fontSize: 28, color: colors.accentDark, letterSpacing: 2 },
  playSection: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  resumeWorld: { ...typography.bold, fontSize: 13, color: colors.textSecondary, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
  resumeLevel: { ...typography.bold, fontSize: 15, color: colors.textPrimary, marginTop: 4, maxWidth: 260, textAlign: 'center' },
});