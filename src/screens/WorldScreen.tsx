import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useGameStore, coordsToGlobalN } from '../store/gameStore';
import { colors, typography } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';

export default function WorldScreen() {
  const { worldId: worldIdParam } = useLocalSearchParams<{ worldId: string }>();
  const worldId  = Number(worldIdParam);
  const worlds   = useGameStore(s => s.worlds);
  const devMode  = useGameStore(s => s.devMode);
  const updateLevelName = useGameStore(s => s.updateLevelName);

  const breakpoint   = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && breakpoint !== 'mobile';

  const world = worlds.find(w => w.id === worldId);

  if (!world) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Mundo no encontrado</Text>
      </View>
    );
  }

  const isAccessible = (status: string) => devMode || status !== 'locked';

  const handleEditLevelName = (level: typeof world.levels[0]) => {
    if (Platform.OS === 'web') {
      const newName = window.prompt('Nuevo nombre del nivel:', level.name);
      if (newName?.trim()) updateLevelName(world.id, level.id, newName.trim());
    } else {
      Alert.prompt(
        'Editar nombre del nivel',
        `Nuevo nombre para ${level.name}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Guardar',
            onPress: (n: string | undefined) => {
              if (n?.trim()) updateLevelName(world.id, level.id, n.trim());
            },
          },
        ],
        'plain-text',
        level.name
      );
    }
  };

  const renderStars = (stars: number) => (
    <View style={styles.starsRow}>
      {[0, 1, 2].map(i => (
        <MaterialIcons key={i} name="star" size={14} color={i < stars ? colors.accent : colors.borderLight} />
      ))}
    </View>
  );

  /* ─── Desktop: grid de tarjetas ─── */
  if (isWebDesktop) {
    const completedCount = world.levels.filter(l => l.status === 'completed').length;
    const totalCount     = world.levels.length;
    const progressPct    = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.desktopScroll}>
        {/* Web header con back button */}
        <View style={styles.desktopHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backBtnText}>Mapa</Text>
          </TouchableOpacity>

          <View style={styles.desktopWorldInfo}>
            <View style={styles.desktopWorldIcon}>
              <MaterialIcons name={world.icon as any} size={52} color={colors.primary} />
            </View>
            <View style={styles.desktopWorldText}>
              <Text style={styles.desktopWorldTitle}>{world.name}</Text>
              <Text style={styles.desktopWorldDesc}>{world.description}</Text>
              {devMode && (
                <View style={styles.devBanner}>
                  <MaterialIcons name="engineering" size={16} color={colors.surface} />
                  <Text style={styles.devBannerText}>Modo Desarrollo activo</Text>
                </View>
              )}
            </View>
            <View style={styles.desktopProgressBox}>
              <Text style={styles.desktopProgressPct}>{Math.round(progressPct)}%</Text>
              <View style={styles.desktopProgressBar}>
                <View style={[styles.desktopProgressFill, { width: `${progressPct}%` as any }]} />
              </View>
              <Text style={styles.desktopProgressLabel}>{completedCount}/{totalCount} niveles</Text>
            </View>
          </View>
        </View>

        {/* Grid de niveles */}
        <View style={styles.levelGrid}>
          {world.levels.map((level) => {
            const accessible = isAccessible(level.status);
            const isCompleted = level.status === 'completed' && !devMode;
            const isCurrent   = level.status === 'current' && !devMode;
            const isLocked    = !accessible;
            const isDevLocked = devMode && level.status === 'locked';

            return (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.levelCard,
                  isCompleted && styles.levelCardCompleted,
                  isCurrent   && styles.levelCardCurrent,
                  isLocked    && styles.levelCardLocked,
                  isDevLocked && styles.levelCardDevLocked,
                ]}
                activeOpacity={accessible ? 0.75 : 1}
                onPress={() => {
                  if (!accessible) {
                    Alert.alert('🔒 Bloqueado', 'Completa el nivel anterior para desbloquear');
                  } else if (level.id === 8) {
                    router.push('/eval/final');
                  } else if (level.id === 7) {
                    router.push(`/eval/${world.id}`);
                  } else {
                    router.push(`/level/${coordsToGlobalN(world.id, level.id)}`);
                  }
                }}
              >
                {/* Número */}
                <View style={[styles.levelNumber, isCompleted && styles.levelNumberDone, isCurrent && styles.levelNumberCurrent]}>
                  <Text style={[styles.levelNumberText, (isCompleted || isCurrent) && styles.levelNumberTextLight]}>
                    {level.id === 8 ? 'EF' : level.id === 7 ? 'E' : `N${coordsToGlobalN(world.id, level.id)}`}
                  </Text>
                </View>

                {/* Icono */}
                <View style={[styles.levelCardIcon, isCompleted && styles.levelCardIconDone]}>
                  {isLocked ? (
                    <MaterialIcons name="lock" size={28} color={colors.textDisabled} />
                  ) : isDevLocked ? (
                    <MaterialIcons name="lock-open" size={28} color={colors.accent} />
                  ) : (
                    <MaterialIcons
                      name={level.icon as any}
                      size={28}
                      color={isCompleted ? colors.surface : colors.primaryDark}
                    />
                  )}
                </View>

                {/* Info */}
                <Text style={[styles.levelCardName, isLocked && styles.levelCardNameLocked]} numberOfLines={2}>
                  {level.name}{isDevLocked ? ' 🔓' : ''}
                </Text>

                {/* Stars o estado */}
                {isCompleted && renderStars(level.stars)}
                {isCurrent && (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>JUGAR</Text>
                  </View>
                )}
                {isLocked && (
                  <Text style={styles.lockedLabel}>Bloqueado</Text>
                )}

                {/* Edit button */}
                <TouchableOpacity
                  style={styles.levelEditBtn}
                  onPress={e => { e.stopPropagation?.(); handleEditLevelName(level); }}
                >
                  <MaterialIcons name="edit" size={13} color={colors.textDisabled} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  /* ─── Mobile: path zigzag (sin cambios) ─── */
  const renderLevel = ({ item: level, index }: { item: typeof world.levels[0]; index: number }) => {
    const isEven    = index % 2 === 0;
    const translateX = isEven ? 0 : 40;
    const isCurrent  = level.status === 'current' && !devMode;
    const nodeSize   = isCurrent ? 96 : 80;
    const accessible = isAccessible(level.status);

    return (
      <View style={[styles.levelWrapper, { transform: [{ translateX }], marginBottom: 40 }]}>
        {index < world.levels.length - 1 && (
          <View style={[styles.connectorLine, isEven ? styles.connectorRight : styles.connectorLeft]} />
        )}
        <TouchableOpacity
          style={[
            styles.levelNode,
            { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
            level.status === 'completed' && !devMode && styles.levelCompleted,
            level.status === 'current'   && !devMode && styles.levelCurrent,
            !accessible                             && styles.levelLocked,
            devMode && level.status === 'locked'    && styles.devUnlocked,
          ]}
          activeOpacity={accessible ? 0.5 : 0.7}
          onPress={() => {
            if (!accessible) Alert.alert('🔒 Bloqueado', 'Completa el nivel anterior para desbloquear');
            else if (level.id === 8) router.push('/eval/final');
            else if (level.id === 7) router.push(`/eval/${world.id}`);
            else router.push(`/level/${coordsToGlobalN(world.id, level.id)}`);
          }}
        >
          {!accessible ? (
            <MaterialIcons name="lock" size={32} color={colors.textDisabled} />
          ) : level.status === 'completed' && !devMode ? (
            <MaterialIcons name={level.icon as any} size={40} color={colors.surface} />
          ) : devMode && level.status === 'locked' ? (
            <MaterialIcons name="lock-open" size={36} color={colors.accent} />
          ) : (
            <MaterialIcons name={level.icon as any} size={44} color={colors.primaryDark} />
          )}
        </TouchableOpacity>
        {isCurrent && (
          <View style={styles.playNowBadge}>
            <Text style={styles.playNowText}>JUGAR</Text>
          </View>
        )}
        {level.status === 'completed' && renderStars(level.stars)}
        <View style={styles.levelNameContainer}>
          <Text style={styles.levelName}>{level.name}{devMode && level.status === 'locked' ? ' 🔓' : ''}</Text>
          <TouchableOpacity onPress={() => handleEditLevelName(level)} style={styles.editButton}>
            <MaterialIcons name="edit" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={world.levels}
      keyExtractor={item => `${worldId}-${item.id}`}
      renderItem={renderLevel}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <MaterialIcons name={world.icon as any} size={64} color={colors.primary} />
          <Text style={styles.worldTitle}>{world.name}</Text>
          <Text style={styles.worldDescription}>{world.description}</Text>
          {devMode && (
            <View style={styles.devBanner}>
              <MaterialIcons name="engineering" size={18} color={colors.surface} />
              <Text style={styles.devBannerText}>Modo Desarrollo - Niveles desbloqueados</Text>
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, color: colors.textPrimary },

  /* ── Desktop ── */
  desktopScroll: { paddingBottom: 60 },
  desktopHeader: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: { ...typography.bold, fontSize: 14, color: colors.primary },
  desktopWorldInfo: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  desktopWorldIcon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 2,
    borderColor: colors.border,
  },
  desktopWorldText: { flex: 1 },
  desktopWorldTitle: { ...typography.extraBold, fontSize: 26, color: colors.textPrimary },
  desktopWorldDesc: { ...typography.regular, fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  desktopProgressBox: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 130,
  },
  desktopProgressPct: { ...typography.extraBold, fontSize: 26, color: colors.primary },
  desktopProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 6,
  },
  desktopProgressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 10 },
  desktopProgressLabel: { ...typography.bold, fontSize: 11, color: colors.textSecondary },

  /* Level grid */
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 16,
  },
  levelCard: {
    width: 168,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  levelCardCompleted: { backgroundColor: colors.success + '12', borderColor: colors.success + '60' },
  levelCardCurrent: { borderColor: colors.primary, borderWidth: 3, shadowOpacity: 0.15 },
  levelCardLocked: { opacity: 0.5, backgroundColor: colors.surfaceVariant },
  levelCardDevLocked: { borderColor: colors.accent, borderStyle: 'dashed' },
  levelNumber: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumberDone: { backgroundColor: colors.success },
  levelNumberCurrent: { backgroundColor: colors.primary },
  levelNumberText: { ...typography.bold, fontSize: 11, color: colors.textSecondary },
  levelNumberTextLight: { color: 'white' },
  levelCardIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  levelCardIconDone: { backgroundColor: colors.success },
  levelCardName: { ...typography.bold, fontSize: 13, color: colors.textPrimary, textAlign: 'center', lineHeight: 18 },
  levelCardNameLocked: { color: colors.textDisabled },
  starsRow: { flexDirection: 'row', gap: 2 },
  currentPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  currentPillText: { ...typography.bold, fontSize: 11, color: 'white', letterSpacing: 0.5 },
  lockedLabel: { ...typography.regular, fontSize: 11, color: colors.textDisabled },
  levelEditBtn: { position: 'absolute', bottom: 8, right: 8, padding: 4 },

  /* ── Mobile (sin cambios) ── */
  scrollContent: { alignItems: 'center', paddingTop: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30, paddingHorizontal: 20 },
  worldTitle: { ...typography.heading1, color: colors.textPrimary, marginTop: 8, textAlign: 'center' },
  worldDescription: { ...typography.body, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  levelWrapper: { alignItems: 'center', width: '100%', position: 'relative' },
  levelNode: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  levelCompleted: { backgroundColor: colors.success, borderColor: colors.success },
  levelCurrent: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 4, shadowOpacity: 0.4 },
  levelLocked: { backgroundColor: colors.borderLight, opacity: 0.6, borderColor: colors.borderLight },
  devUnlocked: { backgroundColor: colors.surfaceVariant, borderColor: colors.accent, borderWidth: 2, borderStyle: 'dashed' },
  levelNameContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  levelName: { ...typography.bold, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  editButton: { padding: 2 },
  playNowBadge: {
    position: 'absolute', top: -20, right: -20, backgroundColor: colors.accent,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 2, borderColor: colors.surface,
  },
  playNowText: { ...typography.bold, fontSize: 10, color: colors.accentDark },
  connectorLine: { position: 'absolute', width: 60, height: 2, backgroundColor: colors.borderLight, top: 40, zIndex: -1 },
  connectorRight: { right: -70, transform: [{ rotate: '15deg' }] },
  connectorLeft: { left: -70, transform: [{ rotate: '-15deg' }] },
  devBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16, marginTop: 12, gap: 8 },
  devBannerText: { ...typography.bold, fontSize: 13, color: colors.surface },
});
