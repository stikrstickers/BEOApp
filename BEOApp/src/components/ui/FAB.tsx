import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { cn } from '@/lib/cn';

interface FABProps {
  onPress: () => void;
  /** Optional label inline next to the +. Looks great for "New event" etc. */
  label?: string;
  className?: string;
  accessibilityLabel?: string;
}

/** Gradient floating action button — pinned bottom-right of a screen. */
export function FAB({ onPress, label, className, accessibilityLabel }: FABProps) {
  return (
    <View className={cn('absolute bottom-5 right-5 z-10', className)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? 'Add new'}
      >
        {({ pressed }) => (
          <MotiView
            animate={{ scale: pressed ? 0.94 : 1 }}
            transition={{ type: 'timing', duration: 120 }}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 999,
                paddingHorizontal: label ? 18 : 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#6366F1',
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <Plus size={20} color="#fff" />
              {label ? (
                <Text className="ml-1.5 text-sm font-bold text-white">{label}</Text>
              ) : null}
            </LinearGradient>
          </MotiView>
        )}
      </Pressable>
    </View>
  );
}
