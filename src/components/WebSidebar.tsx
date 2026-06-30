import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useGameStore, coordsToGlobalN } from '../store/gameStore';
import { colors, typography } from '../theme';
import { getRankInfo } from '../utils/rankSystem';

export const SIDEBAR_WIDTH = 248;

const NAV_ITEMS = [
  { label: 'Inicio',         icon: 'home'         as const, route: '/'         },
  { label: 'Mapa de mundos', icon: 'map'          as const, route: '/map'      },
  { label: 'Trofeos',        icon: 'emoji-events' as const, route: '/badges'   },
  { label: 'Configuración',  icon: 'settings'     as const, route: '/settings' },
];

const TOOLS = [
  { icon: 'chat-bubble-outline' as const, label: 'ChatGPT' },
  { icon: 'auto-awesome'        as const, label: 'Claude'  },
  { icon: 'diamond'             as const, label: 'Gemini'  },
];

function parseLevelContext(pathname: string): {
  worldId: number | null;
  activeN: number | null;
  activeEvalId: number | null;
} {
  const levelMatch = pathname.match(/^\/level\/(\d+)/);
  if (levelMatch) {
    const n = Number(levelMatch[1]);
    return { worldId: Math.ceil(n / 6), activeN: n, activeEvalId: null };
  }
  const evalMatch = pathname.match(/^\/eval\/(\w+)/);
  if (evalMatch) {
    const isFinal = evalMatch[1] === 'final';
    return {
      worldId: isFinal ? 6 : Number(evalMatch[1]),
      activeN: null,
      activeEvalId: isFinal ? 8 : 7,
    };
  }
  const worldMatch = pathname.match(/^\/world\/(\d+)/);
  if (worldMatch) {
    return { worldId: Number(worldMatch[1]), activeN: null, activeEvalId: null };
  }
  return { worldId: null, activeN: null, activeEvalId: null };
}

