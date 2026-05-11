import React from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, { wrap: string; text: string }> = {
  sm: { wrap: 'h-8 w-8',   text: 'text-xs'  },
  md: { wrap: 'h-10 w-10', text: 'text-sm'  },
  lg: { wrap: 'h-14 w-14', text: 'text-lg'  },
};

// Generate a stable indigo/violet hue from the name so each user has a
// consistent (but distinct) color.
const PALETTE = [
  'bg-brand-500', 'bg-brand-600', 'bg-brand-700',
  'bg-fuchsia-500', 'bg-violet-500', 'bg-sky-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const s = SIZE[size];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';
  const color = PALETTE[hashIndex(name, PALETTE.length)];

  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        s.wrap,
        color,
        className,
      )}
    >
      <Text className={cn('font-bold text-white', s.text)}>{initials}</Text>
    </View>
  );
}
