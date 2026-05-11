import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const SIZE_MAP: Record<ButtonSize, { wrap: string; text: string }> = {
  sm: { wrap: 'px-3 py-2',   text: 'text-sm font-semibold' },
  md: { wrap: 'px-4 py-3',   text: 'text-base font-semibold' },
  lg: { wrap: 'px-5 py-4',   text: 'text-base font-semibold' },
};

const VARIANT_MAP: Record<ButtonVariant, { wrap: string; text: string; pressed: string }> = {
  primary:   {
    wrap: 'bg-brand-600 border border-brand-600',
    text: 'text-white',
    pressed: 'bg-brand-700',
  },
  secondary: {
    wrap: 'bg-ink-100 border border-ink-200',
    text: 'text-ink-900',
    pressed: 'bg-ink-200',
  },
  ghost:     {
    wrap: 'bg-transparent border border-transparent',
    text: 'text-ink-700',
    pressed: 'bg-ink-100',
  },
  danger:    {
    wrap: 'bg-danger-500 border border-danger-500',
    text: 'text-white',
    pressed: 'bg-danger-600',
  },
  outline:   {
    wrap: 'bg-white border border-ink-300',
    text: 'text-ink-900',
    pressed: 'bg-ink-50',
  },
};

export function Button({
  onPress, variant = 'primary', size = 'md', disabled, loading,
  fullWidth, icon, iconRight, className, children,
  accessibilityLabel, accessibilityHint,
}: ButtonProps) {
  const s = SIZE_MAP[size];
  const v = VARIANT_MAP[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cn(
        'flex-row items-center justify-center rounded-2xl',
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
    >
      {({ pressed }) => (
        <MotiView
          from={{ scale: 1 }}
          animate={{ scale: pressed && !isDisabled ? 0.97 : 1 }}
          transition={{ type: 'timing', duration: 120 }}
          className={cn(
            'w-full flex-row items-center justify-center rounded-2xl',
            s.wrap,
            v.wrap,
            pressed && !isDisabled && v.pressed,
          )}
        >
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === 'primary' || variant === 'danger' ? '#fff' : '#334155'}
            />
          ) : (
            <>
              {icon ? <View className="mr-2">{icon}</View> : null}
              {typeof children === 'string'
                ? <Text className={cn(s.text, v.text)}>{children}</Text>
                : children}
              {iconRight ? <View className="ml-2">{iconRight}</View> : null}
            </>
          )}
        </MotiView>
      )}
    </Pressable>
  );
}
