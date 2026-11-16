/**
 * constellation.tsx — Modal de constelación flotante.
 * Presentado como formSheet desde el creador.
 */
import { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import FloatingPet from '../../components/FloatingPet';
import Button      from '../../components/Button';
import { useRoom } from '../../hooks/useRoom';
import { useAuth } from '../../hooks/useAuth';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { MAX_PETS } from '../../constants/pets';
import { useEffect, useState } from 'react';
import { apiGetRoom } from '../../lib/api';

const ROOM_KEY = 'huellitas_room_code';

export default function ConstellationScreen() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const { pets, removePet, clearAll, isLoading } = useRoom(roomCode);
  const { user } = useAuth();

  useEffect(() => {
    SecureStore.getItemAsync(ROOM_KEY).then(code => {
      if (code) setRoomCode(code);
    });
  }, []);

  async function handleRemove(id: string, name: string) {
    Alert.alert(
      'Retirar mascota',
      `¿Retirar a ${name || 'esta mascota'} de la constelación?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Retirar', style: 'destructive', onPress: async () => {
          try { await removePet(id); }
          catch (e: any) { Alert.alert('Error', e.message); }
        }},
      ]
    );
  }

  async function handleClear() {
    if (!pets.length) return;
    Alert.alert(
      'Vaciar constelación',
      `¿Eliminar las ${pets.length} mascotas? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Vaciar', style: 'destructive', onPress: async () => {
          try { await clearAll(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        }},
      ]
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />

      {/* Handle (Android ya tiene el grabber del formSheet, esto es para web/fallback) */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Constelación</Text>
          {roomCode && <Text style={styles.roomCode}>{roomCode}</Text>}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{pets.length} / {MAX_PETS}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid de mascotas flotantes */}
      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && (
          <Text style={styles.empty}>Cargando…</Text>
        )}

        {!isLoading && pets.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🐾</Text>
            <Text style={styles.emptyTitle}>La constelación te espera</Text>
            <Text style={styles.emptyText}>Crea tu primera mascota para comenzar a llenar el universo.</Text>
          </View>
        )}

        {!isLoading && pets.length > 0 && (
          <View style={styles.petGrid}>
            {pets.map((pet, i) => (
              <View key={pet.id} style={styles.petCell}>
                <FloatingPet pet={pet} size={90} isNew={i === pets.length - 1} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(pet.id, pet.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Acciones */}
        {pets.length > 0 && (
          <View style={styles.actions}>
            <Button
              label="Vaciar todas"
              variant="outline"
              size="sm"
              onPress={handleClear}
              style={styles.clearBtn}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3a4a65', alignSelf: 'center', marginTop: 10, marginBottom: 4 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a365044' },
  title:       { fontSize: 20, fontWeight: '900', color: Colors.text, letterSpacing: -0.5 },
  roomCode:    { fontSize: 11, fontWeight: '800', color: Colors.mint, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counter:     { backgroundColor: '#7d76cd30', borderWidth: 1, borderColor: '#aaa2ed56', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  counterText: { fontSize: 12, fontWeight: '800', color: '#edeaff' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e2d44', justifyContent: 'center', alignItems: 'center' },
  closeBtnText:{ fontSize: 12, color: Colors.muted, fontWeight: '700' },

  scroll:   { flexGrow: 1, padding: 16 },
  empty:    { textAlign: 'center', color: Colors.muted, marginTop: 40 },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyIcon:{ fontSize: 56 },
  emptyTitle:{ fontSize: 18, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  emptyText: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  petGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  petCell: { alignItems: 'center', position: 'relative', width: 110 },
  removeBtn:     { position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#382a40', borderWidth: 1, borderColor: '#725064', justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { fontSize: 9, color: '#eab6c4', fontWeight: '900' },

  actions:  { alignItems: 'center', marginTop: 24 },
  clearBtn: { borderColor: '#845267' },
});
