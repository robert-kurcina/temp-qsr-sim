import { Delaunay } from 'd3-delaunay';
import { Battlefield } from '../Battlefield';
import { Position } from '../Position';
import { TerrainFeature } from '../terrain/Terrain';

export interface SvgLayerToggle {
  id: string;
  label: string;
  enabled?: boolean;
}

export interface SvgRenderOptions {
  width: number;
  height: number;
  gridResolution?: number;
  title?: string;
  layers?: SvgLayerToggle[];
  deploymentZones?: { x: number; y: number; width: number; height: number; color: string; opacity?: number }[];
  models?: { id: string; position: Position; baseDiameter: number; color?: string; label?: string }[];
  paths?: { id: string; points: Position[]; color?: string; label?: string }[];
  vectors?: { from: Position; to: Position; color?: string; label?: string }[];
  losRays?: { from: Position; to: Position; color?: string; label?: string }[];
  lofRays?: { from: Position; to: Position; color?: string; label?: string }[];
  annotations?: { position: Position; text: string; color?: string }[];
  coverageLabel?: { text: string; secondaryText?: string; color?: string };
  /** Show clearance zones as red outlines around terrain */
  showClearanceZones?: boolean;
  clearanceZoneColor?: string;
  /** Show grid cells covered by terrain (colored by terrain type) */
  showCoveredCells?: boolean;
  coveredCellColor?: string;
}

const defaultLayers: SvgLayerToggle[] = [
  { id: 'deployment', label: 'Deployment Zones', enabled: true },
  { id: 'grid', label: '0.5 MU Grid', enabled: true },
  { id: 'delaunay', label: 'Delaunay Mesh', enabled: true },
  { id: 'area', label: 'Area Terrain', enabled: true },
  { id: 'building', label: 'Buildings', enabled: true },
  { id: 'wall', label: 'Walls', enabled: true },
  { id: 'tree', label: 'Trees', enabled: true },
  { id: 'rocks', label: 'Rocks', enabled: true },
  { id: 'shrub', label: 'Shrubs', enabled: true },
  { id: 'terrain', label: 'Other Terrain', enabled: true },
  { id: 'clearance', label: 'Clearance Zones', enabled: false },
  { id: 'models', label: 'Models', enabled: true },
  { id: 'paths', label: 'Paths', enabled: true },
  { id: 'vectors', label: 'Vectors', enabled: true },
  { id: 'los', label: 'LOS', enabled: true },
  { id: 'lof', label: 'LOF', enabled: true },
];

export class SvgRenderer {
  static render(battlefield: Battlefield, options: SvgRenderOptions): string {
    const layers = options.layers ?? defaultLayers;
    const gridResolution = options.gridResolution ?? 0.5;
    const title = options.title ?? 'Battlefield';

    const svgParts: string[] = [];
    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${options.width} ${options.height}" ` +
        `width="${options.width * 40}" height="${options.height * 40}" font-family="Arial" font-size="0.6">`
    );

    const { styles: categoryStyles, presentCategories } = SvgRenderer.buildCategoryStyles(battlefield.terrain);

    svgParts.push(`<defs>
  <style><![CDATA[
    .layer { display: inline; }
    .layer.hidden { display: none; }
    .grid-line { stroke: #999; stroke-width: 0.02; opacity: 0.2; }
    .grid-line-2mu { stroke: #666; stroke-width: 0.04; opacity: 0.4; }
    .grid-line-6mu { stroke: #333; stroke-width: 0.08; opacity: 0.6; }
    .delaunay-line { stroke: #4a6fa5; stroke-width: 0.03; opacity: 0.3; }
    #layer-area { opacity: 0.8; }
    #layer-building, #layer-wall, #layer-tree, #layer-rocks, #layer-shrub, #layer-terrain { opacity: 0.8; }
    .terrain-area { stroke: none; }
    .terrain-solid { stroke: #000; stroke-width: 0.05; }
    .model { stroke: #ff0000; stroke-width: 2; vector-effect: non-scaling-stroke; }
    .path { fill: none; stroke-width: 0.12; }
    .vector { stroke-width: 0.1; }
    .los-ray { stroke-width: 0.08; stroke-dasharray: 0.2 0.2; }
    .lof-ray { stroke-width: 0.08; stroke-dasharray: 0.3 0.15; }
    .label { fill: #111 !important; font-size: 0.6px; }
    .toggle { cursor: pointer; }
    .toggle.disabled { cursor: default; }
    .toggle.disabled rect { stroke: #ccc; fill: #fff; }
    .toggle.disabled text { fill: #ccc; }
${categoryStyles}
  ]]></style>
</defs>`);

