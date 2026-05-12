import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { Site } from '@/lib/types';

interface SiteFormProps {
  open: boolean;
  onClose: () => void;
  /** If provided → edit; if null/undefined → create. */
  initial?: Site | null;
  onSaved?: (s: Site) => void;
}

interface Form {
  name: string;
  address_line1: string;
  city: string;
  state_region: string;
  postal_code: string;
  country: string;
  owner_name: string;
  operator_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  notes: string;
}

const blank: Form = {
  name: '', address_line1: '', city: '', state_region: '',
  postal_code: '', country: '',
  owner_name: '', operator_name: '',
  contact_name: '', contact_email: '', contact_phone: '',
  website: '', notes: '',
};

export function SiteForm({ open, onClose, initial, onSaved }: SiteFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name,
        address_line1: initial.address_line1,
        city: initial.city,
        state_region: initial.state_region,
        postal_code: initial.postal_code,
        country: initial.country,
        owner_name: initial.owner_name,
        operator_name: initial.operator_name,
        contact_name: initial.contact_name,
        contact_email: initial.contact_email,
        contact_phone: initial.contact_phone,
        website: initial.website,
        notes: initial.notes,
      } : blank);
      setErrors({});
    }
  }, [open, initial]);

  const m = useMutation<{ site: Site }, ApiError, Form>({
    mutationFn: (data) =>
      isEdit
        ? api(`/api/sites/${initial!.id}/`, { method: 'PATCH', body: data })
        : api('/api/sites/', { method: 'POST', body: data }),
    onSuccess: ({ site }) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['site', site.id] });
      toast.success(isEdit ? 'Site updated' : 'Site created');
      onSaved?.(site);
      onClose();
    },
    onError: (err) => {
      if (err.fields?.length) {
        const next: any = {};
        for (const f of err.fields) next[f] = 'Required';
        setErrors(next);
      }
      toast.error('Could not save', err.message);
    },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = () => {
    if (!form.name.trim()) { setErrors({ name: 'Required' }); return; }
    m.mutate(form);
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit site' : 'New site'}
      subtitle={isEdit ? initial!.name : 'A building or location with bookable spaces'}
      submitLabel={isEdit ? 'Save' : 'Create'}
      submitting={m.isPending}
      onSubmit={submit}
    >
      <FormSection title="Basics">
        <FormField label="Site name" required error={errors.name}>
          <Input value={form.name} onChangeText={(v) => set('name', v)}
                 placeholder="e.g. The Crescent Hotel" />
        </FormField>
        <FormField label="Website">
          <Input value={form.website} onChangeText={(v) => set('website', v)}
                 placeholder="https://…" autoCapitalize="none" keyboardType="url" />
        </FormField>
      </FormSection>

      <FormSection title="Address">
        <FormField label="Street">
          <Input value={form.address_line1} onChangeText={(v) => set('address_line1', v)} placeholder="123 Main St" />
        </FormField>
        <FormField label="City">
          <Input value={form.city} onChangeText={(v) => set('city', v)} placeholder="Boston" />
        </FormField>
        <FormField label="State / Region">
          <Input value={form.state_region} onChangeText={(v) => set('state_region', v)} placeholder="MA" />
        </FormField>
        <FormField label="Postal code">
          <Input value={form.postal_code} onChangeText={(v) => set('postal_code', v)} keyboardType="numbers-and-punctuation" />
        </FormField>
        <FormField label="Country">
          <Input value={form.country} onChangeText={(v) => set('country', v)} placeholder="USA" />
        </FormField>
      </FormSection>

      <FormSection title="Operator / Owner">
        <FormField label="Owner">
          <Input value={form.owner_name} onChangeText={(v) => set('owner_name', v)} />
        </FormField>
        <FormField label="Operator" hint="Day-to-day operator; often the same as owner">
          <Input value={form.operator_name} onChangeText={(v) => set('operator_name', v)} />
        </FormField>
      </FormSection>

      <FormSection title="Contact at this site">
        <FormField label="Contact name">
          <Input value={form.contact_name} onChangeText={(v) => set('contact_name', v)} />
        </FormField>
        <FormField label="Email">
          <Input value={form.contact_email} onChangeText={(v) => set('contact_email', v)}
                 keyboardType="email-address" autoCapitalize="none" />
        </FormField>
        <FormField label="Phone">
          <Input value={form.contact_phone} onChangeText={(v) => set('contact_phone', v)}
                 keyboardType="phone-pad" />
        </FormField>
      </FormSection>

      <FormSection title="Notes">
        <Input
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline numberOfLines={4}
          inputClassName="min-h-[96px] py-3"
          placeholder="Loading dock instructions, parking, fire marshal contacts…"
        />
      </FormSection>
    </FormSheet>
  );
}
