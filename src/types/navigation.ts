import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { StackScreenProps } from '@react-navigation/stack';

export type RootStackParamList = {
  MainTabs: undefined;
  World: { worldId: number };
  GameLevel: { worldId: number; levelId: number };
};

export type MainTabParamList = {
  Inicio: undefined;
  Mapa: undefined;
  Trofeos: undefined;
  Configuración: undefined;
};

export type HomeScreenProps = BottomTabScreenProps<MainTabParamList, 'Inicio'>;
export type MapScreenProps = BottomTabScreenProps<MainTabParamList, 'Mapa'>;
export type BadgesScreenProps = BottomTabScreenProps<MainTabParamList, 'Trofeos'>;
export type SettingsScreenProps = BottomTabScreenProps<MainTabParamList, 'Configuración'>;
export type WorldScreenProps = StackScreenProps<RootStackParamList, 'World'>;
export type GameLevelScreenProps = StackScreenProps<RootStackParamList, 'GameLevel'>;