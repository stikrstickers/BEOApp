import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PDFViewer'>;
  route: RouteProp<RootStackParamList, 'PDFViewer'>;
};

/**
 * Build a viewer URL that works in Expo Go (no native PDF renderer needed).
 *
 * - On device: local `file://` URIs can't be loaded by Google Docs viewer, so
 *   we embed the PDF via an inline <iframe> pointing at the local URI — this
 *   works on iOS WebView. On Android we use the Google Docs viewer with the
 *   local path encoded, which works when the file is in the app cache.
 * - For http/https URIs: Google Docs viewer works on both platforms.
 */
function buildViewerUrl(uri: string): string {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(uri)}`;
  }
  // Local file — use inline HTML with an <iframe> (iOS) or object tag (Android)
  return uri; // WebView handles file:// URIs directly on device
}

/** Minimal HTML page that embeds the PDF via an <object> tag. */
function buildLocalHtml(uri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1A1A2E; }
    object, iframe { width: 100vw; height: 100vh; border: none; }
  </style>
</head>
<body>
  <object data="${uri}" type="application/pdf">
    <iframe src="${uri}">
      <p style="color:#fff;padding:20px;">
        PDF preview not available in this WebView. Tap "Mobile View" to read the content.
      </p>
    </iframe>
  </object>
</body>
</html>`;
}

export default function PDFViewerScreen({ navigation, route }: Props) {
  const { uri, name } = route.params;
  const [loading, setLoading] = useState(true);

  const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
  const viewerUrl = isRemote ? buildViewerUrl(uri) : undefined;
  const localHtml = !isRemote ? buildLocalHtml(uri) : undefined;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* PDF via WebView */}
      <WebView
        style={styles.webview}
        source={viewerUrl ? { uri: viewerUrl } : { html: localHtml! }}
        originWhitelist={['*']}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          console.error('WebView error:', e.nativeEvent);
          setLoading(false);
        }}
        startInLoadingState={false}
      />

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading PDF…</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.transformBtn}
          onPress={() => navigation.navigate('SheetView', { uri, name, totalPages: 0 })}
        >
          <Text style={styles.transformBtnText}>✨  Mobile View</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213E',
  },
  backBtn: { width: 60 },
  backText: { color: '#A5B4FC', fontSize: 15, fontWeight: '600' },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: '#A5B4FC', marginTop: 12, fontSize: 15 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#16213E',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  transformBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  transformBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
