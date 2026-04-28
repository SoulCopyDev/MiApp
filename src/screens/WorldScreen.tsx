import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { RootStackParamList } from '../types/navigation';

type WorldScreenRouteProp = RouteProp<RootStackParamList, 'World'>;
type WorldScreenNavigationProp = StackNavigationProp<RootStackParamList, 'World'>;

export default function WorldScreen() {
  const route = useRoute<WorldScreenRouteProp>();
  const navigation = useNavigation<WorldScreenNavigationProp>();
  const { worldId } = route.params;

  const worlds = useGameStore((state) => state.worlds);
  const devMode = useGameStore((state) => state.devMode); // 👈 Leemos el modo dev
  const updateLevelName = useGameStore((state) => state.updateLevelName);

  const world = worlds.find(w => w.id === worldId);

  if (!world) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Mundo no encontrado</Text>
      </View>
    );
  }

  const renderStars = (stars: number) => (
    <View style={styles.starsContainer}>
      {[0, 1, 2].map(i => (
        <MaterialIcons
          key={i}
          name="star"
          size={14}
          color={i < stars ? colors.accent : colors.borderLight}
        />
      ))}
    </View>
  );

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
            onPress: (newName: string | undefined) => {
              if (newName && newName.trim()) updateLevelName(world.id, level.id, newName.trim());
            }
          }
        ],
        'plain-text',
        level.name
      );
    }
  };

  // 👇 Función para determinar si un nivel es accesible (devMode anula bloqueos)
  const isAccessible = (status: string) => {
    if (devMode) return true; // En modo desarrollo, todo está desbloqueado
    return status !== 'locked';
  };

  const renderLevel = ({ item: level, index }: { item: typeof world.levels[0]; index: number }) => {
    const isEven = index % 2 === 0;
    const translateX = isEven ? 0 : 40;
    const isCurrent = level.status === 'current' && !devMode; // En devMode no resaltamos "current" como obligatorio
    const nodeSize = isCurrent ? 96 : 80;
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
            level.status === 'current' && !devMode && styles.levelCurrent,
            !accessible && styles.levelLocked,
            // En devMode, estilo especial para niveles bloqueados (opcional)
            devMode && level.status === 'locked' && styles.devUnlocked,
          ]}
          activeOpacity={accessible ? 0.5 : 0.7}
          onPress={() => {
            if (!accessible) {
              Alert.alert('🔒 Bloqueado', 'Completa el nivel anterior para desbloquear');
            } else {
              navigation.navigate('GameLevel', { worldId: world.id, levelId: level.id });
            }
          }}
        >
          {!accessible ? (
            <MaterialIcons name="lock" size={32} color={colors.textDisabled} />
          ) : level.status === 'completed' && !devMode ? (
            <MaterialIcons name={level.icon as any} size={40} color={colors.surface} />
          ) : devMode && level.status === 'locked' ? (
            <MaterialIcons name="lock-open" size={36} color={colors.accent} /> // Icono de desarrollador
          ) : (
            <MaterialIcons name={level.icon as any} size={44} color={colors.primaryDark} />
          )}
        </TouchableOpacity>

        {/* Solo mostramos la chapa "JUGAR" en el nivel actual (fuera de devMode) */}
        {isCurrent && (
          <View style={styles.playNowBadge}>
            <Text style={styles.playNowText}>JUGAR</Text>
          </View>
        )}

        {level.status === 'completed' && renderStars(level.stars)}

        <View style={styles.levelNameContainer}>
          <Text style={styles.levelName}>
            {level.name}
            {devMode && level.status === 'locked' ? ' 🔓' : ''}
          </Text>
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
      keyExtractor={(item) => `${worldId}-${item.id}`}
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
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, color: colors.textPrimary },
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
  devUnlocked: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.accent,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  starsContainer: { flexDirection: 'row', marginTop: 8, gap: 4 },
  levelNameContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  levelName: { ...typography.bold, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  editButton: { padding: 2 },
  playNowBadge: {
    position: 'absolute', top: -20, right: -20, backgroundColor: colors.accent,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 2, borderColor: colors.surface,
  },
  playNowText: { ...typography.bold, fontSize: 10, color: colors.accentDark },
  connectorLine: {
    position: 'absolute', width: 60, height: 2, backgroundColor: colors.borderLight,
    top: 40, zIndex: -1,
  },
  connectorRight: { right: -70, transform: [{ rotate: '15deg' }] },
  connectorLeft: { left: -70, transform: [{ rotate: '-15deg' }] },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  devBannerText: {
    ...typography.bold,
    fontSize: 13,
    color: colors.surface,
  },
});