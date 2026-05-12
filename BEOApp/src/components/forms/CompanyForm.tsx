import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection, ChoiceChips } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { Company, CompanyKind } from '@/lib/types';

interface CompanyFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Company | null;
  /** Forces a kind when creating (e.g. from the Vendors tab). */
  presetKind?: CompanyKind;
}

interface Form {
  name: string;
  kind: CompanyKind;
  industry: string;
  website: string;
  address: string;
  billing_email: string;
  phone: string;
  notes: string;
}

const blank: Form = {
  name: '', kind: 'client', industry: '', website: '',
  address: '', billing_email: '', phone: '', notes: '',
};

export function CompanyForm({ open, onClose, initial, presetKind }: CompanyFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name, kind: initial.kind,
        industry: initial.industry, website: initial.website,
        address: initial.address, billing_email: initial.billing_email,
        phone: initial.phone, notes: initial.notes,
      } : { ...blank, kind: presetKind ?? 'client' });
      setErrors({});
    }
  }, [open, initial, presetKind]);

  const m = useMutation<{ company: Company }, ApiError, Form>({
    mutationFn: (data) =>
      isEdit
        ? api(`/api/companies/${initial!.id}/`, { method: 'PATCH', body: data })
        : api('/api/companies/', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast.success(isEdit ? 'Company updated' : 'Company added');
      onClose();
    },
    onError: (err) => toast.error('Could not save', err.message),
  });

  const submit = () => {
    if (!form.name.trim()) { setErrors({ name: 'Required' }); return; }
    m.mutate(form);
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit company' : 'New company'}
      submitting={m.isPending}
      onSubmit={submit}
      submitLabel={isEdit ? 'Save' : 'Create'}
    >
      <FormField label="Company name" required error={errors.name}>
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
               placeholder="Acme Corp" autoCapitalize="words" />
      </FormField>

      <FormField label="Type">
        <ChoiceChips<CompanyKind>
          value={form.kind}
          onChange={(v) => setForm({ ...form, kind: v })}
          options={[
            { value: 'client', label: 'Client' },
            { value: 'vendor', label: 'Vendor' },
            { value: 'both',   label: 'Both' },
          ]}
        />
      </FormField>

      <FormField label="Industry">
        <Input value={form.industry} onChangeText={(v) => setForm({ ...form, industry: v })}
               placeholder="Tech, hospitality, nonprofit…" />
      </FormField>
      <FormField label="Website">
        <Input value={form.website} onChangeText={(v) => setForm({ ...form, website: v })}
               placeholder="https://…" autoCapitalize="none" keyboardType="url" />
      </FormField>
      <FormField label="Address">
        <Input value={form.address} onChangeText={(v) => setForm({ ...form, address: v })}
               placeholder="Street, city, state" />
      </FormField>
      <FormField label="Billing email">
        <Input value={form.billing_email} onChangeText={(v) => setForm({ ...form, billing_email: v })}
               keyboardType="email-address" autoCapitalize="none" placeholder="billing@…" />
      </FormField>
      <FormField label="Phone">
        <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })}
               keyboardType="phone-pad" />
      </FormField>
      <FormField label="Notes">
        <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })}
               multiline numberOfLines={3} inputClassName="min-h-[72px] py-3" />
      </FormField>
    </FormSheet>
  );
}
