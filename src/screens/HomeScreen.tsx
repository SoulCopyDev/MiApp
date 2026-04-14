import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { HomeScreenProps } from '../types/navigation';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { profile, level, currentXP, maxXP, streak, totalStars } = useGameStore();

  const porcentajeXP = maxXP > 0 ? (currentXP / maxXP) * 100 : 0;
  const stackNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Barra superior */}
      <View style={styles.topBar}>
        <View style={styles.profileRow}>
          <Image
            source={{
              uri: profile.avatar === 'robot'
                ? 'https://...' // Cambiar a imágenes locales
                : 'https://...',
            }}
            style={styles.avatar}
          />
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
      <View style={styles.profileCard}>
        <View style={styles.robotContainer}>
          <Image
            source={{
              uri: 'https://...', // Cambiar a imagen local
            }}
            style={styles.robotImage}
          />
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>LVL {level}</Text>
          </View>
        </View>
        <Text style={styles.userName}>{profile.name}</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressFill, { width: `${porcentajeXP}%` }]} />
        </View>
        <Text style={styles.xpText}>
          {currentXP} / {maxXP} XP PARA NIVEL {level + 1}
        </Text>
      </View>

      {/* Misión diaria */}
      <TouchableOpacity
        style={styles.dailyMissionCard}
        activeOpacity={0.8}
        onPress={() => Alert.alert('¡Pronto!', 'Detecta 3 imágenes de IA')}
      >
        <View style={styles.missionIcon}>
          <MaterialIcons name="shield" size={40} color={colors.primary} />
        </View>
        <View style={styles.missionText}>
          <Text style={styles.missionTitle}>Misión diaria</Text>
          <Text style={styles.missionDesc}>Detecta 3 imágenes de IA</Text>
        </View>
        <View style={styles.startButton}>
          <Text style={styles.startButtonText}>EMPEZAR</Text>
        </View>
      </TouchableOpacity>

      {/* Botón PLAY */}
      <TouchableOpacity
        style={styles.playButton}
        activeOpacity={0.7}
        onPress={() => stackNavigation.navigate('GameLevel1')}
      >
        <MaterialIcons name="play-arrow" size={80} color={colors.accentDark} />
        <Text style={styles.playText}>JUGAR</Text>
      </TouchableOpacity>
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
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primaryLight },
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
  robotImage: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surface, borderWidth: 6, borderColor: 'white' },
  levelBadge: { position: 'absolute', bottom: -8, right: -8, backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 30, borderWidth: 2, borderColor: 'white' },
  levelText: { ...typography.bold, color: 'white', fontSize: 12 },
  userName: { ...typography.extraBold, fontSize: 22, color: colors.textPrimary, marginTop: 8 },
  progressBarContainer: { width: '100%', height: 20, backgroundColor: colors.borderLight, borderRadius: 30, marginTop: 16, overflow: 'hidden', borderWidth: 2, borderColor: colors.surface },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 30 },
  xpText: { ...typography.bold, fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  dailyMissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef3ff',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#57a3ff20',
    gap: 16,
  },
  missionIcon: { backgroundColor: 'white', padding: 12, borderRadius: 20 },
  missionText: { flex: 1 },
  missionTitle: { ...typography.bold, fontSize: 16, color: colors.primaryDark },
  missionDesc: { ...typography.regular, fontSize: 14, color: colors.primary },
  startButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 40 },
  startButtonText: { ...typography.bold, color: 'white' },
  playButton: {
    alignSelf: 'center',
    backgroundColor: colors.accent,
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    shadowColor: '#b29100',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
    borderWidth: 6,
    borderColor: 'white',
  },
  playText: { ...typography.extraBold, fontSize: 28, color: colors.accentDark, letterSpacing: 2 },
});