import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { BEOWeek } from '../types';

import { BASE_URL } from '../config';
const INDIGO   = '#4F46E5';
const GRAY     = '#6B7280';
const COFFEE   = '#92400E';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = new Date(d);
  const dow = day.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  day.setDate(day.getDate() + diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function makeWeekLabel(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
}

function getThreeWeeks(): { weekStart: string; label: string }[] {
  const mon = getMondayOf(new Date());
  return [-1, 0, 1].map((offset) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + offset * 7);
    return { weekStart: toISODate(d), label: makeWeekLabel(d) };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props) {
  const [weeks, setWeeks]       = useState<BEOWeek[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const threeWeeks = getThreeWeeks();

  const loadWeeks = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/weeks/`);
      const json = await res.json();
      setWeeks(json.weeks ?? []);
    } catch (_) {
      // server may not be up yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWeeks(); }, [loadWeeks]);

  const uploadForWeek = async (weekStart: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || result.assets.length === 0) return;

      setUploading(weekStart);
      const form = new FormData();
      form.append('week_start', weekStart);
      result.assets.forEach((asset, idx) => {
        form.append(`file${idx}`, {
          uri:  asset.uri,
          name: asset.name ?? `beo_${idx}.pdf`,
          type: 'application/pdf',
        } as any);
      });

      const res = await fetch(`${BASE_URL}/api/weeks/`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      await loadWeeks();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Unknown error');
    } finally {
      setUploading(null);
    }
  };

  const deleteFile = (weekId: number, fileId: number, fileName: string) => {
    Alert.alert('Remove file', `Remove "${fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BASE_URL}/api/weeks/${weekId}/files/${fileId}/`, { method: 'DELETE' });
            await loadWeeks();
          } catch (e: any) {
            Alert.alert('Error', e?.message);
          }
        },
      },
    ]);
  };

  const goTo = (screen: 'RunOfShow' | 'Coffee' | 'BinList', week: BEOWeek) => {
    navigation.navigate(screen, { weekId: week.id, weekLabel: week.label });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BEO App</Text>
        <Text style={styles.subtitle}>Upload PDFs by week</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={INDIGO} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.eventEntryRow}>
            <TouchableOpacity
              style={[styles.eventEntryCard, styles.eventEntryClient]}
              onPress={() => navigation.navigate('ClientEventRequest')}
              activeOpacity={0.85}
            >
              <Text style={styles.eventEntryIcon}>📝</Text>
              <Text style={styles.eventEntryTitle}>Request an Event</Text>
              <Text style={styles.eventEntrySub}>Client form</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.eventEntryCard, styles.eventEntryOrganizer]}
              onPress={() => navigation.navigate('OrganizerDashboard')}
              activeOpacity={0.85}
            >
              <Text style={styles.eventEntryIcon}>🗂</Text>
              <Text style={[styles.eventEntryTitle, { color: '#FFF' }]}>Event Requests</Text>
              <Text style={[styles.eventEntrySub, { color: 'rgba(255,255,255,0.85)' }]}>Organizer view</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.opsRow}>
            <TouchableOpacity style={styles.opsTile} onPress={() => navigation.navigate('Inventory')}  activeOpacity={0.85}>
              <Text style={styles.opsIcon}>📦</Text>
              <Text style={styles.opsLabel}>Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.opsTile} onPress={() => navigation.navigate('TeamRoster')} activeOpacity={0.85}>
              <Text style={styles.opsIcon}>👥</Text>
              <Text style={styles.opsLabel}>Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.opsTile} onPress={() => navigation.navigate('Workflows')}  activeOpacity={0.85}>
              <Text style={styles.opsIcon}>⚙️</Text>
              <Text style={styles.opsLabel}>Workflows</Text>
            </TouchableOpacity>
          </View>

          {threeWeeks.map(({ weekStart, label }, slotIdx) => {
            const stored      = weeks.find((w) => w.week_start === weekStart);
            const isUploading = uploading === weekStart;
            const slotLabels  = ['Previous Week', 'This Week', 'Next Week'];
            const isCurrent   = slotIdx === 1;

            return (
              <View key={weekStart} style={[styles.weekCard, isCurrent && styles.weekCardCurrent]}>

                {/* Header row */}
                <View style={styles.weekHeaderRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.slotLabel, isCurrent && styles.slotLabelCurrent]}>
                      {slotLabels[slotIdx]}
                    </Text>
                    <Text style={styles.weekRange}>{label}</Text>
                    {stored && (
                      <Text style={styles.fileCount}>
                        {stored.file_count} PDF{stored.file_count !== 1 ? 's' : ''} uploaded
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.uploadBtn, isUploading && { opacity: 0.6 }]}
                    onPress={() => uploadForWeek(weekStart)}
                    disabled={isUploading}
                    activeOpacity={0.8}
                  >
                    {isUploading
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={styles.uploadBtnText}>＋ PDFs</Text>
                    }
                  </TouchableOpacity>
                </View>

                {/* File chips */}
                {stored && stored.files.length > 0 ? (
                  <View style={styles.fileList}>
                    {stored.files.map((f) => (
                      <View key={f.id} style={styles.fileRow}>
                        <Text style={styles.fileIcon}>📄</Text>
                        <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                        <TouchableOpacity
                          onPress={() => deleteFile(stored.id, f.id, f.name)}
                          hitSlop={10}
                        >
                          <Text style={styles.fileDelete}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noFiles}>No PDFs yet — tap ＋ PDFs to add</Text>
                )}

                {/* Action buttons */}
                {stored && stored.file_count > 0 && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.rosBtn}
                      onPress={() => goTo('RunOfShow', stored)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.rosBtnTxt}>📋  Run of Show</Text>
                    </TouchableOpacity>
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.coffeeBtn}
                        onPress={() => goTo('Coffee', stored)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.coffeeBtnTxt}>☕  Coffee</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.binBtn}
                        onPress={() => goTo('BinList', stored)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.binBtnTxt}>🗂  Bin List</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  title:    { fontSize: 32, fontWeight: '800', color: '#1A1A2E', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 4 },
  scroll:   { paddingHorizontal: 16, paddingTop: 8 },

  // Week card
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  weekCardCurrent: {
    borderColor: INDIGO,
    shadowColor: INDIGO,
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  slotLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: GRAY,
    marginBottom: 2,
  },
  slotLabelCurrent: { color: INDIGO },
  weekRange:  { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  fileCount:  { fontSize: 12, color: GRAY, marginTop: 2 },
  uploadBtn: {
    backgroundColor: INDIGO,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Files
  fileList: { gap: 6, marginBottom: 14 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  fileIcon:   { fontSize: 14 },
  fileName:   { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  fileDelete: { fontSize: 14, color: '#D1D5DB', fontWeight: '600', paddingLeft: 4 },
  noFiles:    { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 },

  // Action buttons
  actions: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginTop: 2,
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  rosBtn: {
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  rosBtnTxt:  { color: '#FFF', fontSize: 14, fontWeight: '700' },
  coffeeBtn: {
    flex: 1,
    backgroundColor: COFFEE,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  coffeeBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  binBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: INDIGO,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  binBtnTxt: { color: INDIGO, fontSize: 14, fontWeight: '700' },

  // Event-request entry cards
  eventEntryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  eventEntryCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 96,
    justifyContent: 'space-between',
    borderWidth: 1.5,
  },
  eventEntryClient: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  eventEntryOrganizer: {
    backgroundColor: INDIGO,
    borderColor: INDIGO,
  },
  eventEntryIcon: { fontSize: 24 },
  eventEntryTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 6 },
  eventEntrySub:   { fontSize: 11, color: GRAY, marginTop: 2 },

  // Ops tools row
  opsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  opsTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  opsIcon: { fontSize: 22, marginBottom: 4 },
  opsLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
});

