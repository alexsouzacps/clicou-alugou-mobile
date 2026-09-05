import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { radius, spacing } from '@/constants/layout';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const handlePress = () => {
    if (loading || disabled) return;
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[size],
    styles[variant],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style as ViewStyle,
  ];

  const textStyles: TextStyle[] = [
    styles.textBase,
    styles[`text_${size}` as keyof typeof styles] as TextStyle,
    styles[`text_${variant}` as keyof typeof styles] as TextStyle,
    disabled && styles.textDisabled,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.cyan}
          size="small"
        />
      ) : (
        <>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18}
              color={
                disabled
                  ? colors.gray
                  : variant === 'primary' || variant === 'danger'
                  ? colors.white
                  : variant === 'secondary'
                  ? colors.navy
                  : colors.cyan
              }
              style={{ marginRight: spacing.sm }}
            />
          )}
          <Text style={textStyles}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: colors.bg.input,
    borderColor: colors.border.default,
    elevation: 0,
  },
  // Sizes
  sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  md: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
  },
  lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 54,
  },
  // Variants
  primary: {
    backgroundColor: colors.orange, // Momentum Orange
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
  // Text sizes
  textBase: {
    fontFamily: typography.fonts.bold,
  },
  text_sm: {
    fontSize: typography.sizes.sm,
  },
  text_md: {
    fontSize: typography.sizes.base,
  },
  text_lg: {
    fontSize: typography.sizes.md,
  },
  // Text variants
  text_primary: {
    color: colors.white,
  },
  text_secondary: {
    color: colors.navy,
  },
  text_ghost: {
    color: colors.cyan,
  },
  text_danger: {
    color: colors.white,
  },
  textDisabled: {
    color: colors.gray,
  },
});
