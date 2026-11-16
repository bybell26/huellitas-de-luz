export const APPEARANCE_OPTIONS = {
  fur: ['breed', 'black', 'chocolate', 'cream', 'white', 'ginger', 'gray'],
  pattern: ['breed', 'solid', 'patches', 'stripes'],
  ears: ['breed', 'pointed', 'soft'],
  tail: ['breed', 'long', 'curled', 'short'],
  body: ['breed', 'slim', 'stocky'],
};
export function validateAppearance(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, entry]) => APPEARANCE_OPTIONS[key]?.includes(entry));
}
