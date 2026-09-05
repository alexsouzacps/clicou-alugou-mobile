import React from 'react';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';

interface MoveInDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Versão web — `@react-native-community/datetimepicker` não tem build pra web
 * e quebra o bundle inteiro se importado sem esse arquivo `.web.tsx` (o Metro
 * escolhe este arquivo automaticamente ao empacotar pra web).
 */
export function MoveInDatePicker({ value, onChange, minimumDate }: MoveInDatePickerProps) {
  return React.createElement('input', {
    type: 'date',
    value: value ? toISODate(value) : '',
    min: minimumDate ? toISODate(minimumDate) : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw) onChange(new Date(`${raw}T00:00:00`));
    },
    style: {
      display: 'flex',
      width: '100%',
      minHeight: 48,
      boxSizing: 'border-box',
      backgroundColor: colors.bg.input,
      border: `1px solid ${colors.border.default}`,
      borderRadius: radius.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      fontSize: typography.sizes.base,
      color: colors.black,
      fontFamily: typography.fonts.regular,
    },
  });
}
