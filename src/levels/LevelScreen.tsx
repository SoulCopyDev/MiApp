// src/levels/LevelScreen.tsx
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import GameLevel1 from './GameLevel1';
import GameLevel2 from './GameLevel2';
import GameLevel3 from './GameLevel3';
import GameLevel4 from './GameLevel4';
import GameLevel5 from './GameLevel5';
import { colors } from '../theme';

type LevelScreenRouteProp = RouteProp<RootStackParamList, 'GameLevel'>;

export default function LevelScreen() {
  const route = useRoute<LevelScreenRouteProp>();
  const { levelId } = route.params;

  const renderLevel = () => {
    switch (levelId) {
      case 1:
        return <GameLevel1 />;
      case 2:
        return <GameLevel2 />;
      case 3:
        return <GameLevel3 />;
      case 4:
        return <GameLevel4 />;
      case 5:
        return <GameLevel5 />;
      default:
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
            <Text>Nivel {levelId} no disponible aún.</Text>
          </View>
        );
    }
  };

  return <>{renderLevel()}</>;
}