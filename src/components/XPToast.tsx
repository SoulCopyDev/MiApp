import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { typography } from '../theme';

interface Props {
  amount: number;
  onHide: () => void;
  bgColor?: string;
  textColor?: string;
}

export default function XPToast({ amount, onHide, bgColor = '#1e293b', textColor = '#fbbf24' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]),
      Animated.delay(1000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]);
    seq.start(({ finished }) => { if (finished) onHide(); });
    return () => seq.stop();
  }, []);

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <Text style={[styles.text, { color: textColor }]}>+{amount} XP ✨</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
    elevation: 10,
  },
  text: {
    ...typography.bold,
    fontSize: 15,
  },
});