export default function WebSidebar() {
  const pathname    = usePathname();
  const worlds      = useGameStore(s => s.worlds);
  const profile     = useGameStore(s => s.profile);
  const totalStars  = useGameStore(s => s.totalStars);
  const streak      = useGameStore(s => s.streak);
  const playerLevel = useGameStore(s => s.playerLevel);
  const currentXP   = useGameStore(s => s.currentXP);
  const maxXP       = useGameStore(s => s.maxXP);
  const rankInfo    = getRankInfo(totalStars);

  const xpPct = maxXP > 0 ? (currentXP / maxXP) * 100 : 0;

  const { worldId, activeN, activeEvalId } = parseLevelContext(pathname);
  const world = worldId !== null ? worlds.find(w => w.id === worldId) ?? null : null;

  const isTabActive = (route: string) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route);

  // ─── Sidebar de nivel: Mi camino + Herramientas ───
  if (world) {
    const subtitle = activeN ? `N${activeN} — en curso` : world.name;

    return (
      <View style={s.sidebar}>
        {/* Logo */}
        <View style={s.logoArea}>
          <View style={s.logoIconBox}>
            <Text style={s.logoEmoji}>🤖</Text>
          </View>
          <View>
            <Text style={s.logoText}>IA Explorer</Text>
            <Text style={s.logoSub}>{subtitle}</Text>
          </View>
        </View>

        {/* Lista de niveles */}
        <ScrollView style={s.nav} showsVerticalScrollIndicator={false}>
          <Text style={s.navSection}>MI CAMINO</Text>

          {world.levels.map(level => {
            const globalN     = level.id <= 6 ? coordsToGlobalN(world.id, level.id) : null;
            const isItemActive =
              (globalN !== null && globalN === activeN) ||
              (activeEvalId !== null && level.id === activeEvalId);
            const isLocked    = level.status === 'locked';
            const isDone      = level.status === 'completed';

            const labelText =
              level.id === 8 ? `EF — ${level.name}` :
              level.id === 7 ? `Eval — ${level.name}` :
              `N${globalN} — ${level.name}`;

            return (
              <TouchableOpacity
                key={level.id}
                style={[
                  s.levelItem,
                  isItemActive && s.levelItemActive,
                  isLocked && s.levelItemLocked,
                ]}
                onPress={() => {
                  if (isLocked) return;
                  if (level.id === 8)      router.push('/eval/final');
                  else if (level.id === 7) router.push(`/eval/${world.id}`);
                  else if (globalN)        router.push(`/level/${globalN}`);
                }}
                activeOpacity={isLocked ? 1 : 0.7}
              >
                <View style={[s.levelIconWrap, isItemActive && s.levelIconWrapActive]}>
                  <MaterialIcons
                    name={level.icon as any}
                    size={15}
                    color={
                      isItemActive ? colors.primary :
                      isLocked     ? colors.textDisabled :
                      colors.textSecondary
                    }
                  />
                </View>
                <Text
                  style={[
                    s.levelLabel,
                    isItemActive && s.levelLabelActive,
                    isLocked     && s.levelLabelLocked,
                  ]}
                  numberOfLines={1}
                >
                  {labelText}
                </Text>
                {isDone && !isItemActive && (
                  <MaterialIcons name="check-circle" size={13} color={colors.success} />
                )}
              </TouchableOpacity>
            );
          })}

          <View style={s.divider} />

          <Text style={s.navSection}>HERRAMIENTAS</Text>
          {TOOLS.map(tool => (
            <View key={tool.label} style={[s.levelItem, s.toolItem]}>
              <View style={[s.levelIconWrap, s.toolIconWrap]}>
                <MaterialIcons name={tool.icon} size={15} color={colors.textDisabled} />
              </View>
              <Text style={[s.levelLabel, s.toolLabel]}>{tool.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* XP + Racha */}
        <View style={s.bottom}>
          <View style={s.xpCard}>
            <Text style={s.xpCardStar}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.xpCardLabel}>XP total</Text>
              <Text style={s.xpCardVal}>{currentXP} XP</Text>
              <View style={s.xpMiniBarBg}>
                <View style={[s.xpMiniBarFill, { width: `${xpPct}%` as any }]} />
              </View>
            </View>
          </View>
          <View style={s.streakCard}>
            <Text style={s.streakEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.streakTitle}>Racha activa</Text>
              <Text style={s.streakSub}>Sigue aprendiendo cada día</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ─── Sidebar de tabs: navegación principal ───
  return (
    <View style={s.sidebar}>
      {/* Logo */}
      <View style={s.logoArea}>
        <Text style={s.logoEmoji}>🤖</Text>
        <Text style={s.logoText}>AI Explorer</Text>
      </View>

      {/* Profile card */}
      <View style={[s.profileCard, { borderColor: rankInfo.tier.color + '40' }]}>
        <View style={s.avatarRow}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarEmoji}>{profile.avatarEmoji}</Text>
          </View>
          <View style={s.profileMeta}>
            <Text style={s.profileName} numberOfLines={1}>{profile.name}</Text>
            <View style={[s.rankPill, { backgroundColor: rankInfo.tier.bgColor }]}>
              <MaterialIcons name={rankInfo.tier.icon as any} size={11} color={rankInfo.tier.color} />
              <Text style={[s.rankLabel, { color: rankInfo.tier.color }]}>{rankInfo.tier.name}</Text>
            </View>
          </View>
          <View style={[s.lvlBadge, { backgroundColor: rankInfo.tier.color }]}>
            <Text style={s.lvlText}>{playerLevel}</Text>
          </View>
        </View>
        <View style={s.xpBarBg}>
          <View style={[s.xpBarFill, { width: `${xpPct}%` as any }]} />
        </View>
        <Text style={s.xpLabel}>{currentXP}/{maxXP} XP</Text>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statValue}>{streak}</Text>
          <Text style={s.statLabel}>Racha 🔥</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statValue}>{totalStars}</Text>
          <Text style={s.statLabel}>Estrellas ⭐</Text>
        </View>
      </View>

      {/* Navigation */}
      <ScrollView style={s.nav} showsVerticalScrollIndicator={false}>
        <Text style={s.navSection}>NAVEGACIÓN</Text>
        {NAV_ITEMS.map(item => {
          const active = isTabActive(item.route);
          return (
            <TouchableOpacity
              key={item.route}
              style={[s.navItem, active && s.navItemActive]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[s.navIconWrap, active && s.navIconWrapActive]}>
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={active ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
              {active && <View style={s.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>AI Explorer · v1.0.0</Text>
        <Text style={s.footerSub}>Sin backend · 100% offline</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexDirection: 'column',
  },

  // ─── Logo ───
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: { fontSize: 24 },
  logoText: { ...typography.extraBold, fontSize: 16, color: colors.primary },
  logoSub:  { ...typography.bold, fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  // ─── Level context: item list ───
  nav: { flex: 1, paddingHorizontal: 10, paddingTop: 6 },
  navSection: {
    ...typography.bold,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingBottom: 6,
    paddingTop: 10,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 2,
  },
  levelItemActive: {
    backgroundColor: colors.primary + '14',
  },
  levelItemLocked: {
    opacity: 0.4,
  },
  levelIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelIconWrapActive: {
    backgroundColor: colors.primary + '20',
  },
  levelLabel: {
    ...typography.bold,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  levelLabelActive: { color: colors.primary },
  levelLabelLocked: { color: colors.textDisabled },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 10,
    marginVertical: 8,
  },

  // ─── Tools (disabled) ───
  toolItem:    { opacity: 0.5 },
  toolIconWrap:{ backgroundColor: colors.surfaceVariant },
  toolLabel:   { color: colors.textDisabled },

  // ─── Bottom: XP + streak ───
  bottom: {
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    padding: 12,
  },
  xpCardStar:  { fontSize: 22 },
  xpCardLabel: { ...typography.bold, fontSize: 10, color: colors.textSecondary },
  xpCardVal:   { ...typography.extraBold, fontSize: 15, color: colors.textPrimary },
  xpMiniBarBg: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  xpMiniBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  streakEmoji: { fontSize: 20 },
  streakTitle: { ...typography.bold, fontSize: 12, color: '#9a3412' },
  streakSub:   { ...typography.regular, fontSize: 10, color: '#c2410c', marginTop: 1 },

  // ─── Profile card (tab sidebar) ───
  profileCard: {
    margin: 12,
    padding: 14,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 18,
    borderWidth: 2,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  avatarEmoji:  { fontSize: 26 },
  profileMeta:  { flex: 1, gap: 4 },
  profileName:  { ...typography.bold, fontSize: 14, color: colors.textPrimary },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  rankLabel: { ...typography.bold, fontSize: 10 },
  lvlBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lvlText: { ...typography.extraBold, color: 'white', fontSize: 13 },
  xpBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 10 },
  xpLabel: { ...typography.bold, fontSize: 10, color: colors.textSecondary, marginTop: 5, textAlign: 'right' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    overflow: 'hidden',
  },
  statItem:   { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue:  { ...typography.extraBold, fontSize: 18, color: colors.textPrimary },
  statLabel:  { ...typography.bold, fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  statDivider:{ width: 1, backgroundColor: colors.border, marginVertical: 8 },

  // ─── Nav items (tab sidebar) ───
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 2,
  },
  navItemActive:    { backgroundColor: colors.primary + '12' },
  navIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  navIconWrapActive: { backgroundColor: colors.primary + '20' },
  navLabel:         { ...typography.bold, fontSize: 14, color: colors.textSecondary, flex: 1 },
  navLabelActive:   { color: colors.primary },
  activeDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },

  // ─── Footer (tab sidebar) ───
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  footerText: { ...typography.bold, fontSize: 11, color: colors.textDisabled, textAlign: 'center' },
  footerSub:  { ...typography.regular, fontSize: 10, color: colors.textDisabled, textAlign: 'center' },
});
