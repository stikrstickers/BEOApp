import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Modal, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../auth/api';
import { Workflow, WorkflowAction, WorkflowActionType, RequestStatus } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkflowEdit'>;

const ACTION_TYPES: { value: WorkflowActionType; label: string; emoji: string }[] = [
  { value: 'send_email',         label: 'Send email',          emoji: '✉️' },
  { value: 'add_organizer_note', label: 'Append organizer note', emoji: '📝' },
  { value: 'set_status',         label: 'Change status',        emoji: '🔄' },
];

const STATUSES: RequestStatus[] = ['new', 'in_review', 'confirmed', 'declined', 'completed'];

type Draft = {
  action_type: WorkflowActionType;
  // send_email fields
  to: string;          // 'client' | 'organizer' | custom email
  subject: string;
  body: string;
  // add_organizer_note field
  text: string;
  // set_status field
  status: RequestStatus;
};

const BLANK_DRAFT: Draft = {
  action_type: 'send_email',
  to: 'client', subject: '', body: '',
  text: '',
  status: 'in_review',
};

export default function WorkflowEditScreen({ route, navigation }: Props) {
  const { workflowId } = route.params;
  const { token } = useAuth();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowAction | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await apiFetch<{ workflow: Workflow }>(`/api/workflows/${workflowId}/`, { token });
      setWf(json.workflow);
    } catch (e: any) {
      Alert.alert('Load failed', e?.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId, token]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setDraft(BLANK_DRAFT); setModalOpen(true); };
  const openEdit = (a: WorkflowAction) => {
    const cfg = a.config || {};
    setEditing(a);
    setDraft({
      action_type: a.action_type,
      to:      String(cfg.to ?? 'client'),
      subject: String(cfg.subject ?? ''),
      body:    String(cfg.body ?? ''),
      text:    String(cfg.text ?? ''),
      status:  (cfg.status as RequestStatus) ?? 'in_review',
    });
    setModalOpen(true);
  };

  const buildConfig = (d: Draft): Record<string, unknown> => {
    if (d.action_type === 'send_email')         return { to: d.to.trim() || 'client', subject: d.subject, body: d.body };
    if (d.action_type === 'add_organizer_note') return { text: d.text };
    if (d.action_type === 'set_status')         return { status: d.status };
    return {};
  };

  const save = async () => {
    if (draft.action_type === 'send_email' && !draft.subject.trim()) {
      Alert.alert('Missing info', 'Email action needs a subject.');
      return;
    }
    if (draft.action_type === 'add_organizer_note' && !draft.text.trim()) {
      Alert.alert('Missing info', 'Note action needs note text.');
      return;
    }

    setSaving(true);
    try {
      const config = buildConfig(draft);
      if (editing) {
        await apiFetch(`/api/workflow-actions/${editing.id}/`, {
          method: 'PATCH', token,
          body: JSON.stringify({ action_type: draft.action_type, config }),
        });
      } else {
        await apiFetch(`/api/workflows/${workflowId}/actions/`, {
          method: 'POST', token,
          body: JSON.stringify({ action_type: draft.action_type, config }),
        });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (a: WorkflowAction) => {
    Alert.alert('Remove action', 'Remove this action from the workflow?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/workflow-actions/${a.id}/`, { method: 'DELETE', token });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message);
          }
        },
      },
    ]);
  };

  if (loading || !wf) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={INDIGO} /></View>
      </SafeAreaView>
    );
  }

  const describeAction = (a: WorkflowAction): string => {
    const cfg = a.config || {};
    if (a.action_type === 'send_email')         return `to ${cfg.to || 'client'} — "${cfg.subject || '(no subject)'}"`;
    if (a.action_type === 'add_organizer_note') return `"${String(cfg.text || '').slice(0, 60)}${String(cfg.text || '').length > 60 ? '…' : ''}"`;
    if (a.action_type === 'set_status')         return `→ ${cfg.status || '?'}`;
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{wf.name}</Text>
        <Text style={styles.subtitle}>Trigger: {wf.trigger.replace(/_/g, ' ')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.actionsHeader}>
          <Text style={styles.sectionTitle}>Actions (run in order)</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>＋ Add action</Text>
          </TouchableOpacity>
        </View>

        {wf.actions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No actions yet</Text>
            <Text style={styles.emptyHint}>Add a send-email step, set-status step, etc.</Text>
          </View>
        ) : wf.actions.map((a, idx) => {
          const meta = ACTION_TYPES.find((t) => t.value === a.action_type);
          return (
            <TouchableOpacity
              key={a.id}
              style={styles.actionCard}
              onPress={() => openEdit(a)}
              onLongPress={() => remove(a)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionOrder}>#{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{meta?.emoji} {meta?.label || a.action_type}</Text>
                <Text style={styles.actionDesc}>{describeAction(a)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.hint}>
          Tip: in email subjects/bodies and notes, use {'{{client_name}}, {{event_name}}, {{preferred_date}}'} etc. for live substitution.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={10}>
              <Text style={styles.back}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{editing ? 'Edit action' : 'New action'}</Text>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Action type</Text>
            <View style={styles.chipRow}>
              {ACTION_TYPES.map((t) => {
                const active = t.value === draft.action_type;
                return (
                  <TouchableOpacity key={t.value} style={[styles.chip, active && styles.chipActive]} onPress={() => setDraft({ ...draft, action_type: t.value })}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.emoji} {t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {draft.action_type === 'send_email' && (
              <>
                <Text style={styles.label}>Recipient</Text>
                <View style={styles.chipRow}>
                  {['client', 'organizer'].map((r) => {
                    const active = r === draft.to;
                    return (
                      <TouchableOpacity key={r} style={[styles.chip, active && styles.chipActive]} onPress={() => setDraft({ ...draft, to: r })}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  value={draft.to}
                  onChangeText={(v) => setDraft({ ...draft, to: v })}
                  placeholder="…or a custom email"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Subject</Text>
                <TextInput style={styles.input} value={draft.subject} onChangeText={(v) => setDraft({ ...draft, subject: v })} placeholder="We received your event request, {{client_name}}!" placeholderTextColor="#9CA3AF" />
                <Text style={styles.label}>Body</Text>
                <TextInput
                  style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]}
                  value={draft.body}
                  onChangeText={(v) => setDraft({ ...draft, body: v })}
                  placeholder="Hi {{client_name}}, …"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
                <Text style={styles.hint}>SMTP isn't configured — sends are logged to WorkflowRun for now.</Text>
              </>
            )}

            {draft.action_type === 'add_organizer_note' && (
              <>
                <Text style={styles.label}>Note text</Text>
                <TextInput
                  style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
                  value={draft.text}
                  onChangeText={(v) => setDraft({ ...draft, text: v })}
                  placeholder="Auto-flagged: high headcount ({{headcount}})"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </>
            )}

            {draft.action_type === 'set_status' && (
              <>
                <Text style={styles.label}>New status</Text>
                <View style={styles.chipRow}>
                  {STATUSES.map((s) => {
                    const active = s === draft.status;
                    return (
                      <TouchableOpacity key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setDraft({ ...draft, status: s })}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{editing ? 'Save action' : 'Add action'}</Text>}
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
  title:    { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 13, color: GRAY, marginTop: 4, textTransform: 'capitalize' },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  actionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: GRAY, letterSpacing: 0.8 },
  addBtn:        { backgroundColor: INDIGO, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  addBtnText:    { color: '#FFF', fontSize: 12, fontWeight: '700' },

  actionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    alignItems: 'center',
  },
  actionOrder: { fontSize: 13, fontWeight: '800', color: INDIGO, width: 28 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  actionDesc:  { fontSize: 12, color: GRAY, marginTop: 2 },

  empty: { paddingVertical: 50, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyHint:  { fontSize: 12, color: GRAY },

  hint: { fontSize: 12, color: GRAY, marginTop: 20, fontStyle: 'italic' },

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
