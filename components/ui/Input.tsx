import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { radius, spacing } from '@/constants/layout';

interface InputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  hint?: string;
  type?: 'text' | 'email' | 'phone' | 'password' | 'currency' | 'cpf';
  leftIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  hint,
  type = 'text',
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const secureTextEntry = isPassword && !showPassword;

  const getKeyboardType = () => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'phone':
        return 'phone-pad';
      case 'currency':
      case 'cpf':
        return 'numeric';
      default:
        return 'default';
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          !!error && styles.errorBorder,
        ]}
      >
        {leftIcon && (
          <MaterialCommunityIcons
            name={leftIcon}
            size={20}
            color={isFocused ? colors.cyan : colors.gray}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.gray}
          value={value}
          onChangeText={onChangeText}
          keyboardType={getKeyboardType()}
          secureTextEntry={secureTextEntry}
          autoCapitalize={type === 'email' || type === 'password' ? 'none' : 'sentences'}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIconPressable}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.gray}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIconPressable}
          >
            <MaterialCommunityIcons name={rightIcon} size={20} color={colors.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  focused: {
    borderColor: colors.border.focus,
    backgroundColor: colors.white,
  },
  errorBorder: {
    borderColor: colors.border.error,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIconPressable: {
    padding: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.black,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  hintText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: spacing.xs,
  },
});
