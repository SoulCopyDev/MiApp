import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { DOWNLOAD_CONFIG } from '../config/downloadConfig';
import { colors, typography } from '../theme';

export default function DownloadBanner() {
  const { platform, visible, dismiss } = useMobileDetect();

  if (!visible) return null;

  /* ── Android ── */
  if (platform === 'android') {
    const hasStore = !!DOWNLOAD_CONFIG.playStoreUrl;
    const hasApk = !!DOWNLOAD_CONFIG.apkUrl;

    const handleAndroid = () => {
      if (hasStore) Linking.openURL(DOWNLOAD_CONFIG.playStoreUrl!);
      else if (hasApk) Linking.openURL(DOWNLOAD_CONFIG.apkUrl!);
    };

    if (!hasStore && !hasApk) return null;

    return (
      <View style={styles.mobileBanner}>
        <View style={styles.mobileBannerLeft}>
          <Text style={styles.bannerEmoji}>🤖</Text>
          <View>
            <Text style={styles.bannerTitle}>Descarga la app</Text>
            <Text style={styles.bannerSub}>
              {hasStore ? 'Disponible en Google Play' : 'Descarga el APK directo'}
            </Text>
          </View>
        </View>
        <View style={styles.mobileBannerRight}>
          <TouchableOpacity style={styles.bannerBtn} onPress={handleAndroid} activeOpacity={0.8}>
            <Text style={styles.bannerBtnText}>
              {hasStore ? 'Play Store' : 'Descargar'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── iOS ── */
  if (platform === 'ios') {
    const hasStore = !!DOWNLOAD_CONFIG.appStoreUrl;

    return (
      <View style={styles.mobileBanner}>
        <View style={styles.mobileBannerLeft}>
          <Text style={styles.bannerEmoji}>🤖</Text>
          <View>
            <Text style={styles.bannerTitle}>Descarga la app</Text>
            <Text style={styles.bannerSub}>
              {hasStore ? 'Disponible en App Store' : 'Próximamente en App Store'}
            </Text>
          </View>
        </View>
        <View style={styles.mobileBannerRight}>
          {hasStore ? (
            <TouchableOpacity
              style={styles.bannerBtn}
              onPress={() => Linking.openURL(DOWNLOAD_CONFIG.appStoreUrl!)}
              activeOpacity={0.8}
            >
              <Text style={styles.bannerBtnText}>App Store</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bannerBtnDisabled}>
              <Text style={styles.bannerBtnDisabledText}>Próximamente</Text>
            </View>
          )}
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Desktop ── */
  return (
    <View style={styles.desktopCard}>
      <TouchableOpacity onPress={dismiss} style={styles.desktopClose}>
        <MaterialIcons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Text style={styles.desktopTitle}>📱 Llévalo en tu bolsillo</Text>
      <Text style={styles.desktopSub}>Escanea el QR con tu móvil para instalar AI Explorer</Text>

      <Image
        source={{ uri: '/icons/qr-app.png' }}
        style={styles.qr}
        resizeMode="contain"
      />

      <View style={styles.desktopLinks}>
        {DOWNLOAD_CONFIG.playStoreUrl ? (
          <TouchableOpacity
            style={styles.storeBtn}
            onPress={() => Linking.openURL(DOWNLOAD_CONFIG.playStoreUrl!)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="android" size={16} color={colors.surface} />
            <Text style={styles.storeBtnText}>Google Play</Text>
          </TouchableOpacity>
        ) : DOWNLOAD_CONFIG.apkUrl ? (
          <TouchableOpacity
            style={styles.storeBtn}
            onPress={() => Linking.openURL(DOWNLOAD_CONFIG.apkUrl!)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="android" size={16} color={colors.surface} />
            <Text style={styles.storeBtnText}>Descargar APK</Text>
          </TouchableOpacity>
        ) : null}

        {DOWNLOAD_CONFIG.appStoreUrl ? (
          <TouchableOpacity
            style={[styles.storeBtn, styles.storeBtnIos]}
            onPress={() => Linking.openURL(DOWNLOAD_CONFIG.appStoreUrl!)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="phone-iphone" size={16} color={colors.primary} />
            <Text style={[styles.storeBtnText, { color: colors.primary }]}>App Store</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.storeBtn, styles.storeBtnDisabled]}>
            <MaterialIcons name="phone-iphone" size={16} color={colors.textSecondary} />
            <Text style={[styles.storeBtnText, { color: colors.textSecondary }]}>iOS próximamente</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Mobile banner (bottom strip) ── */
  mobileBanner: {
    position: 'absolute' as any,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  mobileBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bannerEmoji: { fontSize: 28 },
  bannerTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary },
  bannerSub: { ...typography.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  mobileBannerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerBtnText: { ...typography.bold, fontSize: 13, color: colors.surface },
  bannerBtnDisabled: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerBtnDisabledText: { ...typography.bold, fontSize: 13, color: colors.textSecondary },
  closeBtn: { padding: 4 },

  /* ── Desktop floating card ── */
  desktopCard: {
    position: 'absolute' as any,
    bottom: 32,
    right: 32,
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 999,
    alignItems: 'center',
  },
  desktopClose: {
    position: 'absolute' as any,
    top: 10,
    right: 10,
    padding: 4,
  },
  desktopTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  desktopSub: { ...typography.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 14, lineHeight: 17 },
  qr: { width: 140, height: 140, borderRadius: 8, marginBottom: 14 },
  desktopLinks: { width: '100%', gap: 8 },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: 12,
  },
  storeBtnIos: { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border },
  storeBtnDisabled: { backgroundColor: colors.surfaceVariant },
  storeBtnText: { ...typography.bold, fontSize: 13, color: colors.surface },
});
