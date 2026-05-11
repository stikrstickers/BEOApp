import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import PDFViewerScreen from './src/screens/PDFViewerScreen';
import SheetViewScreen from './src/screens/SheetViewScreen';
import BinListScreen from './src/screens/BinListScreen';
import CoffeeScreen from './src/screens/CoffeeScreen';
import RunOfShowScreen from './src/screens/RunOfShowScreen';
import ClientEventRequestScreen from './src/screens/ClientEventRequestScreen';
import OrganizerDashboardScreen from './src/screens/OrganizerDashboardScreen';
import EventRequestDetailScreen from './src/screens/EventRequestDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import TeamRosterScreen from './src/screens/TeamRosterScreen';
import WorkflowsScreen from './src/screens/WorkflowsScreen';
import WorkflowEditScreen from './src/screens/WorkflowEditScreen';
import { AuthProvider } from './src/auth/AuthContext';

export type RootStackParamList = {
  Home: undefined;
  PDFViewer: { uri: string; name: string };
  SheetView: { uri: string; name: string; totalPages: number };
  BinList:    { weekId: number; weekLabel: string };
  Coffee:     { weekId: number; weekLabel: string };
  RunOfShow:  { weekId: number; weekLabel: string };

  ClientEventRequest: undefined;
  OrganizerDashboard: undefined;
  EventRequestDetail: { requestId: number };

  Login:    undefined;
  Register: undefined;

  Inventory:   undefined;
  TeamRoster:  undefined;
  Workflows:   undefined;
  WorkflowEdit: { workflowId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="PDFViewer" component={PDFViewerScreen} />
          <Stack.Screen name="SheetView" component={SheetViewScreen} />
          <Stack.Screen name="BinList" component={BinListScreen} />
          <Stack.Screen name="Coffee" component={CoffeeScreen} />
          <Stack.Screen name="RunOfShow" component={RunOfShowScreen} />
          <Stack.Screen name="ClientEventRequest" component={ClientEventRequestScreen} />
          <Stack.Screen name="OrganizerDashboard" component={OrganizerDashboardScreen} />
          <Stack.Screen name="EventRequestDetail" component={EventRequestDetailScreen} />
          <Stack.Screen name="Login"    component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Inventory"   component={InventoryScreen} />
          <Stack.Screen name="TeamRoster"  component={TeamRosterScreen} />
          <Stack.Screen name="Workflows"   component={WorkflowsScreen} />
          <Stack.Screen name="WorkflowEdit" component={WorkflowEditScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
