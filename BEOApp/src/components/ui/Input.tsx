import React, { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, View, Text, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { cn } from '@/lib/cn';

interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
  inputClassName?: string;
  isPassword?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, hint, error, leftIcon, rightIcon, containerClassName, inputClassName,
    isPassword, secureTextEntry, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const secure = isPassword ? !pwVisible : secureTextEntry;

  return (
    <View className={cn('w-full', containerClassName)}>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-ink-700">{label}</Text>
      ) : null}
      <View
        className={cn(
          'flex-row items-center rounded-2xl border bg-white px-3.5',
          error
            ? 'border-danger-500'
            : focused
              ? 'border-brand-500'
              : 'border-ink-200',
        )}
      >
        {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          {...props}
          secureTextEntry={secure}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          placeholderTextColor="#94A3B8"
          className={cn('flex-1 py-3 text-base text-ink-900', inputClassName)}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setPwVisible((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={pwVisible ? 'Hide password' : 'Show password'}
            className="ml-2 p-1"
          >
            {pwVisible ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
          </Pressable>
        ) : rightIcon ? (
          <View className="ml-2">{rightIcon}</View>
        ) : null}
      </View>
      {error ? (
        <Text className="mt-1.5 text-xs text-danger-600">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-ink-500">{hint}</Text>
      ) : null}
    </View>
  );
});