    svgParts.push(`<rect x="0" y="0" width="${options.width}" height="${options.height}" fill="#ffffff" stroke="#111" stroke-width="0.05"/>`);

    const legendParts: string[] = [`<g id="legend">`];
    let legendY = 0.6;
    for (const layer of layers) {
      const isCategory = ['area', 'building', 'wall', 'tree', 'rocks', 'shrub'].includes(layer.id);
      const isPresent = !isCategory || presentCategories.has(layer.id);
      const enabled = layer.enabled !== false;
      const isDisabled = !isPresent;
      const toggleClass = isDisabled ? 'toggle disabled' : 'toggle';
      legendParts.push(
        `<g class="${toggleClass}"${isDisabled ? '' : ` onclick="toggleLayer('${layer.id}')"`}>` +
          `<rect x="0.4" y="${legendY - 0.45}" width="0.4" height="0.4" fill="${enabled ? '#222' : '#fff'}" stroke="#222" stroke-width="0.05"/>` +
          `<text x="1.0" y="${legendY - 0.05}" class="label">${layer.label}</text>` +
        `</g>`
      );
      legendY += 0.8;
    }
    legendParts.push(`</g>`);

    svgParts.push(`<script><![CDATA[
      function toggleLayer(id) {
        var layer = document.getElementById('layer-' + id);
        if (!layer) return;
        if (layer.classList.contains('hidden')) {
          layer.classList.remove('hidden');
        } else {
          layer.classList.add('hidden');
        }
      }
    ]]></script>`);

    svgParts.push(`<text x="0.4" y="${options.height - 0.4}" class="label">${title}</text>`);

    svgParts.push(this.renderDeploymentZones(options.deploymentZones ?? [], layers));
    svgParts.push(this.renderGrid(options.width, options.height, gridResolution, layers));
    svgParts.push(this.renderDelaunay(battlefield.getNavMesh(), layers));
    
    // Render covered cells BEFORE terrain (so they appear underneath)
    if (options.showCoveredCells) {
      svgParts.push(this.renderCoveredCells(
        battlefield.terrain,
        gridResolution,
        options.coveredCellColor ?? '#90EE90'
      ));
    }
    
    svgParts.push(this.renderTerrain(
      battlefield.terrain,
      layers,
      options.showClearanceZones ?? false,
      options.clearanceZoneColor ?? '#ff0000'
    ));
    svgParts.push(this.renderModels(options.models ?? [], layers));
    svgParts.push(this.renderPaths(options.paths ?? [], layers));
    svgParts.push(this.renderVectors(options.vectors ?? [], layers));
    svgParts.push(this.renderRays(options.losRays ?? [], 'los', 'los-ray', layers));
    svgParts.push(this.renderRays(options.lofRays ?? [], 'lof', 'lof-ray', layers));
    svgParts.push(this.renderAnnotations(options.annotations ?? []));
    if (options.coverageLabel) {
      svgParts.push(this.renderCoverageLabel(options.coverageLabel, options.width));
    }
    svgParts.push(legendParts.join('\n'));

