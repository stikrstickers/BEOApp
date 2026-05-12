import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection, ChoiceChips, MultiChips, ToggleRow } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { EmploymentType, TeamMember } from '@/lib/types';

interface TeammateFormProps {
  open: boolean;
  onClose: () => void;
  initial?: TeamMember | null;
}

type Role = 'coordinator' | 'chef' | 'bartender' | 'server' | 'it' | 'setup' | 'security' | 'other';

const ROLE_LABEL: Record<Role, string> = {
  coordinator: 'Coordinator',
  chef:        'Chef',
  bartender:   'Bartender',
  server:      'Server',
  it:          'IT / A/V',
  setup:       'Setup',
  security:    'Security',
  other:       'Other',
};

const COMMON_CERTS = ['TIPS', 'ServSafe', 'CPR', 'First Aid', 'CDL', 'Forklift'];

interface Form {
  name: string;
  email: string;
  phone: string;
  role: Role;
  employment_type: EmploymentType;
  hourly_rate: string;
  certifications: string[];
  notes: string;
  is_active: boolean;
}

const blank: Form = {
  name: '', email: '', phone: '',
  role: 'server', employment_type: 'staff',
  hourly_rate: '0', certifications: [], notes: '',
  is_active: true,
};

export function TeammateForm({ open, onClose, initial }: TeammateFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name, email: initial.email, phone: initial.phone,
        role: initial.role as Role,
        employment_type: (initial as any).employment_type ?? 'staff',
        hourly_rate: (initial as any).hourly_rate ?? '0',
        certifications: (initial as any).certifications ?? [],
        notes: initial.notes,
        is_active: (initial as any).is_active ?? true,
      } : blank);
    }
  }, [open, initial]);

  const m = useMutation<{ member: TeamMember }, ApiError, void>({
    mutationFn: () =>
      isEdit
        ? api(`/api/team/${initial!.id}/`, { method: 'PATCH', body: form })
        : api('/api/team/', { method: 'POST', body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isEdit ? 'Updated' : 'Added');
      onClose();
    },
    onError: (e) => toast.error('Could not save', e.message),
  });

  const submit = () => {
    if (!form.name.trim()) { toast.warning('Name is required'); return; }
    m.mutate();
  };

  return (
    <FormSheet
      open={open} onClose={onClose}
      title={isEdit ? 'Edit teammate' : 'New teammate'}
      submitLabel={isEdit ? 'Save' : 'Create'}
      submitting={m.isPending}
      onSubmit={submit}
    >
      <FormField label="Name" required>
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
               autoCapitalize="words" placeholder="Alex Rivera" />
      </FormField>
      <FormField label="Email">
        <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })}
               keyboardType="email-address" autoCapitalize="none" />
      </FormField>
      <FormField label="Phone">
        <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })}
               keyboardType="phone-pad" />
      </FormField>

      <FormField label="Role">
        <ChoiceChips<Role>
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v })}
          options={(Object.keys(ROLE_LABEL) as Role[]).map((v) => ({ value: v, label: ROLE_LABEL[v] }))}
        />
      </FormField>

      <FormField label="Employment">
        <ChoiceChips<EmploymentType>
          value={form.employment_type}
          onChange={(v) => setForm({ ...form, employment_type: v })}
          options={[
            { value: 'staff', label: 'Staff (W-2)' },
            { value: 'temp',  label: 'Temp / 1099' },
          ]}
        />
      </FormField>

      <FormField label="Hourly rate" hint="Internal cost, USD">
        <Input value={form.hourly_rate}
               onChangeText={(v) => setForm({ ...form, hourly_rate: v.replace(/[^\d.]/g, '') })}
               keyboardType="decimal-pad" />
      </FormField>

      <FormSection title="Certifications">
        <MultiChips
          value={form.certifications}
          onChange={(v) => setForm({ ...form, certifications: v })}
          options={COMMON_CERTS.map((c) => ({ value: c, label: c }))}
        />
      </FormSection>

      <FormSection title="Status">
        <ToggleRow
          label={form.is_active ? 'Active' : 'Inactive'}
          description={form.is_active ? 'Schedulable on events' : 'Hidden from scheduling'}
          value={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v })}
        />
      </FormSection>

      <FormField label="Notes">
        <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })}
               multiline numberOfLines={3} inputClassName="min-h-[72px] py-3"
               placeholder="Specialties, availability windows, dietary, etc." />
      </FormField>
    </FormSheet>
  );
}
