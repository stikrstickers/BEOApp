import React, { useRef, useState, useEffect } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, TextInput,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import {
  ArrowLeft, Eye, EyeOff, Save, Code, Mail, MessageSquare, Printer,
  Trash2, FileText,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  FormField, FormSection, ChoiceChips, ToggleRow,
} from '@/components/ui/FormSheet';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  type MessageTemplate, type TemplateKind, type TemplateChannel,
  TEMPLATE_KIND_LABEL, type TokenCatalogEntry,
} from '@/lib/types';
import { cn } from '@/lib/cn';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TemplateEditor'>;

const CHANNEL_LABEL: Record<TemplateChannel, string> = {
  email: 'Email', sms: 'SMS', pdf: 'PDF',
};

const CHANNEL_ICON: Record<TemplateChannel, React.ReactNode> = {
  email: <Mail size={14} color="#475569" />,
  sms:   <MessageSquare size={14} color="#475569" />,
  pdf:   <Printer size={14} color="#475569" />,
};

interface Form {
  name: string;
  kind: TemplateKind;
  channel: TemplateChannel;
  subject: string;
  body: string;
  is_active: boolean;
  is_default: boolean;
}

const blank: Form = {
  name: '', kind: 'guest_email', channel: 'email',
  subject: '', body: '', is_active: true, is_default: false,
};

// Demo sample data for the preview — shown as a default context to the
// /preview/ endpoint so the user sees realistic rendered output.
const SAMPLE_CONTEXT = {
  org:     { name: 'Rivera Events Co.', brand_color: '#6366F1' },
  event:   {
    name: 'Summer Gala 2026', event_type: 'social',
    starts_at: '2026-08-15T18:00:00Z', ends_at: '2026-08-15T23:00:00Z',
    headcount: 120, status: 'scheduled',
    food_service: 'plated', tech_needs: 'full_av',
  },
  venue:   { name: 'Grand Ballroom', site_name: 'The Crescent Hotel', capacity_max: 300 },
  contact: {
    first_name: 'Casey', last_name: 'Rivera', full_name: 'Casey Rivera',
    email: 'casey@example.com', phone: '+1 555 0100', title: 'Events Lead',
  },
  company:   { name: 'Acme Corp' },
  recipient: { first_name: 'Sam', full_name: 'Sam Park', email: 'sam@example.com' },
};

