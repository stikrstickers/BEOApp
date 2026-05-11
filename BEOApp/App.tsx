import './global.css';

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';

import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import ClientEventRequestScreen from '@/screens/ClientEventRequestScreen';
import OrganizerDashboardScreen from '@/screens/OrganizerDashboardScreen';
import EventRequestDetailScreen from '@/screens/EventRequestDetailScreen';

export type RootStackParamList = {
  Login:                undefined;
  Register:             undefined;
  ClientEventRequest:   { slug?: string } | undefined;
  OrganizerDashboard:   undefined;
  EventRequestDetail:   { id: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Router() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-50">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const isPlanner = user?.role === 'planner';
  const isAuthed  = !!user;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isPlanner ? (
        <>
          <Stack.Screen name="OrganizerDashboard" component={OrganizerDashboardScreen} />
          <Stack.Screen name="EventRequestDetail" component={EventRequestDetailScreen} />
        </>
      ) : isAuthed ? (
        // Authenticated client — drop them straight into the submit flow.
        <Stack.Screen name="ClientEventRequest" component={ClientEventRequestScreen} />
      ) : (
        <>
          <Stack.Screen name="Login"              component={LoginScreen} />
          <Stack.Screen name="Register"           component={RegisterScreen} />
          <Stack.Screen name="ClientEventRequest" component={ClientEventRequestScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <NavigationContainer>
              <Router />
            </NavigationContainer>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
