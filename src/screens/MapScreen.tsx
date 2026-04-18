import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { RootStackParamList } from '../types/navigation';

export default function MapScreen() {
  const worlds = useGameStore((state) => state.worlds);
  const updateWorldName = useGameStore((state) => state.updateWorldName);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

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
            onPress: (newName: string | undefined) => {
              if (newName && newName.trim()) updateWorldName(world.id, newName.trim());
            }
          }
        ],
        'plain-text',
        world.name
      );
    }
  };

  const renderWorldCard = ({ item: world }: { item: typeof worlds[0] }) => {
    const totalLevels = world.levels.length;
    const completedLevels = world.levels.filter(l => l.status === 'completed').length;
    const progress = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;

    return (
      <TouchableOpacity
        style={styles.worldCard}
        onPress={() => navigation.navigate('World', { worldId: world.id })}
        activeOpacity={0.7}
      >
        <View style={styles.worldIcon}>
          <MaterialIcons name={world.icon as any} size={48} color={colors.primary} />
        </View>
        
        <View style={styles.worldInfo}>
          <View style={styles.worldHeader}>
            <Text style={styles.worldName}>{world.name}</Text>
            <TouchableOpacity onPress={() => handleEditWorldName(world)} style={styles.editButton}>
              <MaterialIcons name="edit" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.worldDescription}>{world.description}</Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {completedLevels}/{totalLevels} niveles
            </Text>
          </View>
        </View>
        
        <MaterialIcons name="chevron-right" size={28} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={worlds}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderWorldCard}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.background, flexGrow: 1 },
  worldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  worldIcon: { marginRight: 16 },
  worldInfo: { flex: 1 },
  worldHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  worldName: { ...typography.bold, fontSize: 18, color: colors.textPrimary, flex: 1 },
  editButton: { padding: 4 },
  worldDescription: { ...typography.body, color: colors.textSecondary, marginBottom: 8, fontSize: 14 },
  progressContainer: { marginTop: 4 },
  progressBarBackground: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  progressText: { ...typography.caption, color: colors.textSecondary, marginTop: 4, fontSize: 12 },
});