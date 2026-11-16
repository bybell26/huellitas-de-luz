import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { getStoredUser } from '../lib/api';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Solo verificar que el módulo de SecureStore está listo
    getStoredUser().finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.violet} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
        <Stack.Screen name="(app)"   options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
