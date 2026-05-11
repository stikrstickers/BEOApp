import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';

const INDIGO = '#4F46E5';
const GRAY   = '#6B7280';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Email and password are required.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await signUp(email.trim(), password, name.trim());
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
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
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.sub}>Organizers sign up here to manage event requests.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor="#9CA3AF"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password} onChangeText={setPassword}
              placeholder="At least 8 characters" placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={submit}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create account</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  back:  { color: INDIGO, fontSize: 16, fontWeight: '600', marginBottom: 24 },

  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  sub:   { fontSize: 14, color: GRAY, marginBottom: 24 },

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
});
