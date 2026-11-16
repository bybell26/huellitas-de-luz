import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getStoredUser } from '../lib/api';
import { Colors } from '../constants/theme';

export default function Index() {
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    getStoredUser().then(user => {
      setDestination(user ? '/(app)/' : '/(auth)/login');
    });
  }, []);

  if (!destination) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.violet} size="large" />
      </View>
    );
  }

  return <Redirect href={destination as any} />;
}
