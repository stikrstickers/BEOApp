import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
  Pressable,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { BASE_URL } from '../config';
import { EventType, FoodService, TechNeeds } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClientEventRequest'>;
};

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'corporate',  label: 'Corporate' },
  { value: 'wedding',    label: 'Wedding' },
  { value: 'conference', label: 'Conference' },
  { value: 'social',     label: 'Social' },
  { value: 'nonprofit',  label: 'Nonprofit' },
  { value: 'other',      label: 'Other' },
];

const FOOD_OPTIONS: { value: FoodService; label: string }[] = [
  { value: 'none',     label: 'None' },
  { value: 'light',    label: 'Light bites' },
  { value: 'plated',   label: 'Plated' },
  { value: 'buffet',   label: 'Buffet' },
  { value: 'cocktail', label: 'Cocktail' },
];

const TECH_OPTIONS: { value: TechNeeds; label: string }[] = [
  { value: 'none',       label: 'None' },
  { value: 'basic_av',   label: 'Basic A/V' },
  { value: 'full_av',    label: 'Full A/V' },
  { value: 'livestream', label: 'Livestream' },
];

type FormState = {
  client_name:      string;
  client_email:     string;
  client_phone:     string;
  organization:     string;
  event_name:       string;
  event_type:       EventType;
  preferred_date:   string;
  alternate_date:   string;
  start_time:       string;
  end_time:         string;
  headcount:        string;
  venue_preference: string;
  food_service:     FoodService;
  dietary_notes:    string;
  tech_needs:       TechNeeds;
  rsvp_required:    boolean;
  notes:            string;
};

const INITIAL: FormState = {
  client_name:      '',
  client_email:     '',
  client_phone:     '',
  organization:     '',
  event_name:       '',
  event_type:       'corporate',
  preferred_date:   '',
  alternate_date:   '',
  start_time:       '',
  end_time:         '',
  headcount:        '',
  venue_preference: '',
  food_service:     'none',
  dietary_notes:    '',
  tech_needs:       'none',
  rsvp_required:    false,
  notes:            '',
};

