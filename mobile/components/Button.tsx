import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  type PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: PressableProps['onPress'];
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: Size;
  style?: ViewStyle | ViewStyle[];
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  size = 'md',
  style,
}: ButtonProps) {
  const minHeight = size === 'sm' ? 38 : 48;
  const isDisabled = disabled || loading;

  const baseStyle = [
    styles.base,
    { minHeight },
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
  ];

  const content = loading ? (
    <ActivityIndicator
      color={variant === 'primary' ? '#17112f' : Colors.text}
      size="small"
    />
  ) : (
    <Text
      style={[
        styles.label,
        size === 'sm' && styles.labelSm,
        variant === 'primary' && styles.labelPrimary,
        variant === 'ghost' && styles.labelGhost,
        variant === 'outline' && styles.labelOutline,
      ]}
    >
      {label}
    </Text>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={[Colors.btnFrom, Colors.btnTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { minHeight }, fullWidth && styles.fullWidth, styles.primaryShadow]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        ...baseStyle,
        variant === 'ghost' && styles.ghost,
        variant === 'outline' && styles.outline,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.44,
  },
  pressed: {
    opacity: 0.82,
  },
  ghost: {
    backgroundColor: Colors.panel,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryShadow: {
    shadowColor: Colors.btnTo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelSm: {
    fontSize: 13,
  },
  labelPrimary: {
    color: '#17112f',
  },
  labelGhost: {
    color: Colors.text,
  },
  labelOutline: {
    color: Colors.muted,
  },
});
