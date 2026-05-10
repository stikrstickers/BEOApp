import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SheetView'>;
  route: RouteProp<RootStackParamList, 'SheetView'>;
};

import { BASE_URL as API_BASE } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BeoHeader {
  beo_date: string;
  time: string;
  event_name: string;
  event_date: string;
  requestor: string;
  send_invoice_to: string;
  location: string;
  fund_number: string;
  beo_id: string;
  beo_number: string;
  headcount: string;
  vendor: string;
  event_type?: string;
  leftovers_to?: string;
  pickup_time?: string;
  dishes?: string;
}

interface ContentSection {
  section: string;
  items: string[];
}

interface BeoData {
  page: number;
  beo_type: 'catering' | 'floorplan' | 'loadlist' | 'unknown';
  header: BeoHeader;
  notes: string[];
  content: ContentSection[];
  coordinator: string;
  assigned_to: string;
  created: string;
  printed: string;
}

// ─── Colour palette per BEO type ─────────────────────────────────────────────
const TYPE_COLORS = {
  catering:  { accent: '#2D7DD2', badge: '#EAF3FB', badgeText: '#2D7DD2', icon: '🍽' },
  floorplan: { accent: '#3BB273', badge: '#E8F7F0', badgeText: '#3BB273', icon: '🗺' },
  loadlist:  { accent: '#E87040', badge: '#FDF0EA', badgeText: '#E87040', icon: '📋' },
  unknown:   { accent: '#888',    badge: '#F0F0F0', badgeText: '#888',    icon: '📄' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: BeoData['beo_type'] }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.unknown;
  const label = type === 'loadlist' ? 'Loadlist / NN' : type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <View style={[styles.badge, { backgroundColor: c.badge }]}>
      <Text style={[styles.badgeText, { color: c.badgeText }]}>{c.icon}  {label}</Text>
    </View>
  );
}

