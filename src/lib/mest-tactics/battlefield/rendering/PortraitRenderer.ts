/**
 * Portrait Renderer
 * 
 * Renders character portraits with circular clipping from portrait sheets.
 * Integrates with SVG animation mapper for battle report visualization.
 * 
 * Portrait Sheet Layout:
 * - 8 columns × 6 rows on 1920×1920 canvas
 * - Call signs: AA-00 to ZZ-75 → column/row indices (0-based)
 * - Default: Human Quaggkhir Male (SIZ 3)
 */

import { getClipMetrics, ClipMetrics } from '../portraits/portrait-clip';
import { getBaseDiameterForProfile } from '../portraits/portrait-sheet-registry';

export interface PortraitRenderOptions {
  /** Portrait sheet image path (default: human-quaggkhir-male.jpg) */
  sheetPath?: string;
  /** Sheet width in pixels (default: 1920) */
  sheetWidth?: number;
  /** Sheet height in pixels (default: 1920) */
  sheetHeight?: number;
  /** Model base diameter in MU (default: 1.0 for SIZ 3) */
  baseDiameterMu?: number;
  /** Character profile for auto SIZ detection */
  profile?: { species?: string; ancestry?: string; lineage?: string; sex?: string; siz?: number };
}

export interface PortraitClipData {
  /** Model/call sign ID (e.g., "AA-00") */
  callSign: string;
  /** Column index (0-7) */
  column: number;
  /** Row index (0-5) */
  row: number;
  /** Clip center X in sheet coordinates */
  clipX: number;
  /** Clip center Y in sheet coordinates */
  clipY: number;
  /** Clip radius in sheet coordinates */
  clipRadius: number;
  /** Portrait sheet path */
  sheetPath: string;
}

/**
 * Parse call sign to column/row indices
 * Call signs: AA-00 to ZZ-75
 * Format: [A-Z]{2}-[0-9]{2}
 * First digit → column (0-7), second digit → row (0-5)
 * 
 * Examples:
 * - AA-00 → column 0, row 0
 * - BA-32 → column 3, row 2
 * - CZ-75 → column 7, row 5
 */
export function parseCallSign(callSign: string): { column: number; row: number } | null {
  const match = callSign.match(/^[A-Z]{2}-(\d)(\d)$/);
  if (!match) {
    return null;
  }
  
  const column = parseInt(match[1], 10);
  const row = parseInt(match[2], 10);
  
  // Validate ranges
  if (column < 0 || column > 7 || row < 0 || row > 5) {
    return null;
  }
  
  return { column, row };
}

/**
 * Get portrait clip data for a call sign
 */
export function getPortraitClipData(
  callSign: string,
  options: PortraitRenderOptions = {}
): PortraitClipData | null {
  const parsed = parseCallSign(callSign);
  if (!parsed) {
    return null;
  }
  
  const {
    sheetPath = 'assets/portraits/human-quaggkhir-male.jpg',
    sheetWidth = 1920,
    sheetHeight = 1920,
  } = options;
  
  const metrics = getClipMetrics(sheetWidth, sheetHeight, parsed.column, parsed.row);
  
  return {
    callSign,
    column: parsed.column,
    row: parsed.row,
    clipX: metrics.center.x,
    clipY: metrics.center.y,
    clipRadius: metrics.radius,
    sheetPath,
  };
}

/**
 * Generate SVG portrait element with circular clip
 *
 * @param clipData - Portrait clip data
 * @param position - Position on battlefield (MU coordinates)
 * @param scale - Scale factor for rendering (default: 1.0)
 * @param baseDiameterMu - Model base diameter (default: 1.0 for SIZ 3)
 * @returns SVG element string
 */
export function renderPortraitSvg(
  clipData: PortraitClipData,
  position: { x: number; y: number },
  scale: number = 1.0,
  baseDiameterMu: number = 1.0
): string {
  const radiusMu = baseDiameterMu / 2;
  const radiusPx = radiusMu * scale;
  
  // Generate unique clip path ID
  const clipId = `portrait-clip-${clipData.callSign.replace(/-/g, '')}`;
  
  return `
<g class="portrait" data-call-sign="${clipData.callSign}">
  <defs>
    <clipPath id="${clipId}">
      <circle cx="0" cy="0" r="${radiusPx}"/>
    </clipPath>
  </defs>
  <image 
    href="${clipData.sheetPath}" 
    x="${position.x - radiusPx}" 
    y="${position.y - radiusPx}" 
    width="${radiusPx * 2}" 
    height="${radiusPx * 2}"
    clip-path="url(#${clipId})"
    preserveAspectRatio="xMidYMid slice"
  />
  <circle 
    cx="${position.x}" 
    cy="${position.y}" 
    r="${radiusPx}" 
    fill="none" 
    stroke="#cc9944" 
    stroke-width="${0.05 * scale}"
  />
</g>
`.trim();
}

