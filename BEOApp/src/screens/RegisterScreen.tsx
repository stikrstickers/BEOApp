import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User as UserIcon, Building2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/lib/types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  onPress: () => void;
}

function RoleCard({ icon, title, description, active, onPress }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={title}
      className="flex-1"
    >
      <MotiView
        animate={{ scale: active ? 1.02 : 1 }}
        transition={{ type: 'timing', duration: 150 }}
      >
        {active ? (
          <LinearGradient
            colors={['#A5B4FC', '#818CF8', '#F472B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 18, padding: 1.5 }}
          >
            <View className="rounded-2xl bg-white p-4">
              <View className="mb-2 h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                {icon}
              </View>
              <Text className="text-sm font-bold text-ink-900">{title}</Text>
              <Text className="mt-0.5 text-xs text-ink-500">{description}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View className="rounded-2xl border border-ink-200 bg-white p-4">
            <View className="mb-2 h-9 w-9 items-center justify-center rounded-xl bg-ink-100">
              {icon}
            </View>
            <Text className="text-sm font-bold text-ink-900">{title}</Text>
            <Text className="mt-0.5 text-xs text-ink-500">{description}</Text>
          </View>
        )}
      </MotiView>
    </Pressable>
  );
}

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const toast = useToast();

  const [role, setRole] = useState<UserRole>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim())                next.name = 'What should we call you?';
    if (!email || !email.includes('@')) next.email = 'Enter a valid email';
    if (password.length < 8)         next.password = 'At least 8 characters';
    if (role === 'planner' && !orgName.trim()) next.orgName = "Name your planner workspace";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await register({
        email:    email.trim().toLowerCase(),
        password,
        name:     name.trim(),
        role,
        org_name: role === 'planner' ? orgName.trim() : undefined,
      });
      toast.success(
        role === 'planner' ? 'Workspace created!' : 'Welcome aboard!',
        role === 'planner' ? `${orgName} is ready` : "Let's plan your event",
      );
    } catch (e: any) {
      toast.error('Sign up failed', e?.message ?? 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View className="mb-2 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            className="-ml-2 mr-2 p-2"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#334155" />
          </Pressable>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 350 }}
        >
          <Text className="text-3xl font-bold text-ink-900">Create your account</Text>
          <Text className="mt-1 text-base text-ink-500">Pick how you'll use the app</Text>
        </MotiView>

        <View className="mt-6 flex-row gap-x-3">
          <RoleCard
            icon={<Sparkles size={18} color="#6366F1" />}
            title="I'm a client"
            description="Submit event requests to planners"
            active={role === 'client'}
            onPress={() => setRole('client')}
          />
          <RoleCard
            icon={<Building2 size={18} color="#6366F1" />}
            title="I'm a planner"
            description="Manage events, team, inventory"
            active={role === 'planner'}
            onPress={() => setRole('planner')}
          />
        </View>

        <View className="mt-6 gap-y-4">
          <Input
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Alex Rivera"
            autoCapitalize="words"
            leftIcon={<UserIcon size={18} color="#64748B" />}
            error={errors.name}
          />
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
            placeholder="At least 8 characters"
            isPassword
            autoComplete="new-password"
            textContentType="newPassword"
            leftIcon={<Lock size={18} color="#64748B" />}
            error={errors.password}
          />

          <AnimatePresence>
            {role === 'planner' ? (
              <MotiView
                key="org-name"
                from={{ opacity: 0, translateY: -6, height: 0 }}
                animate={{ opacity: 1, translateY: 0, height: 'auto' }}
                exit={{ opacity: 0, translateY: -6, height: 0 }}
                transition={{ type: 'timing', duration: 220 }}
              >
                <Input
                  label="Workspace name"
                  value={orgName}
                  onChangeText={setOrgName}
                  placeholder="Rivera Events Co."
                  autoCapitalize="words"
                  leftIcon={<Building2 size={18} color="#64748B" />}
                  hint="This is what your clients will see"
                  error={errors.orgName}
                />
              </MotiView>
            ) : null}
          </AnimatePresence>

          <Button
            onPress={onSubmit}
            loading={submitting}
            fullWidth
            size="lg"
            iconRight={<ArrowRight size={18} color="#fff" />}
            accessibilityLabel="Create account"
            className="mt-2"
          >
            Create account
          </Button>
        </View>

        <View className="mt-8 flex-row items-center justify-center">
          <Text className="text-sm text-ink-500">Already have an account?  </Text>
          <Text
            onPress={() => navigation.navigate('Login')}
            className="text-sm font-semibold text-brand-600"
            accessibilityRole="link"
          >
            Sign in
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