export default function TemplateEditorScreen({ navigation, route }: Props) {
  const { id } = route.params ?? {};
  const isEdit = typeof id === 'number';
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState<Form>(blank);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focused, setFocused] = useState<'subject' | 'body' | null>('body');
  const bodyRef = useRef<TextInput>(null);
  const subjectRef = useRef<TextInput>(null);

  // Load template if editing
  const tplQ = useQuery<{ template: MessageTemplate }>({
    queryKey: ['template', id],
    queryFn:  () => api(`/api/templates/${id}/`),
    enabled:  isEdit,
  });
  // Available tokens for the picker
  const tokensQ = useQuery<{ tokens: TokenCatalogEntry[] }>({
    queryKey: ['template-tokens'],
    queryFn:  () => api('/api/templates/tokens/'),
  });

  useEffect(() => {
    if (tplQ.data?.template) {
      const t = tplQ.data.template;
      setForm({
        name: t.name, kind: t.kind, channel: t.channel,
        subject: t.subject, body: t.body,
        is_active: t.is_active, is_default: t.is_default,
      });
    }
  }, [tplQ.data]);

  // Save mutation
  const saveM = useMutation<{ template: MessageTemplate }, ApiError, void>({
    mutationFn: () =>
      isEdit
        ? api(`/api/templates/${id}/`, { method: 'PATCH', body: form })
        : api('/api/templates/', { method: 'POST', body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['template', id] });
      toast.success(isEdit ? 'Template saved' : 'Template created');
      navigation.goBack();
    },
    onError: (e) => toast.error('Could not save', e.message),
  });

  // Delete mutation
  const deleteM = useMutation<void, ApiError, void>({
    mutationFn: () => api(`/api/templates/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
      navigation.goBack();
    },
    onError: (e) => toast.error('Could not delete', e.message),
  });

  // Preview — only meaningful when editing (need an id). For drafts we render
  // locally by hitting /preview/ with body + subject as the context source.
  const previewQ = useQuery<{ subject: string; body: string; tokens: string[] }>({
    queryKey: ['template-preview', id, form.subject, form.body],
    queryFn:  () =>
      api(`/api/templates/${id}/preview/`, {
        method: 'POST',
        body: { context: SAMPLE_CONTEXT },
      }),
    enabled: isEdit && previewOpen,
  });

  const insertToken = (path: string) => {
    const token = `{{${path}}}`;
    if (focused === 'subject') {
      setForm((f) => ({ ...f, subject: f.subject + token }));
      subjectRef.current?.focus();
    } else {
      setForm((f) => ({ ...f, body: f.body + token }));
      bodyRef.current?.focus();
    }
  };

  const submit = () => {
    if (!form.name.trim()) { toast.warning('Give the template a name'); return; }
    if (!form.body.trim()) { toast.warning('Body is required'); return; }
    saveM.mutate();
  };

  const channelOpts: TemplateChannel[] = ['email', 'sms', 'pdf'];
  const kindOpts: TemplateKind[] = Object.keys(TEMPLATE_KIND_LABEL) as TemplateKind[];
  const tokensByGroup: Record<string, TokenCatalogEntry[]> = {};
  for (const t of (tokensQ.data?.tokens ?? [])) {
    const group = t.path.split('.')[0];
    if (!tokensByGroup[group]) tokensByGroup[group] = [];
    tokensByGroup[group].push(t);
  }

  return (
    <Screen contentClassName="px-0 py-0">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 p-2"
            accessibilityRole="button" accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
          <View className="flex-row items-center gap-x-2">
            {isEdit ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setPreviewOpen((v) => !v)}
                icon={previewOpen ? <EyeOff size={14} color="#475569" /> : <Eye size={14} color="#475569" />}
                accessibilityLabel={previewOpen ? 'Hide preview' : 'Show preview'}
              >
                <Text className="text-sm font-medium text-ink-700">
                  {previewOpen ? 'Hide preview' : 'Preview'}
                </Text>
              </Button>
            ) : null}
            <Button size="sm" onPress={submit} loading={saveM.isPending} icon={<Save size={14} color="#fff" />}>
              Save
            </Button>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        >
          {isEdit && tplQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Text className="text-2xl font-bold text-ink-900">
                {isEdit ? 'Edit template' : 'New template'}
              </Text>
              <Text className="mt-1 text-sm text-ink-500">
                Use {`{{tokens}}`} to personalize — they'll be replaced when this template is sent.
              </Text>

              {/* Preview panel */}
              <AnimatePresence>
                {isEdit && previewOpen ? (
                  <MotiView
                    from={{ opacity: 0, translateY: -8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -8 }}
                    transition={{ type: 'timing', duration: 200 }}
                    className="mt-5"
                  >
                    <Card className="bg-ink-900">
                      <View className="p-4">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <Eye size={14} color="#A5B4FC" />
                            <Text className="ml-1.5 text-xs font-bold uppercase tracking-wider text-brand-200">
                              Live preview
                            </Text>
                          </View>
                          <Text className="text-[10px] text-ink-400">Sample data</Text>
                        </View>
                        {previewQ.isLoading ? (
                          <View className="mt-3">
                            <Skeleton className="mb-2 h-4 w-2/3" />
                            <Skeleton className="h-16 w-full" />
                          </View>
                        ) : previewQ.data ? (
                          <View className="mt-3">
                            {form.channel !== 'sms' && previewQ.data.subject ? (
                              <>
                                <Text className="text-[10px] uppercase tracking-wider text-ink-400">Subject</Text>
                                <Text className="mt-1 text-sm font-semibold text-white">
                                  {previewQ.data.subject}
                                </Text>
                                <View className="my-3 h-px bg-ink-700" />
                              </>
                            ) : null}
                            <Text className="text-[10px] uppercase tracking-wider text-ink-400">Body</Text>
                            <Text className="mt-1 text-sm text-ink-100" selectable>
                              {previewQ.data.body}
                            </Text>
                            {previewQ.data.tokens.length > 0 ? (
                              <View className="mt-4 flex-row flex-wrap gap-1.5">
                                <Text className="mr-1 text-[10px] uppercase tracking-wider text-ink-400">
                                  Uses:
                                </Text>
                                {previewQ.data.tokens.map((t) => (
                                  <View key={t} className="rounded bg-brand-600/30 px-1.5 py-0.5">
                                    <Text className="text-[10px] font-mono text-brand-200">{t}</Text>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </Card>
                  </MotiView>
                ) : null}
              </AnimatePresence>

              <View className="mt-6 gap-y-4">
                <FormField label="Name" required>
                  <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
                         placeholder="e.g. Booking Confirmation" />
                </FormField>

                <FormField label="Kind">
                  <View className="flex-row flex-wrap gap-2">
                    {kindOpts.map((k) => {
                      const active = form.kind === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => setForm({ ...form, kind: k })}
                          className={cn(
                            'rounded-full border px-3 py-2',
                            active ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white',
                          )}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={TEMPLATE_KIND_LABEL[k]}
                        >
                          <Text className={cn('text-xs font-medium', active ? 'text-brand-700' : 'text-ink-700')}>
                            {TEMPLATE_KIND_LABEL[k]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </FormField>

                <FormField label="Channel">
                  <ChoiceChips<TemplateChannel>
                    value={form.channel}
                    onChange={(v) => setForm({ ...form, channel: v })}
                    options={channelOpts.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                  />
                </FormField>

                {form.channel !== 'sms' ? (
                  <FormField label="Subject">
                    <Input
                      ref={subjectRef}
                      value={form.subject}
                      onChangeText={(v) => setForm({ ...form, subject: v })}
                      onFocus={() => setFocused('subject')}
                      placeholder='e.g. "{{event.name}} — booking confirmed"'
                    />
                  </FormField>
                ) : null}

                <FormField label={form.channel === 'sms' ? 'Message' : 'Body'} required>
                  <Input
                    ref={bodyRef}
                    value={form.body}
                    onChangeText={(v) => setForm({ ...form, body: v })}
                    onFocus={() => setFocused('body')}
                    multiline
                    numberOfLines={10}
                    inputClassName="min-h-[200px] py-3 font-mono"
                    placeholder={form.channel === 'sms'
                      ? 'Short message. Keep under 160 chars when possible.'
                      : 'Hi {{contact.first_name}},\n\nGood news! We\'re all set for {{event.name}} on {{event.starts_at | date:"%b %d"}}…'}
                  />
                </FormField>

                <FormSection title="Tokens">
                  <Text className="text-xs text-ink-500">
                    Tap to insert at the end of the {focused === 'subject' ? 'subject' : 'body'}. Filters: {`{{path|date:"%b %d"}}`}, |upper, |lower, |title.
                  </Text>
                  {Object.entries(tokensByGroup).map(([group, toks]) => (
                    <View key={group}>
                      <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        {group}
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {toks.map((t) => (
                          <Pressable
                            key={t.path}
                            onPress={() => insertToken(t.path)}
                            accessibilityRole="button"
                            accessibilityLabel={`Insert ${t.label}`}
                            className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5"
                          >
                            <Text className="font-mono text-[11px] text-brand-700">
                              {`{{${t.path}}}`}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </FormSection>

                <FormSection title="Settings">
                  <ToggleRow
                    label="Active"
                    description="Inactive templates won't be offered when sending"
                    value={form.is_active}
                    onChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <ToggleRow
                    label="Default for this kind + channel"
                    description="Auto-selected when this kind of message is sent on this channel"
                    value={form.is_default}
                    onChange={(v) => setForm({ ...form, is_default: v })}
                  />
                </FormSection>

                {isEdit ? (
                  <Pressable
                    onPress={() => deleteM.mutate()}
                    className="mt-4 flex-row items-center justify-center rounded-2xl border border-danger-500/40 bg-danger-500/5 px-4 py-3"
                    accessibilityRole="button" accessibilityLabel="Delete template"
                  >
                    <Trash2 size={14} color="#DC2626" />
                    <Text className="ml-2 text-sm font-semibold text-danger-600">Delete template</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
