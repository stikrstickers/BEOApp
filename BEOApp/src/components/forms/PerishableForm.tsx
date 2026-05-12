import React, { useState, useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormSheet, FormField, FormSection, ChoiceChips, MultiChips } from '@/components/ui/FormSheet';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  type Perishable, type PerishableCategory, type PerishableStorage,
  PERISHABLE_CATEGORY_LABEL,
} from '@/lib/types';
import { cn } from '@/lib/cn';

interface PerishableFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Perishable | null;
}

const STORAGE_LABEL: Record<PerishableStorage, string> = {
  pantry: 'Pantry', cooler: 'Cooler', freezer: 'Freezer', cellar: 'Cellar',
};

const COMMON_ALLERGENS = ['gluten', 'dairy', 'nuts', 'soy', 'eggs', 'shellfish', 'fish', 'sesame'];

interface Form {
  name: string;
  category: PerishableCategory;
  storage:  PerishableStorage;
  unit: string;
  quantity_on_hand: string;
  unit_cost: string;
  unit_price: string;
  low_stock_threshold: string;
  supplier: string;
  lot_number: string;
  expiry_date: Date | null;
  allergens: string[];
  notes: string;
}

const blank: Form = {
  name: '', category: 'produce', storage: 'pantry', unit: '',
  quantity_on_hand: '0', unit_cost: '0', unit_price: '0', low_stock_threshold: '0',
  supplier: '', lot_number: '',
  expiry_date: null, allergens: [], notes: '',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function PerishableForm({ open, onClose, initial }: PerishableFormProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Form>(blank);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name, category: initial.category, storage: initial.storage,
        unit: initial.unit,
        quantity_on_hand:    initial.quantity_on_hand,
        unit_cost:           initial.unit_cost,
        unit_price:          initial.unit_price,
        low_stock_threshold: initial.low_stock_threshold,
        supplier: initial.supplier, lot_number: initial.lot_number,
        expiry_date: initial.expiry_date ? new Date(`${initial.expiry_date}T00:00:00`) : null,
        allergens: initial.allergens,
        notes: initial.notes,
      } : blank);
    }
  }, [open, initial]);

  const m = useMutation<{ item: Perishable }, ApiError, void>({
    mutationFn: () => {
      const body = {
        ...form,
        expiry_date: form.expiry_date ? dateOnly(form.expiry_date) : null,
      };
      return isEdit
        ? api(`/api/perishables/${initial!.id}/`, { method: 'PATCH', body })
        : api('/api/perishables/', { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perishables'] });
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
      title={isEdit ? 'Edit perishable' : 'New perishable'}
      submitLabel={isEdit ? 'Save' : 'Create'}
      submitting={m.isPending}
      onSubmit={submit}
    >
      <FormField label="Name" required>
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })}
               placeholder="Heirloom tomatoes" />
      </FormField>

      <FormField label="Category">
        <ChoiceChips<PerishableCategory>
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          options={(Object.keys(PERISHABLE_CATEGORY_LABEL) as PerishableCategory[]).map((v) => ({
            value: v, label: PERISHABLE_CATEGORY_LABEL[v],
          }))}
        />
      </FormField>

      <FormField label="Storage">
        <ChoiceChips<PerishableStorage>
          value={form.storage}
          onChange={(v) => setForm({ ...form, storage: v })}
          options={(Object.keys(STORAGE_LABEL) as PerishableStorage[]).map((v) => ({
            value: v, label: STORAGE_LABEL[v],
          }))}
        />
      </FormField>

      <FormSection title="Stock">
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <FormField label="On hand">
              <Input value={form.quantity_on_hand}
                     onChangeText={(v) => setForm({ ...form, quantity_on_hand: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Unit">
              <Input value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })}
                     placeholder="lb, ea, gal" />
            </FormField>
          </View>
        </View>
        <FormField label="Low-stock threshold">
          <Input value={form.low_stock_threshold}
                 onChangeText={(v) => setForm({ ...form, low_stock_threshold: v.replace(/[^\d.]/g, '') })}
                 keyboardType="decimal-pad" />
        </FormField>
      </FormSection>

      <FormSection title="Pricing">
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <FormField label="Cost / unit">
              <Input value={form.unit_cost}
                     onChangeText={(v) => setForm({ ...form, unit_cost: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
          <View className="flex-1">
            <FormField label="Charge / unit">
              <Input value={form.unit_price}
                     onChangeText={(v) => setForm({ ...form, unit_price: v.replace(/[^\d.]/g, '') })}
                     keyboardType="decimal-pad" />
            </FormField>
          </View>
        </View>
      </FormSection>

      <FormSection title="Sourcing">
        <FormField label="Supplier">
          <Input value={form.supplier} onChangeText={(v) => setForm({ ...form, supplier: v })} />
        </FormField>
        <FormField label="Lot number">
          <Input value={form.lot_number} onChangeText={(v) => setForm({ ...form, lot_number: v })} />
        </FormField>
        <FormField label="Expiry date">
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Pick expiry date"
            className="flex-row items-center rounded-2xl border border-ink-200 bg-white px-3.5 py-3"
          >
            <Calendar size={18} color="#64748B" />
            <Text className={cn('ml-2 flex-1 text-base', form.expiry_date ? 'text-ink-900' : 'text-ink-400')}>
              {form.expiry_date ? fmtDate(form.expiry_date) : 'No expiry'}
            </Text>
            {form.expiry_date ? (
              <Pressable onPress={() => setForm({ ...form, expiry_date: null })} hitSlop={12}>
                <Text className="text-xs font-medium text-danger-600">Clear</Text>
              </Pressable>
            ) : null}
          </Pressable>
          {pickerOpen ? (
            <DateTimePicker
              value={form.expiry_date ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_: DateTimePickerEvent, d?: Date) => {
                if (Platform.OS === 'android') setPickerOpen(false);
                if (d) setForm({ ...form, expiry_date: d });
              }}
            />
          ) : null}
        </FormField>
      </FormSection>

      <FormSection title="Allergens">
        <MultiChips
          value={form.allergens}
          onChange={(v) => setForm({ ...form, allergens: v })}
          options={COMMON_ALLERGENS.map((a) => ({ value: a, label: a }))}
        />
      </FormSection>

      <FormField label="Notes">
        <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })}
               multiline numberOfLines={3} inputClassName="min-h-[72px] py-3" />
      </FormField>
    </FormSheet>
  );
}
