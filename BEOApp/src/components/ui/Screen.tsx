import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

/** Standard screen wrapper — safe area + optional scroll + neutral bg. */
export function Screen({
  children, scroll, className, contentClassName,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-ink-50', className)}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={cn('px-5 py-4', contentClassName)}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn('flex-1 px-5 py-4', contentClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
