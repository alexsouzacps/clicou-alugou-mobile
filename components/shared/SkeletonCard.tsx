import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { radius, spacing } from '@/constants/layout';

interface SkeletonCardProps {
  height?: number;
}

export function SkeletonCard({ height = 220 }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { height, opacity }]}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.contentPlaceholder}>
        <View style={styles.titleLine} />
        <View style={styles.subtitleLine} />
        <View style={styles.priceLine} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    marginVertical: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: colors.bg.skeleton,
  },
  contentPlaceholder: {
    padding: spacing.md,
  },
  titleLine: {
    width: '80%',
    height: 16,
    backgroundColor: colors.bg.skeleton,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  subtitleLine: {
    width: '50%',
    height: 12,
    backgroundColor: colors.bg.skeleton,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  priceLine: {
    width: '35%',
    height: 18,
    backgroundColor: colors.bg.skeleton,
    borderRadius: radius.sm,
  },
});
