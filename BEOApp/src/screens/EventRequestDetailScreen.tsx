import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../auth/api';
import { EventAssignment, EventRequest, RequestStatus, TeamMember, WorkflowRun } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = NativeStackScreenProps<RootStackParamList, 'EventRequestDetail'>;

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: 'new',       label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined',  label: 'Declined' },
  { value: 'completed', label: 'Completed' },
];

const EVENT_TYPE_LABEL: Record<string, string> = {
  corporate: 'Corporate', wedding: 'Wedding', conference: 'Conference',
  social: 'Social', nonprofit: 'Nonprofit', other: 'Other',
};
const FOOD_LABEL: Record<string, string> = {
  none: 'None', light: 'Light bites', plated: 'Plated', buffet: 'Buffet', cocktail: 'Cocktail',
};
const TECH_LABEL: Record<string, string> = {
  none: 'None', basic_av: 'Basic A/V', full_av: 'Full A/V', livestream: 'Livestream',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function EventRequestDetailScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const { token } = useAuth();
  const [req, setReq]   = useState<EventRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [note, setNote]       = useState('');
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [runs, setRuns]               = useState<WorkflowRun[]>([]);

  // Assign-staff modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [members, setMembers]                 = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMember] = useState<number | null>(null);
  const [roleOnEvent, setRoleOnEvent]         = useState('');

  useEffect(() => {
    if (!token) navigation.replace('Login');
  }, [token, navigation]);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [reqRes, assignRes, runRes] = await Promise.all([
        apiFetch<{ request: EventRequest }>(`/api/event-requests/${requestId}/`, { token }),
        apiFetch<{ assignments: EventAssignment[] }>(`/api/event-requests/${requestId}/assignments/`, { token }),
        apiFetch<{ runs: WorkflowRun[] }>(`/api/event-requests/${requestId}/workflow-runs/`, { token }),
      ]);
      setReq(reqRes.request);
      setNote(reqRes.request.organizer_note || '');
      setAssignments(assignRes.assignments);
      setRuns(runRes.runs);
    } catch (e: any) {
      Alert.alert('Load failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [requestId, token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (status: RequestStatus) => {
    if (!req) return;
    setSaving(true);
    try {
      const json = await apiFetch<{ request: EventRequest }>(
        `/api/event-requests/${requestId}/`,
        { method: 'PATCH', token, body: JSON.stringify({ status }) },
      );
      setReq(json.request);
      // Workflow runs may have fired on this status change — refresh the log.
      const runRes = await apiFetch<{ runs: WorkflowRun[] }>(`/api/event-requests/${requestId}/workflow-runs/`, { token });
      setRuns(runRes.runs);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async () => {
    if (!req) return;
    setSaving(true);
    try {
      const json = await apiFetch<{ request: EventRequest }>(
        `/api/event-requests/${requestId}/`,
        { method: 'PATCH', token, body: JSON.stringify({ organizer_note: note }) },
      );
      setReq(json.request);
      Alert.alert('Saved', 'Organizer note updated.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = async () => {
    try {
      const json = await apiFetch<{ members: TeamMember[] }>('/api/team/', { token });
      setMembers(json.members);
      setSelectedMember(null);
      setRoleOnEvent('');
      setAssignModalOpen(true);
    } catch (e: any) {
      Alert.alert('Load team failed', e?.message);
    }
  };

  const assignMember = async () => {
    if (!selectedMemberId) {
      Alert.alert('Pick a member', 'Select a team member to assign.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/event-requests/${requestId}/assignments/`, {
        method: 'POST', token,
        body: JSON.stringify({ team_member: selectedMemberId, role_on_event: roleOnEvent }),
      });
      setAssignModalOpen(false);
      const a = await apiFetch<{ assignments: EventAssignment[] }>(`/api/event-requests/${requestId}/assignments/`, { token });
      setAssignments(a.assignments);
    } catch (e: any) {
      Alert.alert('Assignment failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const unassign = (a: EventAssignment) => {
    Alert.alert('Unassign?', `Remove ${a.team_member.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/assignments/${a.id}/`, { method: 'DELETE', token });
            setAssignments(assignments.filter((x) => x.id !== a.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={INDIGO} /></View>
      </SafeAreaView>
    );
  }

  if (!req) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><Text style={{ color: GRAY }}>Request not found.</Text></View>
      </SafeAreaView>
    );
  }

  const Row = ({ k, v }: { k: string; v: string | number | null }) => (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={styles.rowVal}>{v === null || v === '' ? '—' : String(v)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>{req.event_name}</Text>
        <Text style={styles.subtitle}>
          Submitted {new Date(req.submitted_at).toLocaleString()}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Status switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((s) => {
              const active = s.value === req.status;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.statusChip, active && styles.statusChipActive]}
                  onPress={() => updateStatus(s.value)}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <Row k="Name"         v={req.client_name} />
          <Row k="Email"        v={req.client_email} />
          <Row k="Phone"        v={req.client_phone} />
          <Row k="Organization" v={req.organization} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event</Text>
          <Row k="Type"            v={EVENT_TYPE_LABEL[req.event_type] || req.event_type} />
          <Row k="Preferred date"  v={fmtDate(req.preferred_date)} />
          <Row k="Alternate date"  v={fmtDate(req.alternate_date)} />
          <Row k="Time"            v={`${req.start_time} – ${req.end_time}`} />
          <Row k="Headcount"       v={req.headcount} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Venue & services</Text>
          <Row k="Venue preference" v={req.venue_preference} />
          <Row k="Food service"     v={FOOD_LABEL[req.food_service] || req.food_service} />
          <Row k="Dietary notes"    v={req.dietary_notes} />
          <Row k="Tech needs"       v={TECH_LABEL[req.tech_needs] || req.tech_needs} />
          <Row k="RSVP invitations" v={req.rsvp_required ? 'Yes' : 'No'} />
        </View>

        {req.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client notes</Text>
            <Text style={styles.body}>{req.notes}</Text>
          </View>
        ) : null}

        {/* Assignments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Team assignments</Text>
            <TouchableOpacity onPress={openAssignModal} style={styles.miniBtn}>
              <Text style={styles.miniBtnText}>＋ Assign</Text>
            </TouchableOpacity>
          </View>
          {assignments.length === 0 ? (
            <Text style={styles.emptySmall}>No one assigned yet.</Text>
          ) : assignments.map((a) => (
            <TouchableOpacity key={a.id} onLongPress={() => unassign(a)} activeOpacity={0.8} style={styles.assignRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignName}>{a.team_member.name}</Text>
                <Text style={styles.assignMeta}>
                  {a.team_member.role}{a.role_on_event ? ` · ${a.role_on_event}` : ''} · {a.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Workflow runs */}
        {runs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workflow runs</Text>
            {runs.slice(0, 10).map((r) => (
              <View key={r.id} style={styles.runRow}>
                <Text style={[styles.runTitle, { color: r.success ? '#065F46' : '#991B1B' }]}>
                  {r.success ? '✓' : '✗'} {r.workflow_name}
                </Text>
                <Text style={styles.runMeta}>{new Date(r.ran_at).toLocaleString()}</Text>
                {r.log ? <Text style={styles.runLog}>{r.log}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizer note</Text>
          <TextInput
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
            value={note}
            onChangeText={setNote}
            placeholder="Internal notes about this request..."
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveNote}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save note</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={assignModalOpen} animationType="slide" onRequestClose={() => setAssignModalOpen(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setAssignModalOpen(false)} hitSlop={10}>
              <Text style={styles.back}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Assign team member</Text>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Choose member</Text>
            {members.length === 0 ? (
              <Text style={styles.emptySmall}>No team members yet — add some in the Team Roster screen first.</Text>
            ) : members.map((m) => {
              const active = m.id === selectedMemberId;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberChoice, active && styles.memberChoiceActive]}
                  onPress={() => setSelectedMember(m.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.memberChoiceName, active && { color: '#FFF' }]}>{m.name}</Text>
                  <Text style={[styles.memberChoiceRole, active && { color: 'rgba(255,255,255,0.85)' }]}>
                    {m.role}{m.is_vendor ? ' · vendor' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.sectionTitle}>Role on this event (optional)</Text>
            <TextInput
              style={styles.input}
              value={roleOnEvent}
              onChangeText={setRoleOnEvent}
              placeholder="e.g. Lead Bartender"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              style={[styles.saveBtn, (saving || !selectedMemberId) && { opacity: 0.6 }]}
              disabled={saving || !selectedMemberId}
              onPress={assignMember}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Assign</Text>}
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
  header:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  back:      { color: INDIGO, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  title:     { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  subtitle:  { fontSize: 12, color: GRAY, marginTop: 4 },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, color: GRAY, marginBottom: 10,
  },

  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowKey: { width: 130, fontSize: 13, color: GRAY, fontWeight: '600' },
  rowVal: { flex: 1, fontSize: 14, color: '#1F2937' },
  body:   { fontSize: 14, color: '#1F2937', lineHeight: 20 },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusChipActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  statusChipText:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  statusChipTextActive: { color: '#FFFFFF' },

  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  saveBtn: {
    backgroundColor: INDIGO,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Assignments
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  miniBtn:    { backgroundColor: INDIGO, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  miniBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  emptySmall: { fontSize: 13, color: GRAY, fontStyle: 'italic' },
  assignRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  assignName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  assignMeta: { fontSize: 12, color: GRAY, marginTop: 2 },

  // Workflow runs
  runRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  runTitle: { fontSize: 13, fontWeight: '700' },
  runMeta:  { fontSize: 11, color: GRAY, marginTop: 2 },
  runLog:   { fontSize: 11, color: '#374151', marginTop: 4, fontFamily: 'Courier' },

  // Member chooser
  memberChoice: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  memberChoiceActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  memberChoiceName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  memberChoiceRole: { fontSize: 12, color: GRAY, marginTop: 2, textTransform: 'capitalize' },
});
