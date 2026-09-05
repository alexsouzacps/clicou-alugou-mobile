import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/layout';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
  };
  role?: 'owner' | 'tenant';
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  rightAction,
  role,
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Stripe de cor por papel (Proprietário = verde, Locatário = azul) */}
      {role && (
        <View
          style={[
            styles.stripe,
            { backgroundColor: role === 'owner' ? colors.success : colors.cyan },
          ]}
        />
      )}

      <View style={styles.content}>
        <View style={styles.leftRow}>
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.navy} />
            </TouchableOpacity>
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={styles.rightButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name={rightAction.icon} size={24} color={colors.navy} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  stripe: {
    height: 3,
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.lg,
    color: colors.navy,
  },
  subtitle: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  rightButton: {
    padding: spacing.xs,
    marginLeft: spacing.md,
  },
});
