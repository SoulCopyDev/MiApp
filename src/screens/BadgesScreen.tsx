import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import {
  buildTrophyGroups,
  countTrophies,
  getWorldColor,
  LevelTrophy,
  WorldTrophy,
  WorldTrophyGroup,
  TrophyColorScheme,
} from '../utils/trophies';

// ---------- Sub-componentes ----------

function StarRow({ stars }: { stars: number }) {
  return (
    <View style={innerStyles.starRow}>
      {[1, 2, 3].map(i => (
        <MaterialIcons
          key={i}
          name="star"
          size={13}
          color={i <= stars ? colors.accent : colors.borderLight}
        />
      ))}
    </View>
  );
}

function LevelTrophyRow({ trophy, accent }: { trophy: LevelTrophy; accent: string }) {
  return (
    <View style={[innerStyles.levelRow, !trophy.unlocked && innerStyles.levelRowLocked]}>
      <View style={[innerStyles.levelRowIcon, { backgroundColor: trophy.unlocked ? accent + '18' : colors.surfaceVariant }]}>
        <MaterialIcons
          name={trophy.icon as any}
          size={19}
          color={trophy.unlocked ? accent : colors.textDisabled}
        />
      </View>

      <View style={innerStyles.levelRowInfo}>
        <Text
          style={[innerStyles.levelRowName, !trophy.unlocked && innerStyles.dimText]}
          numberOfLines={1}
        >
          {trophy.name}
        </Text>
        {trophy.unlocked
          ? <StarRow stars={trophy.stars} />
          : <Text style={innerStyles.lockedLabel}>Bloqueado</Text>
        }
      </View>

      <MaterialIcons
        name={trophy.unlocked ? 'check-circle' : 'lock'}
        size={20}
        color={trophy.unlocked ? accent : colors.borderLight}
      />
    </View>
  );
}

