import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Battlefield } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { SvgRenderer, type SvgRenderOptions } from '../../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';

export type BattlefieldSvgOptions = Omit<SvgRenderOptions, 'width' | 'height'> & {
  width?: number;
  height?: number;
};

export function renderBattlefieldSvg(
  battlefield: Battlefield,
  options: BattlefieldSvgOptions = {}
): string {
  const width = options.width ?? battlefield.width;
  const height = options.height ?? battlefield.height;
  return SvgRenderer.render(battlefield, {
    ...options,
    width,
    height,
    gridResolution: options.gridResolution ?? 0.5,
  });
}

export function writeBattlefieldSvgFile(
  svgPath: string,
  battlefield: Battlefield,
  options: BattlefieldSvgOptions = {}
): void {
  mkdirSync(dirname(svgPath), { recursive: true });
  const svg = renderBattlefieldSvg(battlefield, options);
  writeFileSync(svgPath, svg, 'utf-8');
}
