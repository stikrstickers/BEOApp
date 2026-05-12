import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection, MultiChips, ToggleRow } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  type SiteVenue, type VenueLayout, VENUE_LAYOUT_LABEL,
} from '@/lib/types';

interface SiteVenueFormProps {
  open: boolean;
  onClose: () => void;
  siteId: number;
  initial?: SiteVenue | null;
}

interface Form {
  name: string;
  capacity_min: string;
  capacity_max: string;
  square_footage: string;
  base_hourly_rate: string;
  supported_layouts: VenueLayout[];
  has_av: boolean;
  has_stage: boolean;
  has_dance_floor: boolean;
  has_kitchen_access: boolean;
  has_outdoor_access: boolean;
  is_accessible: boolean;
  has_natural_light: boolean;
  is_active: boolean;
  notes: string;
}

const blank: Form = {
  name: '', capacity_min: '0', capacity_max: '0', square_footage: '0',
  base_hourly_rate: '0', supported_layouts: [],
  has_av: false, has_stage: false, has_dance_floor: false,
  has_kitchen_access: false, has_outdoor_access: false,
  is_accessible: true, has_natural_light: false,
  is_active: true, notes: '',
};

export function SiteVenueForm({ open, onClose, siteId, initial }: SiteVenueFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name,
        capacity_min:     String(initial.capacity_min),
        capacity_max:     String(initial.capacity_max),
        square_footage:   String(initial.square_footage),
        base_hourly_rate: String(initial.base_hourly_rate),
        supported_layouts: initial.supported_layouts,
        has_av:             initial.has_av,
        has_stage:          initial.has_stage,
        has_dance_floor:    initial.has_dance_floor,
        has_kitchen_access: initial.has_kitchen_access,
        has_outdoor_access: initial.has_outdoor_access,
        is_accessible:      initial.is_accessible,
        has_natural_light:  initial.has_natural_light,
        is_active:          initial.is_active,
        notes:              initial.notes,
      } : blank);
      setError(undefined);
    }
  }, [open, initial]);

  const m = useMutation<{ venue: SiteVenue }, ApiError, void>({
    mutationFn: () => {
      const payload = {
        ...form,
        capacity_min:     Number(form.capacity_min) || 0,
        capacity_max:     Number(form.capacity_max) || 0,
        square_footage:   Number(form.square_footage) || 0,
        base_hourly_rate: form.base_hourly_rate || '0',
      };
      return isEdit
        ? api(`/api/venues/${initial!.id}/`, { method: 'PATCH', body: payload })
        : api(`/api/sites/${siteId}/venues/`, { method: 'POST', body: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site', siteId] });
      qc.invalidateQueries({ queryKey: ['sites'] });
      toast.success(isEdit ? 'Venue updated' : 'Venue created');
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      toast.error('Could not save', err.message);
    },
  });

  const submit = () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    const min = Number(form.capacity_min) || 0;
    const max = Number(form.capacity_max) || 0;
    if (max > 0 && min > max) { setError('Min capacity must be ≤ max'); return; }
    setError(undefined);
    m.mutate();
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit venue' : 'New venue'}
      subtitle={isEdit ? initial!.name : 'A bookable space inside this site'}
      submitLabel={isEdit ? 'Save' : 'Create'}
      submitting={m.isPending}
      onSubmit={submit}
    >
      <FormSection title="Basics">
        <FormField label="Venue name" required error={!form.name && error ? error : undefined}>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
                 placeholder="e.g. Grand Ballroom" />
        </FormField>
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <FormField label="Capacity min">
              <Input value={form.capacity_min} onChangeText={(v) => setForm({ ...form, capacity_min: v.replace(/\D/g, '') })}
                     keyboardType="number-pad" placeholder="0" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Capacity max">
              <Input value={form.capacity_max} onChangeText={(v) => setForm({ ...form, capacity_max: v.replace(/\D/g, '') })}
                     keyboardType="number-pad" placeholder="0" />
            </FormField>
          </View>
        </View>
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <FormField label="Square footage">
              <Input value={form.square_footage} onChangeText={(v) => setForm({ ...form, square_footage: v.replace(/\D/g, '') })}
                     keyboardType="number-pad" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Hourly rate" hint="USD">
              <Input value={form.base_hourly_rate} onChangeText={(v) => setForm({ ...form, base_hourly_rate: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
        </View>
      </FormSection>

      <FormSection title="Supported layouts">
        <MultiChips<VenueLayout>
          value={form.supported_layouts}
          onChange={(v) => setForm({ ...form, supported_layouts: v })}
          options={(Object.keys(VENUE_LAYOUT_LABEL) as VenueLayout[]).map((v) => ({
            value: v, label: VENUE_LAYOUT_LABEL[v],
          }))}
        />
      </FormSection>

      <FormSection title="Amenities">
        <ToggleRow label="A/V equipment built in"        value={form.has_av}             onChange={(v) => setForm({ ...form, has_av: v })} />
        <ToggleRow label="Stage / risers"                 value={form.has_stage}          onChange={(v) => setForm({ ...form, has_stage: v })} />
        <ToggleRow label="Dance floor"                    value={form.has_dance_floor}    onChange={(v) => setForm({ ...form, has_dance_floor: v })} />
        <ToggleRow label="Kitchen access"                 value={form.has_kitchen_access} onChange={(v) => setForm({ ...form, has_kitchen_access: v })} />
        <ToggleRow label="Outdoor access"                 value={form.has_outdoor_access} onChange={(v) => setForm({ ...form, has_outdoor_access: v })} />
        <ToggleRow label="ADA accessible"                 value={form.is_accessible}      onChange={(v) => setForm({ ...form, is_accessible: v })} />
        <ToggleRow label="Natural light"                  value={form.has_natural_light}  onChange={(v) => setForm({ ...form, has_natural_light: v })} />
      </FormSection>

      <FormSection title="Visibility">
        <ToggleRow
          label={form.is_active ? 'Active' : 'Hidden'}
          description={form.is_active
            ? 'Bookable by planners and visible in venue pickers'
            : 'Not bookable; hidden from venue pickers'}
          value={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v })}
        />
      </FormSection>

      <FormSection title="Notes">
        <Input
          value={form.notes}
          onChangeText={(v) => setForm({ ...form, notes: v })}
          multiline numberOfLines={4}
          inputClassName="min-h-[96px] py-3"
          placeholder="Setup quirks, restrictions, AV peculiarities…"
        />
      </FormSection>
    </FormSheet>
  );
}
