import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { MotiView } from 'moti';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Users, MapPin,
  UtensilsCrossed, Cpu, FileText, Building2, Mail, Phone, User as UserIcon, Check,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  EVENT_TYPE_LABEL, FOOD_SERVICE_LABEL, TECH_NEEDS_LABEL,
  type EventType, type FoodService, type TechNeeds, type Organization, type EventRequest,
} from '@/lib/types';
import { useAuth } from '@/auth/AuthContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientEventRequest'>;

interface FormState {
  client_name:      string;
  client_email:     string;
  client_phone:     string;
  client_org:       string;
  event_name:       string;
  event_type:       EventType;
  preferred_date:   Date | null;
  alternate_date:   Date | null;
  start_time:       Date | null;
  end_time:         Date | null;
  headcount:        string;
  venue_preference: string;
  food_service:     FoodService;
  dietary_notes:    string;
  tech_needs:       TechNeeds;
  rsvp_required:    boolean;
  notes:            string;
}

const initialForm: FormState = {
  client_name: '', client_email: '', client_phone: '', client_org: '',
  event_name: '', event_type: 'corporate',
  preferred_date: null, alternate_date: null,
  start_time: null, end_time: null,
  headcount: '', venue_preference: '',
  food_service: 'none', dietary_notes: '',
  tech_needs: 'none', rsvp_required: false,
  notes: '',
};

function ChoiceChips<T extends string>({
  options, value, onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            className={cn(
              'rounded-full border px-3.5 py-2',
              active ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                active ? 'text-brand-700' : 'text-ink-700',
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View className="mt-6 mb-3 flex-row items-center">
      <View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
        {icon}
      </View>
      <Text className="text-base font-semibold text-ink-900">{title}</Text>
    </View>
  );
}

function DateField({ label, value, onChange, mode, minimumDate }: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  mode: 'date' | 'time';
  minimumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const display = value
    ? mode === 'date'
      ? value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : mode === 'date' ? 'Pick a date' : 'Pick a time';

  const onPickerChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (d) onChange(d);
  };

  return (
    <View className="w-full">
      <Text className="mb-1.5 text-sm font-medium text-ink-700">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        className="flex-row items-center rounded-2xl border border-ink-200 bg-white px-3.5 py-3"
      >
        {mode === 'date'
          ? <Calendar size={18} color="#64748B" />
          : <Clock size={18} color="#64748B" />}
        <Text className={cn('ml-2 flex-1 text-base', value ? 'text-ink-900' : 'text-ink-400')}>
          {display}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value ?? (minimumDate ?? new Date())}
          mode={mode}
          minimumDate={minimumDate}
          onChange={onPickerChange}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
        />
      ) : null}
    </View>
  );
}

