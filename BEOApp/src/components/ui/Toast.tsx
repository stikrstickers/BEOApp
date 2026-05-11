import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react-native';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  show: (t: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error:   (title: string, description?: string) => void;
  info:    (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const TONE_STYLE: Record<ToastTone, { bg: string; text: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-success-500', text: 'text-white', icon: <CheckCircle2 size={20} color="#fff" /> },
  error:   { bg: 'bg-danger-500',  text: 'text-white', icon: <XCircle size={20} color="#fff" /> },
  warning: { bg: 'bg-warning-500', text: 'text-white', icon: <AlertCircle size={20} color="#fff" /> },
  info:    { bg: 'bg-ink-900',     text: 'text-white', icon: <Info size={20} color="#fff" /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++idRef.current;
    setItems((cur) => [...cur, { ...t, id }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value: ToastContextValue = {
    show,
    success: (title, description) => show({ tone: 'success', title, description }),
    error:   (title, description) => show({ tone: 'error', title, description }),
    info:    (title, description) => show({ tone: 'info', title, description }),
    warning: (title, description) => show({ tone: 'warning', title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" className="absolute inset-x-0 top-12 z-50 px-4">
        <AnimatePresence>
          {items.map((t) => {
            const s = TONE_STYLE[t.tone];
            return (
              <MotiView
                key={t.id}
                from={{ opacity: 0, translateY: -20 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: -20 }}
                transition={{ type: 'timing', duration: 200 }}
                className={cn('mb-2 flex-row items-start rounded-2xl px-4 py-3 shadow-lg', s.bg)}
              >
                <View className="mr-3 mt-0.5">{s.icon}</View>
                <View className="flex-1">
                  <Text className={cn('text-sm font-semibold', s.text)}>{t.title}</Text>
                  {t.description ? (
                    <Text className={cn('mt-0.5 text-xs opacity-90', s.text)}>{t.description}</Text>
                  ) : null}
                </View>
              </MotiView>
            );
          })}
        </AnimatePresence>
      </View>
    </ToastContext.Provider>
  );
}
