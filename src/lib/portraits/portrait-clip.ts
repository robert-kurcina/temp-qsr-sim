export const PORTRAIT_SHEET_COLUMNS = 8;
export const PORTRAIT_SHEET_ROWS = 6;

// Anchor derived from portraits/human-quaggkhir-male-example-clip.svg (column 0, row 0).
// Sheet layout is 8 columns x 6 rows on a 1920 x 1920 canvas.
export const CLIP_EXAMPLE = {
  cx: 168.47746,
  cy: 456.87289,
  r: 94.130058,
};

// Measured cell spacing from the example SVG (distance between column centers
// and between row centers). These values come from the red-circle grid in
// portraits/human-quaggkhir-male-example-clip.svg.
export const EXAMPLE_CELL_WIDTH = 225.00734;
export const EXAMPLE_CELL_HEIGHT = 223.54691;
// The source SVG uses a 1920x1920 canvas (viewBox). Use that as the
// original canvas size for scaling anchors to target sheet images.
export const EXAMPLE_CANVAS_WIDTH = 1920;
export const EXAMPLE_CANVAS_HEIGHT = 1920;

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
  // Compute scale factors relative to the example grid so the circle anchors
  // (measured in the example SVG) map to any sheet image size.
  const scaleX = width / EXAMPLE_CANVAS_WIDTH;
  const scaleY = height / EXAMPLE_CANVAS_HEIGHT;

  const baseX = CLIP_EXAMPLE.cx;
  const baseY = CLIP_EXAMPLE.cy;

  const centerX = (baseX + col * EXAMPLE_CELL_WIDTH) * scaleX;
  const centerY = (baseY + rowIndex * EXAMPLE_CELL_HEIGHT) * scaleY;

  // Scale the radius using the average of the X/Y scales to preserve shape.
  const radius = CLIP_EXAMPLE.r * (0.5 * (scaleX + scaleY));

  const cellWidth = EXAMPLE_CELL_WIDTH * scaleX;
  const cellHeight = EXAMPLE_CELL_HEIGHT * scaleY;
  const diameter = radius * 2;

  return {
    center: { x: centerX, y: centerY },
    radius,
    diameter,
    cellWidth,
    cellHeight,
  };
}
