import React from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/cn';

interface BadgeProps {
  children: React.ReactNode;
  // Tailwind classes for background + text. Pair these from STATUS_TONE etc.
  bgClassName?: string;
  textClassName?: string;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, bgClassName = 'bg-ink-100', textClassName = 'text-ink-700', className, dot }: BadgeProps) {
  return (
    <View
      className={cn(
        'flex-row items-center rounded-full px-2.5 py-1 self-start',
        bgClassName,
        className,
      )}
    >
      {dot ? (
        <View className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', textClassName.replace(/text-/g, 'bg-'))} />
      ) : null}
      <Text className={cn('text-xs font-semibold', textClassName)}>{children}</Text>
    </View>
  );
}
