import React, { useState } from 'react';
import { TextInput, TextInputProps, View, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { cn } from '@/lib/cn';

interface SearchBarProps extends Omit<TextInputProps, 'className'> {
  containerClassName?: string;
}

export function SearchBar({ containerClassName, value, onChangeText, ...props }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={cn(
        'flex-row items-center rounded-2xl border bg-white px-3.5',
        focused ? 'border-brand-500' : 'border-ink-200',
        containerClassName,
      )}
    >
      <Search size={18} color="#64748B" />
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="flex-1 px-2 py-2.5 text-base text-ink-900"
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText?.('')}
          hitSlop={12}
          className="p-1"
          accessibilityRole="button" accessibilityLabel="Clear search"
        >
          <X size={16} color="#94A3B8" />
        </Pressable>
      ) : null}
    </View>
  );
}
