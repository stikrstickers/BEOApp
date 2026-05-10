import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

import { BASE_URL } from '../config';

// ── Types ────────────────────────────────────────────────────────────────────

type EventBin = {
  event_name: string;
  time: string;
  date: string;
  headcount: string;
  items: string[];
  checked: boolean[];
};

type CategoryBin = {
  category: string;
  events: EventBin[];
};

type EventSummary = {
  date: string;
  event_name: string;
  time: string;
  location: string;
  headcount: string;
  coordinator: string;
};

type BinListResponse = {
  dates: string[];
  events: EventSummary[];
  bins: CategoryBin[];
};

// ── Category colour palette ───────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; accent: string; emoji: string }> = {
  'Sodas & Sparkling': { bg: '#EFF6FF', accent: '#2563EB', emoji: '🥤' },
  'Water Bottles':     { bg: '#F0FDF4', accent: '#16A34A', emoji: '💧' },
  'Chips & Snacks':    { bg: '#FFF7ED', accent: '#EA580C', emoji: '🍟' },
  'Cookies & Sweets':  { bg: '#FDF4FF', accent: '#9333EA', emoji: '🍪' },
  'Hot Beverages':     { bg: '#FFFBEB', accent: '#D97706', emoji: '☕' },
  'Serviceware':       { bg: '#F8FAFC', accent: '#475569', emoji: '🍽️' },
  'Decor & Linens':    { bg: '#FFF1F2', accent: '#E11D48', emoji: '🌸' },
  'Sanitation':        { bg: '#F0FDF4', accent: '#059669', emoji: '🧤' },
  'Other Supplies':    { bg: '#F9FAFB', accent: '#6B7280', emoji: '📦' },
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: '#F9FAFB', accent: '#6B7280', emoji: '📦' };
}

