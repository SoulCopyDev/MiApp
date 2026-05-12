import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import useCustomFonts from './src/hooks/useCustomFonts';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import WorldScreen from './src/screens/WorldScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LevelScreen from './src/levels/LevelScreen';
import { colors, typography } from './src/theme';
import { RootStackParamList, MainTabParamList } from './src/types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap = 'home';
          if (route.name === 'Inicio') iconName = 'home';
          else if (route.name === 'Mapa') iconName = 'map';
          else if (route.name === 'Trofeos') iconName = 'emoji-events';
          else if (route.name === 'Configuración') iconName = 'settings';
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 4,
          borderTopColor: colors.surfaceVariant,
          height: 70,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          ...typography.bold,
          fontSize: 12,
        },
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 4,
          borderBottomColor: colors.surfaceVariant,
        },
        headerTitleStyle: {
          ...typography.bold,
          color: colors.textPrimary,
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="Trofeos" component={BadgesScreen} />
      <Tab.Screen name="Configuración" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const fontsLoaded = useCustomFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text>Cargando fuentes...</Text>
      </View>
    );
  }

  const app = (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="World" component={WorldScreen} />
          <Stack.Screen name="GameLevel" component={LevelScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );

  if (Platform.OS !== 'web') return app;

  // Web: center app in viewport with max-width — looks like a mobile app on desktop
  return (
    <View style={webStyles.outer}>
      <View style={webStyles.inner}>{app}</View>
    </View>
  );
}

const webStyles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#d0d8e4',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
});