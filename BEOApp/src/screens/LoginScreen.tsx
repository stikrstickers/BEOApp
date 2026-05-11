import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { BASE_URL } from '../config';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const OAUTH_PROVIDERS: { id: 'google' | 'outlook' | 'github'; label: string; emoji: string }[] = [
  { id: 'google',  label: 'Continue with Google',  emoji: 'G' },
  { id: 'outlook', label: 'Continue with Outlook', emoji: 'O' },
  { id: 'github',  label: 'Continue with GitHub',  emoji: '◐' },
];

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter both your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const tryOAuth = async (provider: string) => {
    // OAuth providers aren't configured server-side yet; surface the helpful 501 message.
    try {
      const res  = await fetch(`${BASE_URL}/api/auth/oauth/${provider}/start/`);
      const json = await res.json();
      Alert.alert(`${provider} sign-in`, json.hint || json.error || 'Provider not configured');
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to manage events.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={submit}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Sign in</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} />
          </View>

          {OAUTH_PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.oauthBtn}
              onPress={() => tryOAuth(p.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.oauthEmoji}>{p.emoji}</Text>
              <Text style={styles.oauthText}>{p.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 24 }}>
            <Text style={styles.footerLink}>
              Don't have an account? <Text style={{ color: INDIGO, fontWeight: '700' }}>Create one</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.replace('Home')} style={{ marginTop: 12 }}>
            <Text style={[styles.footerLink, { color: GRAY }]}>Continue as client (no sign-in)</Text>
          </TouchableOpacity>

          <Text style={styles.apiHint} numberOfLines={1}>API: {BASE_URL}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 40, justifyContent: 'center' },

  title: { fontSize: 32, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  sub:   { fontSize: 14, color: GRAY, marginBottom: 28 },

  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1F2937',
  },

  primaryBtn: {
    backgroundColor: INDIGO,
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { paddingHorizontal: 12, color: GRAY, fontSize: 12, fontWeight: '700' },

  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  oauthEmoji: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
  oauthText:  { fontSize: 14, fontWeight: '600', color: '#374151' },

  footerLink: { textAlign: 'center', fontSize: 14, color: '#374151' },
  apiHint:    { textAlign: 'center', fontSize: 10, color: '#9CA3AF', marginTop: 18, fontFamily: 'Courier' },
});
