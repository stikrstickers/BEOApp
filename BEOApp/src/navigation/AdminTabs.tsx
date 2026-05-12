// Bottom-tab navigator for the planner admin. 5 tabs: Calendar, Events,
// Contacts, Inventory, More. Each tab is its own native stack so back
// history is per-tab.

import React from 'react';
import { Platform, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Calendar, Inbox, Contact as ContactIcon, Package, Menu } from 'lucide-react-native';

import CalendarScreen from '@/screens/admin/CalendarScreen';
import ContactsScreen from '@/screens/admin/ContactsScreen';
import InventoryScreen from '@/screens/admin/InventoryScreen';
import MoreScreen from '@/screens/admin/MoreScreen';
import SitesScreen from '@/screens/admin/SitesScreen';
import SiteDetailScreen from '@/screens/admin/SiteDetailScreen';
import TeammatesScreen from '@/screens/admin/TeammatesScreen';
import TemplatesScreen from '@/screens/admin/TemplatesScreen';
import {
  ContactDetailScreen, CompanyDetailScreen, EventDetailScreen,
  TemplateEditorScreen, WorkspaceScreen,
} from '@/screens/admin/stubs';

import OrganizerDashboardScreen from '@/screens/OrganizerDashboardScreen';
import EventRequestDetailScreen from '@/screens/EventRequestDetailScreen';

import type {
  AdminTabParamList, CalendarStackParamList, EventsStackParamList,
  ContactsStackParamList, InventoryStackParamList, MoreStackParamList,
} from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();

// Per-tab stacks. Each gets its own typed Stack instance.

const CalStack    = createNativeStackNavigator<CalendarStackParamList>();
const EvtStack    = createNativeStackNavigator<EventsStackParamList>();
const ContStack   = createNativeStackNavigator<ContactsStackParamList>();
const InvStack    = createNativeStackNavigator<InventoryStackParamList>();
const MoreStack   = createNativeStackNavigator<MoreStackParamList>();

function CalendarStackNav() {
  return (
    <CalStack.Navigator screenOptions={{ headerShown: false }}>
      <CalStack.Screen name="Calendar"    component={CalendarScreen} />
      <CalStack.Screen name="EventDetail" component={EventDetailScreen} />
    </CalStack.Navigator>
  );
}

function EventsStackNav() {
  return (
    <EvtStack.Navigator screenOptions={{ headerShown: false }}>
      <EvtStack.Screen name="EventsHome"          component={OrganizerDashboardScreen} />
      <EvtStack.Screen name="EventRequestDetail"  component={EventRequestDetailScreen} />
      <EvtStack.Screen name="Calendar"            component={CalendarScreen} />
      <EvtStack.Screen name="EventDetail"         component={EventDetailScreen} />
    </EvtStack.Navigator>
  );
}

function ContactsStackNav() {
  return (
    <ContStack.Navigator screenOptions={{ headerShown: false }}>
      <ContStack.Screen name="ContactsHome"  component={ContactsScreen} />
      <ContStack.Screen name="ContactDetail" component={ContactDetailScreen} />
      <ContStack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
    </ContStack.Navigator>
  );
}

function InventoryStackNav() {
  return (
    <InvStack.Navigator screenOptions={{ headerShown: false }}>
      <InvStack.Screen name="InventoryHome" component={InventoryScreen} />
    </InvStack.Navigator>
  );
}

function MoreStackNav() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome"       component={MoreScreen} />
      <MoreStack.Screen name="SitesHome"      component={SitesScreen} />
      <MoreStack.Screen name="SiteDetail"     component={SiteDetailScreen} />
      <MoreStack.Screen name="TeammatesHome"  component={TeammatesScreen} />
      <MoreStack.Screen name="TemplatesHome"  component={TemplatesScreen} />
      <MoreStack.Screen name="TemplateEditor" component={TemplateEditorScreen} />
      <MoreStack.Screen name="Workspace"      component={WorkspaceScreen} />
    </MoreStack.Navigator>
  );
}

function TabLabel({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <Text
      className={focused ? 'text-[10px] font-bold text-brand-600' : 'text-[10px] font-medium text-ink-500'}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

export default function AdminTabs() {
  const iconColor = (focused: boolean) => (focused ? '#6366F1' : '#94A3B8');

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarActiveTintColor:   '#6366F1',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tab.Screen
        name="CalendarTab"
        component={CalendarStackNav}
        options={{
          title: 'Calendar',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>Calendar</TabLabel>,
          tabBarIcon: ({ focused }) => <Calendar size={22} color={iconColor(focused)} />,
        }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventsStackNav}
        options={{
          title: 'Events',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>Events</TabLabel>,
          tabBarIcon: ({ focused }) => <Inbox size={22} color={iconColor(focused)} />,
        }}
      />
      <Tab.Screen
        name="ContactsTab"
        component={ContactsStackNav}
        options={{
          title: 'Contacts',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>Contacts</TabLabel>,
          tabBarIcon: ({ focused }) => <ContactIcon size={22} color={iconColor(focused)} />,
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStackNav}
        options={{
          title: 'Inventory',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>Inventory</TabLabel>,
          tabBarIcon: ({ focused }) => <Package size={22} color={iconColor(focused)} />,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNav}
        options={{
          title: 'More',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>More</TabLabel>,
          tabBarIcon: ({ focused }) => <Menu size={22} color={iconColor(focused)} />,
        }}
      />
    </Tab.Navigator>
  );
}
