import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import { getRankInfo } from '../utils/rankSystem';

export const SIDEBAR_WIDTH = 248;

const NAV_ITEMS = [
  { label: 'Inicio',         icon: 'home'           as const, route: '/'         },
  { label: 'Mapa de mundos', icon: 'map'            as const, route: '/map'      },
  { label: 'Trofeos',        icon: 'emoji-events'   as const, route: '/badges'   },
  { label: 'Configuración',  icon: 'settings'       as const, route: '/settings' },
];

export default function WebSidebar() {
  const pathname   = usePathname();
  const profile    = useGameStore(s => s.profile);
  const totalStars = useGameStore(s => s.totalStars);
  const streak     = useGameStore(s => s.streak);
  const playerLevel = useGameStore(s => s.playerLevel);
  const currentXP  = useGameStore(s => s.currentXP);
  const maxXP      = useGameStore(s => s.maxXP);
  const rankInfo   = getRankInfo(totalStars);

  const xpPct = maxXP > 0 ? (currentXP / maxXP) * 100 : 0;

  const isActive = (route: string) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route);

  return (
    <View style={s.sidebar}>
      {/* Logo */}
      <View style={s.logoArea}>
        <Text style={s.logoIcon}>🤖</Text>
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
              <Text style={[s.rankLabel, { color: rankInfo.tier.color }]}>
                {rankInfo.tier.name}
              </Text>
            </View>
          </View>
          <View style={[s.lvlBadge, { backgroundColor: rankInfo.tier.color }]}>
            <Text style={s.lvlText}>{playerLevel}</Text>
          </View>
        </View>

        {/* XP bar */}
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
          const active = isActive(item.route);
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
              <Text style={[s.navLabel, active && s.navLabelActive]}>
                {item.label}
              </Text>
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
  logoIcon: { fontSize: 26 },
  logoText: { ...typography.extraBold, fontSize: 20, color: colors.primary },

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
  avatarEmoji: { fontSize: 26 },
  profileMeta: { flex: 1, gap: 4 },
  profileName: { ...typography.bold, fontSize: 14, color: colors.textPrimary },
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
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue: { ...typography.extraBold, fontSize: 18, color: colors.textPrimary },
  statLabel: { ...typography.bold, fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },

  nav: { flex: 1, paddingHorizontal: 10, paddingTop: 4 },
  navSection: {
    ...typography.bold,
    fontSize: 10,
    color: colors.textDisabled,
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: colors.primary + '12' },
  navIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  navIconWrapActive: { backgroundColor: colors.primary + '20' },
  navLabel: { ...typography.bold, fontSize: 14, color: colors.textSecondary, flex: 1 },
  navLabelActive: { color: colors.primary },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  footerText: { ...typography.bold, fontSize: 11, color: colors.textDisabled, textAlign: 'center' },
  footerSub: { ...typography.regular, fontSize: 10, color: colors.textDisabled, textAlign: 'center' },
});
