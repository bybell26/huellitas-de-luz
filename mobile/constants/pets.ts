// Espejo exacto de js/pets.js — mismos IDs y valores para compatibilidad con el backend

export type Species = 'perro' | 'gato';

export interface Breed {
  id: string;
  name: string;
  coat: string;
  light: string;
  ear: string;
  kind: string;
  muzzle: string;
  isNew?: boolean;
}

export interface CollarColor {
  label: string;
  value: string;
}

export const BREEDS: Record<Species, Breed[]> = {
  perro: [
    { id: 'labrador', name: 'Labrador',  coat: '#d6a36c', light: '#f5d1a0', ear: '#a36b47', kind: 'floppy',  muzzle: '#f4dcbd' },
    { id: 'husky',    name: 'Husky',     coat: '#8797b3', light: '#dce9ef', ear: '#60728f', kind: 'pointy',  muzzle: '#f5f7f7' },
    { id: 'corgi',    name: 'Corgi',     coat: '#d88c4e', light: '#fbe1b8', ear: '#c57b3b', kind: 'corgi',   muzzle: '#fff0d8' },
    { id: 'pug',      name: 'Pug',       coat: '#d5b78d', light: '#f4dfbb', ear: '#594c50', kind: 'pug',     muzzle: '#6c5357' },
    { id: 'poodle',   name: 'Poodle',    coat: '#d6b5aa', light: '#f1d9cb', ear: '#b88e87', kind: 'poodle',  muzzle: '#f4ded5' },
    { id: 'dalmata',  name: 'Dálmata',   coat: '#dce4ee', light: '#ffffff', ear: '#34384b', kind: 'dalmata', muzzle: '#faf7ef', isNew: true },
  ],
  gato: [
    { id: 'siames',    name: 'Siamés',       coat: '#dec8a2', light: '#fff0cb', ear: '#6d565c', kind: 'siames',   muzzle: '#6a535a' },
    { id: 'persa',     name: 'Persa',        coat: '#e5d5c5', light: '#fff0e0', ear: '#cbb6a5', kind: 'persa',    muzzle: '#f8e6d5' },
    { id: 'bengali',   name: 'Bengalí',      coat: '#d0a15c', light: '#f3cf8e', ear: '#af7f45', kind: 'bengali',  muzzle: '#ebce9a' },
    { id: 'britanico', name: 'Británico',    coat: '#8295ad', light: '#b7c9df', ear: '#64758b', kind: 'britanico',muzzle: '#c8d7e5' },
    { id: 'maine',     name: 'Maine Coon',   coat: '#b88c78', light: '#ecd2b8', ear: '#896858', kind: 'maine',    muzzle: '#e9c9ae' },
    { id: 'sphynx',    name: 'Sphynx',       coat: '#c48f9f', light: '#f4d1cb', ear: '#ad788e', kind: 'sphynx',   muzzle: '#f7dcd2', isNew: true },
  ],
};

export const COLORS: CollarColor[] = [
  { label: 'Lila',      value: '#a77fff' },
  { label: 'Turquesa',  value: '#6fe1cf' },
  { label: 'Coral',     value: '#ff8b88' },
  { label: 'Azul',      value: '#73a7fc' },
  { label: 'Amarillo',  value: '#ffc96d' },
  { label: 'Negro',     value: '#33435c' },
];

export const MAX_PETS = 42;

export function getBreed(species: Species, breedId: string): Breed {
  return BREEDS[species]?.find(b => b.id === breedId) ?? BREEDS.perro[0];
}

export function labelFor(species: Species): string {
  return species === 'perro' ? 'Perro' : 'Gato';
}
