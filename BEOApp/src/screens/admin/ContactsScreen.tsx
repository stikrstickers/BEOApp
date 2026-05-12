import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MotiView } from 'moti';
import {
  ChevronRight, Mail, Phone, Building2, Users as UsersIcon,
  UserPlus, Truck,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataList, DataRow, trashBulkAction } from '@/components/ui/DataList';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToast } from '@/components/ui/Toast';
import { CompanyForm } from '@/components/forms/CompanyForm';
import { ContactForm } from '@/components/forms/ContactForm';
import { api, ApiError } from '@/lib/api';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { Company, Contact } from '@/lib/types';
import type { ContactsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactsHome'>;
type Segment = 'companies' | 'individuals' | 'vendors';

export default function ContactsScreen({ navigation }: Props) {
  const [seg, setSeg] = useState<Segment>('companies');
  const [search, setSearch] = useState('');
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  // Three queries kept in cache so flipping tabs is instant after first load.
  const companiesQ = useQuery<{ companies: Company[] }>({
    queryKey: ['companies', 'client'],
    queryFn:  () => api('/api/companies/?kind=client'),
  });
  const vendorsQ = useQuery<{ companies: Company[] }>({
    queryKey: ['companies', 'vendor'],
    queryFn:  () => api('/api/companies/?kind=vendor'),
  });
  const contactsQ = useQuery<{ contacts: Contact[] }>({
    queryKey: ['contacts', search],
    queryFn:  () => api(`/api/contacts/${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  });

  const counts = {
    companies:   companiesQ.data?.companies?.length ?? 0,
    individuals: contactsQ.data?.contacts?.length ?? 0,
    vendors:     vendorsQ.data?.companies?.length ?? 0,
  };

  const items: Array<Company | Contact> = useMemo(() => {
    if (seg === 'companies') return companiesQ.data?.companies ?? [];
    if (seg === 'vendors')   return vendorsQ.data?.companies ?? [];
    return contactsQ.data?.contacts ?? [];
  }, [seg, companiesQ.data, vendorsQ.data, contactsQ.data]);

  const filtered = useMemo(() => {
    if (seg === 'individuals') return items;  // server-side search
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return (items as Company[]).filter((c) => c.name.toLowerCase().includes(q));
  }, [items, search, seg]);

  const deleteCompanyM = useMutation<void, ApiError, number[]>({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api(`/api/companies/${id}/`, { method: 'DELETE' })));
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e) => toast.error('Could not delete', e.message),
  });

  const deleteContactM = useMutation<void, ApiError, number[]>({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api(`/api/contacts/${id}/`, { method: 'DELETE' })));
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (e) => toast.error('Could not delete', e.message),
  });

  const onAdd = () => {
    if (seg === 'individuals') setContactFormOpen(true);
    else setCompanyFormOpen(true);
  };

  const refresh = () => {
    if (seg === 'individuals') contactsQ.refetch();
    else if (seg === 'vendors') vendorsQ.refetch();
    else companiesQ.refetch();
  };
  const isRefetching =
    seg === 'individuals' ? contactsQ.isRefetching
    : seg === 'vendors'   ? vendorsQ.isRefetching
                           : companiesQ.isRefetching;

  const header = (
    <View className="px-5 pt-2 pb-3">
      <Text className="text-2xl font-bold text-ink-900">Contacts</Text>
      <Text className="mt-0.5 text-sm text-ink-500">
        {seg === 'individuals' ? 'People' : seg === 'vendors' ? 'Third-party vendors' : 'Client organizations'}
      </Text>

      <SegmentedControl<Segment>
        className="mt-4"
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'companies',   label: 'Companies',   badge: counts.companies },
          { value: 'individuals', label: 'Individuals', badge: counts.individuals },
          { value: 'vendors',     label: 'Vendors',     badge: counts.vendors },
        ]}
      />

      <SearchBar
        containerClassName="mt-3"
        value={search}
        onChangeText={setSearch}
        placeholder={seg === 'individuals' ? 'Search by name or email…' : 'Search by name…'}
      />
    </View>
  );

  return (
    <Screen contentClassName="px-0 py-0">
      <DataList
        data={filtered as Array<Company | Contact>}
        ListHeaderComponent={header}
        refreshing={isRefetching}
        onRefresh={refresh}
        bulkActions={seg === 'individuals'
          ? [trashBulkAction((ids) => deleteContactM.mutate(ids))]
          : [trashBulkAction((ids) => deleteCompanyM.mutate(ids))]}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={(item, { selectionMode, selected, toggleSelected, enterSelection }) => {
          if (seg === 'individuals') {
            const c = item as Contact;
            return (
              <View className="px-5">
                <DataRow
                  selectable={selectionMode}
                  selected={selected}
                  onPress={() =>
                    selectionMode
                      ? toggleSelected()
                      : navigation.navigate('ContactDetail', { id: c.id })
                  }
                  onLongPress={() => { enterSelection(); toggleSelected(); }}
                  leading={<Avatar name={c.full_name} size="md" />}
                  title={c.full_name}
                  subtitle={c.email || c.phone || c.title || '—'}
                  trailing={
                    c.companies && c.companies.length > 0
                      ? <Badge bgClassName="bg-ink-100" textClassName="text-ink-700">{c.companies.length} co.</Badge>
                      : <ChevronRight size={16} color="#94A3B8" />
                  }
                />
              </View>
            );
          }
          const c = item as Company;
          return (
            <View className="px-5">
              <DataRow
                selectable={selectionMode}
                selected={selected}
                onPress={() =>
                  selectionMode
                    ? toggleSelected()
                    : navigation.navigate('CompanyDetail', { id: c.id })
                }
                onLongPress={() => { enterSelection(); toggleSelected(); }}
                leading={
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-brand-50">
                    {c.kind === 'vendor'
                      ? <Truck size={18} color="#6366F1" />
                      : <Building2 size={18} color="#6366F1" />}
                  </View>
                }
                title={c.name}
                subtitle={c.industry || c.billing_email || c.phone || '—'}
                trailing={<ChevronRight size={16} color="#94A3B8" />}
              />
            </View>
          );
        }}
        ItemSeparator={<View className="h-px bg-ink-100 mx-8" />}
        emptyState={
          <EmptyState
            icon={
              seg === 'individuals' ? <UsersIcon size={24} color="#6366F1" />
              : seg === 'vendors'   ? <Truck size={24} color="#6366F1" />
                                     : <Building2 size={24} color="#6366F1" />
            }
            title={`No ${seg === 'individuals' ? 'individuals' : seg === 'vendors' ? 'vendors' : 'companies'} yet`}
            description="Tap + to add your first one"
          />
        }
      />
      <FAB onPress={onAdd} label={`New ${seg === 'individuals' ? 'contact' : seg === 'vendors' ? 'vendor' : 'company'}`} />
      <CompanyForm
        open={companyFormOpen}
        onClose={() => setCompanyFormOpen(false)}
        presetKind={seg === 'vendors' ? 'vendor' : 'client'}
      />
      <ContactForm
        open={contactFormOpen}
        onClose={() => setContactFormOpen(false)}
      />
    </Screen>
  );
}
