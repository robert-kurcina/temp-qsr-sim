import { Delaunay } from 'd3-delaunay';
import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature } from './Terrain';

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
    .delaunay-line { stroke: #4a6fa5; stroke-width: 0.03; opacity: 0.3; }
    .terrain-area { stroke: #000; stroke-width: 0.05; }
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
    svgParts.push(this.renderTerrain(battlefield.terrain, layers));
    svgParts.push(this.renderModels(options.models ?? [], layers));
    svgParts.push(this.renderPaths(options.paths ?? [], layers));
    svgParts.push(this.renderVectors(options.vectors ?? [], layers));
    svgParts.push(this.renderRays(options.losRays ?? [], 'los', 'los-ray', layers));
    svgParts.push(this.renderRays(options.lofRays ?? [], 'lof', 'lof-ray', layers));
    svgParts.push(this.renderAnnotations(options.annotations ?? []));
    svgParts.push(legendParts.join('\n'));

    svgParts.push(`</svg>`);
    return svgParts.join('\n');
  }

  static renderGrid(width: number, height: number, gridResolution: number, layers: SvgLayerToggle[]): string {
    const layer = layers.find(item => item.id === 'grid');
    const hidden = layer?.enabled === false ? 'hidden' : '';
    const lines: string[] = [`<g id="layer-grid" class="layer ${hidden}">`];
    for (let x = 0; x <= width; x += gridResolution) {
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="grid-line"/>`);
    }
    for (let y = 0; y <= height; y += gridResolution) {
      lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="grid-line"/>`);
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

  static renderTerrain(terrain: TerrainFeature[], layers: SvgLayerToggle[]): string {
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

    for (const feature of terrain) {
      const color = feature.meta?.color ?? '#bbb';
      const layer = feature.meta?.layer ?? 'terrain';
      const category = feature.meta?.category ?? 'terrain';
      const points = feature.vertices.map(point => `${point.x},${point.y}`).join(' ');
      const polygon = `<polygon points="${points}" class="${layer === 'area' ? 'terrain-area' : 'terrain-solid'}"/>`;
      const centroid = SvgRenderer.calculateCentroid(feature.vertices);
      const colorLabel = `<text x="${centroid.x}" y="${centroid.y}" class="label">${color}</text>`;
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
    }

    area.push(`</g>`);
    building.push(`</g>`);
    wall.push(`</g>`);
    tree.push(`</g>`);
    rocks.push(`</g>`);
    shrub.push(`</g>`);
    other.push(`</g>`);
    return [
      area.join('\n'),
      building.join('\n'),
      wall.join('\n'),
      tree.join('\n'),
      rocks.join('\n'),
      shrub.join('\n'),
      other.join('\n'),
    ].join('\n');
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
