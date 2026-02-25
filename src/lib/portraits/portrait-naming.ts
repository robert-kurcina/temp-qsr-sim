import {
  PORTRAIT_SHEET_COLUMNS,
  PORTRAIT_SHEET_ROWS,
} from './portrait-clip';

export const DEFAULT_PORTRAIT_SHEET = 'assets/portraits/human-quaggkhir-male.jpg';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const dash = '-';
const nameLength = 5;
const columnBase = 10;
const rowBase = 10;
const portraitIndexLabel = 'Portrait index';
const portraitColumnLabel = 'Portrait column';
const portraitRowLabel = 'Portrait row';
const lengthMessage = `Portrait name must be ${nameLength} characters.`;
const letterMessage = 'Portrait name must start with two capital letters.';
const dashMessage = 'Portrait name must include a dash at position 3.';
const digitMessage = 'Portrait name must end with two digits.';

export interface PortraitSlot {
  sheet: string;
  column: number;
  row: number;
}

export interface NamedPortraitAssignment extends PortraitSlot {
  name: string;
}

function validateIndex(value: number, label: string): number {
  const name = label;
  const index = value;
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return index;
}

function validateRange(value: number, max: number, label: string): number {
  const name = label;
  const maxValue = max;
  const numeric = value;
  if (numeric >= maxValue) {
    throw new Error(`${name} must be less than ${maxValue}.`);
  }
  return numeric;
}

export function createPortraitName(index: number): string {
  const gridColumns = PORTRAIT_SHEET_COLUMNS;
  const gridRows = PORTRAIT_SHEET_ROWS;
  const gridSize = gridColumns * gridRows;
  const letterCount = letters.length;
  const maxNames = letterCount * letterCount * gridSize;
  const safeIndex = validateIndex(index, portraitIndexLabel);
  validateRange(safeIndex, maxNames, portraitIndexLabel);

  const letterIndexQuotient = safeIndex / gridSize;
  const letterIndex = Math.floor(letterIndexQuotient);
  const firstLetterQuotient = letterIndex / letterCount;
  const firstLetterIndex = Math.floor(firstLetterQuotient);
  const secondLetterIndex = letterIndex % letterCount;
  const digitsIndex = safeIndex % gridSize;
  const column = digitsIndex % gridColumns;
  const rowQuotient = digitsIndex / gridColumns;
  const row = Math.floor(rowQuotient);

  const firstLetter = letters[firstLetterIndex];
  const secondLetter = letters[secondLetterIndex];
  const colDigit = String(column);
  const rowDigit = String(row);

  return firstLetter + secondLetter + dash + colDigit + rowDigit;
}

export function parsePortraitName(name: string): { column: number; row: number } {
  const rawName = name;
  if (rawName.length !== nameLength) {
    const message = lengthMessage;
    throw new Error(message);
  }

  const firstLetter = rawName[0];
  const secondLetter = rawName[1];
  const dashChar = rawName[2];
  const columnChar = rawName[3];
  const rowChar = rawName[4];

  if (!letters.includes(firstLetter) || !letters.includes(secondLetter)) {
    const message = letterMessage;
    throw new Error(message);
  }
  if (dashChar !== dash) {
    const message = dashMessage;
    throw new Error(message);
  }

  const columnValue = Number.parseInt(columnChar, columnBase);
  const rowValue = Number.parseInt(rowChar, rowBase);

  if (!Number.isInteger(columnValue) || !Number.isInteger(rowValue)) {
    const message = digitMessage;
    throw new Error(message);
  }

  const maxColumn = PORTRAIT_SHEET_COLUMNS;
  const maxRow = PORTRAIT_SHEET_ROWS;
  validateRange(columnValue, maxColumn, portraitColumnLabel);
  validateRange(rowValue, maxRow, portraitRowLabel);

  return { column: columnValue, row: rowValue };
}

export function createPortraitAssignmentFromIndex(
  index: number,
  sheet: string = DEFAULT_PORTRAIT_SHEET
): NamedPortraitAssignment {
  const sheetName = sheet;
  const portraitName = createPortraitName(index);
  const coordinates = parsePortraitName(portraitName);

  return {
    name: portraitName,
    sheet: sheetName,
    column: coordinates.column,
    row: coordinates.row,
  };
}

export function createPortraitAssignmentFromName(
  name: string,
  sheet: string = DEFAULT_PORTRAIT_SHEET
): NamedPortraitAssignment {
  const sheetName = sheet;
  const portraitName = name;
  const coordinates = parsePortraitName(portraitName);

  return {
    name: portraitName,
    sheet: sheetName,
    column: coordinates.column,
    row: coordinates.row,
  };
}
