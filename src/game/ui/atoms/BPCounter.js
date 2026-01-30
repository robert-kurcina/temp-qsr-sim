// /src/ui/atoms/BPCounter.js
/**
 * BP counter atom with visual feedback
 * @param {number} bp - Build Point value
 * @param {string} [status] - 'normal', 'warning', 'error'
 * @returns {string} HTML string
 */
export function BPCounter({ bp, status = 'normal' }) {
  const statuses = {
    normal: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800'
  };
  
  return `
    <div class="bp-counter inline-flex items-center px-3 py-1 rounded-full font-bold text-sm
                ${statuses[status]} border border-transparent">
      <span class="font-mono">${bp}</span>
      <span class="ml-1">BP</span>
    </div>
  `;
}