import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Stack, SplashScreen } from 'expo-router';
import useCustomFonts from '../src/hooks/useCustomFonts';
import DownloadBanner from '../src/components/DownloadBanner';
import { installTouchDragShim } from '../src/utils/touchDragShim';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fontsLoaded = useCustomFonts();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Web: arrastre táctil inmediato en los drag & drop (sin long-press). Ver src/utils/touchDragShim.ts
  useEffect(() => {
    if (Platform.OS === 'web') installTouchDragShim();
  }, []);

  if (!fontsLoaded) return null;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="world/[worldId]" />
      <Stack.Screen name="level/[N]" />
      <Stack.Screen name="eval/[worldId]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );

  if (Platform.OS !== 'web') return stack;

  // Web: sin phone frame — layouts responsivos manejados por cada pantalla
  return (
    <View style={styles.webRoot}>
      {stack}
      <DownloadBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    backgroundColor: '#f5f7f9',
  },
});
