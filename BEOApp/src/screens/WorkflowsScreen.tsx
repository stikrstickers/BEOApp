import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Modal, ActivityIndicator, Alert, Switch, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../auth/api';
import { Workflow, WorkflowTrigger } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = NativeStackScreenProps<RootStackParamList, 'Workflows'>;

const TRIGGERS: { value: WorkflowTrigger; label: string }[] = [
  { value: 'on_submit',           label: 'Event submitted' },
  { value: 'on_status_new',       label: 'Status → New' },
  { value: 'on_status_in_review', label: 'Status → In Review' },
  { value: 'on_status_confirmed', label: 'Status → Confirmed' },
  { value: 'on_status_declined',  label: 'Status → Declined' },
  { value: 'on_status_completed', label: 'Status → Completed' },
];

export default function WorkflowsScreen({ navigation }: Props) {
  const { token, loading: authLoading } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<WorkflowTrigger>('on_submit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) navigation.replace('Login');
  }, [authLoading, token, navigation]);

  const load = useCallback(async () => {
    try {
      const json = await apiFetch<{ workflows: Workflow[] }>('/api/workflows/', { token });
      setWorkflows(json.workflows);
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Give the workflow a name.');
      return;
    }
    setSaving(true);
    try {
      const json = await apiFetch<{ workflow: Workflow }>(
        '/api/workflows/',
        { method: 'POST', token, body: JSON.stringify({ name: name.trim(), trigger }) },
      );
      setModalOpen(false);
      setName('');
      setTrigger('on_submit');
      navigation.navigate('WorkflowEdit', { workflowId: json.workflow.id });
    } catch (e: any) {
      Alert.alert('Create failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (w: Workflow) => {
    try {
      await apiFetch(`/api/workflows/${w.id}/`, {
        method: 'PATCH', token,
        body: JSON.stringify({ is_active: !w.is_active }),
      });
      await load();
    } catch (e: any) {
      Alert.alert('Toggle failed', e?.message);
    }
  };

  const remove = (w: Workflow) => {
    Alert.alert('Remove workflow', `Delete "${w.name}"? Its run history will be removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/workflows/${w.id}/`, { method: 'DELETE', token });
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
            <Text style={styles.title}>Workflows</Text>
            <Text style={styles.subtitle}>Automate what happens around event requests.</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>＋ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={INDIGO} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} tintColor={INDIGO} />}
        >
          {workflows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No workflows yet</Text>
              <Text style={styles.emptyHint}>Send a welcome email when a request comes in, auto-confirm low-headcount events, and so on.</Text>
            </View>
          ) : workflows.map((w) => {
            const trigLabel = TRIGGERS.find((t) => t.value === w.trigger)?.label || w.trigger;
            return (
              <TouchableOpacity
                key={w.id}
                style={styles.card}
                onPress={() => navigation.navigate('WorkflowEdit', { workflowId: w.id })}
                onLongPress={() => remove(w)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.wfName} numberOfLines={1}>{w.name}</Text>
                  <Switch
                    value={w.is_active}
                    onValueChange={() => toggleActive(w)}
                    trackColor={{ false: '#D1D5DB', true: INDIGO }}
                    thumbColor="#FFF"
                  />
                </View>
                <Text style={styles.trigger}>↳ {trigLabel}</Text>
                <Text style={styles.meta}>
                  {w.actions.length} action{w.actions.length === 1 ? '' : 's'}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={10}>
              <Text style={styles.back}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New workflow</Text>
            <Text style={styles.subtitle}>You'll add the actions after this step.</Text>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Welcome email"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Trigger</Text>
            <View style={styles.chipRow}>
              {TRIGGERS.map((t) => {
                const active = t.value === trigger;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setTrigger(t.value)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={create}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create + add actions</Text>}
            </TouchableOpacity>
            <View style={{ height: 120 }} />
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wfName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937', marginRight: 10 },
  trigger: { fontSize: 12, color: INDIGO, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  meta: { fontSize: 12, color: GRAY },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyHint:  { fontSize: 13, color: GRAY, textAlign: 'center', paddingHorizontal: 30 },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1F2937',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  primaryBtn: { backgroundColor: INDIGO, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
