import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Sparkles, ArrowRight } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async () => {
    const next: typeof errors = {};
    if (!email || !email.includes('@')) next.email = 'Enter a valid email';
    if (password.length < 8)            next.password = 'At least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await signIn({ email: email.trim().toLowerCase(), password });
    } catch (e: any) {
      toast.error('Sign in failed', e?.message ?? 'Check your email and password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <MotiView
          from={{ opacity: 0, translateY: -12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          className="mb-8 items-center pt-6"
        >
          <LinearGradient
            colors={['#A5B4FC', '#818CF8', '#F472B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 18, padding: 1.5 }}
          >
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white">
              <Sparkles size={26} color="#6366F1" />
            </View>
          </LinearGradient>
          <Text className="mt-5 text-3xl font-bold text-ink-900">Welcome back</Text>
          <Text className="mt-1 text-base text-ink-500">Sign in to your workspace</Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
          className="gap-y-4"
        >
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            leftIcon={<Mail size={18} color="#64748B" />}
            error={errors.email}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            isPassword
            autoComplete="current-password"
            textContentType="password"
            leftIcon={<Lock size={18} color="#64748B" />}
            error={errors.password}
          />

          <Button
            onPress={onSubmit}
            loading={submitting}
            fullWidth
            size="lg"
            iconRight={<ArrowRight size={18} color="#fff" />}
            accessibilityLabel="Sign in"
            className="mt-2"
          >
            Sign in
          </Button>
        </MotiView>

        <View className="mt-8 flex-row items-center justify-center">
          <Text className="text-sm text-ink-500">New here?  </Text>
          <Text
            onPress={() => navigation.navigate('Register')}
            className="text-sm font-semibold text-brand-600"
            accessibilityRole="link"
          >
            Create an account
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
