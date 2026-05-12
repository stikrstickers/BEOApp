import React, { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MotiView } from 'moti';
import {
  ArrowLeft, Mail, Phone, Briefcase, Building2, Pencil, Tag,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ContactForm } from '@/components/forms/ContactForm';
import { api } from '@/lib/api';
import type { Contact } from '@/lib/types';
import type { ContactsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactDetail'>;

export default function ContactDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [editOpen, setEditOpen] = useState(false);

  const q = useQuery<{ contact: Contact }>({
    queryKey: ['contact', id],
    queryFn:  () => api(`/api/contacts/${id}/`),
  });

  const c = q.data?.contact;

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
            <View className="items-center pt-2 pb-5">
              <Avatar name={c.full_name} size="lg" />
              <Text className="mt-3 text-2xl font-bold text-ink-900">{c.full_name}</Text>
              {c.title ? (
                <Text className="mt-1 text-sm text-ink-500">{c.title}</Text>
              ) : null}
            </View>

            {/* Tags */}
            {(c.tags?.length ?? 0) > 0 ? (
              <View className="mb-5 flex-row flex-wrap justify-center gap-1.5">
                {c.tags.map((t) => (
                  <View key={t} className="flex-row items-center rounded-full bg-brand-50 px-2.5 py-1">
                    <Tag size={10} color="#4338CA" />
                    <Text className="ml-1 text-xs font-semibold text-brand-700">{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Contact methods */}
            <Card>
              <View className="p-2">
                {c.email ? (
                  <Pressable
                    onPress={() => Linking.openURL(`mailto:${c.email}`)}
                    className="flex-row items-center p-3"
                    accessibilityRole="link" accessibilityLabel={`Email ${c.email}`}
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                      <Mail size={16} color="#6366F1" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Email</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{c.email}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {c.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${c.phone}`)}
                    className="flex-row items-center p-3"
                    accessibilityRole="link" accessibilityLabel={`Call ${c.phone}`}
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-success-500/10">
                      <Phone size={16} color="#059669" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-wide text-ink-500">Phone</Text>
                      <Text className="mt-0.5 text-sm font-medium text-ink-900">{c.phone}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            </Card>

            {/* Companies */}
            {(c.companies?.length ?? 0) > 0 ? (
              <>
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                  Companies
                </Text>
                <Card>
                  <View className="p-2">
                    {(c.companies ?? []).map((co) => (
                      <Pressable
                        key={co.company_id}
                        onPress={() => navigation.navigate('CompanyDetail', { id: co.company_id })}
                        className="flex-row items-center p-3"
                        accessibilityRole="button" accessibilityLabel={`Open ${co.company_name}`}
                      >
                        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-ink-100">
                          <Building2 size={16} color="#475569" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="text-sm font-semibold text-ink-900">{co.company_name}</Text>
                            {co.is_primary ? (
                              <Badge className="ml-2" bgClassName="bg-brand-50" textClassName="text-brand-700">
                                Primary
                              </Badge>
                            ) : null}
                          </View>
                          {co.role_title ? (
                            <View className="mt-0.5 flex-row items-center">
                              <Briefcase size={10} color="#94A3B8" />
                              <Text className="ml-1 text-xs text-ink-500">{co.role_title}</Text>
                            </View>
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
                <Text className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                  Notes
                </Text>
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
        <ContactForm
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={c}
        />
      ) : null}
    </Screen>
  );
}