/**
 * Generate CSS for portrait styling
 */
export function getPortraitCss(): string {
  return `
.portrait {
  cursor: pointer;
  transition: filter 0.2s;
}

.portrait:hover {
  filter: brightness(1.2) drop-shadow(0 0 4px #ffcc66);
}

.portrait image {
  pointer-events: none;
}

.portrait circle {
  pointer-events: none;
}
`.trim();
}

/**
 * Generate portrait data for all models in a frame
 * For use with audit frame rendering
 */
export interface ModelPortraitData {
  modelId: string;
  callSign: string;
  position: { x: number; y: number };
  clipData: PortraitClipData | null;
  sideId: string;
}

export function getModelPortraitData(
  modelId: string,
  callSign: string | undefined,
  position: { x: number; y: number },
  sideId: string,
  options?: PortraitRenderOptions
): ModelPortraitData {
  const clipData = callSign ? getPortraitClipData(callSign, options) : null;
  
  return {
    modelId,
    callSign: callSign || modelId,
    position,
    clipData,
    sideId,
  };
}

/**
 * Generate SVG for multiple portraits
 */
export function renderPortraitsSvg(
  portraits: ModelPortraitData[],
  scale: number = 1.0
): string {
  const parts: string[] = ['<g id="portraits">'];
  
  for (const portrait of portraits) {
    if (portrait.clipData) {
      parts.push(renderPortraitSvg(portrait.clipData, portrait.position, scale));
    } else {
      // Fallback: render colored circle if no portrait available
      const radiusMu = 0.5;
      const radiusPx = radiusMu * scale;
      const color = portrait.sideId.includes('Alpha') ? '#ffcc66' : '#cc66ff';
      
      parts.push(`
<circle 
  cx="${portrait.position.x}" 
  cy="${portrait.position.y}" 
  r="${radiusPx}" 
  fill="${color}" 
  stroke="#333" 
  stroke-width="${0.05 * scale}"
  data-model-id="${portrait.modelId}"
  data-side="${portrait.sideId}"
/>
      `.trim());
    }
  }
  
  parts.push('</g>');
  return parts.join('\n');
}

/**
 * Get all available portrait sheets
 * Maps species/ancestry/sex to sheet paths
 */
export const PORTRAIT_SHEETS: Record<string, string> = {
  // Humaniki
  'alef-akrunai-auldfaran-male': 'assets/portraits/alef-akrunai-auldfaran-male.jpg',
  'alef-akrunai-borondan-male': 'assets/portraits/alef-akruniai-borondan-male.jpg',
  'babbita-indelan-male': 'assets/portraits/babbita-indelan-male.jpg',
  'human-eniyaski-male': 'assets/portraits/human-eniyaski-male.jpg',
  'human-quaggkhir-female': 'assets/portraits/human-quaggkhir-female.jpg',
  'human-quaggkhir-male': 'assets/portraits/human-quaggkhir-male.jpg',
  'human-vasikhan-male': 'assets/portraits/human-vasikhan-male.jpg',
  'human-vasikhan-female': 'assets/portraits/human-vasikhan-female.jpg',
  'human-drusian-female': 'assets/portraits/human-drusian-female.jpg',
  
  // Orogulun
  'orugu-common-male': 'assets/portraits/orugu-common-male.jpg',
  
  // Jhastruj
  'lizardfolk-common-male': 'assets/portraits/lizardfolk-common-male.jpg',
  
  // Gorblun
  'golbrini-common-male': 'assets/portraits/golbrini-common-male.jpg',
  
  // Klobalun
  'kobolds-common-male': 'assets/portraits/kobolds-common-male.jpg',
};

/**
 * Get default portrait sheet path
 */
export function getDefaultPortraitSheet(): string {
  return PORTRAIT_SHEETS['human-quaggkhir-male'];
}
