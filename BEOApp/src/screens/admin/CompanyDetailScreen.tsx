import React, { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MotiView } from 'moti';
import {
  ArrowLeft, Building2, Truck, Globe, Mail, Phone, MapPin, Pencil, Users as UsersIcon,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CompanyForm } from '@/components/forms/CompanyForm';
import { api } from '@/lib/api';
import type { Company } from '@/lib/types';
import type { ContactsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContactsStackParamList, 'CompanyDetail'>;

export default function CompanyDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [editOpen, setEditOpen] = useState(false);

  const q = useQuery<{ company: Company }>({
    queryKey: ['company', id],
    queryFn:  () => api(`/api/companies/${id}/`),
  });

  const c = q.data?.company;

  return (
    <Screen contentClassName="px-0 py-0">
      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#6366F1" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12} className="-ml-2 p-2"
            accessibilityRole="button" accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
          {c ? (
            <Button
              size="sm"
              variant="outline"
              icon={<Pencil size={14} color="#334155" />}
              onPress={() => setEditOpen(true)}
            >
              Edit
            </Button>
          ) : null}
        </View>

        {q.isLoading || !c ? (
          <View className="px-5 pt-4">
            <Skeleton className="mb-3 h-8 w-64" />
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
              <View className="mr-3 h-14 w-14 items-center justify-center rounded-3xl bg-brand-50">
                {c.kind === 'vendor'
                  ? <Truck size={24} color="#6366F1" />
                  : <Building2 size={24} color="#6366F1" />}
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-ink-900">{c.name}</Text>
                <View className="mt-1 flex-row items-center gap-x-2">
                  <Badge
                    bgClassName={c.kind === 'vendor' ? 'bg-warning-500/10' : 'bg-brand-50'}
                    textClassName={c.kind === 'vendor' ? 'text-warning-600' : 'text-brand-700'}
                  >
                    {c.kind === 'vendor' ? 'Vendor' : c.kind === 'both' ? 'Client + Vendor' : 'Client'}
                  </Badge>
                  {c.industry ? (
                    <Text className="text-xs text-ink-500">{c.industry}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Services (vendor only) */}
            {(c.services?.length ?? 0) > 0 ? (
              <View className="mt-4 flex-row flex-wrap gap-1.5">
                {c.services.map((s) => (
                  <View key={s} className="rounded-full bg-ink-100 px-2.5 py-1">
                    <Text className="text-xs font-medium text-ink-700">{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Contact info */}
            <Card className="mt-5">
              <View className="p-2">
                {c.website ? (
                  <Pressable
                    onPress={() => Linking.openURL(c.website)}
                    className="flex-row items-center p-3"
                    accessibilityRole="link" accessibilityLabel={`Open ${c.website}`}
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                      <Globe size={16} color="#6366F1" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Website</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{c.website}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {c.billing_email ? (
                  <Pressable
                    onPress={() => Linking.openURL(`mailto:${c.billing_email}`)}
                    className="flex-row items-center p-3"
                    accessibilityRole="link"
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-success-500/10">
                      <Mail size={16} color="#059669" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Billing email</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{c.billing_email}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {c.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${c.phone}`)}
                    className="flex-row items-center p-3"
                    accessibilityRole="link"
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-ink-100">
                      <Phone size={16} color="#475569" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Phone</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{c.phone}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {c.address ? (
                  <View className="flex-row items-center p-3">
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-ink-100">
                      <MapPin size={16} color="#475569" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Address</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{c.address}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </Card>

            {/* Contacts at this company */}
            {(c.contacts?.length ?? 0) > 0 ? (
              <>
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                  People here ({c.contacts!.length})
                </Text>
                <Card>
                  <View className="p-2">
                    {c.contacts!.map((person) => (
                      <Pressable
                        key={person.id}
                        onPress={() => navigation.navigate('ContactDetail', { id: person.id })}
                        className="flex-row items-center p-3"
                        accessibilityRole="button"
                      >
                        <Avatar name={person.full_name} size="sm" />
                        <View className="ml-3 flex-1">
                          <View className="flex-row items-center">
                            <Text className="text-sm font-semibold text-ink-900">{person.full_name}</Text>
                            {person.is_primary ? (
                              <Badge className="ml-2" bgClassName="bg-brand-50" textClassName="text-brand-700">Primary</Badge>
                            ) : null}
                          </View>
                          {person.role_title || person.email ? (
                            <Text className="mt-0.5 text-xs text-ink-500" numberOfLines={1}>
                              {person.role_title || person.email}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {/* Notes */}
            {c.notes ? (
              <>
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Notes</Text>
                <Card>
                  <View className="p-4">
                    <Text className="text-sm text-ink-700">{c.notes}</Text>
                  </View>
                </Card>
              </>
            ) : null}
          </MotiView>
        )}
      </ScrollView>

      {c ? (
        <CompanyForm
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={c}
        />
      ) : null}
    </Screen>
  );
}
