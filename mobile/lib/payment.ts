/**
 * payment.ts — Flujo de pago Pey portado de js/payment-flow.js
 * Idéntica lógica: QR → validar → 120 s timeout → PAID o rejected
 */
import { getToken, handleUnauthorized } from './api';

import { getApiBase } from './config';

export type PaymentStatus =
  | { status: 'creating' }
  | { status: 'qr';       qr: QRData }
  | { status: 'waiting';  qr: QRData; message?: string; remaining?: number }
  | { status: 'paid';     qr: QRData; transaction: Transaction }
  | { status: 'rejected'; qr?: QRData; message: string }
  | { status: 'error';    message: string };

export interface QRData {
  id: string;
  qrImage: string; // data:image/png;base64,...
}

export interface Transaction {
  id: string;
  status: 'PAID';
  amount: number;
  currency?: string;
}

interface PaymentFlowOptions {
  now?: () => number;
}

export interface PaymentFlow {
  start:    () => Promise<void>;
  validate: () => void;
  dispose:  () => void;
}

export function createPaymentFlow(
  onUpdate: (update: PaymentStatus) => void,
  options: PaymentFlowOptions = {},
): PaymentFlow {
  const now = options.now ?? Date.now;

  let qr:       QRData | null = null;
  let deadline  = 0;
  let finished  = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  function clearTimers() {
    if (pollTimer)    clearTimeout(pollTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    abortController?.abort();
  }

  function finish(update: PaymentStatus) {
    if (finished) return;
    finished = true;
    clearTimers();
    onUpdate(update);
  }

  function reject() {
    finish({
      status:  'rejected',
      qr:      qr ?? undefined,
      message: 'Cobro rechazado por tiempo agotado: no se confirmó en 2 minutos.',
    });
  }

  async function request(body: object, signal: AbortSignal): Promise<any> {
    const token = await getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${getApiBase()}/api/pey`, {
      method: 'POST', headers,
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 401 && token) await handleUnauthorized();
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error('No se pudo consultar Pey.');
    return result.data;
  }

  async function poll() {
    if (finished) return;
    if (now() >= deadline) return reject();

    abortController = new AbortController();
    const reqTimeout = setTimeout(
      () => abortController?.abort(),
      Math.min(10000, deadline - now()),
    );

    try {
      let nextToken: string | undefined;
      const seen = new Set<string>();

      do {
        const data = await request(
          { action: 'status', id: qr!.id, ...(nextToken ? { nextToken } : {}) },
          abortController.signal,
        );
        if (finished) return;
        if (now() >= deadline) return reject();

        const paid = (data.items ?? []).find(
          (item: any) => item.status === 'PAID' && Number(item.amount) === 0.01 && (!item.currency || item.currency === 'MXN'),
        );
        if (paid) return finish({ status: 'paid', qr: qr!, transaction: paid });

        nextToken = data.nextToken;
        if (nextToken && seen.has(nextToken)) throw new Error('Paginación repetida.');
        if (nextToken) seen.add(nextToken);
      } while (nextToken);

    } catch {
      if (!finished) {
        onUpdate({
          status:    'waiting',
          qr:        qr!,
          message:   'Seguimos verificando el pago…',
          remaining: Math.max(0, Math.ceil((deadline - now()) / 1000)),
        });
      }
    } finally {
      clearTimeout(reqTimeout);
      if (!finished) {
        pollTimer = setTimeout(poll, Math.min(2000, Math.max(0, deadline - now())));
      }
    }
  }

  return {
    async start() {
      onUpdate({ status: 'creating' });
      abortController = new AbortController();
      const createTimeout = setTimeout(() => abortController?.abort(), 30000);
      try {
        const data = await request({ action: 'create' }, abortController.signal);
        if (finished) return;
        if (!data?.id || typeof data.qrImage !== 'string') throw new Error('QR sin imagen.');
        const image = data.qrImage.replace(/^data:image\/png;base64,/, '');
        qr = { id: data.id, qrImage: `data:image/png;base64,${image}` };
        onUpdate({ status: 'qr', qr });
      } catch {
        if (!finished) finish({ status: 'error', message: 'No fue posible preparar el QR.' });
      } finally {
        clearTimeout(createTimeout);
      }
    },

    validate() {
      if (finished || !qr || deadline) return;
      deadline = now() + 120_000;
      onUpdate({ status: 'waiting', qr, remaining: 120 });
      timeoutTimer = setTimeout(reject, 120_000);
      poll();
    },

    dispose() {
      finished = true;
      clearTimers();
    },
  };
}
