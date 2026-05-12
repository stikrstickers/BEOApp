import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building, Users, FileText, Settings, ChevronRight, LogOut, Sparkles,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/auth/AuthContext';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

interface NavItem {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export default function MoreScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();

  const items: NavItem[] = [
    {
      icon: <Building size={20} color="#6366F1" />,
      iconBg: 'bg-brand-50',
      title: 'Venues',
      subtitle: 'Sites you operate or book into',
      onPress: () => navigation.navigate('SitesHome'),
    },
    {
      icon: <Users size={20} color="#059669" />,
      iconBg: 'bg-success-500/10',
      title: 'Teammates',
      subtitle: 'Staff + temps you can schedule',
      onPress: () => navigation.navigate('TeammatesHome'),
    },
    {
      icon: <FileText size={20} color="#D97706" />,
      iconBg: 'bg-warning-500/10',
      title: 'Templates',
      subtitle: 'BEOs, guest emails, vendor notices',
      onPress: () => navigation.navigate('TemplatesHome'),
    },
    {
      icon: <Settings size={20} color="#475569" />,
      iconBg: 'bg-ink-200',
      title: 'Workspace',
      subtitle: 'Branding, billing, OAuth, settings',
      onPress: () => navigation.navigate('Workspace'),
    },
  ];

  return (
    <Screen scroll>
      <View className="mb-5">
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 18 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="mb-1 flex-row items-center">
                <Sparkles size={14} color="#FDE68A" />
                <Text className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  Workspace
                </Text>
              </View>
              <Text className="text-xl font-bold text-white">
                {user?.organization?.name ?? 'Settings'}
              </Text>
              <Text className="mt-0.5 text-xs text-white/85">
                {user?.email}
              </Text>
            </View>
            <Pressable
              onPress={signOut}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
              accessibilityRole="button" accessibilityLabel="Sign out"
            >
              <LogOut size={18} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <View className="gap-y-2">
        {items.map((item, i) => (
          <MotiView
            key={item.title}
            from={{ opacity: 0, translateX: -8 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 220, delay: i * 40 }}
          >
            <Card onPress={item.onPress} accessibilityLabel={item.title}>
              <View className="flex-row items-center p-4">
                <View
                  className={`mr-3 h-10 w-10 items-center justify-center rounded-2xl ${item.iconBg}`}
                >
                  {item.icon}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink-900">{item.title}</Text>
                  <Text className="mt-0.5 text-xs text-ink-500">{item.subtitle}</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </View>
            </Card>
          </MotiView>
        ))}
      </View>
    </Screen>
  );
}
