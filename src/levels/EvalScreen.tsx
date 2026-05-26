import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../theme';

import Eval1 from './eval/Eval1';
import Eval2 from './eval/Eval2';
import Eval3 from './eval/Eval3';
import Eval4 from './eval/Eval4';
import Eval5 from './eval/Eval5';
import Eval6 from './eval/Eval6';
import EvalFinal from './eval/EvalFinal';

const EVAL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  '1': Eval1,
  '2': Eval2,
  '3': Eval3,
  '4': Eval4,
  '5': Eval5,
  '6': Eval6,
  'final': EvalFinal,
};

export default function EvalScreen() {
  const { worldId } = useLocalSearchParams<{ worldId: string }>();
  const Component = EVAL_COMPONENTS[worldId];

  if (!Component) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text>Evaluación no disponible: {worldId}</Text>
      </View>
    );
  }

  return <Component />;
}
