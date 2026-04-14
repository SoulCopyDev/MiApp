import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { RootStackParamList } from '../types/navigation';

export default function MapScreen() {
  const levels = useGameStore((state) => state.levels);
  const stackNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const renderStars = (stars: number) => {
    const starIcons = [];
    for (let i = 0; i < 3; i++) {
      starIcons.push(
        <MaterialIcons
          key={i}
          name="star"
          size={16}
          color={i < stars ? colors.accent : colors.borderLight}
          style={{ marginHorizontal: 2 }}
        />
      );
    }
    return <View style={styles.starsContainer}>{starIcons}</View>;
  };

  const renderNodeContent = (level: typeof levels[0]) => {
    if (level.status === 'locked') {
      return <MaterialIcons name="lock" size={32} color={colors.textDisabled} />;
    }
    if (level.status === 'completed') {
      return <MaterialIcons name={level.icon as any} size={40} color={colors.surface} />;
    }
    if (level.status === 'current') {
      return <MaterialIcons name={level.icon as any} size={44} color={colors.primaryDark} />;
    }
    return null;
  };

  const getNodeStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return styles.nodeCompleted;
      case 'current':
        return styles.nodeCurrent;
      default:
        return styles.nodeLocked;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.mapWrapper}>
        <View style={styles.nodesContainer}>
          {levels.map((level, index) => {
            const isEven = index % 2 === 0;
            const translateX = isEven ? 0 : 40;
            return (
              <View
                key={level.id}
                style={[styles.nodeWrapper, { transform: [{ translateX }] }]}
              >
                <TouchableOpacity
                  style={[styles.node, getNodeStyle(level.status)]}
                  activeOpacity={level.status === 'locked' ? 0.7 : 0.5}
                  onPress={() => {
                    if (level.status === 'locked') {
                      Alert.alert('🔒 Bloqueado', 'Completa el nivel anterior para desbloquear');
                    } else {
                      // Navegar a la pantalla genérica de nivel pasando el ID
                      stackNavigation.navigate('GameLevel', { levelId: level.id });
                    }
                  }}
                >
                  {renderNodeContent(level)}
                </TouchableOpacity>

                {level.status === 'current' && (
                  <View style={styles.playNowBadge}>
                    <Text style={styles.playNowText}>JUGAR</Text>
                  </View>
                )}

                {level.status === 'completed' && renderStars(level.stars)}

                <Text style={styles.nodeLabel}>{level.name}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.decorationRobot}>
        <Text style={{ fontSize: 60 }}>🤖</Text>
      </View>
      <View style={styles.decorationGear}>
        <Text style={{ fontSize: 40 }}>⚙️</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 120, paddingTop: 20 },
  mapWrapper: { flex: 1, position: 'relative' },
  nodesContainer: { alignItems: 'center', paddingHorizontal: 20 },
  nodeWrapper: { alignItems: 'center', marginBottom: 80, width: '100%' },
  node: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  nodeCompleted: { backgroundColor: colors.success },
  nodeCurrent: {
    backgroundColor: colors.primaryLight,
    width: 96,
    height: 96,
    borderRadius: 48,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  nodeLocked: { backgroundColor: colors.borderLight, opacity: 0.6 },
  starsContainer: { flexDirection: 'row', marginTop: 8 },
  nodeLabel: { ...typography.bold, fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  playNowBadge: {
    position: 'absolute',
    top: -20,
    right: -20,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  playNowText: { ...typography.bold, fontSize: 10, color: colors.accentDark },
  decorationRobot: { position: 'absolute', bottom: 40, left: 10, opacity: 0.3 },
  decorationGear: { position: 'absolute', top: 100, right: 20, opacity: 0.2 },
});