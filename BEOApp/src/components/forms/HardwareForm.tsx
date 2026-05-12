import React, { useState, useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection, ChoiceChips } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  type Hardware, type HardwareCategory, type HardwareCondition,
  HARDWARE_CATEGORY_LABEL, HARDWARE_CONDITION_LABEL,
} from '@/lib/types';
import { cn } from '@/lib/cn';

interface HardwareFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Hardware | null;
}

interface Form {
  name: string;
  category: HardwareCategory;
  condition: HardwareCondition;
  unit: string;
  quantity_on_hand: string;
  unit_cost: string;
  unit_price: string;
  low_stock_threshold: string;
  serial_number: string;
  storage_location: string;
  purchase_date: Date | null;
  purchase_cost: string;
  last_serviced: Date | null;
  service_notes: string;
  notes: string;
}

const blank: Form = {
  name: '', category: 'table', condition: 'good',
  unit: 'each',
  quantity_on_hand: '0', unit_cost: '0', unit_price: '0', low_stock_threshold: '0',
  serial_number: '', storage_location: '',
  purchase_date: null, purchase_cost: '0',
  last_serviced: null, service_notes: '',
  notes: '',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function DateInput({ label, value, onChange }: {
  label: string; value: Date | null; onChange: (d: Date | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <FormField label={label}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button" accessibilityLabel={label}
        className="flex-row items-center rounded-2xl border border-ink-200 bg-white px-3.5 py-3"
      >
        <Calendar size={18} color="#64748B" />
        <Text className={cn('ml-2 flex-1 text-base', value ? 'text-ink-900' : 'text-ink-400')}>
          {value ? fmtDate(value) : 'Not set'}
        </Text>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={12}>
            <Text className="text-xs font-medium text-danger-600">Clear</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_: DateTimePickerEvent, d?: Date) => {
            if (Platform.OS === 'android') setOpen(false);
            if (d) onChange(d);
          }}
        />
      ) : null}
    </FormField>
  );
}

export function HardwareForm({ open, onClose, initial }: HardwareFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name, category: initial.category, condition: initial.condition,
        unit: initial.unit,
        quantity_on_hand:    initial.quantity_on_hand,
        unit_cost:           initial.unit_cost,
        unit_price:          initial.unit_price,
        low_stock_threshold: initial.low_stock_threshold,
        serial_number: initial.serial_number,
        storage_location: initial.storage_location,
        purchase_date: initial.purchase_date ? new Date(`${initial.purchase_date}T00:00:00`) : null,
        purchase_cost: initial.purchase_cost,
        last_serviced: initial.last_serviced ? new Date(`${initial.last_serviced}T00:00:00`) : null,
        service_notes: initial.service_notes,
        notes: initial.notes,
      } : blank);
    }
  }, [open, initial]);

  const m = useMutation<{ item: Hardware }, ApiError, void>({
    mutationFn: () => {
      const body = {
        ...form,
        purchase_date: form.purchase_date ? dateOnly(form.purchase_date) : null,
        last_serviced: form.last_serviced ? dateOnly(form.last_serviced) : null,
      };
      return isEdit
        ? api(`/api/hardware/${initial!.id}/`, { method: 'PATCH', body })
        : api('/api/hardware/', { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware'] });
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
      title={isEdit ? 'Edit item' : 'New hardware'}
      submitLabel={isEdit ? 'Save' : 'Create'}
      submitting={m.isPending}
      onSubmit={submit}
    >
      <FormField label="Name" required>
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
               placeholder="60in round table" />
      </FormField>

      <FormField label="Category">
        <ChoiceChips<HardwareCategory>
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          options={(Object.keys(HARDWARE_CATEGORY_LABEL) as HardwareCategory[]).map((v) => ({
            value: v, label: HARDWARE_CATEGORY_LABEL[v],
          }))}
        />
      </FormField>

      <FormField label="Condition">
        <ChoiceChips<HardwareCondition>
          value={form.condition}
          onChange={(v) => setForm({ ...form, condition: v })}
          options={(Object.keys(HARDWARE_CONDITION_LABEL) as HardwareCondition[]).map((v) => ({
            value: v, label: HARDWARE_CONDITION_LABEL[v],
          }))}
        />
      </FormField>

      <FormSection title="Stock">
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <FormField label="Quantity">
              <Input value={form.quantity_on_hand}
                     onChangeText={(v) => setForm({ ...form, quantity_on_hand: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Unit">
              <Input value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} />
            </FormField>
          </View>
        </View>
        <FormField label="Low-stock threshold">
          <Input value={form.low_stock_threshold}
                 onChangeText={(v) => setForm({ ...form, low_stock_threshold: v.replace(/[^\d.]/g, '') })}
                 keyboardType="decimal-pad" />
        </FormField>
      </FormSection>

      <FormSection title="Tracking">
        <FormField label="Storage location" hint="Where it lives when not deployed">
          <Input value={form.storage_location} onChangeText={(v) => setForm({ ...form, storage_location: v })}
                 placeholder="Warehouse rack B-3" />
        </FormField>
        <FormField label="Serial number">
          <Input value={form.serial_number} onChangeText={(v) => setForm({ ...form, serial_number: v })} />
        </FormField>
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <DateInput label="Purchased" value={form.purchase_date}
                       onChange={(d) => setForm({ ...form, purchase_date: d })} />
          </View>
          <View className="flex-1">
            <FormField label="Cost">
              <Input value={form.purchase_cost}
                     onChangeText={(v) => setForm({ ...form, purchase_cost: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
        </View>
      </FormSection>

      <FormSection title="Pricing (per use)">
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <FormField label="Cost / use">
              <Input value={form.unit_cost}
                     onChangeText={(v) => setForm({ ...form, unit_cost: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Charge / use">
              <Input value={form.unit_price}
                     onChangeText={(v) => setForm({ ...form, unit_price: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
        </View>
      </FormSection>

      <FormSection title="Service history">
        <DateInput label="Last serviced" value={form.last_serviced}
                   onChange={(d) => setForm({ ...form, last_serviced: d })} />
        <FormField label="Service notes">
          <Input value={form.service_notes} onChangeText={(v) => setForm({ ...form, service_notes: v })}
                 multiline numberOfLines={2} inputClassName="min-h-[56px] py-3" />
        </FormField>
      </FormSection>

      <FormField label="Notes">
        <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })}
               multiline numberOfLines={3} inputClassName="min-h-[72px] py-3" />
      </FormField>
    </FormSheet>
  );
}
