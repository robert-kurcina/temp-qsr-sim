/**
 * Portrait Sheet Registry
 * 
 * Maps character profiles to portrait sheets based on species, ancestry, lineage, and sex.
 * Implements the portrait assignment rules from rules-portraits.md.
 */

export interface PortraitSheetInfo {
  species: string;
  ancestry: string;
  lineage: string;
  sex: string;
  siz: number;
  sheetPath: string;
  baseDiameterMu: number; // Model base diameter in MU (SIZ-based)
}

/**
 * Portrait sheet mapping from rules-portraits.md
 */
export const PORTRAIT_SHEET_REGISTRY: PortraitSheetInfo[] = [
  {
    species: 'Humaniki',
    ancestry: 'Alef',
    lineage: 'Akrunai-Auldaran',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/alef-akrunai-auldfaran-male.jpg',
    baseDiameterMu: 1.0, // SIZ 3 = 30mm = 1 MU
  },
  {
    species: 'Humaniki',
    ancestry: 'Alef',
    lineage: 'Akrunai-Borondan',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/alef-akruniai-borondan-male.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Humaniki',
    ancestry: 'Babbita',
    lineage: 'Indelan',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/babbita-indelan-male.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Humaniki',
    ancestry: 'Human',
    lineage: 'Eniyaski',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/human-eniyaski-male.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Humaniki',
    ancestry: 'Human',
    lineage: 'Quaggkhir',
    sex: 'Female',
    siz: 3,
    sheetPath: 'assets/portraits/human-quaggkhir-female.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Humaniki',
    ancestry: 'Human',
    lineage: 'Quaggkhir',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/human-quaggkhir-male.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Humaniki',
    ancestry: 'Human',
    lineage: 'Vasikhan',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/human-vasikhan-male.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Orogulun',
    ancestry: 'Orok',
    lineage: 'Orogu',
    sex: 'Male',
    siz: 3,
    sheetPath: 'assets/portraits/orugu-common-male.jpg',
    baseDiameterMu: 1.0,
  },
  {
    species: 'Jhastruj',
    ancestry: 'Jhastra',
    lineage: 'Jhasu',
    sex: 'Male',
    siz: 2,
    sheetPath: 'assets/portraits/lizardfolk-common-male.jpg',
    baseDiameterMu: 0.67, // SIZ 2 = 20mm = 0.67 MU
  },
  {
    species: 'Gorblun',
    ancestry: 'Golbrini',
    lineage: 'Globlin',
    sex: 'Male',
    siz: 2,
    sheetPath: 'assets/portraits/golbrini-common-male.jpg',
    baseDiameterMu: 0.67,
  },
  {
    species: 'Klobalun',
    ancestry: 'Korkbul',
    lineage: 'Kolboh',
    sex: 'Male',
    siz: 1,
    sheetPath: 'assets/portraits/kobolds-common-male.jpg',
    baseDiameterMu: 0.33, // SIZ 1 = 10mm = 0.33 MU
  },
];

/**
 * Default portrait sheet when no match is found
 */
export const DEFAULT_PORTRAIT_SHEET = 'assets/portraits/human-quaggkhir-male.jpg';

/**
 * Get portrait sheet for a character profile
 */
export function getPortraitSheetForProfile(profile: {
  species?: string;
  ancestry?: string;
  lineage?: string;
  sex?: string;
  siz?: number;
}): string {
  const match = PORTRAIT_SHEET_REGISTRY.find(
    sheet =>
      sheet.species.toLowerCase() === (profile.species || '').toLowerCase() &&
      sheet.ancestry.toLowerCase() === (profile.ancestry || '').toLowerCase() &&
      sheet.lineage.toLowerCase() === (profile.lineage || '').toLowerCase() &&
      sheet.sex.toLowerCase() === (profile.sex || '').toLowerCase() &&
      sheet.siz === (profile.siz || 3)
  );

  return match?.sheetPath || DEFAULT_PORTRAIT_SHEET;
}

/**
 * Get base diameter in MU for a character profile (SIZ-based)
 * SIZ 3 = 1.0 MU (30mm)
 * SIZ 2 = 0.67 MU (20mm)
 * SIZ 1 = 0.33 MU (10mm)
 */
export function getBaseDiameterForProfile(profile: {
  species?: string;
  ancestry?: string;
  lineage?: string;
  sex?: string;
  siz?: number;
}): number {
  const match = PORTRAIT_SHEET_REGISTRY.find(
    sheet =>
      sheet.species.toLowerCase() === (profile.species || '').toLowerCase() &&
      sheet.ancestry.toLowerCase() === (profile.ancestry || '').toLowerCase() &&
      sheet.lineage.toLowerCase() === (profile.lineage || '').toLowerCase() &&
      sheet.sex.toLowerCase() === (profile.sex || '').toLowerCase() &&
      sheet.siz === (profile.siz || 3)
  );

  return match?.baseDiameterMu || 1.0; // Default SIZ 3
}

/**
 * Get all available portrait sheets
 */
export function getAvailablePortraitSheets(): PortraitSheetInfo[] {
  return PORTRAIT_SHEET_REGISTRY;
}

/**
 * Get portrait sheet by key (for API/dashboard use)
 */
export function getPortraitSheetByKey(key: string): string | undefined {
  const match = PORTRAIT_SHEET_REGISTRY.find(
    sheet => `${sheet.species}-${sheet.ancestry}-${sheet.lineage}-${sheet.sex}`.toLowerCase() === key.toLowerCase()
  );
  return match?.sheetPath;
}
