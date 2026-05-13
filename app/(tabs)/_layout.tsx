import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../../src/theme';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import WebSidebar from '../../src/components/WebSidebar';

export default function TabsLayout() {
  const breakpoint = useBreakpoint();
  const isWebDesktop = Platform.OS === 'web' && breakpoint !== 'mobile';

  const tabs = (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap = 'home';
          if (route.name === 'index')    iconName = 'home';
          else if (route.name === 'map')     iconName = 'map';
          else if (route.name === 'badges')  iconName = 'emoji-events';
          else if (route.name === 'settings') iconName = 'settings';
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: isWebDesktop
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface,
              borderTopWidth: 4,
              borderTopColor: colors.surfaceVariant,
              height: Platform.OS === 'web' ? 74 : 70,
              paddingBottom: Platform.OS === 'web' ? 14 : 10,
              paddingTop: 5,
            },
        tabBarLabelStyle: {
          ...typography.bold,
          fontSize: 12,
        },
        headerShown: false,
      })}
    >
      <Tabs.Screen name="index"    options={{ title: 'Inicio' }} />
      <Tabs.Screen name="map"      options={{ title: 'Mapa' }} />
      <Tabs.Screen name="badges"   options={{ title: 'Trofeos' }} />
      <Tabs.Screen name="settings" options={{ title: 'Configuración' }} />
    </Tabs>
  );

  // Desktop/tablet web: sidebar fija a la izquierda + contenido
  if (isWebDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <WebSidebar />
        <View style={{ flex: 1, overflow: 'hidden' }}>{tabs}</View>
      </View>
    );
  }

  return tabs;
}
