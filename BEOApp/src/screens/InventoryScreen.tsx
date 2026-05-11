import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Modal, ActivityIndicator, Alert, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../auth/api';
import { InventoryCategory, InventoryItem } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';
const RED    = '#DC2626';

type Props = NativeStackScreenProps<RootStackParamList, 'Inventory'>;

const CATEGORIES: { value: InventoryCategory | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'table',       label: 'Tables' },
  { value: 'chair',       label: 'Chairs' },
  { value: 'food',        label: 'Food' },
  { value: 'beverage',    label: 'Beverages' },
  { value: 'av',          label: 'A/V' },
  { value: 'linen',       label: 'Linens' },
  { value: 'serviceware', label: 'Serviceware' },
  { value: 'other',       label: 'Other' },
];

const EDITABLE_CATEGORIES = CATEGORIES.filter((c) => c.value !== 'all') as
  { value: InventoryCategory; label: string }[];

type Draft = {
  name: string;
  category: InventoryCategory;
  unit: string;
  quantity_on_hand: string;
  unit_price: string;
  low_stock_threshold: string;
  notes: string;
};

const BLANK_DRAFT: Draft = {
  name: '', category: 'other', unit: '', quantity_on_hand: '0',
  unit_price: '0.00', low_stock_threshold: '0', notes: '',
};

export default function InventoryScreen({ navigation }: Props) {
  const { token, loading: authLoading } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [activeCat, setActiveCat] = useState<InventoryCategory | 'all'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<InventoryItem | null>(null);
  const [draft, setDraft]         = useState<Draft>(BLANK_DRAFT);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!authLoading && !token) navigation.replace('Login');
  }, [authLoading, token, navigation]);

  const load = useCallback(async () => {
    try {
      const qs = activeCat === 'all' ? '' : `?category=${activeCat}`;
      const json = await apiFetch<{ items: InventoryItem[] }>(`/api/inventory/${qs}`, { token });
      setItems(json.items);
    } catch (_) {
      // ignore — show empty
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [activeCat, token]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setDraft(BLANK_DRAFT);
    setModalOpen(true);
  };

  const openEdit = (it: InventoryItem) => {
    setEditing(it);
    setDraft({
      name: it.name,
      category: it.category,
      unit: it.unit,
      quantity_on_hand: String(it.quantity_on_hand),
      unit_price: it.unit_price,
      low_stock_threshold: String(it.low_stock_threshold),
      notes: it.notes,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Missing info', 'Item needs a name.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...draft,
        quantity_on_hand: parseInt(draft.quantity_on_hand || '0', 10),
        low_stock_threshold: parseInt(draft.low_stock_threshold || '0', 10),
      };
      if (editing) {
        await apiFetch(`/api/inventory/${editing.id}/`, { method: 'PATCH', token, body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/inventory/', { method: 'POST', token, body: JSON.stringify(body) });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (it: InventoryItem) => {
    Alert.alert('Remove item', `Remove "${it.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/inventory/${it.id}/`, { method: 'DELETE', token });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>＋ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ flexGrow: 0 }}>
        {CATEGORIES.map((c) => {
          const active = c.value === activeCat;
          return (
            <TouchableOpacity
              key={c.value}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveCat(c.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={INDIGO} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} tintColor={INDIGO} />}
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No items yet</Text>
              <Text style={styles.emptyHint}>Tap "＋ Add" to log your first item.</Text>
            </View>
          ) : items.map((it) => (
            <TouchableOpacity key={it.id} style={styles.card} onPress={() => openEdit(it)} onLongPress={() => remove(it)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                <Text style={styles.price}>${it.unit_price}{it.unit ? ` / ${it.unit}` : ''}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>📦 {it.quantity_on_hand} on hand</Text>
                <Text style={styles.meta}>🏷 {it.category}</Text>
                {it.is_low_stock && <Text style={[styles.meta, { color: RED, fontWeight: '700' }]}>⚠ low stock</Text>}
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={10}>
              <Text style={styles.back}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{editing ? 'Edit item' : 'New item'}</Text>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required />

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {EDITABLE_CATEGORIES.map((c) => {
                const active = c.value === draft.category;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft({ ...draft, category: c.value })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Unit" value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} placeholder="each, lb, gallon" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Qty on hand" value={draft.quantity_on_hand} onChange={(v) => setDraft({ ...draft, quantity_on_hand: v })} keyboardType="numeric" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Unit price ($)" value={draft.unit_price} onChange={(v) => setDraft({ ...draft, unit_price: v })} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Low-stock at" value={draft.low_stock_threshold} onChange={(v) => setDraft({ ...draft, low_stock_threshold: v })} keyboardType="numeric" />
              </View>
            </View>
            <Field label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} multiline />

            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Create item'}</Text>}
            </TouchableOpacity>
            <View style={{ height: 120 }} />
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={{ color: '#DC2626' }}> *</Text> : null}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:   { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  back:     { color: INDIGO, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title:    { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 4 },
  addBtn:   { backgroundColor: INDIGO, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  tabRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  tabActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  tabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tabTextActive: { color: '#FFFFFF' },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937', marginRight: 10 },
  price: { fontSize: 14, fontWeight: '700', color: INDIGO },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#374151' },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyHint:  { fontSize: 13, color: GRAY },

  field: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1F2937',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  primaryBtn: { backgroundColor: INDIGO, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
