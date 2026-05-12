import React from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MotiView } from 'moti';
import {
  ArrowLeft, Building, MapPin, User as UserIcon, Mail, Phone, Globe,
  DoorOpen, Plus, Users as UsersIcon, Square,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { Site, SiteVenue } from '@/lib/types';
import { VENUE_LAYOUT_LABEL } from '@/lib/types';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'SiteDetail'>;

function ContactRow({ icon, label, value, onPress }: {
  icon: React.ReactNode; label: string; value: string; onPress?: () => void;
}) {
  if (!value) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={`${label}: ${value}`}
    >
      <View className="flex-row items-center py-2.5">
        <View className="mr-3 h-8 w-8 items-center justify-center rounded-lg bg-ink-100">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-xs uppercase tracking-wide text-ink-500">{label}</Text>
          <Text className="mt-0.5 text-sm font-medium text-ink-900" numberOfLines={1}>{value}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function VenueCard({ v }: { v: SiteVenue }) {
  const amenities: Array<[boolean, string]> = [
    [v.has_av,             'A/V'],
    [v.has_stage,          'Stage'],
    [v.has_dance_floor,    'Dance floor'],
    [v.has_kitchen_access, 'Kitchen'],
    [v.has_outdoor_access, 'Outdoor'],
    [v.has_natural_light,  'Natural light'],
    [v.is_accessible,      'Accessible'],
  ];
  const activeAmenities = amenities.filter(([on]) => on).map(([, label]) => label);

  return (
    <Card className="mb-3">
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-ink-900">{v.name}</Text>
            <View className="mt-1.5 flex-row items-center gap-x-3">
              {(v.capacity_min > 0 || v.capacity_max > 0) ? (
                <View className="flex-row items-center">
                  <UsersIcon size={12} color="#64748B" />
                  <Text className="ml-1 text-xs text-ink-500">
                    {v.capacity_min > 0 ? `${v.capacity_min}–` : 'up to '}
                    {v.capacity_max > 0 ? v.capacity_max : '?'}
                  </Text>
                </View>
              ) : null}
              {v.square_footage > 0 ? (
                <View className="flex-row items-center">
                  <Square size={12} color="#64748B" />
                  <Text className="ml-1 text-xs text-ink-500">{v.square_footage} sq ft</Text>
                </View>
              ) : null}
            </View>
          </View>
          {!v.is_active ? (
            <Badge bgClassName="bg-ink-200" textClassName="text-ink-600">Inactive</Badge>
          ) : null}
        </View>

        {(v.supported_layouts?.length ?? 0) > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-1.5">
            {v.supported_layouts.map((l) => (
              <View key={l} className="rounded-full bg-brand-50 px-2 py-1">
                <Text className="text-[10px] font-semibold text-brand-700">
                  {VENUE_LAYOUT_LABEL[l]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {activeAmenities.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-1.5">
            {activeAmenities.map((a) => (
              <View key={a} className="rounded-full bg-ink-100 px-2 py-1">
                <Text className="text-[10px] font-medium text-ink-600">{a}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export default function SiteDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const toast = useToast();

  const q = useQuery<{ site: Site }>({
    queryKey: ['site', id],
    queryFn:  () => api(`/api/sites/${id}/`),
  });

  const s = q.data?.site;
  const venues = s?.venues ?? [];
  const addressParts = s ? [
    s.address_line1, s.address_line2,
    [s.city, s.state_region, s.postal_code].filter(Boolean).join(', '),
    s.country,
  ].filter(Boolean) : [];

  return (
    <Screen contentClassName="px-0 py-0">
      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#6366F1" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center px-5 pt-4">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 p-2"
            accessibilityRole="button" accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
        </View>

        {q.isLoading || !s ? (
          <View className="px-5 pt-4">
            <Skeleton className="mb-3 h-8 w-64" />
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="h-32 w-full" />
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            className="px-5 pt-3"
          >
            <View className="flex-row items-center">
              <View className="mr-3 h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
                <Building size={22} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-ink-900">{s.name}</Text>
                {addressParts.length > 0 ? (
                  <Text className="mt-0.5 text-sm text-ink-500" numberOfLines={2}>
                    {addressParts.join(' · ')}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Operator / Owner / Contact */}
            <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
              Contact
            </Text>
            <Card>
              <View className="px-4 py-1.5">
                <ContactRow
                  icon={<UserIcon size={16} color="#475569" />}
                  label="Contact"
                  value={s.contact_name}
                />
                <ContactRow
                  icon={<Mail size={16} color="#475569" />}
                  label="Email"
                  value={s.contact_email}
                  onPress={() => s.contact_email && Linking.openURL(`mailto:${s.contact_email}`)}
                />
                <ContactRow
                  icon={<Phone size={16} color="#475569" />}
                  label="Phone"
                  value={s.contact_phone}
                  onPress={() => s.contact_phone && Linking.openURL(`tel:${s.contact_phone}`)}
                />
                <ContactRow
                  icon={<Globe size={16} color="#475569" />}
                  label="Website"
                  value={s.website}
                  onPress={() => s.website && Linking.openURL(s.website)}
                />
              </View>
            </Card>

            {(s.owner_name || s.operator_name) ? (
              <Card className="mt-3">
                <View className="p-4">
                  {s.owner_name ? (
                    <View className="mb-2">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Owner</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{s.owner_name}</Text>
                    </View>
                  ) : null}
                  {s.operator_name ? (
                    <View>
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Operator</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{s.operator_name}</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            ) : null}

            {/* Venues inside */}
            <View className="mt-6 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-ink-500">
                Venues ({venues.length})
              </Text>
              <Button
                size="sm"
                variant="outline"
                icon={<Plus size={14} color="#334155" />}
                onPress={() => toast.info('Add venue coming soon')}
              >
                Add
              </Button>
            </View>
            <View className="mt-3">
              {venues.length === 0 ? (
                <EmptyState
                  icon={<DoorOpen size={22} color="#6366F1" />}
                  title="No bookable spaces yet"
                  description="Add ballrooms, terraces, or any space clients can book"
                />
              ) : (
                venues.map((v) => <VenueCard key={v.id} v={v} />)
              )}
            </View>
          </MotiView>
        )}
      </ScrollView>
    </Screen>
  );
}
