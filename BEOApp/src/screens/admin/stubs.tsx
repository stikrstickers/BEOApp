// Lightweight placeholder screens for routes we've wired but haven't fully
// built yet. Each shows a polished empty-state so the navigator is
// navigable end-to-end — saves us shipping broken links.

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Construction } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import type {
  ContactsStackParamList, MoreStackParamList, CalendarStackParamList,
} from '../../navigation/types';

function StubScreen({
  navigation, title, description,
}: {
  navigation: { goBack: () => void };
  title: string;
  description: string;
}) {
  return (
    <Screen>
      <View className="flex-row items-center mb-2">
        <Pressable
          onPress={navigation.goBack}
          hitSlop={12} className="-ml-2 p-2"
          accessibilityRole="button" accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color="#334155" />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center">
        <EmptyState
          icon={<Construction size={28} color="#D97706" />}
          title={title}
          description={description}
          action={
            <Button variant="ghost" onPress={navigation.goBack}>
              Go back
            </Button>
          }
        />
      </View>
    </Screen>
  );
}

export function ContactDetailScreen({ navigation }: NativeStackScreenProps<ContactsStackParamList, 'ContactDetail'>) {
  return (
    <StubScreen
      navigation={navigation}
      title="Contact detail coming next"
      description="We'll surface companies, events submitted, communications history, and tags here"
    />
  );
}

export function CompanyDetailScreen({ navigation }: NativeStackScreenProps<ContactsStackParamList, 'CompanyDetail'>) {
  return (
    <StubScreen
      navigation={navigation}
      title="Company detail coming next"
      description="Linked contacts, events booked, billing info, vendor services will live here"
    />
  );
}

export function EventDetailScreen({ navigation }: NativeStackScreenProps<CalendarStackParamList, 'EventDetail'>) {
  return (
    <StubScreen
      navigation={navigation}
      title="Event detail coming next"
      description="Full event timeline, assignments, BEO export, and status changes will live here"
    />
  );
}

export function TemplateEditorScreen({ navigation }: NativeStackScreenProps<MoreStackParamList, 'TemplateEditor'>) {
  return (
    <StubScreen
      navigation={navigation}
      title="Template editor coming next"
      description="Markdown body with {{token}} autocomplete, channel/kind picker, and live preview"
    />
  );
}

export function WorkspaceScreen({ navigation }: NativeStackScreenProps<MoreStackParamList, 'Workspace'>) {
  return (
    <StubScreen
      navigation={navigation}
      title="Workspace settings coming next"
      description="Brand color, logo upload, OAuth providers, member invitations, billing"
    />
  );
}
