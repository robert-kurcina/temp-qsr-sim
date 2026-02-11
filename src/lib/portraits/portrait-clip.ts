export const PORTRAIT_SHEET_COLUMNS = 8;
export const PORTRAIT_SHEET_ROWS = 6;

// Anchor derived from portraits/human-quaggkhir-male-example-clip.svg (column 0, row 0).
// Sheet layout is 8 columns x 6 rows on a 1920 x 1920 canvas.
export const CLIP_EXAMPLE = {
  cx: 169.50751,
  cy: 456.80441,
  r: 94.130051,
};

export interface ClipCenter {
  x: number;
  y: number;
}

export interface ClipMetrics {
  center: ClipCenter;
  radius: number;
  diameter: number;
  cellWidth: number;
  cellHeight: number;
}

export function getClipMetrics(
  sheetWidth: number,
  sheetHeight: number,
  column: number,
  row: number
): ClipMetrics {
  // Column/row are 0-based indices (top-left is 0:0).
  const width = sheetWidth;
  const height = sheetHeight;
  const col = column;
  const rowIndex = row;
  const columns = PORTRAIT_SHEET_COLUMNS;
  const rows = PORTRAIT_SHEET_ROWS;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const baseX = CLIP_EXAMPLE.cx;
  const baseY = CLIP_EXAMPLE.cy;
  const colOffset = col * cellWidth;
  const rowOffset = rowIndex * cellHeight;
  const centerX = baseX + colOffset;
  const centerY = baseY + rowOffset;
  const radius = CLIP_EXAMPLE.r;
  const diameter = radius * 2;

  return {
    center: { x: centerX, y: centerY },
    radius,
    diameter,
    cellWidth,
    cellHeight,
  };
}
