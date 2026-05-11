import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Modal, ActivityIndicator, Alert, Switch, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../auth/api';
import { TeamMember, TeamRole } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamRoster'>;

const ROLES: { value: TeamRole | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'coordinator', label: 'Coordinators' },
  { value: 'chef',        label: 'Chefs' },
  { value: 'bartender',   label: 'Bartenders' },
  { value: 'server',      label: 'Servers' },
  { value: 'it',          label: 'IT / A/V' },
  { value: 'setup',       label: 'Setup' },
  { value: 'security',    label: 'Security' },
  { value: 'vendor',      label: 'Vendors' },
  { value: 'other',       label: 'Other' },
];
const EDITABLE_ROLES = ROLES.filter((r) => r.value !== 'all') as
  { value: TeamRole; label: string }[];

type Draft = {
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  is_vendor: boolean;
  company: string;
  notes: string;
};

const BLANK: Draft = { name: '', email: '', phone: '', role: 'other', is_vendor: false, company: '', notes: '' };

export default function TeamRosterScreen({ navigation }: Props) {
  const { token, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [activeRole, setActiveRole] = useState<TeamRole | 'all'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<TeamMember | null>(null);
  const [draft, setDraft]         = useState<Draft>(BLANK);
  const [saving, setSaving]       = useState(false);

  // Team management is organizer-only — bounce to login if no token.
  useEffect(() => {
    if (!authLoading && !token) navigation.replace('Login');
  }, [authLoading, token, navigation]);

  const load = useCallback(async () => {
    try {
      const qs = activeRole === 'all' ? '' : `?role=${activeRole}`;
      const json = await apiFetch<{ members: TeamMember[] }>(`/api/team/${qs}`, { token });
      setMembers(json.members);
    } catch (_) {
      // empty state
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [activeRole, token]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setDraft(BLANK); setModalOpen(true); };
  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setDraft({
      name: m.name, email: m.email, phone: m.phone, role: m.role,
      is_vendor: m.is_vendor, company: m.company, notes: m.notes,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Missing info', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/team/${editing.id}/`, { method: 'PATCH', token, body: JSON.stringify(draft) });
      } else {
        await apiFetch('/api/team/', { method: 'POST', token, body: JSON.stringify(draft) });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (m: TeamMember) => {
    Alert.alert('Remove member', `Remove ${m.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/team/${m.id}/`, { method: 'DELETE', token });
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
            <Text style={styles.title}>Team</Text>
            <Text style={styles.subtitle}>{members.length} member{members.length === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>＋ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ flexGrow: 0 }}>
        {ROLES.map((r) => {
          const active = r.value === activeRole;
          return (
            <TouchableOpacity
              key={r.value}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveRole(r.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{r.label}</Text>
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
          {members.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No members yet</Text>
              <Text style={styles.emptyHint}>Add coordinators, chefs, vendors, etc.</Text>
            </View>
          ) : members.map((m) => (
            <TouchableOpacity key={m.id} style={styles.card} onPress={() => openEdit(m)} onLongPress={() => remove(m)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.memberName}>{m.name}</Text>
                {m.is_vendor && <View style={styles.vendorBadge}><Text style={styles.vendorBadgeText}>Vendor</Text></View>}
              </View>
              <Text style={styles.role}>{ROLES.find((r) => r.value === m.role)?.label || m.role}</Text>
              {(m.email || m.phone) && (
                <Text style={styles.meta}>{[m.email, m.phone].filter(Boolean).join('  ·  ')}</Text>
              )}
              {m.company ? <Text style={styles.meta}>🏢 {m.company}</Text> : null}
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
            <Text style={styles.title}>{editing ? 'Edit member' : 'New member'}</Text>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required />

            <Text style={styles.label}>Role</Text>
            <View style={styles.chipRow}>
              {EDITABLE_ROLES.map((r) => {
                const active = r.value === draft.role;
                return (
                  <TouchableOpacity key={r.value} style={[styles.chip, active && styles.chipActive]} onPress={() => setDraft({ ...draft, role: r.value })}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field label="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} keyboardType="email-address" />
            <Field label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} keyboardType="phone-pad" />

            <View style={styles.vendorRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Third-party vendor</Text>
                <Text style={styles.hint}>External contractor or outside vendor.</Text>
              </View>
              <Switch value={draft.is_vendor} onValueChange={(v) => setDraft({ ...draft, is_vendor: v })} trackColor={{ false: '#D1D5DB', true: INDIGO }} thumbColor="#FFFFFF" />
            </View>
            {draft.is_vendor && (
              <Field label="Company" value={draft.company} onChange={(v) => setDraft({ ...draft, company: v })} />
            )}
            <Field label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} multiline />

            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Create member'}</Text>}
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
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
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
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  role: { fontSize: 12, color: INDIGO, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  vendorBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  vendorBadgeText: { color: '#92400E', fontSize: 10, fontWeight: '700' },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyHint:  { fontSize: 13, color: GRAY },

  field: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  hint:  { fontSize: 12, color: GRAY, marginTop: 2 },
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

  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },

  primaryBtn: { backgroundColor: INDIGO, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
