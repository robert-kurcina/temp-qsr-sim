// /src/ui/molecules/BPStatusIndicator.js
import { BPCounter } from '../atoms/BPCounter.js';
import { getBPStatus, isValidBP } from '../../engine/GameSizeService.js';

export function BPStatusIndicator({ bp, gameSize = 'small' }) {
  const status = getBPStatus(bp, gameSize);
  const config = GAME_SIZES[gameSize];
  const isValid = isValidBP(bp, gameSize);
  
  return `
    <div class="bp-status flex items-center gap-2">
      ${BPCounter({ bp, status })}
      <span class="text-xs text-gray-500">${config.minBP}-${config.maxBP} BP</span>
      ${!isValid ? '<span class="status-error ml-1">✗</span>' : ''}
    </div>
  `;
}