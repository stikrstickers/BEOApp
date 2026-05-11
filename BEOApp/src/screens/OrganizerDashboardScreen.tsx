import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Calendar, Users, ChevronRight, Inbox, LogOut, Sparkles, Search,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  STATUS_LABEL, STATUS_TONE, EVENT_TYPE_LABEL,
  type EventRequest, type EventStatus,
} from '@/lib/types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OrganizerDashboard'>;

const STATUS_FILTERS: Array<{ value: EventStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'new',       label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OrganizerDashboardScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [filter, setFilter] = useState<EventStatus | 'all'>('all');

  const q = useQuery<{ requests: EventRequest[] }>({
    queryKey: ['event-requests'],
    queryFn:  () => api('/api/event-requests/'),
  });

  const filtered = useMemo(() => {
    const items = q.data?.requests ?? [];
    if (filter === 'all') return items;
    return items.filter((r) => r.status === filter);
  }, [q.data, filter]);

  const counts = useMemo(() => {
    const items = q.data?.requests ?? [];
    const byStatus: Record<string, number> = {};
    for (const r of items) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    return {
      all: items.length,
      new: byStatus.new ?? 0,
      in_review: byStatus.in_review ?? 0,
      confirmed: byStatus.confirmed ?? 0,
      completed: byStatus.completed ?? 0,
    };
  }, [q.data]);

  const renderItem = ({ item, index }: { item: EventRequest; index: number }) => {
    const tone = STATUS_TONE[item.status];
    return (
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 280, delay: index * 30 }}
        className="mb-3"
      >
        <Card
          onPress={() => navigation.navigate('EventRequestDetail', { id: item.id })}
          accessibilityLabel={`Open ${item.event_name}`}
        >
          <View className="flex-row items-center p-4">
            <Avatar name={item.client_name || item.event_name} size="md" />
            <View className="ml-3 flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-2 text-base font-semibold text-ink-900" numberOfLines={1}>
                  {item.event_name}
                </Text>
                <Badge bgClassName={tone.bg} textClassName={tone.text} dot>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </View>
              <Text className="mt-0.5 text-sm text-ink-500" numberOfLines={1}>
                {item.client_name}{item.client_org ? ` · ${item.client_org}` : ''}
              </Text>
              <View className="mt-2 flex-row items-center">
                <Calendar size={14} color="#64748B" />
                <Text className="ml-1.5 text-xs text-ink-500">{formatDate(item.preferred_date)}</Text>
                <View className="mx-2 h-1 w-1 rounded-full bg-ink-300" />
                <Users size={14} color="#64748B" />
                <Text className="ml-1 text-xs text-ink-500">{item.headcount}</Text>
                <View className="mx-2 h-1 w-1 rounded-full bg-ink-300" />
                <Text className="text-xs text-ink-500">{EVENT_TYPE_LABEL[item.event_type]}</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" className="ml-1" />
          </View>
        </Card>
      </MotiView>
    );
  };

  const ListHeader = (
    <View>
      {/* Greeting card */}
      <MotiView
        from={{ opacity: 0, translateY: -6 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        className="mb-5"
      >
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 20 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="mb-1 flex-row items-center">
                <Sparkles size={16} color="#FDE68A" />
                <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
                  {user?.organization?.name ?? 'Workspace'}
                </Text>
              </View>
              <Text className="text-2xl font-bold text-white">Hey {user?.name?.split(' ')[0] ?? 'there'}</Text>
              <Text className="mt-1 text-sm text-white/85">
                {counts.new} new · {counts.in_review} in review · {counts.confirmed} confirmed
              </Text>
            </View>
            <Pressable
              onPress={signOut}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
              accessibilityRole="button" accessibilityLabel="Sign out"
            >
              <LogOut size={18} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>
      </MotiView>

      {/* Filter chips */}
      <View className="mb-4 flex-row flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = f.value === filter;
          const n = counts[f.value as keyof typeof counts] ?? 0;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${f.label} (${n})`}
              className={cn(
                'flex-row items-center rounded-full border px-3.5 py-2',
                active ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white',
              )}
            >
              <Text className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-ink-700')}>
                {f.label}
              </Text>
              <View className={cn(
                'ml-2 rounded-full px-1.5 py-0.5',
                active ? 'bg-brand-600' : 'bg-ink-200',
              )}>
                <Text className={cn('text-[10px] font-bold', active ? 'text-white' : 'text-ink-700')}>
                  {n}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (q.isLoading) {
    return (
      <Screen>
        {ListHeader}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-24 w-full" />
        ))}
      </Screen>
    );
  }

  return (
    <Screen contentClassName="px-5 py-0">
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            icon={<Inbox size={26} color="#6366F1" />}
            title={filter === 'all' ? 'No requests yet' : `No ${STATUS_LABEL[filter as EventStatus] ?? filter} requests`}
            description={
              filter === 'all'
                ? `Share your handle "${user?.organization?.slug}" with clients to start receiving requests`
                : 'Try a different filter'
            }
          />
        }
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#6366F1" />
        }
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
      />
    </Screen>
  );
}
