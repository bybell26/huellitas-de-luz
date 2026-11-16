import Constants from 'expo-constants';

// Una sola dirección para API, pagos y WebSocket.
// En desarrollo se usa el equipo que sirve Metro; en builds se configura HTTPS.
export function getApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('EXPO_PUBLIC_API_URL debe ser HTTP o HTTPS.');
    return configured;
  }
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) return 'http://' + new URL('http://' + hostUri).hostname + ':4000';
  }
  throw new Error('Configura EXPO_PUBLIC_API_URL con la dirección de tu backend.');
}
