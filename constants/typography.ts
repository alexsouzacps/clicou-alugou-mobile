export const typography = {
  fonts: {
    regular: 'Gantari-Regular',
    medium: 'Gantari-Medium',
    semibold: 'Gantari-SemiBold',
    bold: 'Gantari-Bold',
    extrabold: 'Gantari-ExtraBold',
  },

  // Escala de tamanhos
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 19,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
    '4xl': 40,
  },

  // Font weights
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Line heights
  leading: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
};
