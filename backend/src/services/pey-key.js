import { readFile } from 'node:fs/promises';

function usable(value) {
  return typeof value === 'string' && !!value.trim() &&
    !/^(tu_api_key|cambia_|example|placeholder)/i.test(value.trim());
}
export async function getPeyKey() {
  if (usable(process.env.PEY_API_KEY)) return process.env.PEY_API_KEY.trim();
  try {
    const config = JSON.parse(await readFile(new URL('../../../pruebas-pey/config.local.json', import.meta.url), 'utf8'));
    if (usable(config.apiKey)) return config.apiKey.trim();
  } catch {}
  const error = new Error('Pey no está configurado. Define PEY_API_KEY en backend/.env y reinicia el backend.');
  error.code = 'PEY_NOT_CONFIGURED';
  throw error;
}
