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
import World1Level6 from './World1/Level6';

import World2Level1 from './World2/Level1';
import World2Level2 from './World2/Level2';
import World2Level3 from './World2/Level3';
import World2Level4 from './World2/Level4';
import World2Level5 from './World2/Level5';
import World2Level6 from './World2/Level6';
import World2Level7 from './World2/Level7';

import World3Level1 from './World3/Level1';
import World3Level2 from './World3/Level2';
import World3Level3 from './World3/Level3';
import World3Level4 from './World3/Level4';
import World3Level5 from './World3/Level5';
import World3Level6 from './World3/Level6';
import World3Level7 from './World3/Level7';

import World4Level1 from './World4/Level1';
import World4Level2 from './World4/Level2';
import World4Level3 from './World4/Level3';
import World4Level4 from './World4/Level4';
import World4Level5 from './World4/Level5';
import World4Level6 from './World4/Level6';
import World4Level7 from './World4/Level7';

import World5Level1 from './World5/Level1';
import World5Level2 from './World5/Level2';
import World5Level3 from './World5/Level3';
import World5Level4 from './World5/Level4';
import World5Level5 from './World5/Level5';
import World5Level6 from './World5/Level6';
import World5Level7 from './World5/Level7';

import World6Level1 from './World6/Level1';
import World6Level2 from './World6/Level2';
import World6Level3 from './World6/Level3';
import World6Level4 from './World6/Level4';
import World6Level5 from './World6/Level5';
import World6Level6 from './World6/Level6';
import World6Level7 from './World6/Level7'; 
import World6Level8 from './World6/Level8';

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
    6: World1Level6,
  },
  2: {
    1: World2Level1,
    2: World2Level2,
    3: World2Level3,
    4: World2Level4,
    5: World2Level5,
    6: World2Level6,
    7: World2Level7,
  },
  3: {
    1: World3Level1,
    2: World3Level2,
    3: World3Level3,
    4: World3Level4,
    5: World3Level5,
    6: World3Level6,
    7: World3Level7,
  },
  4: {
    1: World4Level1,
    2: World4Level2,
    3: World4Level3,
    4: World4Level4,
    5: World4Level5,
    6: World4Level6,
    7: World4Level7,
  },
  5: {
    1: World5Level1,
    2: World5Level2,
    3: World5Level3,
    4: World5Level4,
    5: World5Level5,
    6: World5Level6,
    7: World5Level7,
  },
  6: {
    1: World6Level1,
    2: World6Level2,
    3: World6Level3,
    4: World6Level4,
    5: World6Level5,
    6: World6Level6,
    7: World6Level7,
    8: World6Level8,
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