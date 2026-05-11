import React from 'react';
import { Text, View } from 'react-native';
import { MotiView } from 'moti';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 250 }}
      className={cn('items-center justify-center px-6 py-12', className)}
    >
      {icon ? (
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          {icon}
        </View>
      ) : null}
      <Text className="mb-1 text-center text-base font-semibold text-ink-900">{title}</Text>
      {description ? (
        <Text className="mb-4 text-center text-sm text-ink-500 max-w-xs">{description}</Text>
      ) : null}
      {action}
    </MotiView>
  );
}
