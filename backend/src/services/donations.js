import pool from '../db/pool.js';
import { broadcast } from '../ws/rooms.js';

export const TRICKS = { perro: ['paw', 'spin'], gato: ['stand', 'yarn'] };
export function donationCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return cents >= 1 && cents <= 100000 && Math.abs(value * 100 - cents) < .000001 ? cents : null;
}
export async function applyDonation(item, order, userId) {
  const inserted = await pool.query(
    `WITH receipt AS (
       UPDATE payment_receipts SET redeemed_at = now()
       WHERE transaction_id = $1 AND user_id = $2 AND qr_id = $3 AND redeemed_at IS NULL
       RETURNING transaction_id
     )
     INSERT INTO pet_donations (transaction_id, pet_id, user_id, trick)
     SELECT transaction_id, $4, $2, $5 FROM receipt
     ON CONFLICT (transaction_id) DO NOTHING RETURNING id`,
    [item.id, userId, order.qr_id, order.pet_id, order.trick]
  );
  if (!inserted.rows.length) {
    const existing = await pool.query('SELECT id, pet_id, trick FROM pet_donations WHERE transaction_id = $1 AND user_id = $2 AND pet_id = $3 AND transaction_id IN (SELECT transaction_id FROM payment_receipts WHERE qr_id = $4)', [item.id, userId, order.pet_id, order.qr_id]);
    const saved = existing.rows[0];
    return saved ? {type:'donation_added',petId:saved.pet_id,trick:saved.trick,eventId:saved.id} : null;
  }
  const rooms = await pool.query('SELECT r.code FROM rooms r JOIN room_pets rp ON rp.room_id = r.id WHERE rp.pet_id = $1', [order.pet_id]);
  const event = {type:'donation_added',petId:order.pet_id,trick:order.trick,eventId:inserted.rows[0].id};
  for (const room of rooms.rows) broadcast(room.code,event);
  return event;
}
