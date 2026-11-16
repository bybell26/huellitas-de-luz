import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { getStoredUser } from '../../lib/api';
import { Colors } from '../../constants/theme';

export default function AppLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getStoredUser().then(user => {
      if (!user) router.replace('/(auth)/login');
      else setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="constellation"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 1,
        }}
      />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
