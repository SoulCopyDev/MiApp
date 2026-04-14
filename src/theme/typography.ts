import { StyleSheet } from 'react-native';

export const typography = StyleSheet.create({
  // Familias (deben coincidir con las cargadas en useCustomFonts)
  regular: {
    fontFamily: 'PlusJakartaSans-Regular',
  },
  bold: {
    fontFamily: 'PlusJakartaSans-Bold',
  },
  extraBold: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },

  // Tamaños
  heading1: {
    fontSize: 28,
    lineHeight: 36,
  },
  heading2: {
    fontSize: 22,
    lineHeight: 30,
  },
  heading3: {
    fontSize: 20,
    lineHeight: 28,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
  },
});