    svgParts.push(`</svg>`);
    return svgParts.join('\n');
  }

  static renderGrid(width: number, height: number, gridResolution: number, layers: SvgLayerToggle[]): string {
    const layer = layers.find(item => item.id === 'grid');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const lines: string[] = [`<g id="layer-grid" class="layer ${hidden}">`];
    
    // Render gridlines at different intervals with different thicknesses
    for (let x = 0; x <= width; x += gridResolution) {
      let className = 'grid-line';
      if (x % 6 === 0) {
        className = 'grid-line-6mu'; // 6 MU intervals - thickest
      } else if (x % 2 === 0) {
        className = 'grid-line-2mu'; // 2 MU intervals - thicker
      }
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="${className}"/>`);
    }
    for (let y = 0; y <= height; y += gridResolution) {
      let className = 'grid-line';
      if (y % 6 === 0) {
        className = 'grid-line-6mu'; // 6 MU intervals - thickest
      } else if (y % 2 === 0) {
        className = 'grid-line-2mu'; // 2 MU intervals - thicker
      }
      lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="${className}"/>`);
    }
    lines.push(`</g>`);
    return lines.join('\n');
  }

  static renderDeploymentZones(
    zones: { x: number; y: number; width: number; height: number; color: string; opacity?: number }[],
    layers: SvgLayerToggle[]
  ): string {
    const layer = layers.find(item => item.id === 'deployment');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const items: string[] = [`<g id="layer-deployment" class="layer ${hidden}">`];
    for (const zone of zones) {
      const opacity = zone.opacity ?? 0.2;
      items.push(`<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="${zone.color}" opacity="${opacity}"/>`);
    }
    items.push(`</g>`);
    return items.join('\n');
  }

  static renderCoverageLabel(label: { text: string; secondaryText?: string; color?: string }, width: number): string {
    const color = label.color ?? '#111';
    const lines = [label.text, label.secondaryText].filter(Boolean) as string[];
    const startY = 0.8;
    const lineHeight = 0.7;
    const parts: string[] = [`<g id="coverage-label">`];
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      parts.push(`<text x="${width - 0.4}" y="${y}" text-anchor="end" fill="${color}" class="label">${line}</text>`);
    });
    parts.push(`</g>`);
    return parts.join('\n');
  }

  static renderDelaunay(mesh: Delaunay<Position> | null, layers: SvgLayerToggle[]): string {
    const layer = layers.find(item => item.id === 'delaunay');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    if (!mesh) {
      return `<g id="layer-delaunay" class="layer ${hidden}"></g>`;
    }
    const lines: string[] = [`<g id="layer-delaunay" class="layer ${hidden}">`];
    const { points } = mesh;
    for (let e = 0; e < mesh.triangles.length; e += 3) {
      const a = mesh.triangles[e];
      const b = mesh.triangles[e + 1];
      const c = mesh.triangles[e + 2];
      const ax = points[a * 2], ay = points[a * 2 + 1];
      const bx = points[b * 2], by = points[b * 2 + 1];
      const cx = points[c * 2], cy = points[c * 2 + 1];
      lines.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="delaunay-line"/>`);
      lines.push(`<line x1="${bx}" y1="${by}" x2="${cx}" y2="${cy}" class="delaunay-line"/>`);
      lines.push(`<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" class="delaunay-line"/>`);
    }
    lines.push(`</g>`);
    return lines.join('\n');
  }

  static renderTerrain(
    terrain: TerrainFeature[],
    layers: SvgLayerToggle[],
    showClearanceZones: boolean = false,
    clearanceZoneColor: string = '#ff0000'
  ): string {
    const areaLayer = layers.find(item => item.id === 'area');
    const buildingLayer = layers.find(item => item.id === 'building');
    const wallLayer = layers.find(item => item.id === 'wall');
    const treeLayer = layers.find(item => item.id === 'tree');
    const rocksLayer = layers.find(item => item.id === 'rocks');
    const shrubLayer = layers.find(item => item.id === 'shrub');
    const terrainLayer = layers.find(item => item.id === 'terrain');
    const areaHidden = areaLayer?.enabled === false ? 'hidden' : '';
    const buildingHidden = buildingLayer?.enabled === false ? 'hidden' : '';
    const wallHidden = wallLayer?.enabled === false ? 'hidden' : '';
    const treeHidden = treeLayer?.enabled === false ? 'hidden' : '';
    const rocksHidden = rocksLayer?.enabled === false ? 'hidden' : '';
    const shrubHidden = shrubLayer?.enabled === false ? 'hidden' : '';
    const terrainHidden = terrainLayer?.enabled === false ? 'hidden' : '';

    const area: string[] = [`<g id="layer-area" class="layer ${areaHidden}">`];
    const building: string[] = [`<g id="layer-building" class="layer ${buildingHidden}">`];
    const wall: string[] = [`<g id="layer-wall" class="layer ${wallHidden}">`];
    const tree: string[] = [`<g id="layer-tree" class="layer ${treeHidden}">`];
    const rocks: string[] = [`<g id="layer-rocks" class="layer ${rocksHidden}">`];
    const shrub: string[] = [`<g id="layer-shrub" class="layer ${shrubHidden}">`];
    const other: string[] = [`<g id="layer-terrain" class="layer ${terrainHidden}">`];
    const clearanceZones: string[] = [`<g id="layer-clearance" class="layer ${showClearanceZones ? '' : 'hidden'}">`];

    for (const feature of terrain) {
      const color = feature.meta?.color ?? '#bbb';
      const layer = feature.meta?.layer ?? 'terrain';
      const category = feature.meta?.category ?? 'terrain';
      const points = feature.vertices.map(point => `${point.x},${point.y}`).join(' ');
      const polygon = `<polygon points="${points}" class="${layer === 'area' ? 'terrain-area' : 'terrain-solid'}"/>`;
      const centroid = SvgRenderer.calculateCentroid(feature.vertices);
      const colorLabel = `<text x="${centroid.x}" y="${centroid.y}" class="label">${color}</text>`;
      
      // Add terrain to appropriate layer
      if (layer === 'area') {
        area.push(polygon, colorLabel);
      } else if (category === 'building') {
        building.push(polygon, colorLabel);
      } else if (category === 'wall') {
        wall.push(polygon, colorLabel);
      } else if (category === 'tree') {
        tree.push(polygon, colorLabel);
      } else if (category === 'rocks') {
        rocks.push(polygon, colorLabel);
      } else if (category === 'shrub') {
        shrub.push(polygon, colorLabel);
      } else {
        other.push(polygon, colorLabel);
      }
      
      // Add clearance zone outline (inflated terrain shape)
      if (showClearanceZones && feature.vertices.length >= 3) {
        const clearanceSvg = SvgRenderer.createClearanceOutline(feature, 0.5, clearanceZoneColor);
        clearanceZones.push(clearanceSvg);
      }
    }

    area.push(`</g>`);
    building.push(`</g>`);
    wall.push(`</g>`);
    tree.push(`</g>`);
    rocks.push(`</g>`);
    shrub.push(`</g>`);
    other.push(`</g>`);
    clearanceZones.push(`</g>`);
    
    return [
      area.join('\n'),
      building.join('\n'),
      wall.join('\n'),
      tree.join('\n'),
      rocks.join('\n'),
      shrub.join('\n'),
      other.join('\n'),
      clearanceZones.join('\n'),
    ].join('\n');
  }

  /**
   * Expand bounds by margin for clearance zone visualization
   */
  static expandBounds(vertices: Position[], margin: number): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const v of vertices) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }

    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin,
    };
  }

  /**
   * Create clearance outline that matches terrain shape (inflated by margin)
   * For circles/ellipses: inflated ellipse
   * For rectangles: inflated rectangle with same rotation
   */
  static createClearanceOutline(feature: TerrainFeature, margin: number, color: string): string {
    const shape = feature.meta?.shape ?? 'rectangle';
    const dimensions = feature.meta?.dimensions;
    const rotation = feature.meta?.rotationDegrees ?? 0;
    const centroid = this.calculateCentroid(feature.vertices);

    if (shape === 'circle' && dimensions?.diameter) {
      // Circle: inflate radius
      const radius = (dimensions.diameter / 2) + margin;
      return `<circle cx="${centroid.x}" cy="${centroid.y}" r="${radius}" fill="none" stroke="${color}" stroke-width="0.08" stroke-dasharray="0.2 0.1" opacity="0.9"/>`;
    }

    if (shape === 'ellipse' && dimensions?.width && dimensions?.length) {
      // Ellipse: inflate both axes
      const rx = (dimensions.width / 2) + margin;
      const ry = (dimensions.length / 2) + margin;
      return `<ellipse cx="${centroid.x}" cy="${centroid.y}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="0.08" stroke-dasharray="0.2 0.1" opacity="0.9" transform="rotate(${rotation} ${centroid.x} ${centroid.y})"/>`;
    }

    if (shape === 'rectangle' && dimensions?.width && dimensions?.length) {
      // Rectangle: inflate width and length, keep rotation
      const width = dimensions.width + (margin * 2);
      const length = dimensions.length + (margin * 2);
      return `<rect x="${centroid.x - width / 2}" y="${centroid.y - length / 2}" width="${width}" height="${length}" fill="none" stroke="${color}" stroke-width="0.08" stroke-dasharray="0.2 0.1" opacity="0.9" transform="rotate(${rotation} ${centroid.x} ${centroid.y})"/>`;
    }

    // Fallback: use polygon offset (simple bounding box for unknown shapes)
    const bounds = this.expandBounds(feature.vertices, margin);
    return `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.maxX - bounds.minX}" height="${bounds.maxY - bounds.minY}" fill="none" stroke="${color}" stroke-width="0.08" stroke-dasharray="0.2 0.1" opacity="0.9"/>`;
  }

  static renderModels(models: SvgRenderOptions['models'], layers: SvgLayerToggle[]): string {
    const layer = layers.find(item => item.id === 'models');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const items: string[] = [`<g id="layer-models" class="layer ${hidden}">`];
    for (const model of models ?? []) {
      const radius = model.baseDiameter / 2;
      items.push(`<circle cx="${model.position.x}" cy="${model.position.y}" r="${radius}" fill="${model.color ?? '#ffcc66'}" class="model"/>`);
      if (model.label) {
        items.push(`<text x="${model.position.x + radius + 0.2}" y="${model.position.y}" class="label">${model.label}</text>`);
      }
    }
    items.push(`</g>`);
    return items.join('\n');
  }

  /**
   * Render grid cells covered by terrain
   * Colors cells based on terrain category (building=black, wall=gray, rocks=lightgray)
   */
  static renderCoveredCells(
    terrain: TerrainFeature[],
    cellSize: number,
    baseColor: string
  ): string {
    const coveredCells = new Map<string, { x: number; y: number; category: string }>();
    
    // For each terrain feature, mark covered cells
    for (const feature of terrain) {
      const category = feature.meta?.category ?? 'terrain';
      const bounds = this.expandBounds(feature.vertices, 0);
      
      // Calculate cell range
      const minXCell = Math.floor(bounds.minX / cellSize);
      const maxXCell = Math.ceil(bounds.maxX / cellSize);
      const minYCell = Math.floor(bounds.minY / cellSize);
      const maxYCell = Math.ceil(bounds.maxY / cellSize);
      
      // Mark cells
      for (let cx = minXCell; cx < maxXCell; cx++) {
        for (let cy = minYCell; cy < maxYCell; cy++) {
          const cellX = cx * cellSize;
          const cellY = cy * cellSize;
          const cellKey = `${cx},${cy}`;
          
          // Check if cell center is inside terrain
          const cellCenter = { x: cellX + cellSize / 2, y: cellY + cellSize / 2 };
          if (this.pointInPolygon(cellCenter, feature.vertices)) {
            coveredCells.set(cellKey, { x: cellX, y: cellY, category });
          }
        }
      }
    }
    
    // Render covered cells
    const parts: string[] = [`<g id="layer-covered-cells" class="layer">`];
    
    for (const cell of coveredCells.values()) {
      let color = baseColor;
      if (cell.category === 'building') color = '#444444';
      else if (cell.category === 'wall') color = '#666666';
      else if (cell.category === 'rocks') color = '#AAAAAA';
      else if (cell.category === 'area') color = '#C49A6C';
      
      parts.push(
        `<rect x="${cell.x}" y="${cell.y}" width="${cellSize}" height="${cellSize}" ` +
        `fill="${color}" opacity="0.5" stroke="none"/>`
      );
    }
    
    parts.push(`</g>`);
    return parts.join('\n');
  }

  /**
   * Check if point is inside polygon
   */
  static pointInPolygon(point: Position, polygon: Position[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersects = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  static renderPaths(paths: SvgRenderOptions['paths'], layers: SvgLayerToggle[]): string {
    const layer = layers.find(item => item.id === 'paths');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const items: string[] = [`<g id="layer-paths" class="layer ${hidden}">`];
    for (const path of paths ?? []) {
      const points = path.points.map(point => `${point.x},${point.y}`).join(' ');
      items.push(`<polyline points="${points}" class="path" stroke="${path.color ?? '#1144aa'}"/>`);
      if (path.label && path.points.length > 0) {
        const last = path.points[path.points.length - 1];
        items.push(`<text x="${last.x + 0.2}" y="${last.y + 0.2}" class="label">${path.label}</text>`);
      }
    }
    items.push(`</g>`);
    return items.join('\n');
  }

  static renderVectors(vectors: SvgRenderOptions['vectors'], layers: SvgLayerToggle[]): string {
    const layer = layers.find(item => item.id === 'vectors');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const items: string[] = [`<g id="layer-vectors" class="layer ${hidden}">`];
    for (const vector of vectors ?? []) {
      items.push(`<line x1="${vector.from.x}" y1="${vector.from.y}" x2="${vector.to.x}" y2="${vector.to.y}" class="vector" stroke="${vector.color ?? '#d14b4b'}"/>`);
      if (vector.label) {
        const midX = (vector.from.x + vector.to.x) / 2;
        const midY = (vector.from.y + vector.to.y) / 2;
        items.push(`<text x="${midX + 0.2}" y="${midY + 0.2}" class="label">${vector.label}</text>`);
      }
    }
    items.push(`</g>`);
    return items.join('\n');
  }

  static renderRays(
    rays: { from: Position; to: Position; color?: string; label?: string }[],
    id: string,
    className: string,
    layers: SvgLayerToggle[]
  ): string {
    const layer = layers.find(item => item.id === id);
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const items: string[] = [`<g id="layer-${id}" class="layer ${hidden}">`];
    for (const ray of rays) {
      items.push(`<line x1="${ray.from.x}" y1="${ray.from.y}" x2="${ray.to.x}" y2="${ray.to.y}" class="${className}" stroke="${ray.color ?? '#333'}"/>`);
      if (ray.label) {
        const midX = (ray.from.x + ray.to.x) / 2;
        const midY = (ray.from.y + ray.to.y) / 2;
        items.push(`<text x="${midX + 0.2}" y="${midY + 0.2}" class="label">${ray.label}</text>`);
      }
    }
    items.push(`</g>`);
    return items.join('\n');
  }

  static renderAnnotations(annotations: SvgRenderOptions['annotations']): string {
    if (!annotations || annotations.length === 0) return '';
    const items: string[] = [`<g id="layer-annotations" class="layer">`];
    for (const annotation of annotations) {
      items.push(`<text x="${annotation.position.x}" y="${annotation.position.y}" class="label" fill="${annotation.color ?? '#111'}">${annotation.text}</text>`);
    }
    items.push(`</g>`);
    return items.join('\n');
  }

  static calculateCentroid(vertices: Position[]): Position {
    if (vertices.length === 0) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const vertex of vertices) {
      x += vertex.x;
      y += vertex.y;
    }
    return { x: x / vertices.length, y: y / vertices.length };
  }

  static buildCategoryStyles(terrain: TerrainFeature[]): { styles: string; presentCategories: Set<string> } {
    const categoryColors = new Map<string, string>();
    for (const feature of terrain) {
      const category = feature.meta?.category;
      const color = feature.meta?.color;
      if (!category || !color) continue;
      if (!categoryColors.has(category)) {
        categoryColors.set(category, color);
      }
    }

    const lines: string[] = [];
    for (const [category, color] of categoryColors.entries()) {
      lines.push(`#layer-${category} { fill: ${color}; }`);
    }
    return { styles: lines.join('\n'), presentCategories: new Set(categoryColors.keys()) };
  }
}
