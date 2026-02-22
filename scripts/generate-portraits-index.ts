import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CLIP_EXAMPLE,
  EXAMPLE_CELL_WIDTH,
  EXAMPLE_CELL_HEIGHT,
  PORTRAIT_SHEET_COLUMNS,
  PORTRAIT_SHEET_ROWS,
} from '../src/lib/portraits/portrait-clip';

const portraitDirName = 'assets/portraits';
const portraitDir = path.resolve(portraitDirName);
const outputName = 'index.html';
const outputPath = path.join(portraitDir, outputName);
const jsonSpacing = 2;
const jsonReplacer = null;
const utf8Encoding = 'utf8';
const jpgExt = '.jpg';
const jpegExt = '.jpeg';
const pngExt = '.png';
const svgExt = '.svg';
const exampleMarker = 'example-clip';

function isPortraitSheet(name: string): boolean {
  const lower = name.toLowerCase();
  const isImage = lower.endsWith(jpgExt) || lower.endsWith(jpegExt) || lower.endsWith(pngExt) || lower.endsWith(svgExt);
  const isExample = lower.includes(exampleMarker);
  return isImage && !isExample;
}

const portraitFiles = await fs.readdir(portraitDir);
const sheetFiles = portraitFiles.filter(file => isPortraitSheet(file)).sort();
const firstSheet = sheetFiles[0] ?? '';

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Portrait Clip Demo</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Fira Sans", "Helvetica Neue", Arial, sans-serif;
    }
    body {
      margin: 24px;
      background: #f6f3ef;
      color: #1f1a16;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 22px;
      letter-spacing: 0.02em;
    }
    .panel {
      display: grid;
      grid-template-columns: minmax(280px, 340px) 1fr;
      gap: 24px;
      align-items: start;
    }
    .controls {
      padding: 16px;
      background: #fff7ef;
      border: 1px solid #d8c7b6;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
    }
    label {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 14px 0 6px;
    }
    input, select, button {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #c2b2a1;
      border-radius: 8px;
      background: #fff;
      font-size: 14px;
    }
    .clip-area {
      display: grid;
      place-items: center;
      min-height: 320px;
      padding: 16px;
      background: #1f1a16;
      border-radius: 16px;
    }
    .clip-output {
      border-radius: 50%;
      overflow: hidden;
      width: 220px;
      height: 220px;
      border: 4px solid #f92e2e;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .debug {
      margin-top: 12px;
      font-size: 12px;
      color: #574c41;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>Portrait Clip Demo</h1>
  <div class="panel">
    <div class="controls">
      <label for="sheet-select">Portrait Sheet</label>
      <select id="sheet-select"></select>

      <label for="col-input">Column (0-${PORTRAIT_SHEET_COLUMNS - 1})</label>
      <input id="col-input" type="number" min="0" max="${PORTRAIT_SHEET_COLUMNS - 1}" value="0" />

      <label for="row-input">Row (0-${PORTRAIT_SHEET_ROWS - 1})</label>
      <input id="row-input" type="number" min="0" max="${PORTRAIT_SHEET_ROWS - 1}" value="0" />

      <div class="debug" id="clip-info">Loading...</div>
    </div>

    <div class="clip-area">
      <div class="clip-output" id="clip-output"></div>
    </div>
  </div>

  <script>
    const SHEETS = ${JSON.stringify(sheetFiles, jsonReplacer, jsonSpacing)};
    const DEFAULT_SHEET = ${JSON.stringify(firstSheet)};
    const GRID = { columns: ${PORTRAIT_SHEET_COLUMNS}, rows: ${PORTRAIT_SHEET_ROWS} };
    const CLIP_EXAMPLE = { cx: ${CLIP_EXAMPLE.cx}, cy: ${CLIP_EXAMPLE.cy}, r: ${CLIP_EXAMPLE.r} };
    const EXAMPLE_CELL_WIDTH = ${EXAMPLE_CELL_WIDTH};
    const EXAMPLE_CELL_HEIGHT = ${EXAMPLE_CELL_HEIGHT};
    const EXAMPLE_CANVAS_WIDTH = 1920;
    const EXAMPLE_CANVAS_HEIGHT = 1920;

    const sheetSelectId = 'sheet-select';
    const colInputId = 'col-input';
    const rowInputId = 'row-input';
    const clipOutputId = 'clip-output';
    const infoId = 'clip-info';
    const inputEvent = 'input';
    const changeEvent = 'change';
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svgTag = 'svg';
    const defsTag = 'defs';
    const clipPathTag = 'clipPath';
    const circleTag = 'circle';
    const imageTag = 'image';
    const optionTag = 'option';
    const viewBoxAttr = 'viewBox';
    const widthAttr = 'width';
    const heightAttr = 'height';
    const xAttr = 'x';
    const yAttr = 'y';
    const idAttr = 'id';
    const cxAttr = 'cx';
    const cyAttr = 'cy';
    const rAttr = 'r';
    const hrefAttr = 'href';
    const clipPathAttr = 'clip-path';
    const preserveAspectAttr = 'preserveAspectRatio';
    const preserveAspectValue = 'none';
    const clipId = 'clip-circle';
    const emptyValue = '';
    const newline = '\\n';
    const defaultColumn = 0;
    const defaultRow = 0;
    const precision = 2;
    const OUTPUT_PX = 220; // matches .clip-output CSS width/height

    const sheetSelect = document.getElementById(sheetSelectId);
    const colInput = document.getElementById(colInputId);
    const rowInput = document.getElementById(rowInputId);
    const clipOutput = document.getElementById(clipOutputId);
    const info = document.getElementById(infoId);

    function clamp(value, min, max) {
      const lower = Math.max(value, min);
      const upper = Math.min(lower, max);
      return upper;
    }

    function parseNumber(value, fallback) {
      const parsed = Number.parseFloat(value);
      const isValid = Number.isFinite(parsed);
      return isValid ? parsed : fallback;
    }

    function getClipMetrics(sheetWidth, sheetHeight, column, row) {
      const width = sheetWidth;
      const height = sheetHeight;
      const col = column;
      const rowIndex = row;

      const scaleX = width / EXAMPLE_CANVAS_WIDTH;
      const scaleY = height / EXAMPLE_CANVAS_HEIGHT;

      const centerX = (CLIP_EXAMPLE.cx + col * EXAMPLE_CELL_WIDTH) * scaleX;
      const centerY = (CLIP_EXAMPLE.cy + rowIndex * EXAMPLE_CELL_HEIGHT) * scaleY;

      const radius = CLIP_EXAMPLE.r * (0.5 * (scaleX + scaleY));
      const diameter = radius * 2;

      const cellWidth = EXAMPLE_CELL_WIDTH * scaleX;
      const cellHeight = EXAMPLE_CELL_HEIGHT * scaleY;

      return {
        center: { x: centerX, y: centerY },
        radius,
        diameter,
        cellWidth,
        cellHeight,
      };
    }

    function createClipSvg(sheetSrc, metrics, sheetWidth, sheetHeight) {
      const diameter = metrics.diameter;
      const radius = metrics.radius;
      const center = metrics.center;
      const viewSize = diameter;
      const viewHalf = viewSize / 2;
      const imageX = viewHalf - center.x;
      const imageY = viewHalf - center.y;
      const svgNs = svgNamespace;
      const svg = document.createElementNS(svgNs, svgTag);
      const viewBox = '0 0 ' + viewSize + ' ' + viewSize;
      const widthValue = String(OUTPUT_PX);
      const heightValue = String(OUTPUT_PX);
      svg.setAttribute(viewBoxAttr, viewBox);
      svg.setAttribute(widthAttr, widthValue);
      svg.setAttribute(heightAttr, heightValue);

      const defs = document.createElementNS(svgNs, defsTag);
      const clipPath = document.createElementNS(svgNs, clipPathTag);
      const clipName = clipId;
      clipPath.setAttribute(idAttr, clipName);
      const circle = document.createElementNS(svgNs, circleTag);
      const centerValue = String(viewHalf);
      const radiusValue = String(radius);
      circle.setAttribute(cxAttr, centerValue);
      circle.setAttribute(cyAttr, centerValue);
      circle.setAttribute(rAttr, radiusValue);
      clipPath.appendChild(circle);
      defs.appendChild(clipPath);
      svg.appendChild(defs);

      const image = document.createElementNS(svgNs, imageTag);
      const sheetPath = sheetSrc;
      image.setAttribute(hrefAttr, sheetPath);
      image.setAttribute(widthAttr, String(sheetWidth));
      image.setAttribute(heightAttr, String(sheetHeight));
      image.setAttribute(xAttr, String(imageX));
      image.setAttribute(yAttr, String(imageY));
      image.setAttribute(preserveAspectAttr, preserveAspectValue);
      image.setAttribute(clipPathAttr, 'url(#' + clipName + ')');
      svg.appendChild(image);

      return svg;
    }

    function updateClip() {
      const colRaw = parseNumber(colInput.value, defaultColumn);
      const rowRaw = parseNumber(rowInput.value, defaultRow);
      const minColumn = defaultColumn;
      const minRow = defaultRow;
      const maxColumn = GRID.columns - 1;
      const maxRow = GRID.rows - 1;
      const col = clamp(colRaw, minColumn, maxColumn);
      const row = clamp(rowRaw, minRow, maxRow);
      const selected = sheetSelect.value || DEFAULT_SHEET;
      const image = new Image();
      const srcValue = selected;
      image.src = srcValue;

      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const metrics = getClipMetrics(width, height, col, row);
        const svg = createClipSvg(srcValue, metrics, width, height);
        clipOutput.replaceChildren(svg);

        const infoLines = [
          'sheet: ' + selected,
          'sheet size: ' + width + ' x ' + height,
          'cell: ' + metrics.cellWidth.toFixed(precision) + ' x ' + metrics.cellHeight.toFixed(precision),
          'clip center: ' + metrics.center.x.toFixed(precision) + ', ' + metrics.center.y.toFixed(precision),
          'clip radius: ' + metrics.radius.toFixed(precision),
        ];
        info.textContent = infoLines.join(newline);
      };
    }

    function populateSheets() {
      sheetSelect.innerHTML = emptyValue;
      const list = SHEETS.length > 0 ? SHEETS : [DEFAULT_SHEET];
      list.forEach(sheetName => {
        const option = document.createElement(optionTag);
        option.value = sheetName;
        option.textContent = sheetName;
        sheetSelect.appendChild(option);
      });
      if (DEFAULT_SHEET) {
        sheetSelect.value = DEFAULT_SHEET;
      }
    }

    populateSheets();
    updateClip();

    sheetSelect.addEventListener(changeEvent, updateClip);
    colInput.addEventListener(inputEvent, updateClip);
    rowInput.addEventListener(inputEvent, updateClip);
  </script>
</body>
</html>
`;

await fs.writeFile(outputPath, html, utf8Encoding);
console.log(`[generate-portraits-index] wrote ${outputPath}`);
