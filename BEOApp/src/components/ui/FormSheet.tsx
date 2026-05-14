import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import {
  Dimensions, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal,
  NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { Button } from './Button';


// ---------------------------------------------------------------------------
// FormScrollContext — Android's ScrollView doesn't auto-scroll focused
// TextInputs above the keyboard. We do it ourselves: the FormSheet exposes
// a callback to its children; the Input component (or any consumer) calls
// it on focus, passing the focused node. FormSheet measures the node's
// screen position and scrolls so it sits above the keyboard.
// ---------------------------------------------------------------------------

interface FormScrollCtx {
  /** Tell the host scroll view that this input just got focus. */
  registerFocus: (node: TextInput | null) => void;
}

export const FormScrollContext = createContext<FormScrollCtx | null>(null);

export function useFormScroll() {
  return useContext(FormScrollContext);
}

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
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const scrollViewportH = useRef(0);
  const [kbHeight, setKbHeight] = useState(0);

  // Track current scroll position so registerFocus can compute the absolute
  // target Y from the relative measurement.
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = e.nativeEvent.contentOffset.y;
  }, []);

  // Track the ScrollView's own rendered height. KAV+'height' shrinks the
  // sheet when the keyboard appears, which shrinks this; we use the new
  // value as the visible viewport for scroll calculations.
  const onScrollLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    scrollViewportH.current = e.nativeEvent.layout.height;
  }, []);

  // Listen for keyboard show/hide so we know how much screen the keyboard
  // occupies. Only attach the listeners while the sheet is open.
  useEffect(() => {
    if (!open) {
      setKbHeight(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open]);

  // When the active keyboard height changes, re-scroll for the focused input.
  // We remember the last focused node so newly-shown keyboards re-scroll.
  const focusedNode = useRef<TextInput | null>(null);

  const scrollFocusedIntoView = useCallback(() => {
    const node = focusedNode.current;
    const sv = scrollRef.current;
    if (!node || !sv) return;

    // Use measureLayout against the ScrollView's content — gives us the
    // input's Y in *content coordinates*, which scrollTo accepts directly.
    // measureInWindow gave screen coords which on Android are off by the
    // status bar inset under statusBarTranslucent.
    const svHandle = findNodeHandle(sv);
    if (svHandle == null) return;

    // Delay so the keyboard's geometry + the KAV-induced layout shrink are
    // both final before we measure. 200ms is roomy on most Androids.
    setTimeout(() => {
      try {
        (node as any).measureLayout?.(
          svHandle,
          (_x: number, y: number, _w: number, h: number) => {
            const viewport = scrollViewportH.current;
            if (!viewport) return;
            const fieldBottom = y + h;
            const visibleBottom = scrollOffset.current + viewport;
            // 40px breathing room above the keyboard.
            if (fieldBottom > visibleBottom - 40) {
              const target = Math.max(0, fieldBottom - viewport + 40);
              sv.scrollTo({ y: target, animated: true });
            }
          },
          () => { /* measure failure — ignore */ },
        );
      } catch {
        /* noop — measure can fail if the node unmounted */
      }
    }, 200);
  }, []);

  useEffect(() => {
    if (kbHeight > 0) scrollFocusedIntoView();
  }, [kbHeight, scrollFocusedIntoView]);

  const ctx: FormScrollCtx = {
    registerFocus: (node) => {
      focusedNode.current = node;
      if (kbHeight > 0) scrollFocusedIntoView();
    },
  };

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

                {/*
                  Scrollable body. Tracks scroll position so registerFocus
                  can scroll the focused TextInput above the keyboard. The
                  large bottom padding gives manual-scroll room past the last
                  field even after the auto-scroll lands.
                */}
                <FormScrollContext.Provider value={ctx}>
                  <ScrollView
                    ref={scrollRef}
                    onScroll={onScroll}
                    onLayout={onScrollLayout}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerClassName="px-5 pb-32"
                    className="flex-1"
                  >
                    <View className="gap-y-4">{children}</View>
                  </ScrollView>
                </FormScrollContext.Provider>

                {/*
                  Footer. `justify-end` packs the buttons against the right
                  edge; `mr-auto` on the destructive Button (when present)
                  pushes it back to the left. Avoids the flex-1 spacer +
                  inner View nesting that was overflowing on narrow phones.
                */}
                <View className="flex-row items-center justify-end gap-x-2 border-t border-ink-200 bg-white px-4 py-3">
                  {destructive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={destructive.onPress}
                      className="mr-auto"
                    >
                      <Text className="text-sm font-semibold text-danger-600">
                        {destructive.label}
                      </Text>
                    </Button>
                  ) : null}
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
