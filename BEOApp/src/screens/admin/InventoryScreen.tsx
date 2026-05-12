import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Apple, Wrench, AlertTriangle, Calendar } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataList, DataRow, trashBulkAction } from '@/components/ui/DataList';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToast } from '@/components/ui/Toast';
import { PerishableForm } from '@/components/forms/PerishableForm';
import { HardwareForm } from '@/components/forms/HardwareForm';
import { api, ApiError } from '@/lib/api';
import {
  type Hardware, type Perishable,
  HARDWARE_CATEGORY_LABEL, HARDWARE_CONDITION_LABEL,
  PERISHABLE_CATEGORY_LABEL,
} from '@/lib/types';

type Segment = 'perishables' | 'hardware';

export default function InventoryScreen() {
  const [seg, setSeg] = useState<Segment>('perishables');
  const [search, setSearch] = useState('');
  const [perishableFormOpen, setPerishableFormOpen] = useState(false);
  const [hardwareFormOpen, setHardwareFormOpen]   = useState(false);
  const [perishableEdit, setPerishableEdit] = useState<Perishable | null>(null);
  const [hardwareEdit, setHardwareEdit]     = useState<Hardware | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const perishableQ = useQuery<{ items: Perishable[] }>({
    queryKey: ['perishables'],
    queryFn:  () => api('/api/perishables/'),
  });
  const hardwareQ = useQuery<{ items: Hardware[] }>({
    queryKey: ['hardware'],
    queryFn:  () => api('/api/hardware/'),
  });

  const counts = {
    perishables: perishableQ.data?.items?.length ?? 0,
    hardware:    hardwareQ.data?.items?.length ?? 0,
  };

  const items = seg === 'perishables'
    ? (perishableQ.data?.items ?? [])
    : (hardwareQ.data?.items ?? []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i: any) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const deleteM = useMutation<void, ApiError, number[]>({
    mutationFn: async (ids) => {
      const path = seg === 'perishables' ? 'perishables' : 'hardware';
      await Promise.all(ids.map((id) => api(`/api/${path}/${id}/`, { method: 'DELETE' })));
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: [seg] });
    },
    onError: (e) => toast.error('Could not delete', e.message),
  });

  const header = (
    <View className="px-5 pt-2 pb-3">
      <Text className="text-2xl font-bold text-ink-900">Inventory</Text>
      <Text className="mt-0.5 text-sm text-ink-500">
        {seg === 'perishables'
          ? 'Food, beverages, anything that expires'
          : 'Tables, chairs, A/V, durable assets'}
      </Text>
      <SegmentedControl<Segment>
        className="mt-4"
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'perishables', label: 'Perishables', badge: counts.perishables },
          { value: 'hardware',    label: 'Hardware',    badge: counts.hardware },
        ]}
      />
      <SearchBar
        containerClassName="mt-3"
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name…"
      />
    </View>
  );

  const isPerishables = seg === 'perishables';
  const renderPerishable = (p: Perishable, helpers: any) => {
    const expSoon = (p.days_until_expiry ?? 999) <= 7 && !p.is_expired;
    return (
      <View className="px-5">
        <DataRow
          selectable={helpers.selectionMode}
          selected={helpers.selected}
          onPress={() => helpers.selectionMode ? helpers.toggleSelected() : (setPerishableEdit(p), setPerishableFormOpen(true))}
          onLongPress={() => { helpers.enterSelection(); helpers.toggleSelected(); }}
          leading={
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-success-500/10">
              <Apple size={18} color="#059669" />
            </View>
          }
          title={p.name}
          subtitle={
            <View className="flex-row items-center">
              <Text className="text-xs text-ink-500">{PERISHABLE_CATEGORY_LABEL[p.category]}</Text>
              <View className="mx-1.5 h-1 w-1 rounded-full bg-ink-300" />
              <Text className="text-xs text-ink-500">
                {p.quantity_on_hand} {p.unit || 'unit'}
              </Text>
              {p.expiry_date ? (
                <>
                  <View className="mx-1.5 h-1 w-1 rounded-full bg-ink-300" />
                  <Calendar size={10} color="#64748B" />
                  <Text className="ml-1 text-xs text-ink-500">
                    {new Date(p.expiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </>
              ) : null}
            </View>
          }
          trailing={
            p.is_expired ? (
              <Badge bgClassName="bg-danger-500/10" textClassName="text-danger-600" dot>Expired</Badge>
            ) : expSoon ? (
              <Badge bgClassName="bg-warning-500/10" textClassName="text-warning-600" dot>
                {p.days_until_expiry}d
              </Badge>
            ) : p.is_low_stock ? (
              <Badge bgClassName="bg-warning-500/10" textClassName="text-warning-600">Low</Badge>
            ) : null
          }
        />
      </View>
    );
  };

  const renderHardware = (h: Hardware, helpers: any) => {
    return (
      <View className="px-5">
        <DataRow
          selectable={helpers.selectionMode}
          selected={helpers.selected}
          onPress={() => helpers.selectionMode ? helpers.toggleSelected() : (setHardwareEdit(h), setHardwareFormOpen(true))}
          onLongPress={() => { helpers.enterSelection(); helpers.toggleSelected(); }}
          leading={
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-brand-50">
              <Wrench size={18} color="#6366F1" />
            </View>
          }
          title={h.name}
          subtitle={
            <View className="flex-row items-center">
              <Text className="text-xs text-ink-500">{HARDWARE_CATEGORY_LABEL[h.category]}</Text>
              <View className="mx-1.5 h-1 w-1 rounded-full bg-ink-300" />
              <Text className="text-xs text-ink-500">
                {h.quantity_on_hand} {h.unit || 'unit'}
              </Text>
              {h.condition !== 'good' ? (
                <>
                  <View className="mx-1.5 h-1 w-1 rounded-full bg-ink-300" />
                  <Text className="text-xs text-ink-500">{HARDWARE_CONDITION_LABEL[h.condition]}</Text>
                </>
              ) : null}
            </View>
          }
          trailing={
            h.condition === 'needs_repair' ? (
              <Badge bgClassName="bg-danger-500/10" textClassName="text-danger-600" dot>
                <AlertTriangle size={10} color="#DC2626" /> Repair
              </Badge>
            ) : h.is_low_stock ? (
              <Badge bgClassName="bg-warning-500/10" textClassName="text-warning-600">Low</Badge>
            ) : null
          }
        />
      </View>
    );
  };

  return (
    <Screen contentClassName="px-0 py-0">
      <DataList
        data={filtered as any}
        ListHeaderComponent={header}
        refreshing={isPerishables ? perishableQ.isRefetching : hardwareQ.isRefetching}
        onRefresh={() => isPerishables ? perishableQ.refetch() : hardwareQ.refetch()}
        bulkActions={[trashBulkAction((ids) => deleteM.mutate(ids))]}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={(item, helpers) =>
          isPerishables
            ? renderPerishable(item as Perishable, helpers)
            : renderHardware(item as Hardware, helpers)
        }
        ItemSeparator={<View className="h-px bg-ink-100 mx-8" />}
        emptyState={
          <EmptyState
            icon={isPerishables
              ? <Apple size={24} color="#059669" />
              : <Wrench size={24} color="#6366F1" />
            }
            title={isPerishables ? 'No perishables yet' : 'No hardware yet'}
            description="Tap + to add your first item"
          />
        }
      />
      <FAB
        onPress={() =>
          isPerishables
            ? (setPerishableEdit(null), setPerishableFormOpen(true))
            : (setHardwareEdit(null),   setHardwareFormOpen(true))
        }
        label={`New ${isPerishables ? 'perishable' : 'item'}`}
      />
      <PerishableForm
        open={perishableFormOpen}
        onClose={() => { setPerishableFormOpen(false); setPerishableEdit(null); }}
        initial={perishableEdit}
      />
      <HardwareForm
        open={hardwareFormOpen}
        onClose={() => { setHardwareFormOpen(false); setHardwareEdit(null); }}
        initial={hardwareEdit}
      />
    </Screen>
  );
}
