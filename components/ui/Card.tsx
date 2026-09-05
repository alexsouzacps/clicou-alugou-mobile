import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { radius, shadow, spacing } from '@/constants/layout';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  noPadding?: boolean;
}

export function Card({
  children,
  onPress,
  style,
  elevated = true,
  noPadding = false,
}: CardProps) {
  const cardStyles: ViewStyle[] = [
    styles.card,
    elevated ? shadow.md : styles.bordered,
    noPadding && styles.noPadding,
    style as ViewStyle,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  noPadding: {
    padding: 0,
    overflow: 'hidden',
  },
});
