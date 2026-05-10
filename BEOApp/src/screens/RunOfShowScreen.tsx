import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

import { BASE_URL } from '../config';

// ── Palette ───────────────────────────────────────────────────────────────────
const INDIGO   = '#4F46E5';
const INDIGO_L = '#EEF2FF';
const INDIGO_D = '#3730A3';
const GREEN    = '#10B981';
const GREEN_L  = '#D1FAE5';
const GRAY     = '#6B7280';

// ── Types ─────────────────────────────────────────────────────────────────────

type BeoSection = {
  title: string;
  items: string[];
};

type RosBeo = {
  id: string;
  beo_type: string;
  date: string;
  event_name: string;
  time: string;
  event_date: string;
  location: string;
  headcount: string;
  requestor: string;
  fund_number: string;
  beo_number: string;
  vendor: string;
  coordinator: string;
  assigned_to: string;
  sections: BeoSection[];
  notes: string[];
  preset: boolean;
  complete: boolean;
  cleaned_up: boolean;
};

type RosResponse = {
  dates: string[];
  beos: RosBeo[];
};

// Per-BEO local mutable state
type BeoState = {
  assignedTo: string;
  preset: boolean;
  complete: boolean;
  cleanedUp: boolean;
};

// ── Navigation types ──────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RunOfShow'>;
  route: RouteProp<RootStackParamList, 'RunOfShow'>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RunOfShowScreen({ navigation, route }: Props) {
  const { weekId, weekLabel } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [data, setData]       = useState<RosResponse | null>(null);
  const [states, setStates]   = useState<BeoState[]>([]);
  const [selectedDay, setSelectedDay]   = useState<string | null>(null);
  const [filterName, setFilterName]     = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('week_id', String(weekId));

      const res  = await fetch(`${BASE_URL}/api/run-of-show/`, { method: 'POST', body: form });
      const json = (await res.json()) as RosResponse;

      const initStates: BeoState[] = json.beos.map((b) => ({
        assignedTo: b.assigned_to ?? '',
        preset:     false,
        complete:   false,
        cleanedUp:  false,
      }));

      setData(json);
      setStates(initStates);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load run of show');
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => { fetchRos(); }, [fetchRos]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggle = (idx: number, field: keyof Omit<BeoState, 'assignedTo'>) => {
    setStates((prev) => prev.map((s, i) =>
      i === idx ? { ...s, [field]: !s[field] } : s
    ));
  };

  const setAssigned = (idx: number, val: string) => {
    setStates((prev) => prev.map((s, i) => i === idx ? { ...s, assignedTo: val } : s));
  };

  // Summary counts
  const presetCount    = states.filter((s) => s.preset).length;
  const completeCount  = states.filter((s) => s.complete).length;
  const cleanedCount   = states.filter((s) => s.cleanedUp).length;
  const total          = states.length;

  // Unique assigned names (only non-empty)
  const assignedNames = Array.from(
    new Set(states.map((s) => s.assignedTo.trim()).filter(Boolean))
  ).sort();

  // ── Loading / error / empty ────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar onBack={() => navigation.goBack()} onRefresh={fetchRos} title={`Run of Show — ${weekLabel}`} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={INDIGO} />
          <Text style={styles.loadingText}>Building run of show…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar onBack={() => navigation.goBack()} onRefresh={fetchRos} title={`Run of Show — ${weekLabel}`} />
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error ?? 'No data returned'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRos}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (data.beos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar onBack={() => navigation.goBack()} onRefresh={fetchRos} title={`Run of Show — ${weekLabel}`} />
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>No events found in these BEOs.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <TopBar onBack={() => navigation.goBack()} onRefresh={fetchRos} title={`Run of Show — ${weekLabel}`} />

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

      {/* Name filter chips — only shown once at least one name is assigned */}
      {assignedNames.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nameBar} contentContainerStyle={styles.dayBarContent}>
          <TouchableOpacity
            style={[styles.nameChip, !filterName && styles.nameChipActive]}
            onPress={() => setFilterName(null)}
          >
            <Text style={[styles.nameChipText, !filterName && styles.nameChipTextActive]}>👥 All</Text>
          </TouchableOpacity>
          {assignedNames.map((name) => (
            <TouchableOpacity
              key={name}
              style={[styles.nameChip, filterName === name && styles.nameChipActive]}
              onPress={() => setFilterName(filterName === name ? null : name)}
            >
              <Text style={[styles.nameChipText, filterName === name && styles.nameChipTextActive]}>
                👤 {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <SummaryPill label="Preset"      count={presetCount}   total={total} color="#F59E0B" />
          <SummaryPill label="Complete"    count={completeCount} total={total} color={GREEN} />
          <SummaryPill label="Cleaned Up"  count={cleanedCount}  total={total} color={INDIGO} />
        </View>

        {/* Date labels + BEO cards */}
        {data.beos.map((beo, idx) => {
          if (selectedDay && beo.date !== selectedDay) return null;
          const st = states[idx];
          // Name filter — show only if assigned to the selected person
          if (filterName && st.assignedTo.trim() !== filterName) return null;
          const isAllDone = st.preset && st.complete && st.cleanedUp;

          // Show date separator when date changes
          const prevDate = idx > 0 ? data.beos[idx - 1].date : null;
          const showDate = beo.date && beo.date !== prevDate;

          return (
            <React.Fragment key={idx}>
              {showDate && (
                <Text style={styles.dateSeparator}>{beo.date}</Text>
              )}

              <View style={[styles.card, isAllDone && styles.cardDone]}>

                {/* ── BEO type badge ── */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.typeBadge, beo.beo_type === 'floorplan' && styles.typeBadgeFloor]}>
                    <Text style={styles.typeBadgeText}>
                      {beo.beo_type === 'catering'  ? '🍽 Catering'  :
                       beo.beo_type === 'floorplan' ? '🪑 Floor Plan' :
                                                      '📦 Load List'}
                    </Text>
                  </View>
                  {beo.beo_number ? (
                    <Text style={styles.beoNumber}>{beo.beo_number}</Text>
                  ) : null}
                </View>

                {/* ── Header block (mimics paper BEO) ── */}
                <View style={styles.headerBlock}>
                  <Text style={styles.eventName}>{beo.event_name}</Text>

                  <View style={styles.metaGrid}>
                    {beo.time      ? <MetaRow icon="🕐" label="Time"      value={beo.time} /> : null}
                    {beo.location  ? <MetaRow icon="📍" label="Location"  value={beo.location} /> : null}
                    {beo.headcount ? <MetaRow icon="👥" label="Headcount" value={beo.headcount} /> : null}
                    {beo.requestor ? <MetaRow icon="👤" label="Requestor" value={beo.requestor} /> : null}
                    {beo.vendor    ? <MetaRow icon="🏪" label="Vendor"    value={beo.vendor} /> : null}
                    {beo.fund_number ? <MetaRow icon="#"  label="Fund #"   value={beo.fund_number} /> : null}
                    {beo.event_date  ? <MetaRow icon="📅" label="Event Date" value={beo.event_date} /> : null}
                  </View>
                </View>

                {/* ── Content sections ── */}
                {beo.sections.map((sec, si) => (
                  <View key={si} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sec.title}</Text>
                    {sec.items.map((item, ii) => {
                      // Strip any leading bullet chars the PDF may already include
                      const clean = item.replace(/^[\s•\-\*–—·]+/, '').trim();
                      return (
                        <View key={ii} style={styles.bulletRow}>
                          <Text style={styles.bulletDot}>•</Text>
                          <Text style={styles.sectionItem}>{clean}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}

                {/* ── Ops notes ── */}
                {beo.notes.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>NOTES</Text>
                    {beo.notes.map((n, ni) => {
                      const clean = n.replace(/^[\s•\-\*–—·]+/, '').trim();
                      return (
                        <View key={ni} style={styles.bulletRow}>
                          <Text style={styles.bulletDot}>•</Text>
                          <Text style={styles.sectionItem}>{clean}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* ── Divider ── */}
                <View style={styles.divider} />

                {/* ── Assigned To ── */}
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>👷 Assigned to</Text>
                  <TextInput
                    style={styles.assignedInput}
                    value={st.assignedTo}
                    onChangeText={(v) => setAssigned(idx, v)}
                    placeholder="Enter name…"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                  />
                </View>

                {/* ── Three checkboxes ── */}
                <View style={styles.checksRow}>
                  <CheckPill
                    label="Preset"
                    checked={st.preset}
                    onPress={() => toggle(idx, 'preset')}
                    color="#F59E0B"
                  />
                  <CheckPill
                    label="Complete"
                    checked={st.complete}
                    onPress={() => toggle(idx, 'complete')}
                    color={GREEN}
                  />
                  <CheckPill
                    label="Cleaned Up"
                    checked={st.cleanedUp}
                    onPress={() => toggle(idx, 'cleanedUp')}
                    color={INDIGO}
                  />
                </View>

              </View>
            </React.Fragment>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TopBar({ onBack, onRefresh, title }: { onBack: () => void; onRefresh: () => void; title: string }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
        <Text style={styles.refreshIcon}>↻</Text>
      </TouchableOpacity>
    </View>
  );
}

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SummaryPill({
  label, count, total, color,
}: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={[styles.summaryPill, { borderColor: color }]}>
      <Text style={[styles.summaryPillCount, { color }]}>{count}/{total}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
      <View style={[styles.summaryPillTrack, { backgroundColor: `${color}22` }]}>
        <View style={[styles.summaryPillFill, { backgroundColor: color, width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

function CheckPill({
  label, checked, onPress, color,
}: { label: string; checked: boolean; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      style={[
        styles.checkPill,
        checked
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: '#FFFFFF', borderColor: '#D1D5DB' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.checkPillText, checked && styles.checkPillTextDone]}>
        {checked ? '✓ ' : ''}{label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:    { paddingHorizontal: 14, paddingTop: 10 },

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
  backBtn:     { width: 36, height: 36, justifyContent: 'center' },
  backIcon:    { fontSize: 32, color: INDIGO, lineHeight: 36, marginTop: -4 },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1F2937' },
  refreshBtn:  { width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  refreshIcon: { fontSize: 22, color: INDIGO, fontWeight: '600' },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 6,
  },
  summaryPill: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  summaryPillCount: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  summaryPillLabel: { fontSize: 10, color: GRAY, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  summaryPillTrack: { width: '100%', height: 4, borderRadius: 2 },
  summaryPillFill:  { height: 4, borderRadius: 2 },

  // Date separator
  dateSeparator: {
    fontSize: 11,
    fontWeight: '700',
    color: INDIGO,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 4,
  },

  // BEO card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: INDIGO,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardDone: {
    borderLeftColor: GREEN,
    backgroundColor: '#F0FDF4',
  },

  // Card top row (type badge + BEO number)
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeBadge: {
    backgroundColor: INDIGO_L,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeFloor: { backgroundColor: '#FEF9C3' },
  typeBadgeText:  { fontSize: 12, fontWeight: '700', color: INDIGO_D },
  beoNumber:      { fontSize: 11, color: GRAY, fontWeight: '600' },

  // Header block
  headerBlock:  { marginBottom: 12 },
  eventName:    { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 8 },
  metaGrid:     { gap: 4 },
  metaRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaIcon:     { fontSize: 12, width: 18, marginTop: 1 },
  metaLabel:    { fontSize: 12, color: GRAY, width: 72, fontWeight: '600' },
  metaValue:    { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18 },

  // Content sections
  section: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: INDIGO,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sectionItem: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    paddingLeft: 4,
  },

  // Divider
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },

  // Assigned to
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  assignedLabel: { fontSize: 13, fontWeight: '700', color: '#374151', width: 100 },
  assignedInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FAFAFA',
  },

  // Check pills
  checksRow: { flexDirection: 'row', gap: 8 },
  checkPill: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  checkPillText:     { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  checkPillTextDone: { color: '#FFFFFF' },

  // Loading / error / empty
  loadingText: { marginTop: 14, color: GRAY, fontSize: 15 },
  errorEmoji:  { fontSize: 40, marginBottom: 12 },
  errorText:   { color: GRAY, fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: INDIGO,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyEmoji:   { fontSize: 48, marginBottom: 14 },
  emptyText:    { color: '#9CA3AF', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },

  // Bullet point rows
  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  bulletDot:  { color: INDIGO, fontSize: 14, fontWeight: '700', marginRight: 6, marginTop: 1 },

  // Day filter bar
  dayBar:            { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dayBarContent:     { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  dayChip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  dayChipActive:     { backgroundColor: INDIGO, borderColor: INDIGO },
  dayChipText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
  dayChipTextActive: { color: '#FFFFFF' },

  // Name filter bar
  nameBar:           { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  nameChip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  nameChipActive:    { backgroundColor: GREEN, borderColor: GREEN },
  nameChipText:      { fontSize: 13, color: '#374151', fontWeight: '600' },
  nameChipTextActive:{ color: '#FFFFFF' },
});