function HeaderCard({ header, coordinator }: { header: BeoHeader; coordinator: string }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Event',       value: header.event_name },
    { label: 'Event Date',  value: header.event_date },
    { label: 'BEO Date',    value: header.beo_date },
    { label: 'Time',        value: header.time },
    { label: 'Location',    value: header.location },
    { label: 'Headcount',   value: header.headcount },
    { label: 'Requestor',   value: header.requestor },
    { label: 'Invoice To',  value: header.send_invoice_to },
    { label: 'Vendor',      value: header.vendor },
    { label: 'Fund #',      value: header.fund_number },
    { label: 'BEO ID',      value: header.beo_id },
    { label: 'BEO #',       value: header.beo_number },
    { label: 'Coordinator', value: coordinator },
    { label: 'Leftovers',   value: header.leftovers_to || '' },
    { label: 'Pickup',      value: header.pickup_time || '' },
    { label: 'Dishes',      value: header.dishes || '' },
  ].filter(r => r.value && r.value.trim());

  return (
    <View style={styles.headerCard}>
      {rows.map(r => (
        <View key={r.label} style={styles.headerRow}>
          <Text style={styles.headerLabel}>{r.label}</Text>
          <Text style={styles.headerValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionBlock({ section, accentColor }: { section: ContentSection; accentColor: string }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={[styles.sectionHeader, { borderLeftColor: accentColor }]}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{section.section}</Text>
      </View>
      {section.items.map((item, idx) => {
        // Detect room headers for loadlist (lines without bullet chars, title-like)
        const isRoomHeader = /^[A-Z][a-z].*--/.test(item) || /^[A-Z][a-z].*study/i.test(item);
        // Normalize bullet chars OCR mangles (¢ © * ® →  •)
        const text = item.replace(/^[¢©*®\-]\s*/, '• ').replace(/^e\s+/, '• ');
        return (
          <View key={idx} style={isRoomHeader ? styles.roomHeader : styles.itemRow}>
            <Text style={isRoomHeader ? styles.roomHeaderText : styles.itemText}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function NotesBlock({ notes, accentColor }: { notes: string[]; accentColor: string }) {
  if (!notes.length) return null;
  return (
    <View style={styles.notesBlock}>
      <View style={[styles.sectionHeader, { borderLeftColor: accentColor }]}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>Event Ops Notes</Text>
      </View>
      {notes.map((line, idx) => {
        const isRoomHeader = /^[A-Z][a-z].*--/.test(line) || /study\s*--/i.test(line);
        const text = line.replace(/^[¢©*®]\s*/, '• ').replace(/^e\s+/, '• ');
        return (
          <View key={idx} style={isRoomHeader ? styles.roomHeader : styles.noteRow}>
            <Text style={isRoomHeader ? styles.roomHeaderText : styles.noteText}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function BeoCard({ beo }: { beo: BeoData }) {
  const colors = TYPE_COLORS[beo.beo_type] || TYPE_COLORS.unknown;
  return (
    <View style={[styles.beoCard, { borderTopColor: colors.accent }]}>
      <TypeBadge type={beo.beo_type} />
      <HeaderCard header={beo.header} coordinator={beo.coordinator} />
      {/* Catering & Loadlist: notes box ABOVE content */}
      {beo.beo_type !== 'floorplan' && (
        <NotesBlock notes={beo.notes} accentColor={colors.accent} />
      )}
      {beo.content.map((sec, i) => (
        <SectionBlock key={i} section={sec} accentColor={colors.accent} />
      ))}
      {/* Floorplan: no separate notes box — all in ROOM CONFIGURATION */}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SheetViewScreen({ navigation, route }: Props) {
  const { uri, name } = route.params;
  const [beos, setBeos] = useState<BeoData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-parse as soon as the screen mounts
  useEffect(() => {
    parseDocument();
  }, [uri]);

  const parseDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: name.endsWith('.pdf') ? name : `${name}.pdf`,
        type: 'application/pdf',
      } as any);

      const response = await fetch(`${API_BASE}/api/parse-pdf/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error ${response.status}: ${text.slice(0, 200)}`);
      }

      const json = await response.json();
      if (json.error) throw new Error(json.error);
      setBeos(json.beos || []);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{name}</Text>
        <TouchableOpacity onPress={parseDocument} style={styles.refreshBtn} disabled={loading}>
          <Text style={[styles.refreshIcon, loading && { opacity: 0.3 }]}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#2D7DD2" />
          <Text style={styles.loadingText}>Reading PDF…</Text>
          <Text style={styles.loadingSubtext}>This may take 15–30 s for image-based PDFs</Text>
        </View>
      )}

      {/* Error */}
      {error && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Failed to parse</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.parseBtn} onPress={parseDocument}>
            <Text style={styles.parseBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {beos && !loading && (
        <>
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              {beos.length} BEO{beos.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <FlatList
            data={beos}
            keyExtractor={(item) => `beo-${item.page}`}
            renderItem={({ item }) => <BeoCard beo={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 60 },
  backText: { color: '#2D7DD2', fontSize: 17 },
  topTitle: { flex: 1, textAlign: 'center', fontWeight: '600', fontSize: 15, color: '#111' },

  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryText: { fontSize: 13, color: '#555', fontWeight: '500' },
  reParseText: { fontSize: 13, color: '#2D7DD2', fontWeight: '500' },
  refreshBtn: { width: 44, alignItems: 'flex-end' },
  refreshIcon: { fontSize: 22, color: '#2D7DD2', fontWeight: '600' },

  listContent: { padding: 12, gap: 12 },

  // BEO card
  beoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontWeight: '700', fontSize: 13 },

  // Header card
  headerCard: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  headerLabel: {
    width: 90,
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerValue: { flex: 1, fontSize: 13, color: '#222', fontWeight: '500' },

  // Section blocks
  sectionBlock: { marginHorizontal: 12, marginBottom: 8 },
  notesBlock:   { marginHorizontal: 12, marginBottom: 8 },

  sectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
  },
  sectionTitle: { fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },

  itemRow: { paddingVertical: 3, paddingLeft: 4 },
  itemText: { fontSize: 14, color: '#333', lineHeight: 20 },

  noteRow: { paddingVertical: 3, paddingLeft: 4 },
  noteText: { fontSize: 14, color: '#444', lineHeight: 20 },

  roomHeader: {
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  roomHeaderText: { fontSize: 13, fontWeight: '700', color: '#222' },

  // Empty / loading / error states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  parseBtn: {
    backgroundColor: '#2D7DD2',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  parseBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  loadingText: { marginTop: 20, fontSize: 16, fontWeight: '600', color: '#333' },
  loadingSubtext: { marginTop: 6, fontSize: 13, color: '#777' },

  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#D32F2F', marginBottom: 8 },
  errorMsg: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 19, marginBottom: 24 },
});
