import React, { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import {
  ArrowLeft, Calendar, Clock, Users, MapPin, UtensilsCrossed, Cpu,
  Mail, Phone, Building2, FileText, ChevronDown, Check,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  STATUS_LABEL, STATUS_TONE, EVENT_TYPE_LABEL, FOOD_SERVICE_LABEL, TECH_NEEDS_LABEL,
  type EventRequest, type EventStatus, type EventAssignment,
} from '@/lib/types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'EventRequestDetail'>;

// Allowed onward transitions, matching the backend state machine.
const NEXT_STATUSES: Record<EventStatus, EventStatus[]> = {
  new:       ['in_review', 'confirmed', 'declined'],
  in_review: ['confirmed', 'declined', 'new'],
  confirmed: ['completed', 'declined', 'in_review'],
  declined:  [],
  completed: [],
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(s: string | null): string {
  if (!s) return '—';
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function StatusChanger({
  current, onChange, busy,
}: {
  current: EventStatus;
  onChange: (s: EventStatus) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = NEXT_STATUSES[current];
  const tone = STATUS_TONE[current];

  return (
    <View>
      <Pressable
        onPress={() => options.length && setOpen((v) => !v)}
        disabled={!options.length || busy}
        accessibilityRole="button"
        accessibilityLabel={`Status: ${STATUS_LABEL[current]}. ${options.length ? 'Tap to change' : 'No further transitions.'}`}
        className={cn(
          'flex-row items-center rounded-full px-3.5 py-2',
          tone.bg,
          (!options.length || busy) && 'opacity-70',
        )}
      >
        <View className={cn('mr-2 h-1.5 w-1.5 rounded-full', tone.text.replace(/text-/, 'bg-'))} />
        <Text className={cn('text-sm font-semibold', tone.text)}>{STATUS_LABEL[current]}</Text>
        {options.length ? <ChevronDown size={14} color="currentColor" className="ml-1.5" /> : null}
      </Pressable>

      <AnimatePresence>
        {open ? (
          <MotiView
            from={{ opacity: 0, translateY: -6 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -6 }}
            transition={{ type: 'timing', duration: 160 }}
            className="absolute right-0 top-12 z-10 w-48 rounded-2xl border border-ink-200 bg-white p-1 shadow-lg"
          >
            {options.map((s) => {
              const t = STATUS_TONE[s];
              return (
                <Pressable
                  key={s}
                  onPress={() => { setOpen(false); onChange(s); }}
                  className="flex-row items-center rounded-xl px-2.5 py-2"
                  accessibilityRole="menuitem"
                  accessibilityLabel={`Move to ${STATUS_LABEL[s]}`}
                >
                  <View className={cn('mr-2 h-2 w-2 rounded-full', t.text.replace(/text-/, 'bg-'))} />
                  <Text className="text-sm font-medium text-ink-900">{STATUS_LABEL[s]}</Text>
                </Pressable>
              );
            })}
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

export default function EventRequestDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const qc = useQueryClient();
  const toast = useToast();
  const [noteEdit, setNoteEdit] = useState<string | null>(null);

  const reqQ = useQuery<{ request: EventRequest }>({
    queryKey: ['event-request', id],
    queryFn:  () => api(`/api/event-requests/${id}/`),
  });
  const asgnQ = useQuery<{ assignments: EventAssignment[] }>({
    queryKey: ['event-assignments', id],
    queryFn:  () => api(`/api/event-requests/${id}/assignments/`),
  });

  const er = reqQ.data?.request;

  const statusM = useMutation<{ request: EventRequest }, ApiError, EventStatus>({
    mutationFn: (status) => api(`/api/event-requests/${id}/`, { method: 'PATCH', body: { status } }),
    onSuccess: ({ request }) => {
      qc.setQueryData(['event-request', id], { request });
      qc.invalidateQueries({ queryKey: ['event-requests'] });
      toast.success('Status updated', `Now ${STATUS_LABEL[request.status]}`);
    },
    onError: (e) => toast.error('Could not update status', e.message),
  });

  const noteM = useMutation<{ request: EventRequest }, ApiError, string>({
    mutationFn: (text) => api(`/api/event-requests/${id}/`, { method: 'PATCH', body: { organizer_note: text } }),
    onSuccess: ({ request }) => {
      qc.setQueryData(['event-request', id], { request });
      setNoteEdit(null);
      toast.success('Note saved');
    },
    onError: (e) => toast.error('Could not save note', e.message),
  });

  const refreshing = reqQ.isRefetching || asgnQ.isRefetching;

  return (
    <Screen contentClassName="px-0 py-0">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { reqQ.refetch(); asgnQ.refetch(); }}
            tintColor="#6366F1"
          />
        }
      >
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 p-2"
            accessibilityRole="button" accessibilityLabel="Back to dashboard"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
          {er ? <StatusChanger current={er.status} onChange={statusM.mutate} busy={statusM.isPending} /> : null}
        </View>

        {reqQ.isLoading || !er ? (
          <View className="px-5 pt-4">
            <Skeleton className="mb-4 h-8 w-64" />
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="h-48 w-full" />
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            className="px-5 pt-4"
          >
            <Text className="text-3xl font-bold text-ink-900">{er.event_name}</Text>
            <View className="mt-2 flex-row items-center">
              <Avatar name={er.client_name} size="sm" />
              <Text className="ml-2 text-base text-ink-700">{er.client_name}</Text>
              {er.client_org ? (
                <Text className="text-base text-ink-500"> · {er.client_org}</Text>
              ) : null}
            </View>
            <Badge
              className="mt-3"
              bgClassName="bg-brand-50"
              textClassName="text-brand-700"
            >
              {EVENT_TYPE_LABEL[er.event_type]}
            </Badge>

            {/* Quick stats */}
            <Card className="mt-5">
              <View className="p-4">
                <Field icon={<Calendar size={16} color="#475569" />} label="Preferred date" value={fmtDate(er.preferred_date)} />
                {er.alternate_date ? (
                  <Field icon={<Calendar size={16} color="#475569" />} label="Alternate date" value={fmtDate(er.alternate_date)} />
                ) : null}
                <Field
                  icon={<Clock size={16} color="#475569" />}
                  label="Time"
                  value={`${fmtTime(er.start_time)} – ${fmtTime(er.end_time)}`}
                />
                <Field icon={<Users size={16} color="#475569" />} label="Headcount" value={String(er.headcount)} />
                {er.venue_preference ? (
                  <Field icon={<MapPin size={16} color="#475569" />} label="Venue preference" value={er.venue_preference} />
                ) : null}
                <Field icon={<UtensilsCrossed size={16} color="#475569" />} label="Food service" value={FOOD_SERVICE_LABEL[er.food_service]} />
                <Field icon={<Cpu size={16} color="#475569" />} label="Tech needs" value={TECH_NEEDS_LABEL[er.tech_needs]} />
              </View>
            </Card>

            {/* Contact */}
            <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Contact</Text>
            <Card>
              <View className="p-4">
                <Pressable
                  onPress={() => Linking.openURL(`mailto:${er.client_email}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`Email ${er.client_email}`}
                >
                  <Field icon={<Mail size={16} color="#475569" />} label="Email" value={er.client_email} />
                </Pressable>
                {er.client_phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${er.client_phone}`)}
                    accessibilityRole="link"
                    accessibilityLabel={`Call ${er.client_phone}`}
                  >
                    <Field icon={<Phone size={16} color="#475569" />} label="Phone" value={er.client_phone} />
                  </Pressable>
                ) : null}
                {er.client_org ? (
                  <Field icon={<Building2 size={16} color="#475569" />} label="Company" value={er.client_org} />
                ) : null}
              </View>
            </Card>

            {/* Notes from client */}
            {er.notes ? (
              <>
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">From the client</Text>
                <Card>
                  <View className="p-4">
                    <Text className="text-sm text-ink-700">{er.notes}</Text>
                  </View>
                </Card>
              </>
            ) : null}
            {er.dietary_notes ? (
              <>
                <Text className="mt-4 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Dietary notes</Text>
                <Card>
                  <View className="p-4">
                    <Text className="text-sm text-ink-700">{er.dietary_notes}</Text>
                  </View>
                </Card>
              </>
            ) : null}

            {/* Organizer note */}
            <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Your notes</Text>
            <Card>
              <View className="p-4">
                {noteEdit !== null ? (
                  <>
                    <Input
                      value={noteEdit}
                      onChangeText={setNoteEdit}
                      multiline
                      numberOfLines={4}
                      inputClassName="min-h-[96px] py-2"
                    />
                    <View className="mt-3 flex-row gap-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => setNoteEdit(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        loading={noteM.isPending}
                        onPress={() => noteM.mutate(noteEdit)}
                        iconRight={<Check size={14} color="#fff" />}
                      >
                        Save
                      </Button>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={() => setNoteEdit(er.organizer_note ?? '')}
                    accessibilityRole="button"
                    accessibilityLabel="Edit your notes"
                  >
                    <Text className={cn('text-sm', er.organizer_note ? 'text-ink-700' : 'text-ink-400')}>
                      {er.organizer_note || 'Tap to add a private note…'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Card>

            {/* Assignments */}
            <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
              Team assigned
            </Text>
            <Card>
              <View className="p-2">
                {(asgnQ.data?.assignments ?? []).length === 0 ? (
                  <View className="px-3 py-6">
                    <Text className="text-center text-sm text-ink-500">
                      No team members assigned yet
                    </Text>
                  </View>
                ) : (
                  (asgnQ.data?.assignments ?? []).map((a) => (
                    <View key={a.id} className="flex-row items-center p-2.5">
                      <Avatar name={a.team_member.name} size="sm" />
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-semibold text-ink-900">{a.team_member.name}</Text>
                        <Text className="text-xs text-ink-500">
                          {a.role_on_event || a.team_member.role}
                        </Text>
                      </View>
                      <Badge bgClassName="bg-ink-100" textClassName="text-ink-700">
                        {a.status}
                      </Badge>
                    </View>
                  ))
                )}
              </View>
            </Card>
          </MotiView>
        )}
      </ScrollView>
    </Screen>
  );
}
