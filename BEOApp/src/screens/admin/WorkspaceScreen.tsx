import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Save, Palette, LogOut, ExternalLink } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { FormField, FormSection } from '@/components/ui/FormSheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Organization } from '@/lib/types';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'Workspace'>;

// Curated palette of brand colors. Picking from a swatch is much faster than
// a hex picker for non-designers, and the chosen value is just a hex string
// so power users can still type their own.
const BRAND_PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F59E0B', '#10B981', '#0EA5E9', '#0F172A',
];

const OAUTH_PROVIDERS = [
  { id: 'google',  name: 'Google',  color: '#EA4335', status: 'Not configured' },
  { id: 'outlook', name: 'Outlook', color: '#0078D4', status: 'Not configured' },
  { id: 'github',  name: 'GitHub',  color: '#0F172A', status: 'Not configured' },
];

export default function WorkspaceScreen({ navigation }: Props) {
  const { user, signOut, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery<{ organization: Organization }>({
    queryKey: ['organization'],
    queryFn:  () => api('/api/organization/'),
  });

  const org = q.data?.organization ?? user?.organization ?? null;

  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#6366F1');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (org) {
      setName(org.name);
      setBrandColor(org.brand_color);
      setLogoUrl(org.logo_url);
    }
  }, [org]);

  const m = useMutation<{ organization: Organization }, ApiError, void>({
    mutationFn: () => api('/api/organization/', {
      method: 'PATCH',
      body: { name, brand_color: brandColor, logo_url: logoUrl },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
      refresh().catch(() => {});  // sync user.organization in AuthContext
      toast.success('Workspace saved');
    },
    onError: (e) => toast.error('Could not save', e.message),
  });

  return (
    <Screen contentClassName="px-0 py-0">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 p-2"
            accessibilityRole="button" accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
          <Button
            size="sm"
            icon={<Save size={14} color="#fff" />}
            onPress={() => m.mutate()}
            loading={m.isPending}
          >
            Save
          </Button>
        </View>

        {q.isLoading || !org ? (
          <View className="px-5 pt-4">
            <Skeleton className="h-32 w-full" />
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            className="px-5 pt-3"
          >
            {/* Live brand preview */}
            <LinearGradient
              colors={[brandColor, brandColor + 'CC', brandColor + '99']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 18 }}
            >
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Live preview
              </Text>
              <Text className="mt-1 text-2xl font-bold text-white">{name || 'Untitled'}</Text>
              <Text className="mt-0.5 text-xs text-white/85">{`@${org.slug}`}</Text>
            </LinearGradient>

            <FormSection title="Identity" className="mt-6">
              <FormField label="Workspace name">
                <Input value={name} onChangeText={setName} />
              </FormField>
              <FormField label="Public handle" hint="Used in client form links — read-only">
                <View className="flex-row items-center rounded-2xl border border-ink-200 bg-ink-100 px-3.5 py-3">
                  <Text className="text-base font-mono text-ink-700">/{org.slug}</Text>
                </View>
              </FormField>
              <FormField label="Logo URL" hint="Optional. Shown to clients on the request form.">
                <Input value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" keyboardType="url" />
              </FormField>
            </FormSection>

            <FormSection title="Brand color">
              <View className="flex-row flex-wrap gap-2.5">
                {BRAND_PALETTE.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setBrandColor(c)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: brandColor.toUpperCase() === c.toUpperCase() }}
                    accessibilityLabel={`Brand color ${c}`}
                  >
                    <View
                      className={cn(
                        'h-10 w-10 rounded-2xl border-2',
                        brandColor.toUpperCase() === c.toUpperCase() ? 'border-ink-900' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  </Pressable>
                ))}
              </View>
              <FormField label="Custom hex">
                <Input
                  value={brandColor}
                  onChangeText={(v) => setBrandColor(v.startsWith('#') ? v : `#${v}`)}
                  autoCapitalize="characters"
                  placeholder="#6366F1"
                  leftIcon={<Palette size={18} color="#64748B" />}
                />
              </FormField>
            </FormSection>

            <FormSection title="Social sign-in">
              <Text className="text-xs text-ink-500">
                Connect OAuth providers so your clients can sign up with their existing accounts.
              </Text>
              <Card>
                <View className="p-2">
                  {OAUTH_PROVIDERS.map((p) => (
                    <View key={p.id} className="flex-row items-center p-3">
                      <View
                        className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: p.color + '15' }}
                      >
                        <Text className="text-base font-bold" style={{ color: p.color }}>
                          {p.name[0]}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-ink-900">{p.name}</Text>
                        <Text className="text-xs text-ink-500">{p.status}</Text>
                      </View>
                      <Badge bgClassName="bg-ink-200" textClassName="text-ink-600">Off</Badge>
                    </View>
                  ))}
                </View>
              </Card>
              <Text className="mt-1 text-xs text-ink-500">
                Setup requires the app to be registered with each provider — see backend
                settings.OAUTH_PROVIDERS.
              </Text>
            </FormSection>

            <FormSection title="Team">
              <Card>
                <View className="p-4">
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink-900">{user?.name}</Text>
                      <Text className="text-xs text-ink-500">{user?.email}</Text>
                    </View>
                    <Badge bgClassName="bg-brand-50" textClassName="text-brand-700">Owner</Badge>
                  </View>
                  <View className="mt-3 border-t border-ink-100 pt-3">
                    <Text className="text-xs text-ink-500">
                      Member invitations coming next — you'll be able to add collaborators
                      with role-based access.
                    </Text>
                  </View>
                </View>
              </Card>
            </FormSection>

            <View className="mt-6">
              <Button variant="ghost" onPress={signOut} icon={<LogOut size={16} color="#DC2626" />}>
                <Text className="text-sm font-semibold text-danger-600">Sign out</Text>
              </Button>
            </View>
          </MotiView>
        )}
      </ScrollView>
    </Screen>
  );
}
