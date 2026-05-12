import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, MapPin, Building, Mail, Phone, ArrowLeft } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataList, DataRow, trashBulkAction } from '@/components/ui/DataList';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { Site } from '@/lib/types';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'SitesHome'>;

export default function SitesScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery<{ sites: Site[] }>({
    queryKey: ['sites'],
    queryFn:  () => api('/api/sites/?with_venues=1'),
  });

  const filtered = useMemo(() => {
    const items = q.data?.sites ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      s.city.toLowerCase().includes(term) ||
      (s.contact_name || '').toLowerCase().includes(term)
    );
  }, [q.data, search]);

  const deleteM = useMutation<void, ApiError, number[]>({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api(`/api/sites/${id}/`, { method: 'DELETE' })));
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (e) => toast.error('Could not delete', e.message),
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
      <Text className="mt-1 text-2xl font-bold text-ink-900">Venues</Text>
      <Text className="mt-0.5 text-sm text-ink-500">
        Sites you operate or book into, with their rooms inside
      </Text>
      <SearchBar
        containerClassName="mt-4"
        value={search}
        onChangeText={setSearch}
        placeholder="Search sites, cities, contacts…"
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
        renderItem={(s, helpers) => (
          <View className="px-5">
            <DataRow
              selectable={helpers.selectionMode}
              selected={helpers.selected}
              onPress={() =>
                helpers.selectionMode
                  ? helpers.toggleSelected()
                  : navigation.navigate('SiteDetail', { id: s.id })
              }
              onLongPress={() => { helpers.enterSelection(); helpers.toggleSelected(); }}
              leading={
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-brand-50">
                  <Building size={18} color="#6366F1" />
                </View>
              }
              title={s.name}
              subtitle={
                <View className="flex-row items-center">
                  {s.city ? (
                    <>
                      <MapPin size={11} color="#64748B" />
                      <Text className="ml-1 text-xs text-ink-500">
                        {s.city}{s.state_region ? `, ${s.state_region}` : ''}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-xs text-ink-500">No address</Text>
                  )}
                </View>
              }
              trailing={
                <View className="flex-row items-center">
                  {(s.venues?.length ?? 0) > 0 ? (
                    <Badge bgClassName="bg-ink-100" textClassName="text-ink-700">
                      {s.venues!.length} venue{s.venues!.length === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                  <ChevronRight size={16} color="#94A3B8" className="ml-1.5" />
                </View>
              }
            />
          </View>
        )}
        ItemSeparator={<View className="h-px bg-ink-100 mx-8" />}
        emptyState={
          <EmptyState
            icon={<Building size={24} color="#6366F1" />}
            title="No sites yet"
            description="Add the venues you work with so events can be booked into their spaces"
          />
        }
      />
      <FAB
        onPress={() => toast.info('Add coming soon', 'Wire up the create modal')}
        label="New site"
      />
    </Screen>
  );
}
