import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';

export default function MapScreen() {
  const worlds          = useGameStore(s => s.worlds);
  const updateWorldName = useGameStore(s => s.updateWorldName);
  const breakpoint      = useBreakpoint();
  const isWebDesktop    = Platform.OS === 'web' && breakpoint !== 'mobile';

  const handleEditWorldName = (world: typeof worlds[0]) => {
    if (Platform.OS === 'web') {
      const newName = window.prompt('Nuevo nombre del mundo:', world.name);
      if (newName?.trim()) updateWorldName(world.id, newName.trim());
    } else {
      Alert.prompt(
        'Editar nombre del mundo',
        `Nuevo nombre para ${world.name}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Guardar',
            onPress: (n: string | undefined) => {
              if (n?.trim()) updateWorldName(world.id, n.trim());
            },
          },
        ],
        'plain-text',
        world.name
      );
    }
  };

  /* ─── Tarjeta de mundo (usada en ambos layouts) ─── */
  const WorldCard = ({ world, desktop }: { world: typeof worlds[0]; desktop?: boolean }) => {
    const totalLevels     = world.levels.length;
    const completedLevels = world.levels.filter(l => l.status === 'completed').length;
    const progress        = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;
    const isComplete      = completedLevels === totalLevels;

    return (
      <TouchableOpacity
        style={[styles.worldCard, desktop && styles.worldCardDesktop]}
        onPress={() => router.push(`/world/${world.id}`)}
        activeOpacity={0.7}
      >
        {/* Icono */}
        <View style={[styles.worldIconWrap, isComplete && styles.worldIconComplete]}>
          <MaterialIcons
            name={world.icon as any}
            size={desktop ? 40 : 48}
            color={isComplete ? colors.surface : colors.primary}
          />
        </View>

        <View style={styles.worldInfo}>
          <View style={styles.worldHeader}>
            <Text style={[styles.worldName, desktop && styles.worldNameDesktop]}>
              {world.name}
            </Text>
            <TouchableOpacity onPress={() => handleEditWorldName(world)} style={styles.editButton}>
              <MaterialIcons name="edit" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            {isComplete && (
              <View style={styles.completePill}>
                <MaterialIcons name="check-circle" size={13} color={colors.success} />
                <Text style={styles.completeText}>Completado</Text>
              </View>
            )}
          </View>

          <Text style={styles.worldDescription} numberOfLines={desktop ? 2 : 3}>
            {world.description}
          </Text>

          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
            </View>
            <Text style={styles.progressText}>
              {completedLevels}/{totalLevels} niveles completados
            </Text>
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={26} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  /* ─── Desktop: grid 2 columnas ─── */
  if (isWebDesktop) {
    const leftCol  = worlds.filter((_, i) => i % 2 === 0);
    const rightCol = worlds.filter((_, i) => i % 2 !== 0);

    return (
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.desktopContent}
      >
        {/* Header */}
        <View style={styles.desktopPageHeader}>
          <View>
            <Text style={styles.desktopPageTitle}>Mapa de mundos</Text>
            <Text style={styles.desktopPageSub}>
              {worlds.filter(w => w.levels.every(l => l.status === 'completed')).length} de {worlds.length} mundos completados
            </Text>
          </View>
          <View style={styles.totalProgressWrap}>
            {(() => {
              const total = worlds.reduce((a, w) => a + w.levels.length, 0);
              const done  = worlds.reduce((a, w) => a + w.levels.filter(l => l.status === 'completed').length, 0);
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <>
                  <Text style={styles.totalProgressPct}>{pct}%</Text>
                  <Text style={styles.totalProgressLabel}>completado</Text>
                </>
              );
            })()}
          </View>
        </View>

        {/* Grid */}
        <View style={styles.desktopGrid}>
          <View style={styles.desktopCol}>
            {leftCol.map(w => <WorldCard key={w.id} world={w} desktop />)}
          </View>
          <View style={styles.desktopCol}>
            {rightCol.map(w => <WorldCard key={w.id} world={w} desktop />)}
          </View>
        </View>
      </ScrollView>
    );
  }

  /* ─── Mobile: lista vertical ─── */
  return (
    <FlatList
      data={worlds}
      keyExtractor={item => item.id.toString()}
      renderItem={({ item }) => <WorldCard world={item} />}
      contentContainerStyle={styles.mobileContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Mobile */
  mobileContent: { padding: 16, backgroundColor: colors.background, flexGrow: 1 },

  /* Desktop */
  desktopContent: { paddingBottom: 60 },
  desktopPageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  desktopPageTitle: { ...typography.extraBold, fontSize: 26, color: colors.textPrimary },
  desktopPageSub: { ...typography.regular, fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  totalProgressWrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  totalProgressPct: { ...typography.extraBold, fontSize: 24, color: 'white' },
  totalProgressLabel: { ...typography.bold, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  desktopGrid: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 20,
    alignItems: 'flex-start',
  },
  desktopCol: { flex: 1, gap: 16 },

  /* World card */
  worldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  worldCardDesktop: {
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
  },
  worldIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  worldIconComplete: { backgroundColor: colors.success },
  worldInfo: { flex: 1 },
  worldHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  worldName: { ...typography.bold, fontSize: 18, color: colors.textPrimary, flex: 1 },
  worldNameDesktop: { fontSize: 16 },
  editButton: { padding: 4 },
  completePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  completeText: { ...typography.bold, fontSize: 11, color: colors.success },
  worldDescription: { ...typography.body, color: colors.textSecondary, marginBottom: 10, fontSize: 13 },
  progressContainer: { gap: 4 },
  progressBarBackground: { height: 7, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  progressText: { ...typography.caption, color: colors.textSecondary, fontSize: 12 },
});
