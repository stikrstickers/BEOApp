import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl, Text, View, FlatListProps,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Check, X, Trash2 } from 'lucide-react-native';
import { cn } from '@/lib/cn';

// ── Row primitive ──────────────────────────────────────────────────────────

interface DataRowProps {
  /** Optional leading slot (avatar, icon, color dot). */
  leading?: React.ReactNode;
  /** Title — bold, larger. */
  title: string;
  /** Subtitle line under title. */
  subtitle?: string | React.ReactNode;
  /** Right-aligned content (badge, meta, count). */
  trailing?: React.ReactNode;
  /** Press handler (single-tap navigates, long-press enters multi-select). */
  onPress?: () => void;
  onLongPress?: () => void;
  /** Multi-select mode state. */
  selected?: boolean;
  selectable?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

export function DataRow({
  leading, title, subtitle, trailing,
  onPress, onLongPress, selected, selectable, className, accessibilityLabel,
}: DataRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? title}
      delayLongPress={300}
    >
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed ? 0.985 : 1 }}
          transition={{ type: 'timing', duration: 120 }}
          className={cn(
            'flex-row items-center rounded-xl px-3 py-3',
            selected ? 'bg-brand-50' : 'bg-white',
            className,
          )}
        >
          {selectable ? (
            <View
              className={cn(
                'mr-3 h-5 w-5 items-center justify-center rounded-md border',
                selected ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white',
              )}
            >
              {selected ? <Check size={12} color="#fff" /> : null}
            </View>
          ) : leading ? (
            <View className="mr-3">{leading}</View>
          ) : null}
          <View className="flex-1 pr-2">
            <Text className="text-[15px] font-semibold text-ink-900" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              typeof subtitle === 'string'
                ? <Text className="mt-0.5 text-xs text-ink-500" numberOfLines={1}>{subtitle}</Text>
                : <View className="mt-0.5">{subtitle}</View>
            ) : null}
          </View>
          {trailing ? <View>{trailing}</View> : null}
        </MotiView>
      )}
    </Pressable>
  );
}


// ── List wrapper with multi-select ────────────────────────────────────────

export interface BulkAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
  onPress: (ids: number[]) => void | Promise<void>;
}

interface DataListProps<T extends { id: number }> {
  data: T[];
  renderItem: (
    item: T,
    helpers: {
      selectionMode: boolean;
      selected: boolean;
      toggleSelected: () => void;
      enterSelection: () => void;
    },
  ) => React.ReactNode;
  keyExtractor?: (item: T) => string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyState?: React.ReactNode;
  /** Bulk actions revealed when ≥1 item is selected. Pass [] to disable. */
  bulkActions?: BulkAction[];
  ListHeaderComponent?: FlatListProps<T>['ListHeaderComponent'];
  contentContainerStyle?: FlatListProps<T>['contentContainerStyle'];
  ItemSeparator?: React.ReactElement;
}

export function DataList<T extends { id: number }>({
  data, renderItem, keyExtractor,
  refreshing, onRefresh, emptyState,
  bulkActions, ListHeaderComponent, contentContainerStyle,
  ItemSeparator,
}: DataListProps<T>) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const enterSelection = useCallback(() => setSelectionMode(true), []);
  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback((id: number) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(data.map((d) => d.id)));
  }, [data]);

  const selectedArr = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return (
    <View className="flex-1">
      <FlatList
        data={data}
        keyExtractor={keyExtractor ?? ((item) => String(item.id))}
        renderItem={({ item }) => (
          <>{renderItem(item, {
            selectionMode,
            selected: selectedIds.has(item.id),
            toggleSelected: () => toggle(item.id),
            enterSelection,
          })}</>
        )}
        ItemSeparatorComponent={ItemSeparator ? () => ItemSeparator : undefined}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={emptyState ? <>{emptyState}</> : null}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor="#6366F1"
            />
          ) : undefined
        }
        contentContainerStyle={contentContainerStyle}
      />

      {/* Bulk action bar — slides up when items are selected */}
      <AnimatePresence>
        {selectionMode && selectedArr.length > 0 && (bulkActions?.length ?? 0) > 0 ? (
          <MotiView
            from={{ translateY: 80, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: 80, opacity: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            className="absolute inset-x-3 bottom-3 flex-row items-center rounded-2xl bg-ink-900 px-3 py-2.5 shadow-lg"
          >
            <Pressable
              onPress={exitSelection}
              hitSlop={12}
              className="mr-2 p-1"
              accessibilityRole="button" accessibilityLabel="Exit selection"
            >
              <X size={18} color="#fff" />
            </Pressable>
            <Text className="mr-3 text-sm font-semibold text-white">
              {selectedArr.length} selected
            </Text>
            <Pressable onPress={selectAll} hitSlop={8} className="mr-3 p-1">
              <Text className="text-xs font-medium text-ink-300">All</Text>
            </Pressable>
            <View className="ml-auto flex-row gap-x-1">
              {bulkActions!.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={async () => { await a.onPress(selectedArr); exitSelection(); }}
                  hitSlop={6}
                  accessibilityRole="button" accessibilityLabel={a.label}
                  className={cn(
                    'flex-row items-center rounded-xl px-3 py-1.5',
                    a.tone === 'danger' ? 'bg-danger-500' : 'bg-white/15',
                  )}
                >
                  {a.icon ? <View className="mr-1.5">{a.icon}</View> : null}
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      a.tone === 'danger' ? 'text-white' : 'text-white',
                    )}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

/** Convenience: a Trash bulk action (planner clicks "Delete N" → confirm). */
export const trashBulkAction = (onConfirm: (ids: number[]) => void): BulkAction => ({
  key: 'delete',
  label: 'Delete',
  tone: 'danger',
  icon: <Trash2 size={14} color="#fff" />,
  onPress: onConfirm,
});
