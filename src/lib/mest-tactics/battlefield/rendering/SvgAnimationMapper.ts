/**
 * SVG Animation Mapper
 * 
 * Converts audit JSON into SVG animation frames for battle replay viewer.
 * Generates static SVG battlefield with model positions per frame.
 */

import { AuditFrame, AuditVector, ModelFrameState, StatusTokenState } from '../../audit/AuditService';
import { Position } from '../Position';
import { renderPortraitsSvg, getModelPortraitData, getPortraitCss, parseCallSign } from './PortraitRenderer';

export interface SvgAnimationOutput {
  svgContent: string;
  frames: FrameData[];
  frameIndex: Map<number, number>; // turn → frame index mapping
}

export interface FrameData {
  frameIndex: number;
  turn: number;
  activationIndex: number;
  sideId: string;
  characterId: string;
  actionType: string;
  apSpent: number;
  modelStates: ModelFrameState[];
  vectors: AuditVector[];
  actionLog: string;
}

export interface SvgAnimationOptions {
  width: number;
  height: number;
  gridResolution?: number;
  title?: string;
  showGrid?: boolean;
  showDeploymentZones?: boolean;
}

/**
 * Convert audit frames to SVG animation data
 */
export function mapAuditToSvgFrames(
  auditFrames: AuditFrame[],
  options: SvgAnimationOptions
): SvgAnimationOutput {
  const frames: FrameData[] = auditFrames.map(frame => ({
    frameIndex: frame.frameIndex,
    turn: frame.turn,
    activationIndex: frame.activationIndex,
    sideId: frame.sideId,
    characterId: frame.characterId,
    actionType: frame.actionType,
    apSpent: frame.apSpent,
    modelStates: frame.modelStates,
    vectors: frame.vectors,
    actionLog: frame.actionLog,
  }));

  // Build frame index by turn
  const frameIndex = new Map<number, number>();
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!frameIndex.has(frame.turn)) {
      frameIndex.set(frame.turn, i);
    }
  }

  // Generate base SVG
  const svgContent = generateBaseSvg(options, frames[0]?.modelStates || []);

  return {
    svgContent,
    frames,
    frameIndex,
  };
}

/**
 * Generate base SVG battlefield
 */
function generateBaseSvg(options: SvgAnimationOptions, modelStates: ModelFrameState[]): string {
  const { width, height, gridResolution = 0.5, title = 'Battle Report', showGrid = true, showDeploymentZones = false } = options;

  const svgParts: string[] = [];
  
  // SVG header
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
      `width="${width * 20}" height="${height * 20}" font-family="Arial, sans-serif" font-size="0.5">`
  );

  // Styles
  svgParts.push(`<defs>
    <style><![CDATA[
      .grid-line { stroke: #999; stroke-width: 0.02; opacity: 0.2; }
      .grid-line-2mu { stroke: #666; stroke-width: 0.04; opacity: 0.4; }
      .grid-line-6mu { stroke: #333; stroke-width: 0.08; opacity: 0.6; }
      .model-base-ring { fill: none; stroke: #cc9944; stroke-width: 0.05; opacity: 0.5; }
      .model-portrait { cursor: pointer; transition: filter 0.2s; }
      .model-portrait:hover { filter: brightness(1.2) drop-shadow(0 0 4px #ffcc66); }
      .vector-movement { stroke: #4488ff; stroke-width: 0.08; stroke-dasharray: 0.2 0.1; }
      .vector-los { stroke: #44ff44; stroke-width: 0.06; stroke-dasharray: 0.15 0.15; }
      .vector-lof { stroke: #ff4444; stroke-width: 0.06; stroke-dasharray: 0.3 0.15; }
      .token { stroke: #000; stroke-width: 0.03; }
      .token-wound { fill: #e82329; }
      .token-delay { fill: #4488ff; }
      .token-fear { fill: #ffcc00; }
      .token-hidden { fill: #44aa44; }
      .token-wait { fill: #8888ff; }
      .label { fill: #111; font-size: 0.5px; }
      .action-log { fill: #333; font-size: 0.4px; }
      ${getPortraitCss()}
    ]]></style>
    <clipPath id="portrait-clip">
      <circle cx="0" cy="0" r="1" />
    </clipPath>
  </defs>`);

  // Background
  svgParts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5dc" stroke="#333" stroke-width="0.1"/>`);

  // Grid
  if (showGrid) {
    svgParts.push(renderGrid(width, height, gridResolution));
  }

  // Deployment zones (optional)
  if (showDeploymentZones) {
    svgParts.push(renderDeploymentZones(width, height));
  }

  // Models
  svgParts.push(renderModels(modelStates));

  // Title
  svgParts.push(`<text x="${width - 0.5}" y="${height - 0.3}" text-anchor="end" class="label">${title}</text>`);

  svgParts.push(`</svg>`);

  return svgParts.join('\n');
}

/**
 * Render grid lines
 */
