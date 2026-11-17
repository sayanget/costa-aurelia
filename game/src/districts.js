// Costa Aurelia's five districts: which grid cell belongs to which, and the palette and prop mix
// each one builds from. world.js asks districtAt for every lot; nothing else needs the grid math.
import { CITY } from './config.js';

export const DISTRICT = {
  INDUSTRIAL: 'industrial',
  MARINA: 'marina',
  DOWNTOWN: 'downtown',
  BEACH: 'beach',
  HILLSIDE: 'hillside',
};

export const DISTRICT_INFO = {
  [DISTRICT.INDUSTRIAL]: {
    label: 'The Lowside Docks',
    ground: 0x3a3a3c,
    buildings: [0x5c5a52, 0x4a4e52, 0x6b5d4a, 0x53504a],
    heightRange: [6, 14],
    prop: 'container',
  },
  [DISTRICT.MARINA]: {
    label: 'Amber Court Marina',
    ground: 0xd8c7a1,
    buildings: [0xf2e6d0, 0xe8d9b8, 0xcfe3e0, 0xf7efe0],
    heightRange: [8, 22],
    prop: 'palm',
  },
  [DISTRICT.DOWNTOWN]: {
    // Steel-blue towers, but kept well off black: the old near-0x2f palette read as flat silhouettes
    // once a face turned away from the low sun, so these are lifted a stop and warmed slightly so the
    // golden hour catches the sunlit sides while the shaded ones still hold detail instead of crushing.
    label: 'Solstice Downtown',
    ground: 0x5c5e68,
    buildings: [0x515972, 0x5c6480, 0x68708c, 0x565d7a],
    heightRange: [20, 48],
    prop: 'streetlamp',
  },
  [DISTRICT.BEACH]: {
    label: 'Promenade Coral',
    ground: 0xe7d2a5,
    buildings: [0xf2a65a, 0xe88d7d, 0xf4c177, 0xe0b05c],
    heightRange: [5, 12],
    prop: 'palm',
  },
  [DISTRICT.HILLSIDE]: {
    label: 'Hillside Villas',
    ground: 0x6f8f5e,
    buildings: [0xe8e2d0, 0xd9cdb8, 0xc9b79a, 0xede4da],
    heightRange: [5, 9],
    prop: 'hedge',
  },
};

/** The district a grid cell (0..blocks-1 each way) belongs to. */
export function districtAt(cx, cz) {
  if (cz <= 1) return DISTRICT.INDUSTRIAL;
  if (cz >= CITY.blocks - 2) return DISTRICT.HILLSIDE;
  if (cx <= 1) return DISTRICT.MARINA;
  if (cx >= CITY.blocks - 2) return DISTRICT.BEACH;
  return DISTRICT.DOWNTOWN;
}
