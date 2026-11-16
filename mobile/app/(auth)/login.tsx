import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiLogin, apiRegister } from '../../lib/api';
import Button from '../../components/Button';
import Input  from '../../components/Input';
import { Colors, FontSize } from '../../constants/theme';

type Tab = 'login' | 'register';

export default function LoginScreen() {
  const [tab,      setTab]      = useState<Tab>('login');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Login
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registro
  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');

  async function handleLogin() {
    setError('');
    if (!loginEmail.trim() || !loginPassword) {
      setError('Completa todos los campos.'); return;
    }
    setLoading(true);
    try {
      await apiLogin(loginEmail.trim().toLowerCase(), loginPassword);
      router.replace('/(app)/');
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError('');
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Completa todos los campos.'); return;
    }
    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.'); return;
    }
    setLoading(true);
    try {
      await apiRegister(regEmail.trim().toLowerCase(), regPassword, regName.trim());
      router.replace('/(app)/');
    } catch (e: any) {
      setError(e.message ?? 'Error al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.brandIcon}><Text style={styles.brandStar}>✦</Text></View>
            <Text style={styles.brandText}>
              huellitas<Text style={styles.brandLight}>de luz</Text>
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Tabs */}
            <View style={styles.tabs}>
              {(['login', 'register'] as Tab[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, tab === t && styles.tabActive]}
                  onPress={() => { setTab(t); setError(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Login form */}
            {tab === 'login' && (
              <>
                <Input label="Correo electrónico" value={loginEmail}
                  onChangeText={setLoginEmail} placeholder="tu@correo.com"
                  keyboardType="email-address" autoCapitalize="none" />
                <Input label="Contraseña" value={loginPassword}
                  onChangeText={setLoginPassword} placeholder="••••••••"
                  secureTextEntry />
                {!!error && <Text style={styles.errorText}>{error}</Text>}
                <Button label="Entrar" onPress={handleLogin} loading={loading} fullWidth />
              </>
            )}

            {/* Register form */}
            {tab === 'register' && (
              <>
                <Input label="Tu nombre" value={regName}
                  onChangeText={setRegName} placeholder="Ej. María" maxLength={60} />
                <Input label="Correo electrónico" value={regEmail}
                  onChangeText={setRegEmail} placeholder="tu@correo.com"
                  keyboardType="email-address" autoCapitalize="none" />
                <Input label="Contraseña (mínimo 8 caracteres)" value={regPassword}
                  onChangeText={setRegPassword} placeholder="••••••••"
                  secureTextEntry />
                {!!error && <Text style={styles.errorText}>{error}</Text>}
                <Button label="Crear cuenta" onPress={handleRegister} loading={loading} fullWidth />
              </>
            )}
          </View>

          <Text style={styles.footer}>
            Tus mascotas quedan guardadas en tu cuenta y se sincronizan en todos tus dispositivos.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },

  brand:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandIcon:  { width: 48, height: 48, borderRadius: 15, backgroundColor: '#b99aff',
                justifyContent: 'center', alignItems: 'center' },
  brandStar:  { fontSize: 26, color: '#1b1938' },
  brandText:  { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: Colors.text },
  brandLight: { color: '#b9a9ff' },

  card: { width: '100%', maxWidth: 420, backgroundColor: '#141e35',
          borderWidth: 1, borderColor: '#36446288', borderRadius: 24, padding: 24, gap: 14 },

  tabs:         { flexDirection: 'row', backgroundColor: '#0f1829', borderRadius: 12, padding: 4, gap: 4 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive:    { backgroundColor: '#1e2e4a' },
  tabText:      { fontSize: FontSize.sm, fontWeight: '700', color: '#8097bc' },
  tabTextActive:{ color: '#e4d6ff' },

  errorText: { color: '#f4a7a7', fontSize: FontSize.xs, backgroundColor: '#3d1e1e',
               borderWidth: 1, borderColor: '#7a3535', borderRadius: 10, padding: 10 },

  footer: { color: '#7589ac', fontSize: 11, textAlign: 'center',
            lineHeight: 17, maxWidth: 300 },
});
