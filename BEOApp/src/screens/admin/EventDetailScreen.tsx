import React, { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import {
  ArrowLeft, Calendar, Clock, Users, MapPin, UtensilsCrossed, Cpu,
  Mail, Phone, ChevronDown,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  type CalendarEvent, type EventCalStatus,
  EVENT_CAL_STATUS_LABEL, EVENT_CAL_STATUS_TONE,
  EVENT_TYPE_LABEL, FOOD_SERVICE_LABEL, TECH_NEEDS_LABEL,
} from '@/lib/types';
import type { CalendarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CalendarStackParamList, 'EventDetail'>;

const NEXT_STATUSES: Record<EventCalStatus, EventCalStatus[]> = {
  scheduled:   ['in_progress', 'cancelled'],
  in_progress: ['completed',   'cancelled'],
  completed:   [],
  cancelled:   ['scheduled'],
};

function StatusChanger({ current, onChange, busy }: {
  current: EventCalStatus; onChange: (s: EventCalStatus) => void; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = NEXT_STATUSES[current];
  const tone = EVENT_CAL_STATUS_TONE[current];

  return (
    <View>
      <Pressable
        onPress={() => options.length && setOpen((v) => !v)}
        disabled={!options.length || busy}
        accessibilityRole="button"
        accessibilityLabel={`Status: ${EVENT_CAL_STATUS_LABEL[current]}`}
        className={cn(
          'flex-row items-center rounded-full px-3.5 py-2',
          tone.bg,
          (!options.length || busy) && 'opacity-70',
        )}
      >
        <View className={cn('mr-2 h-1.5 w-1.5 rounded-full', tone.text.replace(/text-/, 'bg-'))} />
        <Text className={cn('text-sm font-semibold', tone.text)}>{EVENT_CAL_STATUS_LABEL[current]}</Text>
        {options.length ? <ChevronDown size={14} color="currentColor" className="ml-1.5" /> : null}
      </Pressable>

      <AnimatePresence>
        {open ? (
          <MotiView
            from={{ opacity: 0, translateY: -6 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -6 }}
            transition={{ type: 'timing', duration: 160 }}
            className="absolute right-0 top-12 z-10 w-52 rounded-2xl border border-ink-200 bg-white p-1 shadow-lg"
          >
            {options.map((s) => {
              const t = EVENT_CAL_STATUS_TONE[s];
              return (
                <Pressable
                  key={s}
                  onPress={() => { setOpen(false); onChange(s); }}
                  className="flex-row items-center rounded-xl px-2.5 py-2"
                  accessibilityRole="menuitem" accessibilityLabel={`Move to ${EVENT_CAL_STATUS_LABEL[s]}`}
                >
                  <View className={cn('mr-2 h-2 w-2 rounded-full', t.text.replace(/text-/, 'bg-'))} />
                  <Text className="text-sm font-medium text-ink-900">{EVENT_CAL_STATUS_LABEL[s]}</Text>
                </Pressable>
              );
            })}
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="flex-row items-start py-2.5">
      <View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-ink-100">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-xs uppercase tracking-wide text-ink-500">{label}</Text>
        <Text className="mt-0.5 text-sm font-medium text-ink-900">{value || '—'}</Text>
      </View>
    </View>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function EventDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery<{ event: CalendarEvent }>({
    queryKey: ['event', id],
    queryFn:  () => api(`/api/events/${id}/`),
  });

  const statusM = useMutation<{ event: CalendarEvent }, ApiError, EventCalStatus>({
    mutationFn: (status) => api(`/api/events/${id}/`, { method: 'PATCH', body: { status } }),
    onSuccess: ({ event }) => {
      qc.setQueryData(['event', id], { event });
      qc.invalidateQueries({ queryKey: ['events-month'] });
      toast.success('Status updated', `Now ${EVENT_CAL_STATUS_LABEL[event.status]}`);
    },
    onError: (e) => toast.error('Could not update', e.message),
  });

  const e = q.data?.event;

  return (
    <Screen contentClassName="px-0 py-0">
      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#6366F1" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 p-2"
            accessibilityRole="button" accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
          {e ? <StatusChanger current={e.status} onChange={statusM.mutate} busy={statusM.isPending} /> : null}
        </View>

        {q.isLoading || !e ? (
          <View className="px-5 pt-4">
            <Skeleton className="mb-3 h-8 w-64" />
            <Skeleton className="h-32 w-full" />
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            className="px-5 pt-3"
          >
            <Text className="text-3xl font-bold text-ink-900">{e.name}</Text>
            <Badge
              className="mt-2"
              bgClassName="bg-brand-50"
              textClassName="text-brand-700"
            >
              {EVENT_TYPE_LABEL[e.event_type]}
            </Badge>

            <Card className="mt-5">
              <View className="p-4">
                <Stat icon={<Calendar size={16} color="#475569" />} label="Date"      value={fmtDate(e.starts_at)} />
                <Stat icon={<Clock size={16} color="#475569" />}    label="Time"      value={`${fmtTime(e.starts_at)} – ${fmtTime(e.ends_at)}`} />
                <Stat icon={<Users size={16} color="#475569" />}    label="Headcount" value={String(e.headcount)} />
                {e.site_venue ? (
                  <Stat
                    icon={<MapPin size={16} color="#475569" />}
                    label="Venue"
                    value={`${e.site_venue.name}${e.site_venue.site_name ? ` · ${e.site_venue.site_name}` : ''}`}
                  />
                ) : null}
                <Stat icon={<UtensilsCrossed size={16} color="#475569" />} label="Food service" value={FOOD_SERVICE_LABEL[e.food_service]} />
                <Stat icon={<Cpu size={16} color="#475569" />}             label="Tech needs"   value={TECH_NEEDS_LABEL[e.tech_needs]} />
              </View>
            </Card>

            {e.contact ? (
              <>
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                  Contact
                </Text>
                <Card>
                  <View className="p-2">
                    <View className="p-3">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Booker</Text>
                      <Text className="mt-0.5 text-sm font-semibold text-ink-900">{e.contact.full_name}</Text>
                    </View>
                    {e.contact.email ? (
                      <Pressable
                        onPress={() => Linking.openURL(`mailto:${e.contact!.email}`)}
                        className="flex-row items-center p-3"
                        accessibilityRole="link"
                      >
                        <Mail size={16} color="#475569" />
                        <Text className="ml-2 text-sm font-medium text-ink-900">{e.contact.email}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              </>
            ) : null}

            {e.description ? (
              <>
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                  Description
                </Text>
                <Card>
                  <View className="p-4">
                    <Text className="text-sm text-ink-700">{e.description}</Text>
                  </View>
                </Card>
              </>
            ) : null}
          </MotiView>
        )}
      </ScrollView>
    </Screen>
  );
}