function WorldTrophyCard({ trophy, wc }: { trophy: WorldTrophy; wc: TrophyColorScheme }) {
  const progress = trophy.totalLevels > 0 ? trophy.completedLevels / trophy.totalLevels : 0;

  return (
    <View style={[
      innerStyles.worldTrophyCard,
      trophy.unlocked
        ? { backgroundColor: wc.accent, borderColor: wc.accent }
        : { backgroundColor: colors.surface, borderColor: wc.accent + '30' },
    ]}>
      <View style={innerStyles.worldTrophyLeft}>
        <MaterialIcons
          name="emoji-events"
          size={46}
          color={trophy.unlocked ? '#fff' : colors.borderLight}
        />
        {!trophy.unlocked && (
          <View style={[innerStyles.trophyLockBadge, { backgroundColor: wc.accent }]}>
            <MaterialIcons name="lock" size={11} color="#fff" />
          </View>
        )}
      </View>

      <View style={innerStyles.worldTrophyRight}>
        <Text style={[innerStyles.worldTrophyTitle, { color: trophy.unlocked ? '#fff' : colors.textPrimary }]}>
          {trophy.unlocked ? '¡Mundo Completado! 🎉' : 'Trofeo de Mundo'}
        </Text>
        <Text style={[innerStyles.worldTrophyDesc, { color: trophy.unlocked ? '#ffffffcc' : colors.textSecondary }]}>
          {trophy.description}
        </Text>

        {!trophy.unlocked && (
          <>
            <View style={innerStyles.worldTrophyProgressBg}>
              <View style={[innerStyles.worldTrophyProgressFill, { width: `${progress * 100}%`, backgroundColor: wc.accent }]} />
            </View>
            <Text style={[innerStyles.worldTrophyProgressText, { color: wc.accent }]}>
              {trophy.completedLevels}/{trophy.totalLevels} niveles completados
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function WorldSection({ group, expanded, onToggle }: {
  group: WorldTrophyGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const wc = getWorldColor(group.worldId);

  return (
    <View style={innerStyles.worldSection}>
      {/* Cabecera del mundo — toca para expandir/colapsar */}
      <TouchableOpacity
        style={[innerStyles.worldHeader, { backgroundColor: wc.bg, borderColor: wc.accent + '40' }]}
        activeOpacity={0.8}
        onPress={onToggle}
      >
        <View style={[innerStyles.worldHeaderIcon, { backgroundColor: wc.accent + '20' }]}>
          <MaterialIcons name={group.worldIcon as any} size={26} color={wc.accent} />
        </View>

        <View style={innerStyles.worldHeaderText}>
          <Text style={[innerStyles.worldLabel, { color: wc.accent }]}>MUNDO {group.worldId}</Text>
          <Text style={innerStyles.worldTitle} numberOfLines={1}>{group.worldName}</Text>
        </View>

        <View style={innerStyles.worldHeaderRight}>
          <View style={[innerStyles.worldProgressPill, { backgroundColor: wc.accent + '18' }]}>
            <Text style={[innerStyles.worldProgressCount, { color: wc.accent }]}>
              {group.completedLevels}/{group.totalLevels}
            </Text>
          </View>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={24}
            color={wc.accent}
          />
        </View>
      </TouchableOpacity>

      {/* Contenido expandible */}
      {expanded && (
        <View style={[innerStyles.worldBody, { borderColor: wc.accent + '25' }]}>
          {group.levelTrophies.map(t => (
            <LevelTrophyRow key={t.levelId} trophy={t} accent={wc.accent} />
          ))}
          <WorldTrophyCard trophy={group.worldTrophy} wc={wc} />
        </View>
      )}
    </View>
  );
}

// ---------- Pantalla principal ----------

export default function BadgesScreen() {
  const worlds = useGameStore(s => s.worlds);
  const badges = useGameStore(s => s.badges);

  const groups = useMemo(() => buildTrophyGroups(worlds), [worlds]);
  const { unlocked, total } = useMemo(() => countTrophies(groups), [groups]);
  const progressPercent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  // Cada mundo arranca colapsado; solo expandimos si tiene progreso
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.worldId, g.completedLevels > 0]))
  );
  const [badgesExpanded, setBadgesExpanded] = useState(false);

  const toggle = (worldId: number) =>
    setExpanded(prev => ({ ...prev, [worldId]: !prev[worldId] }));

  const unlockedBadges = badges.filter(b => b.unlocked).length;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* ── Cabecera de progreso global ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Trofeos</Text>
          <Text style={styles.headerSub}>
            {unlocked} de {total} desbloqueados
          </Text>
        </View>
        <View style={styles.trophyBubble}>
          <MaterialIcons name="emoji-events" size={38} color={colors.accent} />
        </View>
      </View>

      <View style={styles.globalProgressCard}>
        <View style={styles.globalProgressBar}>
          <View style={[styles.globalProgressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.globalProgressLabel}>{progressPercent}% completado</Text>
      </View>

      {/* ── Secciones por mundo ── */}
      <Text style={styles.sectionTitle}>Por mundo</Text>

      {groups.map(group => (
        <WorldSection
          key={group.worldId}
          group={group}
          expanded={!!expanded[group.worldId]}
          onToggle={() => toggle(group.worldId)}
        />
      ))}

      {/* ── Insignias especiales ── */}
      <TouchableOpacity
        style={styles.badgesHeader}
        activeOpacity={0.8}
        onPress={() => setBadgesExpanded(v => !v)}
      >
        <View style={styles.badgesHeaderLeft}>
          <MaterialIcons name="workspace-premium" size={22} color={colors.secondary} />
          <Text style={styles.badgesHeaderTitle}>Insignias especiales</Text>
        </View>
        <View style={styles.badgesHeaderRight}>
          <View style={styles.badgesPill}>
            <Text style={styles.badgesPillText}>{unlockedBadges}/{badges.length}</Text>
          </View>
          <MaterialIcons
            name={badgesExpanded ? 'expand-less' : 'expand-more'}
            size={22}
            color={colors.secondary}
          />
        </View>
      </TouchableOpacity>

      {badgesExpanded && (
        <View style={styles.badgesGrid}>
          {badges.map(badge => (
            <View
              key={badge.id}
              style={[styles.badgeCard, badge.unlocked ? styles.badgeUnlocked : styles.badgeLocked]}
            >
              <View style={[styles.badgeIconWrap, { backgroundColor: badge.bgColor }]}>
                <MaterialIcons name={badge.icon as any} size={32} color={badge.unlocked ? badge.color : colors.textDisabled} />
                {!badge.unlocked && (
                  <View style={styles.badgeLockOverlay}>
                    <MaterialIcons name="lock" size={16} color={colors.surface} />
                  </View>
                )}
                {badge.unlocked && (
                  <View style={styles.badgeCheck}>
                    <MaterialIcons name="check-circle" size={16} color={colors.accent} />
                  </View>
                )}
              </View>
              <View style={styles.badgeInfo}>
                <Text style={[styles.badgeName, !badge.unlocked && styles.dimText]}>
                  {badge.name}
                </Text>
                <Text style={[styles.badgeDesc, !badge.unlocked && styles.dimText]} numberOfLines={2}>
                  {badge.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ---------- Estilos internos de sub-componentes ----------

const innerStyles = StyleSheet.create({
  // LevelTrophyRow
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  levelRowLocked: { opacity: 0.55 },
  levelRowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  levelRowInfo: { flex: 1, gap: 2 },
  levelRowName: { ...typography.bold, fontSize: 13, color: colors.textPrimary },
  dimText: { color: colors.textDisabled },
  starRow: { flexDirection: 'row', gap: 2 },
  lockedLabel: { ...typography.regular, fontSize: 11, color: colors.textDisabled },

  // WorldTrophyCard
  worldTrophyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
  },
  worldTrophyLeft: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  trophyLockBadge: { position: 'absolute', bottom: -4, right: -6, borderRadius: 10, padding: 3 },
  worldTrophyRight: { flex: 1 },
  worldTrophyTitle: { ...typography.extraBold, fontSize: 15, marginBottom: 3 },
  worldTrophyDesc: { ...typography.regular, fontSize: 12, marginBottom: 6 },
  worldTrophyProgressBg: { height: 8, backgroundColor: '#00000015', borderRadius: 10, overflow: 'hidden', marginBottom: 4 },
  worldTrophyProgressFill: { height: '100%', borderRadius: 10 },
  worldTrophyProgressText: { ...typography.bold, fontSize: 11 },

  // WorldSection header
  worldSection: { marginHorizontal: 16, marginBottom: 10, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  worldHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: 2, borderRadius: 20 },
  worldHeaderIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  worldHeaderText: { flex: 1 },
  worldLabel: { ...typography.bold, fontSize: 11, letterSpacing: 1, marginBottom: 1 },
  worldTitle: { ...typography.extraBold, fontSize: 15, color: colors.textPrimary },
  worldHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  worldProgressPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  worldProgressCount: { ...typography.bold, fontSize: 13 },
  worldBody: { borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderRadius: 20, borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' },
});

// ---------- Estilos de la pantalla ----------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingTop: 16 },

  // Cabecera global
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: { ...typography.extraBold, fontSize: 26, color: colors.primaryDark },
  headerSub: { ...typography.bold, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  trophyBubble: { backgroundColor: '#fed01b20', padding: 14, borderRadius: 50, transform: [{ rotate: '10deg' }] },

  // Barra de progreso global
  globalProgressCard: { marginHorizontal: 20, marginBottom: 24 },
  globalProgressBar: { height: 18, backgroundColor: colors.borderLight, borderRadius: 30, overflow: 'hidden', marginBottom: 6 },
  globalProgressFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 30 },
  globalProgressLabel: { ...typography.bold, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },

  // Título de sección
  sectionTitle: { ...typography.extraBold, fontSize: 16, color: colors.textSecondary, marginHorizontal: 20, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },

  // Insignias especiales
  badgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#f3e8ff',
    borderWidth: 2,
    borderColor: '#a855f730',
    borderRadius: 20,
    padding: 14,
    elevation: 1,
  },
  badgesHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgesHeaderTitle: { ...typography.extraBold, fontSize: 16, color: colors.secondary },
  badgesHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgesPill: { backgroundColor: colors.secondary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgesPillText: { ...typography.bold, fontSize: 13, color: colors.secondary },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  badgeCard: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, padding: 12, borderRadius: 18, borderWidth: 2, marginBottom: 4 },
  badgeUnlocked: { borderColor: '#57a3ff30' },
  badgeLocked: { borderColor: colors.border, opacity: 0.6 },
  badgeIconWrap: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0, position: 'relative' },
  badgeLockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000070', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  badgeCheck: { position: 'absolute', bottom: -5, right: -5, backgroundColor: colors.surface, borderRadius: 10, padding: 1 },
  badgeInfo: { flex: 1, gap: 3 },
  badgeName: { ...typography.bold, fontSize: 12, color: colors.primaryDark },
  badgeDesc: { ...typography.regular, fontSize: 10, color: colors.textSecondary, lineHeight: 14 },
  dimText: { color: colors.textDisabled },
});