function renderGrid(width: number, height: number, gridResolution: number): string {
  const lines: string[] = [`<g id="grid">`];

  for (let x = 0; x <= width; x += gridResolution) {
    let className = 'grid-line';
    if (x % 6 === 0) {
      className = 'grid-line-6mu';
    } else if (x % 2 === 0) {
      className = 'grid-line-2mu';
    }
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="${className}"/>`);
  }
  for (let y = 0; y <= height; y += gridResolution) {
    let className = 'grid-line';
    if (y % 6 === 0) {
      className = 'grid-line-6mu';
    } else if (y % 2 === 0) {
      className = 'grid-line-2mu';
    }
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="${className}"/>`);
  }
  lines.push(`</g>`);
  return lines.join('\n');
}

/**
 * Render deployment zones
 */
function renderDeploymentZones(width: number, height: number): string {
  const zones: string[] = [`<g id="deployment-zones">`];
  
  // Simple edge zones for now
  const zoneWidth = Math.min(4, width / 4);
  zones.push(`<rect x="0" y="0" width="${zoneWidth}" height="${height}" fill="#4488ff" opacity="0.1"/>`);
  zones.push(`<rect x="${width - zoneWidth}" y="0" width="${zoneWidth}" height="${height}" fill="#ff4444" opacity="0.1"/>`);
  
  zones.push(`</g>`);
  return zones.join('\n');
}

/**
 * Render models with portraits
 */
function renderModels(modelStates: ModelFrameState[], scale: number = 1.0): string {
  // Convert model states to portrait data
  const portraitData = modelStates.map(model => {
    // Try to extract call sign from modelId (format: "AA-00" or similar)
    const callSign = model.modelId.includes('-') ? model.modelId : undefined;
    return getModelPortraitData(
      model.modelId,
      callSign,
      model.position,
      model.sideId
    );
  });
  
  const parts: string[] = ['<g id="models">'];
  
  // Render portraits (or fallback circles)
  parts.push(renderPortraitsSvg(portraitData, scale));
  
  // Render base circles and labels
  for (const model of modelStates) {
    const baseDiameter = 1.0; // SIZ 3 = 30mm = 1 MU
    const radius = baseDiameter / 2;
    
    // Model base (subtle ring under portrait)
    parts.push(
      `<circle cx="${model.position.x}" cy="${model.position.y}" r="${radius}" ` +
        `class="model-base-ring" data-model-id="${model.modelId}" data-side="${model.sideId}"/>`
    );
    
    // Model label
    parts.push(
      `<text x="${model.position.x}" y="${model.position.y - radius - 0.2}" ` +
        `text-anchor="middle" class="label">${model.modelId}</text>`
    );
    
    // Status tokens (radial arrangement)
    if (model.tokens && model.tokens.length > 0) {
      parts.push(renderTokens(model.position, radius, model.tokens));
    }
  }
  
  parts.push('</g>');
  return parts.join('\n');
}

/**
 * Render status tokens radially around model base
 */
function renderTokens(position: Position, baseRadius: number, tokens: StatusTokenState[]): string {
  const tokenParts: string[] = [`<g class="tokens">`];
  const tokenRadius = 0.15;
  const ringRadius = baseRadius + tokenRadius + 0.05;

  let tokenIndex = 0;
  for (const token of tokens) {
    for (let i = 0; i < token.count; i++) {
      const angle = (tokenIndex / Math.max(1, tokens.reduce((sum, t) => sum + t.count, 0))) * 2 * Math.PI - Math.PI / 2;
      const x = position.x + Math.cos(angle) * ringRadius;
      const y = position.y + Math.sin(angle) * ringRadius;

      const tokenClass = `token token-${token.type}`;
      tokenParts.push(`<circle cx="${x}" cy="${y}" r="${tokenRadius}" class="${tokenClass}"/>`);
      
      tokenIndex++;
    }
  }

  tokenParts.push(`</g>`);
  return tokenParts.join('\n');
}

/**
 * Render vectors (movement, LOS, LOF)
 */
export function renderVectors(vectors: AuditVector[]): string {
  if (!vectors || vectors.length === 0) return '';

  const vectorParts: string[] = [`<g id="vectors">`];

  for (const vector of vectors) {
    let className = 'vector-movement';
    if (vector.kind === 'los') {
      className = 'vector-los';
    } else if (vector.kind === 'lof') {
      className = 'vector-lof';
    }

    vectorParts.push(
      `<line x1="${vector.from.x}" y1="${vector.from.y}" ` +
        `x2="${vector.to.x}" y2="${vector.to.y}" class="${className}"/>`
    );
  }

  vectorParts.push(`</g>`);
  return vectorParts.join('\n');
}

/**
 * Get model positions for a specific frame
 */
export function getModelPositionsForFrame(frame: FrameData): ModelFrameState[] {
  return frame.modelStates;
}

/**
 * Get vectors for a specific frame
 */
export function getVectorsForFrame(frame: FrameData): AuditVector[] {
  return frame.vectors;
}
