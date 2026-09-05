import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';

interface MoveInDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

function formatDateLabel(date: Date | null): string {
  if (!date) return 'Selecionar data';
  return date.toLocaleDateString('pt-BR');
}

/** Versão nativa (iOS/Android) — usa o picker nativo do sistema. */
export function MoveInDatePicker({ value, onChange, minimumDate }: MoveInDatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View>
      <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
        <MaterialCommunityIcons name="calendar" size={20} color={colors.gray} />
        <Text style={[styles.dateButtonText, !value && styles.dateButtonPlaceholder]}>
          {formatDateLabel(value)}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          minimumDate={minimumDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selectedDate) => {
            setShowPicker(Platform.OS === 'ios');
            if (event.type !== 'dismissed' && selectedDate) {
              onChange(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  dateButtonText: {
    fontSize: typography.sizes.base,
    color: colors.black,
  },
  dateButtonPlaceholder: {
    color: colors.gray,
  },
});
