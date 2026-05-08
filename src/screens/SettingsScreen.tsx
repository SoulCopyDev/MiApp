import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { AVATAR_EMOJIS } from '../config/avatarEmojis';
import { colors, typography } from '../theme';

export default function SettingsScreen() {
  const profile      = useGameStore(s => s.profile);
  const setProfile   = useGameStore(s => s.setProfile);
  const resetProgress = useGameStore(s => s.resetProgress);
  const devMode      = useGameStore(s => s.devMode);
  const setDevMode   = useGameStore(s => s.setDevMode);

  const [name, setName] = useState(profile.name);

  const handleSaveName = () => setProfile({ name });

  // Memoize the grid so it only recalculates when the selected emoji changes
  const emojiGrid = useMemo(() => AVATAR_EMOJIS.map(emoji => {
    const selected = emoji === profile.avatarEmoji;
    return (
      <TouchableOpacity
        key={emoji}
        style={[styles.emojiCell, selected && styles.emojiCellSelected]}
        onPress={() => setProfile({ avatarEmoji: emoji })}
        activeOpacity={0.7}
      >
        <Text style={styles.emojiText}>{emoji}</Text>
      </TouchableOpacity>
    );
  }), [profile.avatarEmoji, setProfile]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>⚙️ Configuración</Text>

      {/* Avatar */}
      <View style={styles.card}>
        <Text style={styles.label}>Avatar</Text>

        {/* Preview del avatar actual */}
        <View style={styles.previewRow}>
          <View style={styles.avatarPreviewWrap}>
            <Text style={styles.avatarPreviewEmoji}>{profile.avatarEmoji}</Text>
          </View>
          <View>
            <Text style={styles.previewName}>{profile.name}</Text>
            <Text style={styles.previewHint}>Toca un emoji para cambiarlo</Text>
          </View>
        </View>

        {/* Grid de emojis */}
        <View style={styles.emojiGrid}>
          {emojiGrid}
        </View>
      </View>

      {/* Nombre */}
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

      {/* Sonidos */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>🔊 Sonidos</Text>
          <Switch
            value={profile.soundEnabled}
            onValueChange={v => setProfile({ soundEnabled: v })}
            trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
            thumbColor={profile.soundEnabled ? colors.primary : colors.background}
          />
        </View>
      </View>

      {/* Modo Desarrollador */}
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
            ],
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
  // Avatar preview
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatarPreviewWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: colors.primaryLight },
  avatarPreviewEmoji: { fontSize: 42 },
  previewName: { ...typography.bold, fontSize: 16, color: colors.textPrimary },
  previewHint: { ...typography.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  // Emoji grid
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceVariant, borderWidth: 2, borderColor: 'transparent' },
  emojiCellSelected: { borderColor: colors.primary, backgroundColor: '#eef3ff' },
  emojiText: { fontSize: 26 },
  // Name input
  input: { borderWidth: 2, borderColor: colors.borderLight, borderRadius: 16, padding: 12, fontSize: 16, ...typography.regular, backgroundColor: colors.surface },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resetButton: { backgroundColor: colors.error, padding: 16, borderRadius: 40, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  resetText: { ...typography.bold, color: 'white', fontSize: 16 },
  version: { textAlign: 'center', ...typography.regular, color: colors.textDisabled, marginBottom: 40 },
  devNote: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});
