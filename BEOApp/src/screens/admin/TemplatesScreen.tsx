import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ArrowLeft, ChevronRight, FileText, Mail, MessageSquare, Printer, FileSignature,
  Receipt, Megaphone, Truck, Inbox,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DataList, DataRow, trashBulkAction } from '@/components/ui/DataList';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  type MessageTemplate, type TemplateKind, TEMPLATE_KIND_LABEL,
} from '@/lib/types';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TemplatesHome'>;
type Group = 'beo' | 'guest' | 'vendor' | 'other';

const GROUP_MAP: Record<TemplateKind, Group> = {
  beo: 'beo',
  guest_email: 'guest', guest_sms: 'guest',
  vendor_email: 'vendor', vendor_sms: 'vendor',
  internal_email: 'other', contract: 'other', invoice: 'other', other: 'other',
};

const KIND_ICON: Record<TemplateKind, React.ReactNode> = {
  beo:              <FileText size={18} color="#6366F1" />,
  guest_email:      <Mail size={18} color="#059669" />,
  guest_sms:        <MessageSquare size={18} color="#059669" />,
  vendor_email:     <Mail size={18} color="#D97706" />,
  vendor_sms:       <MessageSquare size={18} color="#D97706" />,
  internal_email:   <Megaphone size={18} color="#475569" />,
  contract:         <FileSignature size={18} color="#475569" />,
  invoice:          <Receipt size={18} color="#475569" />,
  other:            <FileText size={18} color="#475569" />,
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={10} color="#64748B" />,
  sms:   <MessageSquare size={10} color="#64748B" />,
  pdf:   <Printer size={10} color="#64748B" />,
};

export default function TemplatesScreen({ navigation }: Props) {
  const [group, setGroup] = useState<Group | 'all'>('all');
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery<{ templates: MessageTemplate[] }>({
    queryKey: ['templates'],
    queryFn:  () => api('/api/templates/'),
  });

  const all = q.data?.templates ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, beo: 0, guest: 0, vendor: 0, other: 0 };
    for (const t of all) {
      const g = GROUP_MAP[t.kind];
      c[g] = (c[g] ?? 0) + 1;
    }
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    if (group === 'all') return all;
    return all.filter((t) => GROUP_MAP[t.kind] === group);
  }, [all, group]);

  const deleteM = useMutation<void, ApiError, number[]>({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api(`/api/templates/${id}/`, { method: 'DELETE' })));
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['templates'] });
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
      <Text className="mt-1 text-2xl font-bold text-ink-900">Templates</Text>
      <Text className="mt-0.5 text-sm text-ink-500">
        Reusable BEOs, guest emails, vendor notifications, contracts
      </Text>
      <SegmentedControl
        className="mt-4"
        value={group}
        onChange={(v) => setGroup(v as Group | 'all')}
        options={[
          { value: 'all',    label: 'All',    badge: counts.all },
          { value: 'beo',    label: 'BEOs',   badge: counts.beo },
          { value: 'guest',  label: 'Guests', badge: counts.guest },
          { value: 'vendor', label: 'Vendors',badge: counts.vendor },
        ]}
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
        renderItem={(t, helpers) => (
          <View className="px-5">
            <DataRow
              selectable={helpers.selectionMode}
              selected={helpers.selected}
              onPress={() =>
                helpers.selectionMode
                  ? helpers.toggleSelected()
                  : navigation.navigate('TemplateEditor', { id: t.id })
              }
              onLongPress={() => { helpers.enterSelection(); helpers.toggleSelected(); }}
              leading={
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-ink-100">
                  {KIND_ICON[t.kind]}
                </View>
              }
              title={t.name}
              subtitle={
                <View className="flex-row items-center">
                  <Text className="text-xs text-ink-500">{TEMPLATE_KIND_LABEL[t.kind]}</Text>
                  <View className="mx-1.5 h-1 w-1 rounded-full bg-ink-300" />
                  {CHANNEL_ICON[t.channel]}
                  <Text className="ml-1 text-xs uppercase tracking-wider text-ink-500">{t.channel}</Text>
                </View>
              }
              trailing={
                <View className="flex-row items-center">
                  {t.is_default ? (
                    <Badge bgClassName="bg-brand-50" textClassName="text-brand-700">Default</Badge>
                  ) : null}
                  {!t.is_active ? (
                    <Badge bgClassName="bg-ink-200" textClassName="text-ink-600" className="ml-1">Off</Badge>
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
            icon={<Inbox size={24} color="#6366F1" />}
            title="No templates yet"
            description="Templates use {{tokens}} like {{event.name}} or {{contact.first_name}} to personalize messages"
          />
        }
      />
      <FAB
        onPress={() => navigation.navigate('TemplateEditor', {})}
        label="New template"
      />
    </Screen>
  );
}
