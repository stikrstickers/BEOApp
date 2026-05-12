import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { cn } from '@/lib/cn';

interface Segment<T extends string> {
  value: T;
  label: string;
  /** Optional count badge — e.g. "12" next to the label. */
  badge?: number | string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<Segment<T>>;
  onChange: (v: T) => void;
  className?: string;
}

/** Pill-style segmented control. Used as the top filter in Contacts/Inventory etc. */
export function SegmentedControl<T extends string>({
  value, options, onChange, className,
}: SegmentedControlProps<T>) {
  return (
    <View
      className={cn(
        'flex-row rounded-full bg-ink-100 p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            className="flex-1"
          >
            <MotiView
              animate={{ scale: active ? 1 : 0.985 }}
              transition={{ type: 'timing', duration: 120 }}
              className={cn(
                'flex-row items-center justify-center rounded-full px-2 py-2',
                active && 'bg-white shadow-sm',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  active ? 'text-ink-900' : 'text-ink-500',
                )}
                numberOfLines={1}
              >
                {o.label}
              </Text>
              {o.badge !== undefined && o.badge !== null ? (
                <View
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5',
                    active ? 'bg-brand-100' : 'bg-ink-200',
                  )}
                >
                  <Text
                    className={cn(
                      'text-[10px] font-bold',
                      active ? 'text-brand-700' : 'text-ink-700',
                    )}
                  >
                    {o.badge}
                  </Text>
                </View>
              ) : null}
            </MotiView>
          </Pressable>
        );
      })}
    </View>
  );
}
