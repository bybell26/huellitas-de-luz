/**
 * profile.tsx — Pantalla de perfil y configuración de cuenta.
 */
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import Button from '../../components/Button';
import Card   from '../../components/Card';
import { useAuth }     from '../../hooks/useAuth';
import { apiGetRooms, apiGetPets, clearSession, type Room, type Pet } from '../../lib/api';
import { Colors, FontSize } from '../../constants/theme';

const ROOM_KEY = 'huellitas_room_code';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [rooms,     setRooms]     = useState<Room[]>([]);
  const [pets,      setPets]      = useState<Pet[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGetRooms(),
      apiGetPets(),
      SecureStore.getItemAsync(ROOM_KEY),
    ]).then(([r, p, code]) => {
      setRooms(r);
      setPets(p);
      setActiveRoom(code);
    }).catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/(auth)/login');
      }},
    ]);
  }

  async function switchRoom(code: string) {
    await SecureStore.setItemAsync(ROOM_KEY, code);
    setActiveRoom(code);
    Alert.alert('Sala cambiada', `Ahora estás en la sala ${code}. Vuelve al creador para ver los cambios.`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi perfil</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar y datos */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{pets.length}</Text>
            <Text style={styles.statLabel}>Mascotas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{rooms.length}</Text>
            <Text style={styles.statLabel}>Salas</Text>
          </View>
        </View>

        {/* Salas */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Mis salas</Text>
          {loading && <Text style={styles.mutedText}>Cargando…</Text>}
          {!loading && rooms.length === 0 && (
            <Text style={styles.mutedText}>Aún no tienes salas. Crea una mascota para empezar.</Text>
          )}
          {rooms.map(room => (
            <TouchableOpacity
              key={room.id}
              style={[styles.roomRow, activeRoom === room.code && styles.roomRowActive]}
              onPress={() => switchRoom(room.code)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomCode}>{room.code}</Text>
              </View>
              <View style={styles.roomRight}>
                <Text style={styles.roomPets}>{room.pet_count ?? 0} mascotas</Text>
                {activeRoom === room.code && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Activa</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Acciones */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          <Button
            label="Cerrar sesión"
            variant="outline"
            onPress={handleLogout}
            fullWidth
            style={styles.logoutBtn}
          />
        </Card>

        <Text style={styles.version}>Huellitas de Luz · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 48, gap: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a365044' },
  backBtn:     { width: 70 },
  backText:    { fontSize: 14, color: Colors.violet, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },

  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText:    { fontSize: 30, fontWeight: '900', color: '#fff' },
  userName:      { fontSize: 20, fontWeight: '900', color: Colors.text, letterSpacing: -0.5 },
  userEmail:     { fontSize: 13, color: Colors.muted },

  statsRow:    { flexDirection: 'row', backgroundColor: Colors.panel, borderWidth: 1, borderColor: '#34435e', borderRadius: 16, overflow: 'hidden' },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue:   { fontSize: 26, fontWeight: '900', color: Colors.text },
  statLabel:   { fontSize: 11, color: Colors.muted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#34435e', marginVertical: 12 },

  section:      { gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  mutedText:    { fontSize: 12, color: Colors.muted },

  roomRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#344260' },
  roomRowActive: { backgroundColor: '#17253e88', borderRadius: 10, paddingHorizontal: 8 },
  roomName:      { fontSize: 13, fontWeight: '700', color: Colors.text },
  roomCode:      { fontSize: 11, color: Colors.mint, marginTop: 2 },
  roomRight:     { alignItems: 'flex-end', gap: 4 },
  roomPets:      { fontSize: 11, color: Colors.muted },
  activeBadge:   { backgroundColor: '#17433f77', borderWidth: 1, borderColor: '#3e8c81', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.mint },

  logoutBtn: { borderColor: '#845267' },
  version:   { fontSize: 10, color: '#4a5b78', textAlign: 'center', marginTop: 8 },
});
