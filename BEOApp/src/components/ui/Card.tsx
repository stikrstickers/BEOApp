import React from 'react';
import { Pressable, View } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { cn } from '@/lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  /** Subtle gradient border (MagicUI vibe). */
  gradientBorder?: boolean;
  accessibilityLabel?: string;
}

export function Card({ children, className, onPress, gradientBorder, accessibilityLabel }: CardProps) {
  const inner = (
    <View
      className={cn(
        'rounded-2xl bg-white border border-ink-200/80',
        // RN doesn't support box-shadow via class; use elevation via shadow* utilities
        'shadow-sm',
        className,
      )}
    >
      {children}
    </View>
  );

  const withGradient = gradientBorder ? (
    <LinearGradient
      colors={['#A5B4FC', '#818CF8', '#F472B6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 18, padding: 1.5 }}
    >
      {inner}
    </LinearGradient>
  ) : inner;

  if (!onPress) return withGradient;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed ? 0.985 : 1 }}
          transition={{ type: 'timing', duration: 120 }}
        >
          {withGradient}
        </MotiView>
      )}
    </Pressable>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cn('px-5 pt-5 pb-3', className)}>{children}</View>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cn('px-5 pb-5', className)}>{children}</View>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cn('px-5 py-4 border-t border-ink-100', className)}>{children}</View>;
}
