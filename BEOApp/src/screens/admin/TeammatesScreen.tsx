import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, ChevronRight, Users as UsersIcon, Briefcase } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataList, DataRow, trashBulkAction } from '@/components/ui/DataList';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { EmploymentType, TeamMember } from '@/lib/types';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TeammatesHome'>;
type Segment = EmploymentType | 'all';

const ROLE_LABEL: Record<string, string> = {
  coordinator: 'Coordinator', chef: 'Chef', bartender: 'Bartender',
  server: 'Server', it: 'IT / A/V', setup: 'Setup', security: 'Security',
  other: 'Other',
};

export default function TeammatesScreen({ navigation }: Props) {
  const [seg, setSeg] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery<{ members: TeamMember[] }>({
    queryKey: ['team', seg],
    queryFn:  () => api(`/api/team/${seg !== 'all' ? `?employment_type=${seg}` : ''}`),
  });

  const filtered = useMemo(() => {
    const items = q.data?.members ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((m) =>
      m.name.toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term)
    );
  }, [q.data, search]);

  const counts = {
    all:   (q.data?.members ?? []).length,
    staff: (q.data?.members ?? []).filter((m: any) => m.employment_type === 'staff').length,
    temp:  (q.data?.members ?? []).filter((m: any) => m.employment_type === 'temp').length,
  };

  const deleteM = useMutation<void, ApiError, number[]>({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api(`/api/team/${id}/`, { method: 'DELETE' })));
    },
    onSuccess: () => {
      toast.success('Removed');
      qc.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (e) => toast.error('Could not remove', e.message),
  });

  const header = (
    <View className="px-5 pt-2 pb-3">
      <View className="flex-row items-center">
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12} className="-ml-2 mr-1 p-2"
          accessibilityRole="button" accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color="#334155" />
        </Pressable>
      </View>
      <Text className="mt-1 text-2xl font-bold text-ink-900">Teammates</Text>
      <Text className="mt-0.5 text-sm text-ink-500">
        Your in-house staff and on-call temps
      </Text>
      <SegmentedControl<Segment>
        className="mt-4"
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'all',   label: 'All',   badge: counts.all },
          { value: 'staff', label: 'Staff', badge: counts.staff },
          { value: 'temp',  label: 'Temps', badge: counts.temp },
        ]}
      />
      <SearchBar
        containerClassName="mt-3"
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email…"
      />
    </View>
  );

  return (
    <Screen contentClassName="px-0 py-0">
      <DataList
        data={filtered}
        ListHeaderComponent={header}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        bulkActions={[trashBulkAction((ids) => deleteM.mutate(ids))]}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={(m, helpers) => (
          <View className="px-5">
            <DataRow
              selectable={helpers.selectionMode}
              selected={helpers.selected}
              onPress={() => helpers.selectionMode ? helpers.toggleSelected() : toast.info('Edit coming soon')}
              onLongPress={() => { helpers.enterSelection(); helpers.toggleSelected(); }}
              leading={<Avatar name={m.name} size="md" />}
              title={m.name}
              subtitle={
                <View className="flex-row items-center">
                  <Text className="text-xs text-ink-500">{ROLE_LABEL[m.role] ?? m.role}</Text>
                  {m.email ? (
                    <>
                      <View className="mx-1.5 h-1 w-1 rounded-full bg-ink-300" />
                      <Text className="text-xs text-ink-500" numberOfLines={1}>{m.email}</Text>
                    </>
                  ) : null}
                </View>
              }
              trailing={
                <View className="flex-row items-center">
                  <Badge
                    bgClassName={(m as any).employment_type === 'staff' ? 'bg-brand-50' : 'bg-ink-100'}
                    textClassName={(m as any).employment_type === 'staff' ? 'text-brand-700' : 'text-ink-700'}
                  >
                    {(m as any).employment_type === 'staff' ? 'Staff' : 'Temp'}
                  </Badge>
                  <ChevronRight size={16} color="#94A3B8" className="ml-1.5" />
                </View>
              }
            />
          </View>
        )}
        ItemSeparator={<View className="h-px bg-ink-100 mx-8" />}
        emptyState={
          <EmptyState
            icon={<UsersIcon size={24} color="#6366F1" />}
            title="No teammates yet"
            description="Add staff (W-2) or temps (1099) you can schedule on events"
          />
        }
      />
      <FAB
        onPress={() => toast.info('Add coming soon', 'Wire up the create modal')}
        label="New teammate"
      />
    </Screen>
  );
}
