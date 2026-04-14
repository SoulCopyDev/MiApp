import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

export default function SettingsScreen() {
  const profile = useGameStore((state) => state.profile);
  const setProfile = useGameStore((state) => state.setProfile);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const devMode = useGameStore((state) => state.devMode);
  const setDevMode = useGameStore((state) => state.setDevMode);
  const [name, setName] = useState(profile.name);

  const updateProfile = (updates: Partial<typeof profile>) => {
    setProfile(updates);
  };

  const handleSaveName = () => {
    updateProfile({ name });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚙️ Configuración</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Tu nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          onBlur={handleSaveName}
          placeholder="Escribe tu nombre"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Avatar</Text>
        <View style={styles.avatarRow}>
          <TouchableOpacity
            style={[styles.avatarOption, profile.avatar === 'robot' && styles.avatarSelected]}
            onPress={() => updateProfile({ avatar: 'robot' })}
          >
            <MaterialIcons name="smart-toy" size={40} color={profile.avatar === 'robot' ? colors.primary : colors.textDisabled} />
            <Text style={styles.avatarText}>Robot</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarOption, profile.avatar === 'kid' && styles.avatarSelected]}
            onPress={() => updateProfile({ avatar: 'kid' })}
          >
            <MaterialIcons name="face" size={40} color={profile.avatar === 'kid' ? colors.primary : colors.textDisabled} />
            <Text style={styles.avatarText}>Niño/a</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatarOption, profile.avatar === 'pet' && styles.avatarSelected]}
            onPress={() => updateProfile({ avatar: 'pet' })}
          >
            <MaterialIcons name="pets" size={40} color={profile.avatar === 'pet' ? colors.primary : colors.textDisabled} />
            <Text style={styles.avatarText}>Mascota</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>🔊 Sonidos</Text>
          <Switch
            value={profile.soundEnabled}
            onValueChange={(value) => updateProfile({ soundEnabled: value })}
            trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
            thumbColor={profile.soundEnabled ? colors.primary : colors.background}
          />
        </View>
      </View>

      {/* NUEVO: Modo Desarrollador */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.label}>🛠️ Modo Desarrollador</Text>
            <Text style={styles.devNote}>Saltar validaciones en niveles</Text>
          </View>
          <Switch
            value={devMode}
            onValueChange={setDevMode}
            trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
            thumbColor={devMode ? colors.primary : colors.background}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => {
          Alert.alert(
            'Reiniciar progreso',
            '¿Seguro? Perderás todos tus trofeos, niveles y XP.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Reiniciar', style: 'destructive', onPress: resetProgress },
            ]
          );
        }}
      >
        <Text style={styles.resetText}>🔄 Reiniciar Progreso</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Versión 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { ...typography.extraBold, fontSize: 28, color: colors.primary, marginBottom: 24, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 16, marginBottom: 20, borderWidth: 2, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2 },
  label: { ...typography.bold, fontSize: 16, color: colors.textPrimary, marginBottom: 12 },
  input: { borderWidth: 2, borderColor: colors.borderLight, borderRadius: 16, padding: 12, fontSize: 16, ...typography.regular, backgroundColor: colors.surface },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  avatarOption: { alignItems: 'center', padding: 12, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: colors.primary, backgroundColor: '#eef3ff' },
  avatarText: { ...typography.bold, fontSize: 12, marginTop: 4, color: colors.textPrimary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resetButton: { backgroundColor: colors.error, padding: 16, borderRadius: 40, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  resetText: { ...typography.bold, color: 'white', fontSize: 16 },
  version: { textAlign: 'center', ...typography.regular, color: colors.textDisabled, marginBottom: 40 },
  devNote: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});