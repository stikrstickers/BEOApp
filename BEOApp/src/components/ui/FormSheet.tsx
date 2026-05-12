import React, { useEffect } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface FormSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Form fields. */
  children: React.ReactNode;
  /** Primary action label, e.g. "Save" / "Create". */
  submitLabel?: string;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  /** Disable submit (e.g. validation hasn't passed). */
  submitDisabled?: boolean;
  /** Optional left side action in the footer (e.g. Delete). */
  destructive?: { label: string; onPress: () => void };
}

/**
 * Bottom-sheet style modal for create/edit forms. Plays nicely with the
 * keyboard, scrolls when content overflows, and animates open/close.
 *
 * Usage is *not* React Hook Form aware — keep the form state outside, just
 * pass children + onSubmit. This keeps the sheet generic enough to host
 * anything from a 3-field "rename" dialog to the 25-field SiteVenue editor.
 */
export function FormSheet({
  open, onClose, title, subtitle, children,
  submitLabel = 'Save', onSubmit, submitting, submitDisabled,
  destructive,
}: FormSheetProps) {
  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/*
        The KeyboardAvoidingView wraps the whole modal so it can shrink the
        backdrop layout when the keyboard rises. Inside, we `justify-end` to
        glue the sheet to the bottom — and the sheet uses maxHeight rather
        than a fixed height so it can naturally compress as the keyboard
        eats vertical space. Without this, h-[90%] would stay 90% of the
        whole screen and the keyboard would draw over the footer.
      */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-ink-900/40"
      >
        <AnimatePresence>
          {open ? (
            <MotiView
              from={{ translateY: 800 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: 800 }}
              transition={{ type: 'timing', duration: 250 }}
              // height: '92%' — fixed percentage so flex children (ScrollView)
              // have a bounded parent. The outer KAV shrinks `available height`
              // when the keyboard appears, so 92% naturally compresses with it.
              style={{ height: '92%' }}
              className="rounded-t-3xl bg-ink-50"
            >
              <View className="flex-1">
                {/* Drag handle */}
                <View className="items-center pt-2 pb-1">
                  <View className="h-1 w-10 rounded-full bg-ink-300" />
                </View>

                {/* Header */}
                <View className="flex-row items-start justify-between px-5 pb-3">
                  <View className="flex-1 pr-3">
                    <Text className="text-xl font-bold text-ink-900">{title}</Text>
                    {subtitle ? (
                      <Text className="mt-0.5 text-sm text-ink-500">{subtitle}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    className="-mr-2 h-9 w-9 items-center justify-center rounded-full bg-ink-100"
                  >
                    <X size={18} color="#475569" />
                  </Pressable>
                </View>

                {/* Scrollable body. pb-4 is enough — the keyboard pushes the
                    whole sheet up via KAV, so we don't need to oversize this. */}
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  contentContainerClassName="px-5 pb-6"
                  className="flex-1"
                >
                  <View className="gap-y-4">{children}</View>
                </ScrollView>

                {/*
                  Footer: spacer pushes the right group to the edge regardless
                  of whether `destructive` renders, so Cancel/Save always sit
                  flush right (ml-auto was inconsistent across phones).
                */}
                <View className="flex-row items-center border-t border-ink-200 bg-white px-4 py-3">
                  {destructive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={destructive.onPress}
                    >
                      <Text className="text-sm font-semibold text-danger-600">
                        {destructive.label}
                      </Text>
                    </Button>
                  ) : null}
                  <View className="flex-1" />
                  <View className="flex-row gap-x-2">
                    <Button variant="secondary" size="sm" onPress={onClose}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onPress={onSubmit}
                      loading={submitting}
                      disabled={submitDisabled}
                    >
                      {submitLabel}
                    </Button>
                  </View>
                </View>
              </View>
            </MotiView>
          ) : null}
        </AnimatePresence>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ── Reusable form helpers ──────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

/** Wraps any input with a label, hint, and inline error. */
export function FormField({ label, hint, error, required, children }: FormFieldProps) {
  return (
    <View>
      <View className="mb-1.5 flex-row items-center">
        <Text className="text-sm font-medium text-ink-700">{label}</Text>
        {required ? <Text className="ml-0.5 text-sm text-danger-500">*</Text> : null}
      </View>
      {children}
      {error ? (
        <Text className="mt-1.5 text-xs text-danger-600">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-ink-500">{hint}</Text>
      ) : null}
    </View>
  );
}

interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <View className={cn('gap-y-4', className)}>
      {title ? (
        <Text className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-500">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Choice chips row used inside FormField. Single-select. */
export function ChoiceChips<T extends string>({
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
              'rounded-full border px-3 py-2',
              active ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white',
            )}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-brand-700' : 'text-ink-700')}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select chip row — for venue layouts, allergens, services, etc. */
export function MultiChips<T extends string>({
  options, value, onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const set = new Set(value);
  const toggle = (v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = set.has(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            className={cn(
              'rounded-full border px-3 py-2',
              active ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white',
            )}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-brand-700' : 'text-ink-700')}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Switch-style toggle row — for boolean amenity flags. */
export function ToggleRow({
  label, description, value, onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      className="flex-row items-center justify-between rounded-2xl border border-ink-200 bg-white p-3"
    >
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-ink-900">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-ink-500">{description}</Text>
        ) : null}
      </View>
      <View
        className={cn(
          'h-6 w-10 rounded-full p-0.5',
          value ? 'bg-brand-600' : 'bg-ink-300',
        )}
      >
        <MotiView
          animate={{ translateX: value ? 16 : 0 }}
          transition={{ type: 'timing', duration: 150 }}
          className="h-5 w-5 rounded-full bg-white"
        />
      </View>
    </Pressable>
  );
}
