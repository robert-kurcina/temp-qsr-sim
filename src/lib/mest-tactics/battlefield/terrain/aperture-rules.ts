import { TerrainFeature, TerrainType } from './Terrain';

const EPSILON = 1e-6;

type ApertureKind = 'door' | 'doorway' | 'window' | 'low-ceiling';

function normalizeApertureKind(value: unknown): ApertureKind | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/[_\s]+/g, '-');
  if (normalized === 'door') return 'door';
  if (normalized === 'doorway') return 'doorway';
  if (normalized === 'window') return 'window';
  if (normalized === 'low-ceiling' || normalized === 'lowceiling') return 'low-ceiling';
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getApertureKind(feature: TerrainFeature): ApertureKind | null {
  const meta = feature.meta as Record<string, unknown> | undefined;
  return normalizeApertureKind(
    meta?.apertureKind ?? meta?.apertureType ?? meta?.aperture ?? null
  );
}

function isOpenAperture(feature: TerrainFeature): boolean {
  const meta = feature.meta as Record<string, unknown> | undefined;
  const openValue = meta?.isOpen ?? meta?.open;
  if (typeof openValue === 'boolean') return openValue;
  return true;
}

function getOpeningDimensions(feature: TerrainFeature): { widthMu: number; heightMu: number } {
  const meta = feature.meta as Record<string, unknown> | undefined;
  const dimensions = feature.meta?.dimensions as Record<string, unknown> | undefined;

  const widthMu = toNumber(meta?.openingWidthMu)
    ?? toNumber(dimensions?.width)
    ?? toNumber(dimensions?.diameter)
    ?? 0;
  const heightMu = toNumber(meta?.openingHeightMu)
    ?? toNumber(meta?.ceilingHeightMu)
    ?? toNumber(dimensions?.height)
    ?? toNumber(dimensions?.length)
    ?? widthMu;

  return { widthMu, heightMu };
}

/**
 * QSR DR.1-DR.5 helper.
 * Returns traversal terrain for aperture-like features, or null when not aperture terrain.
 */
export function resolveApertureTraversalTerrain(
  feature: TerrainFeature,
  modelBaseDiameter: number
): TerrainType | null {
  const kind = getApertureKind(feature);
  if (!kind) return null;

  const halfBase = Math.max(0, modelBaseDiameter / 2);
  const { widthMu, heightMu } = getOpeningDimensions(feature);
  const isSmall = widthMu <= halfBase + EPSILON || heightMu <= halfBase + EPSILON;
  const isOpen = isOpenAperture(feature);

  if (kind === 'door' || kind === 'doorway') {
    if (!isOpen) return TerrainType.Impassable;
    return isSmall ? TerrainType.Rough : TerrainType.Clear;
  }

  if (kind === 'window') {
    if (!isOpen) return TerrainType.Impassable;
    return isSmall ? TerrainType.Impassable : TerrainType.Difficult;
  }

  // low-ceiling
  return heightMu + EPSILON < halfBase
    ? TerrainType.Impassable
    : TerrainType.Difficult;
}
