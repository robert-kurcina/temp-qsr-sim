// /src/ui/atoms/SelectInput.js
/**
 * Generic select input atom - no hardcoded data
 */
export function SelectInput({ label, id, options, value = '' }) {
  return `
    <div class="input-group mb-4">
      <label for="${id}" class="block text-sm font-medium text-gray-700 mb-1">
        ${label}
      </label>
      <select 
        id="${id}" 
        class="w-full px-3 py-2 border border-gray-300 rounded-lg 
               bg-white text-gray-800 min-h-[48px] text-base"
        style="appearance: none; background-image: url(\"image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\"); background-position: right 0.5rem center; background-repeat: no-repeat; padding-right: 2rem;"
      >
        ${options.map(opt => `
          <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>
            ${opt.label}
          </option>
        `).join('')}
      </select>
    </div>
  `;
}