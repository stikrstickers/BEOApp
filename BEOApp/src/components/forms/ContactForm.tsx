import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection, MultiChips } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { Company, Contact } from '@/lib/types';

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Contact | null;
}

interface Form {
  first_name: string;
  last_name:  string;
  email:      string;
  phone:      string;
  title:      string;
  tags:       string[];
  notes:      string;
  companyIds: number[];
}

const blank: Form = {
  first_name: '', last_name: '', email: '', phone: '',
  title: '', tags: [], notes: '', companyIds: [],
};

export function ContactForm({ open, onClose, initial }: ContactFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  // Company picker — pull all companies (clients + vendors) so a contact
  // can be linked to anyone.
  const companiesQ = useQuery<{ companies: Company[] }>({
    queryKey: ['companies', 'all'],
    queryFn:  () => api('/api/companies/'),
    enabled:  open,
  });

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        first_name: initial.first_name, last_name: initial.last_name,
        email: initial.email, phone: initial.phone,
        title: initial.title, tags: initial.tags,
        notes: initial.notes,
        companyIds: (initial.companies ?? []).map((c) => c.company_id),
      } : blank);
      setErrors({});
    }
  }, [open, initial]);

  const m = useMutation<{ contact: Contact }, ApiError, void>({
    mutationFn: async () => {
      const body = {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, phone: form.phone, title: form.title,
        tags: form.tags, notes: form.notes,
        ...(isEdit ? {} : {
          companies: form.companyIds.map((id) => ({ id })),
        }),
      };
      const res = await (isEdit
        ? api<{ contact: Contact }>(`/api/contacts/${initial!.id}/`, { method: 'PATCH', body })
        : api<{ contact: Contact }>('/api/contacts/', { method: 'POST', body }));

      // On edit: reconcile company attachments via the dedicated endpoint.
      if (isEdit) {
        const currentIds = new Set((initial!.companies ?? []).map((c) => c.company_id));
        const targetIds  = new Set(form.companyIds);
        const toAdd      = [...targetIds].filter((id) => !currentIds.has(id));
        const toRemove   = [...currentIds].filter((id) => !targetIds.has(id));
        await Promise.all([
          ...toAdd.map((id) =>
            api(`/api/contacts/${initial!.id}/companies/`, {
              method: 'POST', body: { company_id: id },
            })),
          ...toRemove.map((id) =>
            api(`/api/contacts/${initial!.id}/companies/?company_id=${id}`, {
              method: 'DELETE',
            })),
        ]);
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(isEdit ? 'Contact updated' : 'Contact added');
      onClose();
    },
    onError: (err) => toast.error('Could not save', err.message),
  });

  const submit = () => {
    if (!form.first_name.trim()) { setErrors({ first_name: 'Required' }); return; }
    m.mutate();
  };

  const companyOptions = (companiesQ.data?.companies ?? []).map((c) => ({
    value: String(c.id),
    label: c.kind === 'vendor' ? `${c.name} (vendor)` : c.name,
  }));

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit contact' : 'New contact'}
      submitting={m.isPending}
      onSubmit={submit}
      submitLabel={isEdit ? 'Save' : 'Create'}
    >
      <View className="flex-row gap-x-3">
        <View className="flex-1">
          <FormField label="First name" required error={errors.first_name}>
            <Input value={form.first_name} onChangeText={(v) => setForm({ ...form, first_name: v })}
                   autoCapitalize="words" />
          </FormField>
        </View>
        <View className="flex-1">
          <FormField label="Last name">
            <Input value={form.last_name} onChangeText={(v) => setForm({ ...form, last_name: v })}
                   autoCapitalize="words" />
          </FormField>
        </View>
      </View>

      <FormField label="Title">
        <Input value={form.title} onChangeText={(v) => setForm({ ...form, title: v })}
               placeholder="Events Lead, Procurement, …" />
      </FormField>
      <FormField label="Email">
        <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })}
               keyboardType="email-address" autoCapitalize="none" />
      </FormField>
      <FormField label="Phone">
        <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })}
               keyboardType="phone-pad" />
      </FormField>

      <FormSection title="Companies">
        {companyOptions.length === 0 ? (
          <Text className="text-sm text-ink-500">
            No companies yet — add a Company first to link contacts to it.
          </Text>
        ) : (
          <MultiChips
            value={form.companyIds.map(String)}
            onChange={(v) => setForm({ ...form, companyIds: v.map(Number) })}
            options={companyOptions}
          />
        )}
      </FormSection>

      <FormField label="Notes">
        <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })}
               multiline numberOfLines={3} inputClassName="min-h-[72px] py-3"
               placeholder="Dietary preferences, communication preferences, etc." />
      </FormField>
    </FormSheet>
  );
}
