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
  Modal,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

import { BASE_URL } from '../config';

const ALL_SIZES = ['3.0 L', '1.9 L', '1.5 Gal', '2.5 Gal','5 Gal'];

// ── Types ─────────────────────────────────────────────────────────────────────

type CoffeeOrder = {
  date: string;
  event_name: string;
  time: string;
  brew_by: string;
  location: string;
  headcount: string;
  items: string[];
  sizes: string[];
  brewed: boolean;
};

type CoffeeResponse = {
  dates: string[];
  orders: CoffeeOrder[];
};

// Local state per order (brew_by editable, sizes togglable, brewed checkbox)
type OrderState = {
  brewBy: string;
  sizes: string[];
  brewed: boolean;
};

// ── Navigation types ──────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Coffee'>;
  route: RouteProp<RootStackParamList, 'Coffee'>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoffeeScreen({ navigation, route }: Props) {
  const { weekId, weekLabel } = route.params;

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [data, setData]         = useState<CoffeeResponse | null>(null);
  const [states, setStates]     = useState<OrderState[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Time-picker modal
  const [editingIdx, setEditingIdx]     = useState<number | null>(null);
  const [editingTime, setEditingTime]   = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCoffee = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('week_id', String(weekId));

      const res  = await fetch(`${BASE_URL}/api/coffee-list/`, { method: 'POST', body: form });
      const json = (await res.json()) as CoffeeResponse;

      // Init local state from response
      const initStates: OrderState[] = json.orders.map((o) => ({
        brewBy: o.brew_by,
        sizes:  o.sizes.length > 0 ? o.sizes : [],
        brewed: false,
      }));

      setData(json);
      setStates(initStates);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load coffee orders');
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => { fetchCoffee(); }, [fetchCoffee]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleBrewed = (idx: number) => {
    setStates((prev) => prev.map((s, i) => i === idx ? { ...s, brewed: !s.brewed } : s));
  };

  const toggleSize = (idx: number, size: string) => {
    setStates((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const has = s.sizes.includes(size);
      return { ...s, sizes: has ? s.sizes.filter((x) => x !== size) : [...s.sizes, size] };
    }));
  };

  const openTimePicker = (idx: number) => {
    setEditingIdx(idx);
    setEditingTime(states[idx]?.brewBy ?? '');
  };

  const saveTime = () => {
    if (editingIdx === null) return;
    setStates((prev) => prev.map((s, i) =>
      i === editingIdx ? { ...s, brewBy: editingTime } : s
    ));
    setEditingIdx(null);
  };

  const doneCount = states.filter((s) => s.brewed).length;

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar onBack={() => navigation.goBack()} onRefresh={fetchCoffee} title={`Coffee — ${weekLabel}`} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B45309" />
          <Text style={styles.loadingText}>Reading coffee orders…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar onBack={() => navigation.goBack()} onRefresh={fetchCoffee} title={`Coffee — ${weekLabel}`} />
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error ?? 'No data returned'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchCoffee}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (data.orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar onBack={() => navigation.goBack()} onRefresh={fetchCoffee} title={`Coffee — ${weekLabel}`} />
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>☕</Text>
          <Text style={styles.emptyText}>No coffee orders found in these BEOs.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <TopBar onBack={() => navigation.goBack()} onRefresh={fetchCoffee} title={`Coffee — ${weekLabel}`} />

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

        {/* Header card */}
        <View style={styles.headerCard}>
          <Text style={styles.headerEmoji}>☕</Text>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>Coffee Orders</Text>
            <Text style={styles.headerSub}>
              {data.dates.length > 1
                ? `${data.dates[0]} – ${data.dates[data.dates.length - 1]}`
                : data.dates[0] ?? ''}
            </Text>
            <Text style={styles.headerSub}>
              {doneCount}/{data.orders.length} brewed
            </Text>
          </View>
          {/* Overall progress bar */}
          {data.orders.length > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((doneCount / data.orders.length) * 100)}%` as any },
                ]}
              />
            </View>
          )}
        </View>

        {/* Order cards */}
        {data.orders.map((order, idx) => {
          if (selectedDay && order.date !== selectedDay) return null;
          const st     = states[idx];
          const brewed = st?.brewed ?? false;

          return (
            <View key={idx} style={[styles.card, brewed && styles.cardDone]}>

              {/* Date label */}
              {order.date ? (
                <Text style={styles.cardDate}>{order.date}</Text>
              ) : null}

              {/* Event row */}
              <View style={styles.eventRow}>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventName, brewed && styles.textDone]}>
                    {order.event_name}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {order.time}{order.location ? `  ·  ${order.location}` : ''}
                    {order.headcount ? `  ·  👥 ${order.headcount}` : ''}
                  </Text>
                </View>

                {/* Brewed checkbox */}
                <TouchableOpacity
                  style={[styles.brewedBtn, brewed && styles.brewedBtnDone]}
                  onPress={() => toggleBrewed(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.brewedBtnText, brewed && styles.brewedBtnTextDone]}>
                    {brewed ? '✓ Brewed' : 'Brewed?'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Brew-by time row */}
              <View style={styles.brewRow}>
                <Text style={styles.brewLabel}>☕ Brew by</Text>
                <TouchableOpacity
                  style={styles.brewTimeBtn}
                  onPress={() => openTimePicker(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.brewTimeText}>
                    {st?.brewBy || '—  tap to set'}
                  </Text>
                  <Text style={styles.brewTimeEdit}>✎</Text>
                </TouchableOpacity>
              </View>

              {/* Size chips */}
              <View style={styles.sizesRow}>
                <Text style={styles.sizesLabel}>Sizes</Text>
                <View style={styles.sizeChips}>
                  {ALL_SIZES.map((sz) => {
                    const active = st?.sizes.includes(sz) ?? false;
                    return (
                      <TouchableOpacity
                        key={sz}
                        style={[styles.sizeChip, active && styles.sizeChipActive]}
                        onPress={() => toggleSize(idx, sz)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.sizeChipText, active && styles.sizeChipTextActive]}>
                          {sz}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Items */}
              <View style={styles.itemsBlock}>
                {order.items.map((item, ii) => (
                  <Text key={ii} style={[styles.itemLine, brewed && styles.textDone]}>
                    · {item}
                  </Text>
                ))}
              </View>

            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Time-edit modal */}
      <Modal
        visible={editingIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingIdx(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditingIdx(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Brew-By Time</Text>
            <Text style={styles.modalHint}>e.g. 12:30 PM</Text>
            <TextInput
              style={styles.modalInput}
              value={editingTime}
              onChangeText={setEditingTime}
              placeholder="12:30 PM"
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveTime}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditingIdx(null)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={saveTime}
              >
                <Text style={styles.modalBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Top bar sub-component ────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

const COFFEE   = '#92400E';
const COFFEE_L = '#FEF3C7';
const COFFEE_M = '#B45309';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:    { paddingHorizontal: 16, paddingTop: 12 },

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
  backBtn:      { width: 36, height: 36, justifyContent: 'center' },
  backIcon:     { fontSize: 32, color: COFFEE_M, lineHeight: 36, marginTop: -4 },
  topBarTitle:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1F2937' },
  refreshBtn:   { width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  refreshIcon:  { fontSize: 22, color: COFFEE_M, fontWeight: '600' },

  // Header card
  headerCard: {
    backgroundColor: COFFEE_M,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap',
  },
  headerEmoji: { fontSize: 36 },
  headerBody:  { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  headerSub:   { fontSize: 13, color: '#FDE68A', marginTop: 1 },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    marginTop: 10,
  },
  progressFill:  { height: 6, backgroundColor: '#A7F3D0', borderRadius: 3 },

  // Order card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: COFFEE_M,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardDone:  { borderLeftColor: '#10B981', backgroundColor: '#F0FDF4' },
  cardDate:  { fontSize: 10, color: COFFEE_M, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  // Event row
  eventRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 3 },
  eventMeta: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  textDone:  { color: '#9CA3AF', textDecorationLine: 'line-through' },

  // Brewed checkbox button
  brewedBtn: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    minWidth: 80,
  },
  brewedBtnDone:     { backgroundColor: '#10B981', borderColor: '#10B981' },
  brewedBtnText:     { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  brewedBtnTextDone: { color: '#FFFFFF' },

  // Brew-by time row
  brewRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  brewLabel:  { fontSize: 13, fontWeight: '600', color: '#374151', width: 70 },
  brewTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COFFEE_L,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  brewTimeText: { fontSize: 15, fontWeight: '700', color: COFFEE },
  brewTimeEdit: { fontSize: 16, color: COFFEE_M },

  // Sizes row
  sizesRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sizesLabel: { fontSize: 13, fontWeight: '600', color: '#374151', width: 70 },
  sizeChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sizeChip: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  sizeChipActive:     { backgroundColor: COFFEE_M, borderColor: COFFEE_M },
  sizeChipText:       { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  sizeChipTextActive: { color: '#FFFFFF' },

  // Items
  itemsBlock: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  itemLine:   { fontSize: 13, color: '#6B7280', lineHeight: 20 },

  // Loading / error / empty
  loadingText: { marginTop: 14, color: '#6B7280', fontSize: 15 },
  errorEmoji:  { fontSize: 40, marginBottom: 12 },
  errorText:   { color: '#6B7280', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: COFFEE_M,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyText:  { color: '#9CA3AF', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },

  // Time-edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  modalHint:  { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 18,
  },
  modalBtns:          { flexDirection: 'row', gap: 10 },
  modalBtn:           { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel:     { backgroundColor: '#F3F4F6' },
  modalBtnSave:       { backgroundColor: COFFEE_M },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalBtnSaveText:   { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Day filter bar
  dayBar:            { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dayBarContent:     { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  dayChip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  dayChipActive:     { backgroundColor: '#92400E', borderColor: '#92400E' },
  dayChipText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
  dayChipTextActive: { color: '#FFFFFF' },
});
