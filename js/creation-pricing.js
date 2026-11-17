'use strict';
(function (root) {
  const presets = [50, 100, 150, 200];
  function moneyCents(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return null;
    const cents = Math.round(amount * 100);
    return Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) < .0001 ? cents : null;
  }
  function creationCents(amount) {
    const cents = moneyCents(amount);
    return cents !== null && (presets.includes(amount) || cents > 20000) ? cents : null;
  }
  const pricing = { presets, moneyCents, creationCents };
  if (typeof module !== 'undefined' && module.exports) module.exports = pricing;
  else root.CreationPricing = pricing;
})(typeof window !== 'undefined' ? window : globalThis);