// ── Navigation types ──────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BinList'>;
  route: RouteProp<RootStackParamList, 'BinList'>;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function BinListScreen({ navigation, route }: Props) {
  const { weekId, weekLabel } = route.params;

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [data, setData]       = useState<BinListResponse | null>(null);

  // collapsed state per category index
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  // checked state: [catIdx][evtIdx] — one checkbox per event per category
  const [checks, setChecks] = useState<boolean[][]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchBinList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('week_id', String(weekId));

      const res  = await fetch(`${BASE_URL}/api/bin-list/`, { method: 'POST', body: form });
      const json = (await res.json()) as BinListResponse;

      // Initialise checks matrix: [catIdx][evtIdx] = false
      const initChecks = json.bins.map((cat) =>
        cat.events.map(() => false)
      );

      setData(json);
      setChecks(initChecks);
      // Default: all categories expanded
      const initCollapsed: Record<number, boolean> = {};
      json.bins.forEach((_, i) => { initCollapsed[i] = false; });
      setCollapsed(initCollapsed);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load bin list');
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => { fetchBinList(); }, [fetchBinList]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleCheck = (catIdx: number, evtIdx: number) => {
    setChecks((prev) => {
      const next = prev.map((cat) => [...cat]);
      next[catIdx][evtIdx] = !next[catIdx][evtIdx];
      return next;
    });
  };

  const toggleCollapse = (catIdx: number) => {
    setCollapsed((prev) => ({ ...prev, [catIdx]: !prev[catIdx] }));
  };

  const checkAllInCategory = (catIdx: number, value: boolean) => {
    setChecks((prev) => {
      const next = prev.map((cat, ci) =>
        ci === catIdx ? cat.map(() => value) : [...cat]
      );
      return next;
    });
  };

  const categoryProgress = (catIdx: number): { done: number; total: number } => {
    if (!checks[catIdx]) return { done: 0, total: 0 };
    const total = checks[catIdx].length;
    const done  = checks[catIdx].filter(Boolean).length;
    return { done, total };
  };

  const overallProgress = (): { done: number; total: number } => {
    let done = 0, total = 0;
    checks.forEach((cat) => cat.forEach((c) => { total++; if (c) done++; }));
    return { done, total };
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>Bin List</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Building bin list…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Bin List</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error ?? 'No data returned'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBinList}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const overall = overallProgress();

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Bin List — {weekLabel}</Text>
        <TouchableOpacity onPress={fetchBinList} style={styles.refreshBtn}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Day filter chips */}
      {data.dates.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayBar} contentContainerStyle={styles.dayBarContent}>
          {['All', ...data.dates].map((d) => {
            const active = d === 'All' ? !selectedDay : selectedDay === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => setSelectedDay(d === 'All' ? null : d)}
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Summary header */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryDate}>
            {data.dates.length > 1
              ? `${data.dates[0]} – ${data.dates[data.dates.length - 1]}`
              : data.dates[0] ?? ''}
          </Text>
          <Text style={styles.summaryEvents}>
            {data.dates.length > 1 ? `${data.dates.length} days · ` : ''}
            {data.events.length} event{data.events.length !== 1 ? 's' : ''}
          </Text>
          {/* Overall progress bar */}
          {overall.total > 0 && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round((overall.done / overall.total) * 100)}%` as any },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {overall.done}/{overall.total} items
              </Text>
            </View>
          )}
        </View>

        {/* Event chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {data.events.map((ev, i) => (
            <View key={i} style={styles.chip}>
              {ev.date ? <Text style={styles.chipDate}>{ev.date}</Text> : null}
              <Text style={styles.chipName} numberOfLines={1}>{ev.event_name}</Text>
              <Text style={styles.chipTime}>{ev.time}</Text>
              {ev.location ? <Text style={styles.chipLoc}>{ev.location}</Text> : null}
            </View>
          ))}
        </ScrollView>

        {/* Category bins */}
        {data.bins.map((cat, catIdx) => {
          // Filter events by selected day
          const filteredEvents = selectedDay
            ? cat.events.filter((ev) => ev.date === selectedDay)
            : cat.events;
          if (filteredEvents.length === 0) return null;
          const cs        = categoryStyle(cat.category);
          const prog      = categoryProgress(catIdx);
          const isCollapsed = collapsed[catIdx];
          const allDone   = prog.total > 0 && prog.done === prog.total;

          return (
            <View key={catIdx} style={[styles.categoryCard, { borderLeftColor: cs.accent }]}>

              {/* Category header */}
              <TouchableOpacity
                style={[styles.categoryHeader, { backgroundColor: cs.bg }]}
                onPress={() => toggleCollapse(catIdx)}
                activeOpacity={0.7}
              >
                <Text style={styles.catEmoji}>{cs.emoji}</Text>
                <View style={styles.catHeaderMid}>
                  <Text style={[styles.catTitle, { color: cs.accent }]}>{cat.category}</Text>
                  <Text style={styles.catProgress}>
                    {prog.done}/{prog.total}
                  </Text>
                </View>
                <View style={styles.catHeaderRight}>
                  {allDone && <Text style={styles.doneTag}>✓ Done</Text>}
                  <Text style={[styles.chevron, { color: cs.accent }]}>
                    {isCollapsed ? '›' : '⌄'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Collapsed body */}
              {!isCollapsed && (
                <View style={styles.categoryBody}>

                  {/* Check all / Clear all */}
                  <View style={styles.bulkRow}>
                    <TouchableOpacity
                      onPress={() => checkAllInCategory(catIdx, true)}
                      style={[styles.bulkBtn, { borderColor: cs.accent }]}
                    >
                      <Text style={[styles.bulkBtnText, { color: cs.accent }]}>✓ All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => checkAllInCategory(catIdx, false)}
                      style={[styles.bulkBtn, { borderColor: '#D1D5DB' }]}
                    >
                      <Text style={[styles.bulkBtnText, { color: '#6B7280' }]}>✕ Clear</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Events inside this category */}
                  {cat.events.map((ev, evtIdx) => {
                    const done = checks[catIdx]?.[evtIdx] ?? false;
                    return (
                      <TouchableOpacity
                        key={evtIdx}
                        style={[styles.eventBlock, done && styles.eventBlockDone]}
                        onPress={() => toggleCheck(catIdx, evtIdx)}
                        activeOpacity={0.7}
                      >
                        {/* Single checkbox on the left */}
                        <View
                          style={[
                            styles.checkbox,
                            done && { backgroundColor: cs.accent, borderColor: cs.accent },
                          ]}
                        >
                          {done && <Text style={styles.checkmark}>✓</Text>}
                        </View>

                        {/* Event info + item list */}
                        <View style={styles.eventBlockBody}>
                          {ev.date ? <Text style={styles.eventDateLabel}>{ev.date}</Text> : null}
                          <Text style={[styles.eventName, done && styles.eventNameDone]}>
                            {ev.event_name}
                          </Text>
                          <View style={styles.eventMeta}>
                            <Text style={styles.eventTime}>{ev.time}</Text>
                            {ev.headcount ? (
                              <View style={styles.headcountBadge}>
                                <Text style={styles.headcountText}>👥 {ev.headcount}</Text>
                              </View>
                            ) : null}
                          </View>
                          {/* Items listed as plain text below */}
                          {ev.items.map((item, ii) => (
                            <Text
                              key={ii}
                              style={[styles.itemText, done && styles.itemTextDone]}
                            >
                              · {item}
                            </Text>
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F5F7FA' },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:      { paddingHorizontal: 16, paddingTop: 12 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn:       { width: 36, height: 36, justifyContent: 'center' },
  backIcon:      { fontSize: 32, color: '#4F46E5', lineHeight: 36, marginTop: -4 },
  topBarTitle:   { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1F2937' },
  refreshBtn:    { width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  refreshIcon:   { fontSize: 22, color: '#4F46E5', fontWeight: '600' },

  // Summary card
  summaryCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    marginTop: 8,
  },
  summaryDate:   { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  summaryEvents: { fontSize: 13, color: '#C7D2FE', marginBottom: 10 },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3 },
  progressFill:  { height: 6, backgroundColor: '#A5F3A5', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#C7D2FE', minWidth: 60, textAlign: 'right' },

  // Event chips
  chipRow:   { paddingBottom: 12, gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipName: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  chipDate: { fontSize: 10, color: '#4F46E5', fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipTime: { fontSize: 11, color: '#6B7280' },
  chipLoc:  { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // Category card
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  catEmoji:      { fontSize: 22, width: 28 },
  catHeaderMid:  { flex: 1 },
  catTitle:      { fontSize: 16, fontWeight: '700', marginBottom: 1 },
  catProgress:   { fontSize: 12, color: '#6B7280' },
  catHeaderRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneTag: {
    fontSize: 11,
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '600',
  },
  chevron:       { fontSize: 22, fontWeight: '700', width: 18, textAlign: 'center' },

  categoryBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  // Bulk buttons
  bulkRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  bulkBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  bulkBtnText: { fontSize: 12, fontWeight: '600' },

  // Event block inside category — now the whole block is one tappable checkbox row
  eventBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  eventBlockDone:  { backgroundColor: '#F0FDF4' },
  eventBlockBody:  { flex: 1 },
  eventName:       { fontSize: 14, fontWeight: '700', color: '#374151' },
  eventNameDone:   { color: '#9CA3AF', textDecorationLine: 'line-through' },
  eventDateLabel:  { fontSize: 10, color: '#4F46E5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  eventMeta:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, marginBottom: 6 },
  eventTime:       { fontSize: 11, color: '#6B7280' },
  headcountBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  headcountText: { fontSize: 11, color: '#4F46E5', fontWeight: '600' },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkmark:    { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  itemText:     { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 1 },
  itemTextDone: { color: '#C4C9D0', textDecorationLine: 'line-through' },

  // Loading / error
  loadingText: { marginTop: 14, color: '#6B7280', fontSize: 15 },
  errorEmoji:  { fontSize: 40, marginBottom: 12 },
  errorText:   { color: '#6B7280', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Day filter bar
  dayBar:            { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dayBarContent:     { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  dayChip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  dayChipActive:     { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  dayChipText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
  dayChipTextActive: { color: '#FFFFFF' },
});