export default function ClientEventRequestScreen({ navigation }: Props) {
  const [form, setForm]         = useState<FormState>(INITIAL);
  const [submitting, setSubmit] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const submit = async () => {
    // Light client-side validation; backend repeats it authoritatively.
    if (!form.client_name || !form.client_email || !form.event_name
        || !form.preferred_date || !form.start_time || !form.end_time
        || !form.headcount) {
      Alert.alert('Missing info', 'Please fill in all required fields (marked *).');
      return;
    }

    setSubmit(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // alternate_date is optional — omit if blank so the server doesn't try to parse ''
      if (!form.alternate_date) delete payload.alternate_date;

      const res = await fetch(`${BASE_URL}/api/event-requests/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Server error ${res.status}`);
      }
      Alert.alert(
        'Request received',
        `Thanks, ${form.client_name}! We received your event request and will follow up at ${form.client_email}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
      setForm(INITIAL);
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Request an Event</Text>
          <Text style={styles.subtitle}>Tell us about your event and we'll be in touch.</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section title="Your contact info">
            <Field label="Name" value={form.client_name} onChangeText={(v) => update('client_name', v)} required />
            <Field label="Email" value={form.client_email} onChangeText={(v) => update('client_email', v)} required keyboardType="email-address" />
            <Field label="Phone" value={form.client_phone} onChangeText={(v) => update('client_phone', v)} keyboardType="phone-pad" />
            <Field label="Organization" value={form.organization} onChangeText={(v) => update('organization', v)} />
          </Section>

          <Section title="Event details">
            <Field label="Event name" value={form.event_name} onChangeText={(v) => update('event_name', v)} required placeholder="e.g. Q4 All-Hands Lunch" />

            <Text style={styles.label}>Event type</Text>
            <ChipRow options={EVENT_TYPES} value={form.event_type} onPick={(v) => update('event_type', v)} />

            <DateField label="Preferred date" value={form.preferred_date} onChange={(v) => update('preferred_date', v)} required />
            <DateField label="Alternate date (optional)" value={form.alternate_date} onChange={(v) => update('alternate_date', v)} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TimeField label="Start time" value={form.start_time} onChange={(v) => update('start_time', v)} required />
              </View>
              <View style={{ flex: 1 }}>
                <TimeField label="End time" value={form.end_time} onChange={(v) => update('end_time', v)} required />
              </View>
            </View>

            <Field label="Headcount" value={form.headcount} onChangeText={(v) => update('headcount', v)} required keyboardType="numeric" placeholder="40" />
          </Section>

          <Section title="Venue">
            <Field label="Venue preference" value={form.venue_preference} onChangeText={(v) => update('venue_preference', v)} placeholder="Chihuly Conf Room, outdoor patio, etc." />
          </Section>

          <Section title="Food & beverage">
            <Text style={styles.label}>Service style</Text>
            <ChipRow options={FOOD_OPTIONS} value={form.food_service} onPick={(v) => update('food_service', v)} />
            <Field label="Dietary notes / restrictions" value={form.dietary_notes} onChangeText={(v) => update('dietary_notes', v)} placeholder="3 vegan, 1 GF, no shellfish" multiline />
          </Section>

          <Section title="Technology">
            <Text style={styles.label}>A/V needs</Text>
            <ChipRow options={TECH_OPTIONS} value={form.tech_needs} onPick={(v) => update('tech_needs', v)} />
          </Section>

          <Section title="Attendance / RSVP">
            <View style={styles.rsvpRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Send RSVP invitations</Text>
                <Text style={styles.hint}>We'll follow up about delivery method and template.</Text>
              </View>
              <Switch
                value={form.rsvp_required}
                onValueChange={(v) => update('rsvp_required', v)}
                trackColor={{ false: '#D1D5DB', true: INDIGO }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Section>

          <Section title="Anything else?">
            <Field label="Notes" value={form.notes} onChangeText={(v) => update('notes', v)} placeholder="Special requests, accessibility needs, theme..." multiline />
          </Section>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={submit}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.submitText}>Submit request</Text>}
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Top-level so each keystroke (which re-renders the parent) doesn't give these
// a fresh identity — that would unmount/remount the TextInput and lose keyboard focus.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, required, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

// YYYY-MM-DD <-> Date; HH:MM <-> Date. Strings stay the wire format the API expects.
function parseDateStr(s: string): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseTimeStr(s: string): Date {
  const d = new Date();
  if (!s) { d.setHours(12, 0, 0, 0); return d; }
  const [h, m] = s.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
function fmtTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function displayDate(s: string): string {
  if (!s) return 'Tap to select';
  const d = parseDateStr(s);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function displayTime(s: string): string {
  if (!s) return 'Tap to select';
  const d = parseTimeStr(s);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function DateField({
  label, value, onChange, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    // On Android the dialog auto-dismisses after the user confirms or cancels.
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && selected) onChange(fmtDateStr(selected));
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.pickerTouch, pressed && { opacity: 0.7 }]}
        onPress={() => setShow(true)}
      >
        <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>{displayDate(value)}</Text>
        <Text style={styles.pickerChevron}>📅</Text>
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} style={styles.pickerClearBtn}>
          <Text style={styles.pickerClearText}>Clear</Text>
        </Pressable>
      ) : null}
      {show && (
        <DateTimePicker
          value={parseDateStr(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

function TimeField({
  label, value, onChange, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && selected) onChange(fmtTimeStr(selected));
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.pickerTouch, pressed && { opacity: 0.7 }]}
        onPress={() => setShow(true)}
      >
        <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>{displayTime(value)}</Text>
        <Text style={styles.pickerChevron}>🕐</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={parseTimeStr(value)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          is24Hour={false}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

function ChipRow<T extends string>({
  options, value, onPick,
}: {
  options: { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onPick(o.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  back: { color: INDIGO, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 4 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: GRAY,
    marginBottom: 10,
  },

  field: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  req:   { color: '#DC2626' },
  hint:  { fontSize: 12, color: GRAY, marginTop: 2 },
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
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  pickerTouch: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText:        { fontSize: 15, color: '#1F2937', flex: 1 },
  pickerPlaceholder: { color: '#9CA3AF' },
  pickerChevron:     { fontSize: 16, marginLeft: 8 },
  pickerClearBtn:    { alignSelf: 'flex-end', paddingTop: 4, paddingHorizontal: 4 },
  pickerClearText:   { fontSize: 12, color: INDIGO, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  chipText:   { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  rsvpRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  submitBtn: {
    backgroundColor: INDIGO,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
