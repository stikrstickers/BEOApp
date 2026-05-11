import React from 'react';
import { MotiView } from 'moti';
import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

/** Shimmering placeholder block. Combine widths/heights via className. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <MotiView
      from={{ opacity: 0.4 }}
      animate={{ opacity: 0.85 }}
      transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
      className={cn('rounded-xl bg-ink-200', className)}
    />
  );
}
