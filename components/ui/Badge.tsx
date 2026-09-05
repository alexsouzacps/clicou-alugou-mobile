import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { radius, spacing } from '@/constants/layout';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'owner' | 'tenant';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], styles[size], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], styles[`text_${size}`]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sizes
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // Variants
  success: {
    backgroundColor: '#dcfce7',
  },
  warning: {
    backgroundColor: '#fef3c7',
  },
  error: {
    backgroundColor: '#fee2e2',
  },
  info: {
    backgroundColor: '#e0f2fe',
  },
  neutral: {
    backgroundColor: colors.bg.input,
  },
  owner: {
    backgroundColor: colors.bg.owner,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  tenant: {
    backgroundColor: colors.bg.tenant,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  // Text
  text: {
    fontWeight: typography.weights.bold,
  },
  text_sm: {
    fontSize: typography.sizes.xs,
  },
  text_md: {
    fontSize: typography.sizes.sm,
  },
  text_success: {
    color: colors.success,
  },
  text_warning: {
    color: colors.warning,
  },
  text_error: {
    color: colors.error,
  },
  text_info: {
    color: colors.info,
  },
  text_neutral: {
    color: colors.gray,
  },
  text_owner: {
    color: colors.success,
  },
  text_tenant: {
    color: colors.cyan,
  },
});
