'use strict';
function paymentOutcome(items) {
  // Pey solo documenta PENDING y PAID. Nunca se infiere un rechazo.
  return items.find(item => item.status === 'PAID' && Number(item.amount) === 0.01 && (!item.currency || item.currency === 'MXN')) || null;
}
if (typeof module !== 'undefined') module.exports = {paymentOutcome};
