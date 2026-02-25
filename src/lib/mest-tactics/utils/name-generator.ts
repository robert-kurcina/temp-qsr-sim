import * as fs from 'fs';
import * as path from 'path';

const stateFilePath = path.join(process.cwd(), '.name-generator-state.json');

export interface NameGeneratorState {
  usedNames: string[];
  currentLetter: string;
  currentNumber: string;
}

export function readState(): NameGeneratorState {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.usedNames) && typeof parsed.currentLetter === 'string' && typeof parsed.currentNumber === 'string') {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error reading name generator state:', error);
  }
  return { usedNames: [], currentLetter: 'A', currentNumber: '0000' };
}

export function writeState(state: NameGeneratorState): void {
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error writing name generator state:', error);
  }
}

function getNextLetter(letter: string): string {
  if (letter === 'Z') {
    return 'A'; // Wrap around
  } else {
    return String.fromCharCode(letter.charCodeAt(0) + 1);
  }
}

function getNextNumber(number: string): string {
    const nextNum = parseInt(number) + 1;
    if (nextNum > 9999) {
        return '0000';
    }
    return nextNum.toString().padStart(4, '0');
}

export function generateNextName(state: NameGeneratorState): { name: string, nextState: NameGeneratorState } {
  const usedNames = new Set(state.usedNames);
  let { currentLetter, currentNumber } = state;

  let baseName = `${currentLetter}-${currentNumber}`;
  let finalName = baseName;

  if (usedNames.has(finalName)) {
    let suffixLetterCode = 'a'.charCodeAt(0);
    let suffixNumber = 0;

    while (usedNames.has(finalName)) {
      const suffix = `-${String.fromCharCode(suffixLetterCode)}${suffixNumber}`;
      finalName = `${baseName}${suffix}`;

      suffixNumber++;
      if (suffixNumber > 9) {
        suffixNumber = 0;
        suffixLetterCode++;
        if (suffixLetterCode > 'z'.charCodeAt(0)) {
          suffixLetterCode = 'a'.charCodeAt(0);
        }
      }
    }
  }

  const nextNumberForState = getNextNumber(currentNumber);
  const nextLetterForState = nextNumberForState === '0000' ? getNextLetter(currentLetter) : currentLetter;

  const nextState: NameGeneratorState = {
      usedNames: [...usedNames, finalName],
      currentLetter: nextLetterForState,
      currentNumber: nextNumberForState
  };

  return { name: finalName, nextState };
}
