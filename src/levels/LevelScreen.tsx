import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';

// Importación de niveles
import World1Level1 from './World1/Level1';
import World1Level2 from './World1/Level2';
import World1Level3 from './World1/Level3';
import World1Level4 from './World1/Level4';
import World1Level5 from './World1/Level5';

import World2Level1 from './World2/Level1';
import World2Level2 from './World2/Level2';
import World2Level3 from './World2/Level3';
import World2Level4 from './World2/Level4';
import World2Level5 from './World2/Level5';

import World3Level1 from './World3/Level1';
import World3Level2 from './World3/Level2';
import World3Level3 from './World3/Level3';
import World3Level4 from './World3/Level4';
import World3Level5 from './World3/Level5';

type LevelScreenRouteProp = RouteProp<RootStackParamList, 'GameLevel'>;

// Tipo para las props que pueden recibir los niveles
interface LevelComponentProps {
  setAllowBack?: (allow: boolean) => void;
}

// Mapeo de componentes
const levelComponents: Record<number, Record<number, React.ComponentType<LevelComponentProps>>> = {
  1: {
    1: World1Level1,
    2: World1Level2,
    3: World1Level3,
    4: World1Level4,
    5: World1Level5,
  },
  2: {
    1: World2Level1,
    2: World2Level2,
    3: World2Level3,
    4: World2Level4,
    5: World2Level5,
  },
  3: {
    1: World3Level1,
    2: World3Level2,
    3: World3Level3,
    4: World3Level4,
    5: World3Level5,
  },
};

export default function LevelScreen() {
  const route = useRoute<LevelScreenRouteProp>();
  const { worldId, levelId } = route.params;

  const [allowBack, setAllowBack] = useState(true);

  const LevelComponent = levelComponents[worldId]?.[levelId];

  if (!LevelComponent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text>Nivel {levelId} del mundo {worldId} no disponible aún.</Text>
      </View>
    );
  }

  // Pasamos la función para que el nivel pueda deshabilitar el botón de atrás
  return <LevelComponent setAllowBack={setAllowBack} />;
}