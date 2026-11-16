/**
 * Pantalla principal — Creador de mascotas.
 * Pasos: 1 Diseña → 2 Revisa → 3 Paga → 4 Enviada
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ensureOwnRoom } from '../../lib/active-room';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import PetSVG from '../../components/PetSVG';
import Button  from '../../components/Button';
import Card    from '../../components/Card';
import { BREEDS, COLORS, MAX_PETS, getBreed, type Species } from '../../constants/pets';
import { Colors } from '../../constants/theme';
import { useRoom }  from '../../hooks/useRoom';
import { useAuth }  from '../../hooks/useAuth';
import { createPaymentFlow, type PaymentStatus } from '../../lib/payment';
import { type Pet } from '../../lib/api';

type Step = 'create' | 'review' | 'payment' | 'sent';

interface CreatorState {
  species:  Species | null;
  breed:    string | null;
  collar:   string;
  name:     string;
}

export default function CreatorScreen() {
  const { user }                = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const { pets, addPet, isLoading, error: roomError } = useRoom(roomCode);

  const [step,    setStep]    = useState<Step>('create');
  const [creator, setCreator] = useState<CreatorState>({
    species: null, breed: null, collar: COLORS[0].value, name: '',
  });
  const [payStatus,  setPayStatus]  = useState<PaymentStatus | null>(null);
  const [, setLastPetId]  = useState<string | null>(null);
  const [savingPet,  setSavingPet]  = useState(false);

  // ── Sala ──────────────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    let cancelled = false;
    void ensureOwnRoom().then(code => {
      if (!cancelled) setRoomCode(code);
    }).catch(err => {
      if (!cancelled) {
        setRoomCode(null);
        Alert.alert('No se pudo preparar la sala', err instanceof Error ? err.message : 'Revisa la conexión.');
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]));

  const isFull     = pets.length >= MAX_PETS;
  const canContinue = !!creator.species && !!creator.breed && !!roomCode && !isLoading && !roomError && !isFull;

  // ── Paso 1: Diseña ────────────────────────────────────────────────────────
  function renderCreate() {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>DISEÑA TU COMPAÑERO</Text>
        <Text style={styles.h1}>Una mascota más.{'\n'}<Text style={styles.gradient}>Una constelación más grande.</Text></Text>

        {/* Preview */}
        <View style={styles.previewBox}>
          {creator.species && creator.breed ? (
            <PetSVG species={creator.species} breedId={creator.breed} collar={creator.collar} name={creator.name} size={160} />
          ) : (
            <Text style={styles.emptyPet}>🐾{'\n'}Elige una mascota</Text>
          )}
        </View>

        <Card style={styles.cardSection}>
          {/* Especie */}
          <Text style={styles.fieldLabel}><Text style={styles.fieldIndex}>01</Text> Elige tu mascota</Text>
          <View style={styles.speciesRow}>
            {(['perro', 'gato'] as Species[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.speciesBtn, creator.species === s && styles.speciesBtnActive]}
                onPress={() => setCreator(c => ({ ...c, species: s, breed: null }))}
                activeOpacity={0.7}
              >
                <Text style={styles.speciesEmoji}>{s === 'perro' ? '🐶' : '🐱'}</Text>
                <Text style={styles.speciesLabel}>{s === 'perro' ? 'Perro' : 'Gato'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Raza */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}><Text style={styles.fieldIndex}>02</Text> Selecciona su raza</Text>
          {creator.species ? (
            <View style={styles.breedGrid}>
              {BREEDS[creator.species].map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.breedBtn, creator.breed === b.id && styles.breedBtnActive]}
                  onPress={() => setCreator(c => ({ ...c, breed: b.id }))}
                  activeOpacity={0.7}
                >
                  {b.isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>Nuevo</Text></View>}
                  <PetSVG species={creator.species!} breedId={b.id} collar={creator.collar} size={64} />
                  <Text style={styles.breedName}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>Primero elige perro o gato.</Text>
          )}

          {/* Collar */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}><Text style={styles.fieldIndex}>03</Text> Color de collar</Text>
          <View style={styles.collarRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.collarBtn, { borderColor: creator.collar === c.value ? '#fff' : 'transparent' }]}
                onPress={() => setCreator(cr => ({ ...cr, collar: c.value }))}
                activeOpacity={0.7}
              >
                <View style={[styles.collarDot, { backgroundColor: c.value }]} />
                {creator.collar === c.value && <Text style={styles.collarCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Nombre */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Nombre (opcional)</Text>
          <TextInput
            style={styles.nameInput}
            value={creator.name}
            onChangeText={t => setCreator(c => ({ ...c, name: t }))}
            placeholder="Ej. Luna"
            placeholderTextColor="#71829f"
            maxLength={16}
          />
        </Card>

        <Button
          label={isFull ? 'Constelación completa' : 'Revisar mi mascota'}
          onPress={() => { if (canContinue) setStep('review'); }}
          disabled={!canContinue}
          fullWidth
          style={{ marginTop: 16, marginHorizontal: 20, marginBottom: 32 }}
        />
      </ScrollView>
    );
  }

  // ── Paso 2: Revisa ────────────────────────────────────────────────────────
  function renderReview() {
    const b     = getBreed(creator.species!, creator.breed!);
    const color = COLORS.find(c => c.value === creator.collar)!;
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <StepHeader step={2} title="Confirma tu mascota" subtitle="Revisa el diseño antes de pagar." />
        <View style={styles.previewBox}>
          <PetSVG species={creator.species!} breedId={creator.breed!} collar={creator.collar} name={creator.name} size={180} />
        </View>
        <Card style={styles.cardSection}>
          {[
            ['Animal',         creator.species === 'perro' ? '🐶 Perro' : '🐱 Gato'],
            ['Raza',           b.name],
            ['Color de collar', color.label],
            ['Nombre',         creator.name || 'Sin nombre'],
          ].map(([label, value]) => (
            <View key={label} style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>{label}</Text>
              <Text style={styles.reviewValue}>{value}</Text>
            </View>
          ))}
        </Card>
        <Text style={styles.hint}>El siguiente paso es pagar $0.01 MXN con QR.</Text>
        <View style={styles.actionRow}>
          <Button label="Editar" variant="outline" onPress={() => setStep('create')} style={{ flex: 1 }} />
          <Button label="Pagar $0.01 MXN" onPress={beginPayment} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    );
  }

  // ── Paso 3: Pago ──────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<ReturnType<typeof createPaymentFlow> | null>(null);

  useEffect(() => () => flow?.dispose(), [flow]);

  function beginPayment() {
    if (!roomCode || isLoading || roomError || isFull) {
      Alert.alert('Sala no disponible', 'Espera a que la sala esté lista y tenga espacio antes de pagar.');
      return;
    }
    flow?.dispose();
    const pf = createPaymentFlow((update) => {
      setPayStatus(update);
      if (update.status === 'paid') {
        pf.dispose();
        handlePaid(update.transaction);
      }
    });
    setFlow(pf);
    setStep('payment');
    pf.start();
  }

  async function handlePaid(transaction: any) {
    if (!transaction || transaction.status !== 'PAID' || Number(transaction.amount) !== 0.01) return;
    setSavingPet(true);
    const pet: Omit<Pet, 'slot'> = {
      id: `pey-${transaction.id}`,
      species: creator.species!,
      breed:   creator.breed!,
      collar:  creator.collar,
      name:    creator.name.trim(),
    };
    try {
      await addPet(pet);
      setLastPetId(pet.id);
      setStep('sent');
    } catch (e: any) {
      Alert.alert('Pago aprobado', `El pago fue confirmado pero no se pudo guardar la mascota: ${e.message}\n\nNo necesitas pagar de nuevo.`, [
        { text: 'Reintentar', onPress: () => handlePaid(transaction) },
      ]);
    } finally {
      setSavingPet(false);
    }
  }

  function renderPayment() {
    const p = payStatus;
    if (!p || p.status === 'creating') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.mint} size="large" />
          <Text style={styles.payText}>Generando tu QR…</Text>
        </View>
      );
    }
    if (p.status === 'qr') {
      return (
        <ScrollView contentContainerStyle={styles.scroll}>
          <StepHeader step={3} title="Escanea y paga $0.01 MXN" subtitle="Abre tu app bancaria y autoriza el cobro." />
          <Card style={styles.cardSection}>
            {/* En RN mostramos el QR como imagen base64 con expo-image o Image */}
            <Image source={{ uri: p.qr.qrImage }} style={{ width: 240, height: 240, alignSelf: 'center' }} resizeMode="contain" accessibilityLabel="QR CoDi para pagar un centavo" />
            <Text style={styles.payText}>QR generado. Escanéalo con tu app bancaria.</Text>
            <Text style={styles.paySubText}>ID: {p.qr.id}</Text>
          </Card>
          <Button label="Ya pagué, validar cobro" onPress={() => flow?.validate()} fullWidth style={{ margin: 20 }} />
          <Button label="Cancelar" variant="ghost" onPress={() => { flow?.dispose(); setStep('review'); }} fullWidth style={{ marginHorizontal: 20 }} />
        </ScrollView>
      );
    }
    if (p.status === 'waiting') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.mint} size="large" />
          <Text style={styles.payText}>Confirmando pago…</Text>
          <Text style={styles.paySubText}>{p.message}</Text>
          {p.remaining !== undefined && <Text style={styles.payTimer}>{p.remaining}s restantes</Text>}
        </View>
      );
    }
    if (savingPet) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.violet} size="large" />
          <Text style={styles.payText}>Guardando tu mascota…</Text>
        </View>
      );
    }
    // rejected / error
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>✕</Text>
        <Text style={styles.payText}>{p.status === 'rejected' ? 'Cobro rechazado' : 'Error'}</Text>
        <Text style={styles.paySubText}>{'message' in p ? p.message : ''}</Text>
        <Button label="Volver a mi mascota" variant="outline" onPress={() => { flow?.dispose(); setStep('review'); }} style={{ marginTop: 20 }} />
      </View>
    );
  }

  // ── Paso 4: Enviada ───────────────────────────────────────────────────────
  function renderSent() {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.centered}>
          <View style={styles.successMark}><Text style={styles.successIcon}>✓</Text></View>
          <Text style={styles.successTitle}>¡{creator.name || 'Tu mascota'} despegó!</Text>
          <Text style={styles.successText}>Se unió a la constelación compartida. Puedes crear otra mientras todas flotan juntas.</Text>
          <Button
            label="Ver la constelación"
            onPress={() => router.push('/(app)/constellation' as any)}
            fullWidth
            style={{ marginTop: 24 }}
          />
          <Button
            label="Crear otra mascota"
            variant="outline"
            onPress={() => {
              setCreator({ species: null, breed: null, collar: COLORS[0].value, name: '' });
              setPayStatus(null); setLastPetId(null);
              setStep('create');
            }}
            fullWidth
            style={{ marginTop: 12 }}
          />
        </View>
      </ScrollView>
    );
  }

  // ── Header de pasos ───────────────────────────────────────────────────────
  const steps = ['Diseña', 'Revisa', 'Paga'];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <LinearGradient colors={['#b99aff', '#77eacb']} style={styles.brandIcon}>
            <Text style={styles.brandStar}>✦</Text>
          </LinearGradient>
          <Text style={styles.brandText}>huellitas<Text style={styles.brandLight}>de luz</Text></Text>
        </View>
        <View style={styles.topActions}>
          {roomCode && (
            <TouchableOpacity onPress={() => router.push('/(app)/constellation' as any)} style={styles.roomBadge}>
              <Text style={styles.roomBadgeText}>{roomCode}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/(app)/profile' as any)} style={styles.profileBtn}>
            <Text style={styles.profileText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Steps indicator */}
      {step !== 'sent' && (
        <View style={styles.stepsRow}>
          {steps.map((label, i) => {
            const idx = step === 'create' ? 0 : step === 'review' ? 1 : 2;
            const done    = i < idx;
            const current = i === idx;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, done && styles.stepDone, current && styles.stepCurrent]}>
                  <Text style={styles.stepDotText}>{done ? '✓' : i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]}>{label}</Text>
                {i < 2 && <View style={styles.stepLine} />}
              </View>
            );
          })}
        </View>
      )}

      {/* Content */}
      {step === 'create'  && renderCreate()}
      {step === 'review'  && renderReview()}
      {step === 'payment' && renderPayment()}
      {step === 'sent'    && renderSent()}
    </SafeAreaView>
  );
}

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  // Topbar
  topbar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a365044' },
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  brandStar: { fontSize: 20, color: '#1b1938' },
  brandText: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, color: Colors.text },
  brandLight:{ color: '#b9a9ff' },
  topActions:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  roomBadge: { backgroundColor: '#173530', borderWidth: 1, borderColor: '#3a7164', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  roomBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.mint },
  profileBtn:{ width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  profileText: { fontSize: 14, fontWeight: '900', color: '#fff' },

  // Steps
  stepsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 0 },
  stepItem:  { flexDirection: 'row', alignItems: 'center' },
  stepDot:   { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: '#455574', backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  stepDone:  { backgroundColor: '#21453f', borderColor: '#3a7164' },
  stepCurrent:{ backgroundColor: Colors.accent, borderColor: '#d4baff' },
  stepDotText:{ fontSize: 10, color: Colors.muted, fontWeight: '700' },
  stepLabel:  { fontSize: 10, color: Colors.muted, marginLeft: 5 },
  stepLabelCurrent: { color: Colors.text, fontWeight: '700' },
  stepLine:   { width: 24, height: 1, backgroundColor: '#39465f', marginHorizontal: 4 },

  // Typography
  eyebrow:   { fontSize: 10, letterSpacing: 1.4, color: Colors.violet, fontWeight: '900', paddingHorizontal: 20, paddingTop: 20 },
  h1:        { fontSize: 28, fontWeight: '900', letterSpacing: -1, color: Colors.text, lineHeight: 34, paddingHorizontal: 20, marginTop: 8 },
  h2:        { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, color: Colors.text },
  gradient:  { color: '#c6a4ff' },
  subtitle:  { fontSize: 12, color: Colors.muted, marginTop: 4 },
  hint:      { fontSize: 11, color: Colors.muted, paddingHorizontal: 20, marginTop: 8 },

  // Preview
  previewBox:{ alignItems: 'center', paddingVertical: 16 },
  emptyPet:  { fontSize: 48, textAlign: 'center', color: Colors.muted, lineHeight: 60 },

  // Form sections
  cardSection: { marginHorizontal: 20, marginTop: 12 },
  fieldLabel:  { fontSize: 12, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  fieldIndex:  { color: Colors.violet, marginRight: 6 },

  // Species
  speciesRow: { flexDirection: 'row', gap: 10 },
  speciesBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a2943', borderWidth: 1, borderColor: '#435371', borderRadius: 14, padding: 14 },
  speciesBtnActive: { borderColor: '#bea1ff', backgroundColor: '#282b4b' },
  speciesEmoji:{ fontSize: 28 },
  speciesLabel:{ fontSize: 13, fontWeight: '700', color: Colors.text },

  // Breeds
  breedGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  breedBtn:   { width: '30%', alignItems: 'center', backgroundColor: '#192743', borderWidth: 1, borderColor: '#364767', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, position: 'relative' },
  breedBtnActive: { borderColor: '#bea1ff', backgroundColor: '#282b4b' },
  breedName:  { fontSize: 10, color: Colors.text, textAlign: 'center', marginTop: 4, fontWeight: '700' },
  newBadge:   { position: 'absolute', top: 6, left: 6, backgroundColor: '#254b46', borderWidth: 1, borderColor: '#51958366', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 },
  newBadgeText: { fontSize: 7, fontWeight: '800', color: '#a7f6db' },

  // Collar
  collarRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  collarBtn:  { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  collarDot:  { width: 29, height: 29, borderRadius: 15 },
  collarCheck:{ position: 'absolute', fontSize: 10, color: '#fff', fontWeight: '900' },

  // Name input
  nameInput:  { backgroundColor: '#0f1930', borderWidth: 1, borderColor: '#495875', borderRadius: 11, color: Colors.text, padding: 13, fontSize: 14 },

  // Review
  reviewRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#344260' },
  reviewLabel:{ fontSize: 12, color: Colors.muted },
  reviewValue:{ fontSize: 12, fontWeight: '700', color: Colors.text },
  actionRow:  { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 20 },

  // Payment
  qrPlaceholder: { fontSize: 80, textAlign: 'center' },
  payText:    { fontSize: 15, color: Colors.text, fontWeight: '700', textAlign: 'center' },
  paySubText: { fontSize: 12, color: Colors.muted, textAlign: 'center' },
  payTimer:   { fontSize: 20, color: Colors.mint, fontWeight: '900' },
  errorIcon:  { fontSize: 40, color: '#f4a7a7' },

  // Sent
  successMark:{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#85eaca', justifyContent: 'center', alignItems: 'center' },
  successIcon:{ fontSize: 28, color: '#142e34', fontWeight: '900' },
  successTitle:{ fontSize: 24, fontWeight: '900', color: Colors.text, textAlign: 'center', letterSpacing: -0.5 },
  successText: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
});
