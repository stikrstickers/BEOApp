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

export type RootStackParamList = {
  Home: undefined;
  PDFViewer: { uri: string; name: string };
  SheetView: { uri: string; name: string; totalPages: number };
  BinList:    { weekId: number; weekLabel: string };
  Coffee:     { weekId: number; weekLabel: string };
  RunOfShow:  { weekId: number; weekLabel: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