function dateOnly(d: Date | null): string | undefined {
  if (!d) return undefined;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeOnly(d: Date | null): string | undefined {
  if (!d) return undefined;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ClientEventRequestScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [slug, setSlug] = useState(route.params?.slug ?? '');
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    client_name:  user?.name ?? '',
    client_email: user?.email ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Resolve the planner org by slug — gives us the name/brand to display.
  const orgQ = useQuery<{ organization: Organization }>({
    queryKey: ['public-org', slug],
    enabled: slug.length > 0,
    queryFn: () => api(`/api/orgs/${encodeURIComponent(slug)}/`, { anonymous: true }),
    retry: false,
  });
  const org = orgQ.data?.organization;

  const submitM = useMutation<{ request: EventRequest }, ApiError, void>({
    mutationFn: () => api(
      `/api/orgs/${encodeURIComponent(slug)}/event-requests/`,
      {
        method: 'POST',
        body: {
          ...form,
          preferred_date: dateOnly(form.preferred_date),
          alternate_date: dateOnly(form.alternate_date),
          start_time:     timeOnly(form.start_time),
          end_time:       timeOnly(form.end_time),
          headcount:      Number(form.headcount) || 0,
        },
      },
    ),
    onSuccess: () => {
      toast.success('Request sent', `${org?.name ?? 'The planner'} will be in touch shortly`);
      navigation.goBack();
    },
    onError: (err) => {
      if (err.fields?.length) {
        const next: Record<string, string> = {};
        for (const f of err.fields) next[f] = 'This field is required';
        setErrors(next);
        toast.warning('Almost there', 'A few required fields are missing');
      } else {
        toast.error('Submission failed', err.message);
      }
    },
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { if (!e[k as string]) return e; const n = { ...e }; delete n[k as string]; return n; });
  };

  const onSubmit = () => {
    const next: Record<string, string> = {};
    if (!slug)                                          next.slug          = 'Pick a planner first';
    if (!form.client_name.trim())                       next.client_name   = 'Required';
    if (!form.client_email || !form.client_email.includes('@')) next.client_email = 'Enter a valid email';
    if (!form.event_name.trim())                        next.event_name    = 'Required';
    if (!form.preferred_date)                           next.preferred_date = 'Pick a date';
    if (!form.start_time)                               next.start_time    = 'Pick a start time';
    if (!form.end_time)                                 next.end_time      = 'Pick an end time';
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      next.end_time = 'Must be after start time';
    }
    const hc = Number(form.headcount);
    if (!hc || hc < 1) next.headcount = 'How many guests?';
    setErrors(next);
    if (Object.keys(next).length) {
      toast.warning('Check the form', 'A few fields need your attention');
      return;
    }
    submitM.mutate();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="mb-2 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 mr-2 p-2"
            accessibilityRole="button" accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 350 }}
        >
          <Text className="text-3xl font-bold text-ink-900">Request an event</Text>
          <Text className="mt-1 text-base text-ink-500">Tell us what you have in mind</Text>
        </MotiView>

        {/* Planner section */}
        <SectionHeader icon={<Building2 size={16} color="#6366F1" />} title="Planner" />
        <Input
          label="Planner handle"
          value={slug}
          onChangeText={(t) => setSlug(t.trim().toLowerCase())}
          placeholder="rivera-events"
          autoCapitalize="none"
          autoCorrect={false}
          hint="The planner shares this with you (it's in their workspace URL)"
          error={errors.slug || (orgQ.isError && slug.length > 0 ? "We couldn't find that planner" : undefined)}
        />
        {org ? (
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 200 }}
            className="mt-3 flex-row items-center rounded-2xl border border-success-500/30 bg-success-500/5 px-3 py-2.5"
          >
            <View className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-success-500">
              <Check size={14} color="#fff" />
            </View>
            <Text className="flex-1 text-sm font-medium text-ink-900">
              Submitting to <Text className="font-bold">{org.name}</Text>
            </Text>
          </MotiView>
        ) : null}

        {/* Contact */}
        <SectionHeader icon={<UserIcon size={16} color="#6366F1" />} title="Your details" />
        <View className="gap-y-4">
          <Input
            label="Your name"
            value={form.client_name}
            onChangeText={(v) => set('client_name', v)}
            autoCapitalize="words"
            leftIcon={<UserIcon size={18} color="#64748B" />}
            error={errors.client_name}
          />
          <Input
            label="Email"
            value={form.client_email}
            onChangeText={(v) => set('client_email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={18} color="#64748B" />}
            error={errors.client_email}
          />
          <Input
            label="Phone (optional)"
            value={form.client_phone}
            onChangeText={(v) => set('client_phone', v)}
            keyboardType="phone-pad"
            leftIcon={<Phone size={18} color="#64748B" />}
          />
          <Input
            label="Your company (optional)"
            value={form.client_org}
            onChangeText={(v) => set('client_org', v)}
            leftIcon={<Building2 size={18} color="#64748B" />}
          />
        </View>

        {/* Event basics */}
        <SectionHeader icon={<FileText size={16} color="#6366F1" />} title="The event" />
        <View className="gap-y-4">
          <Input
            label="Event name"
            value={form.event_name}
            onChangeText={(v) => set('event_name', v)}
            placeholder="Summer kickoff dinner"
            error={errors.event_name}
          />
          <View>
            <Text className="mb-2 text-sm font-medium text-ink-700">Type</Text>
            <ChoiceChips
              options={(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((v) => ({ value: v, label: EVENT_TYPE_LABEL[v] }))}
              value={form.event_type}
              onChange={(v) => set('event_type', v)}
            />
          </View>
          <DateField
            label="Preferred date"
            value={form.preferred_date}
            onChange={(d) => set('preferred_date', d)}
            mode="date"
            minimumDate={today}
          />
          <DateField
            label="Alternate date (optional)"
            value={form.alternate_date}
            onChange={(d) => set('alternate_date', d)}
            mode="date"
            minimumDate={today}
          />
          <View className="flex-row gap-x-3">
            <View className="flex-1">
              <DateField
                label="Start time"
                value={form.start_time}
                onChange={(d) => set('start_time', d)}
                mode="time"
              />
              {errors.start_time ? <Text className="mt-1.5 text-xs text-danger-600">{errors.start_time}</Text> : null}
            </View>
            <View className="flex-1">
              <DateField
                label="End time"
                value={form.end_time}
                onChange={(d) => set('end_time', d)}
                mode="time"
              />
              {errors.end_time ? <Text className="mt-1.5 text-xs text-danger-600">{errors.end_time}</Text> : null}
            </View>
          </View>
          <Input
            label="Expected headcount"
            value={form.headcount}
            onChangeText={(v) => set('headcount', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="50"
            leftIcon={<Users size={18} color="#64748B" />}
            error={errors.headcount}
          />
          <Input
            label="Venue preference (optional)"
            value={form.venue_preference}
            onChangeText={(v) => set('venue_preference', v)}
            placeholder="Rooftop, garden, ballroom…"
            leftIcon={<MapPin size={18} color="#64748B" />}
          />
        </View>

        {/* Food */}
        <SectionHeader icon={<UtensilsCrossed size={16} color="#6366F1" />} title="Food & beverage" />
        <View>
          <Text className="mb-2 text-sm font-medium text-ink-700">Service style</Text>
          <ChoiceChips
            options={(Object.keys(FOOD_SERVICE_LABEL) as FoodService[]).map((v) => ({ value: v, label: FOOD_SERVICE_LABEL[v] }))}
            value={form.food_service}
            onChange={(v) => set('food_service', v)}
          />
        </View>
        <View className="mt-4">
          <Input
            label="Dietary notes"
            value={form.dietary_notes}
            onChangeText={(v) => set('dietary_notes', v)}
            placeholder="Allergies, vegetarian count, etc."
            multiline
            numberOfLines={3}
            inputClassName="min-h-[72px] py-3"
          />
        </View>

        {/* Tech */}
        <SectionHeader icon={<Cpu size={16} color="#6366F1" />} title="Tech needs" />
        <ChoiceChips
          options={(Object.keys(TECH_NEEDS_LABEL) as TechNeeds[]).map((v) => ({ value: v, label: TECH_NEEDS_LABEL[v] }))}
          value={form.tech_needs}
          onChange={(v) => set('tech_needs', v)}
        />

        {/* Notes */}
        <SectionHeader icon={<FileText size={16} color="#6366F1" />} title="Anything else?" />
        <Input
          label="Notes for the planner"
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          placeholder="Anything you want them to know"
          multiline
          numberOfLines={4}
          inputClassName="min-h-[96px] py-3"
        />

        {/* RSVP toggle */}
        <Pressable
          onPress={() => set('rsvp_required', !form.rsvp_required)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.rsvp_required }}
          accessibilityLabel="RSVP tracking required"
          className="mt-5 flex-row items-center rounded-2xl border border-ink-200 bg-white p-4"
        >
          <View
            className={cn(
              'mr-3 h-6 w-6 items-center justify-center rounded-md border',
              form.rsvp_required ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white',
            )}
          >
            {form.rsvp_required ? <Check size={14} color="#fff" /> : null}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink-900">Track RSVPs</Text>
            <Text className="text-xs text-ink-500">We'll set up an invitation list for you</Text>
          </View>
        </Pressable>

        <Button
          onPress={onSubmit}
          loading={submitM.isPending}
          fullWidth
          size="lg"
          iconRight={<ArrowRight size={18} color="#fff" />}
          accessibilityLabel="Send request"
          className="mt-6 mb-12"
        >
          Send request
        </Button>
      </KeyboardAvoidingView>
    </Screen>
  );
}
