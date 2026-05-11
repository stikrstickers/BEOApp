import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../auth/api';
import { EventRequest, RequestStatus } from '../types';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OrganizerDashboard'>;
};

const STATUS_TABS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'new',       label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined',  label: 'Declined' },
  { value: 'completed', label: 'Done' },
];

const STATUS_COLOR: Record<RequestStatus, { bg: string; fg: string }> = {
  new:       { bg: '#EEF2FF', fg: INDIGO },
  in_review: { bg: '#FEF3C7', fg: '#92400E' },
  confirmed: { bg: '#D1FAE5', fg: '#065F46' },
  declined:  { bg: '#FEE2E2', fg: '#991B1B' },
  completed: { bg: '#E5E7EB', fg: '#374151' },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OrganizerDashboardScreen({ navigation }: Props) {
  const { token, user, signOut } = useAuth();
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<RequestStatus | 'all'>('all');

  // Bounce to login if no token — organizer dashboard is auth-only.
  useEffect(() => {
    if (!token && !loading) {
      navigation.replace('Login');
    }
  }, [token, loading, navigation]);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const path = activeTab === 'all'
        ? '/api/event-requests/'
        : `/api/event-requests/?status=${activeTab}`;
      const json = await apiFetch<{ requests: EventRequest[] }>(path, { token });
      setRequests(json.requests ?? []);
    } catch (_) {
      // backend offline / unauthorized — show empty
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [activeTab, token]);

  useEffect(() => { load(); }, [load]);
  // Refresh whenever the screen regains focus (e.g. after returning from detail).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefresh(true); load(); };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          {user && (
            <TouchableOpacity onPress={signOut} hitSlop={10}>
              <Text style={styles.signOut}>Sign out</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.title}>Event Requests</Text>
        <Text style={styles.subtitle}>
          {user?.name ? `${user.name} · ` : ''}
          {requests.length} {activeTab === 'all' ? 'total' : activeTab.replace('_', ' ')}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        style={{ flexGrow: 0 }}
      >
        {STATUS_TABS.map((t) => {
          const active = t.value === activeTab;
          return (
            <TouchableOpacity
              key={t.value}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(t.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={INDIGO} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO} />}
        >
          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptyHint}>Client submissions appear here.</Text>
            </View>
          ) : (
            requests.map((r) => {
              const c = STATUS_COLOR[r.status];
              return (
                <TouchableOpacity
                  key={r.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('EventRequestDetail', { requestId: r.id })}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.eventName} numberOfLines={1}>{r.event_name}</Text>
                    <View style={[styles.badge, { backgroundColor: c.bg }]}>
                      <Text style={[styles.badgeText, { color: c.fg }]}>
                        {r.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.client}>
                    {r.client_name}{r.organization ? `  ·  ${r.organization}` : ''}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>📅 {formatDate(r.preferred_date)}</Text>
                    <Text style={styles.meta}>⏰ {r.start_time}–{r.end_time}</Text>
                    <Text style={styles.meta}>👥 {r.headcount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  signOut:   { color: GRAY, fontSize: 14, fontWeight: '600' },
  back:      { color: INDIGO, fontSize: 16, fontWeight: '600' },
  title:     { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  subtitle:  { fontSize: 14, color: GRAY, marginTop: 4, textTransform: 'capitalize' },

  tabRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  tabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tabTextActive: { color: '#FFFFFF' },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eventName: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  client: { fontSize: 13, color: GRAY, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#374151' },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyHint:  { fontSize: 13, color: GRAY },
});
