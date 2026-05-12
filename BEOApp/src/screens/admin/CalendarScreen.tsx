import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar as CalendarLib, DateData } from 'react-native-calendars';
import { MotiView, AnimatePresence } from 'moti';
import { ChevronRight, Clock, Users, MapPin, LogOut, Sparkles } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import {
  type CalendarEvent, EVENT_CAL_STATUS_LABEL, EVENT_CAL_STATUS_TONE,
} from '@/lib/types';
import type { EventsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EventsStackParamList, 'Calendar'>;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function monthRange(yyyymm: string): { start: string; end: string } {
  const [y, m] = yyyymm.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 0);  // last day of the month
  const pad   = (n: number) => String(n).padStart(2, '0');
  const iso   = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: iso(start), end: iso(end) };
}

export default function CalendarScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [visibleMonth, setVisibleMonth] = useState<string>(todayIso().slice(0, 7));

  const range = useMemo(() => monthRange(visibleMonth), [visibleMonth]);

  const q = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ['events-month', visibleMonth],
    queryFn:  () => api(`/api/events/?start=${range.start}&end=${range.end}`),
  });

  // Build markedDates from events
  const marked = useMemo(() => {
    const out: Record<string, any> = {};
    for (const e of q.data?.events ?? []) {
      const dateKey = e.starts_at.slice(0, 10);
      const tone = EVENT_CAL_STATUS_TONE[e.status];
      const dotColor =
        tone.text === 'text-brand-700'    ? '#6366F1' :
        tone.text === 'text-warning-600'  ? '#D97706' :
        tone.text === 'text-success-600'  ? '#059669' :
                                            '#64748B';
      if (!out[dateKey]) out[dateKey] = { dots: [] };
      out[dateKey].dots.push({ key: String(e.id), color: dotColor });
    }
    out[selectedDate] = { ...(out[selectedDate] ?? {}), selected: true, selectedColor: '#6366F1' };
    return out;
  }, [q.data, selectedDate]);

  const dayEvents = useMemo(() => {
    return (q.data?.events ?? [])
      .filter((e) => e.starts_at.slice(0, 10) === selectedDate)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [q.data, selectedDate]);

  return (
    <Screen contentClassName="px-0 py-0">
      {/* Gradient hero */}
      <View className="px-5 pt-4">
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 18 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="mb-1 flex-row items-center">
                <Sparkles size={14} color="#FDE68A" />
                <Text className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  {user?.organization?.name ?? 'Workspace'}
                </Text>
              </View>
              <Text className="text-xl font-bold text-white">Calendar</Text>
              <Text className="mt-0.5 text-xs text-white/85">
                {(q.data?.events ?? []).length} events this month
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View className="mx-5 mt-4 overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <CalendarLib
          current={selectedDate}
          markingType="multi-dot"
          markedDates={marked}
          onDayPress={(d: DateData) => setSelectedDate(d.dateString)}
          onMonthChange={(d: DateData) => setVisibleMonth(`${d.year}-${String(d.month).padStart(2, '0')}`)}
          theme={{
            calendarBackground: '#FFFFFF',
            dayTextColor:       '#0F172A',
            monthTextColor:     '#0F172A',
            textMonthFontWeight: '700',
            todayTextColor:     '#6366F1',
            arrowColor:         '#6366F1',
            selectedDayBackgroundColor: '#6366F1',
            selectedDayTextColor:       '#FFFFFF',
            textDayFontWeight:  '500',
          }}
        />
      </View>

      {/* Day's events list */}
      <View className="mt-4 px-5 pb-6">
        <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </Text>
        {q.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : dayEvents.length === 0 ? (
          <EmptyState
            icon={<Clock size={22} color="#6366F1" />}
            title="No events"
            description="Pick a different day or confirm an event request"
          />
        ) : (
          <AnimatePresence>
            {dayEvents.map((e, i) => {
              const tone = EVENT_CAL_STATUS_TONE[e.status];
              return (
                <MotiView
                  key={e.id}
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 260, delay: i * 30 }}
                  className="mb-3"
                >
                  <Card
                    onPress={() => navigation.navigate('EventDetail', { id: e.id })}
                    accessibilityLabel={`Open ${e.name}`}
                  >
                    <View className="flex-row items-center p-4">
                      <View
                        className="mr-3 h-12 w-12 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: e.color || '#EEF2FF' }}
                      >
                        <Clock size={20} color={e.color ? '#fff' : '#6366F1'} />
                      </View>
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="flex-1 pr-2 text-base font-semibold text-ink-900" numberOfLines={1}>
                            {e.name}
                          </Text>
                          <Badge bgClassName={tone.bg} textClassName={tone.text} dot>
                            {EVENT_CAL_STATUS_LABEL[e.status]}
                          </Badge>
                        </View>
                        <View className="mt-1 flex-row items-center">
                          <Clock size={12} color="#64748B" />
                          <Text className="ml-1.5 text-xs text-ink-500">
                            {fmtTime(e.starts_at)} – {fmtTime(e.ends_at)}
                          </Text>
                          {e.headcount > 0 ? (
                            <>
                              <View className="mx-2 h-1 w-1 rounded-full bg-ink-300" />
                              <Users size={12} color="#64748B" />
                              <Text className="ml-1 text-xs text-ink-500">{e.headcount}</Text>
                            </>
                          ) : null}
                          {e.site_venue ? (
                            <>
                              <View className="mx-2 h-1 w-1 rounded-full bg-ink-300" />
                              <MapPin size={12} color="#64748B" />
                              <Text className="ml-1 text-xs text-ink-500" numberOfLines={1}>
                                {e.site_venue.name}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                      <ChevronRight size={18} color="#94A3B8" />
                    </View>
                  </Card>
                </MotiView>
              );
            })}
          </AnimatePresence>
        )}
      </View>
    </Screen>
  );
}
