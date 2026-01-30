// /src/ui/molecules/CharacterNameInput.js
import { Button } from '../atoms/Button.js';

/**
 * Character name input with validation and canonical fallback
 */
export function CharacterNameInput({ 
  id, 
  side, 
  currentName = '', 
  onNameChange,
  onValidationChange
}) {
  const sideLabel = side === 'side-a' ? 'Red Side' : 'Blue Side';
  const placeholder = side === 'side-a' ? 'A-N' : 'Z-M';
  
  return `
    <div class="character-name-input mb-3">
      <label for="${id}" class="block text-sm font-medium mb-1">
        ${sideLabel} Name (max 12 chars)
      </label>
      <div class="flex gap-2">
        <input 
          type="text" 
          id="${id}" 
          class="flex-1 px-3 py-2 border rounded min-h-[48px] text-base"
          placeholder="e.g., ${placeholder}"
          maxlength="12"
          value="${currentName}"
        />
        <button 
          id="reset-${id}" 
          class="btn btn-secondary min-w-[48px] px-2"
          title="Reset to canonical letter"
        >
          ↺
        </button>
      </div>
      <div id="name-status-${id}" class="text-sm mt-1"></div>
    </div>
  `;
}

/**
 * Initialize name input behavior
 */
export function initNameInput(id, side, nameManager, initialName = '') {
  const input = document.getElementById(id);
  const resetBtn = document.getElementById(`reset-${id}`);
  const statusDiv = document.getElementById(`name-status-${id}`);
  
  // Store current assigned name
  let currentAssignedName = initialName;
  
  // Initialize with canonical letter if no initial name
  if (!initialName) {
    const result = nameManager.assignName('', side);
    currentAssignedName = result.name;
    input.value = ''; // Keep input empty to show placeholder
    updateStatus(statusDiv, result);
  } else {
    // Reserve the initial name
    const result = nameManager.assignName(initialName, side, '');
    currentAssignedName = result.name;
    input.value = initialName;
    updateStatus(statusDiv, result);
  }
  
  // Input change handler
  input.addEventListener('input', () => {
    const proposedName = input.value;
    const result = nameManager.assignName(proposedName, side, currentAssignedName);
    
    // Update current assigned name only if valid
    if (result.isValid) {
      currentAssignedName = result.name;
    }
    
    updateStatus(statusDiv, result);
    
    // Trigger change callback
    if (typeof onNameChange === 'function') {
      onNameChange(result.name, result.isValid);
    }
    
    if (typeof onValidationChange === 'function') {
      onValidationChange(result.isValid);
    }
  });
  
  // Reset button handler
  resetBtn.addEventListener('click', () => {
    // Clear input and reassign canonical letter
    const result = nameManager.assignName('', side, currentAssignedName);
    currentAssignedName = result.name;
    input.value = '';
    updateStatus(statusDiv, result);
    
    if (typeof onNameChange === 'function') {
      onNameChange(result.name, result.isValid);
    }
    
    if (typeof onValidationChange === 'function') {
      onValidationChange(result.isValid);
    }
  });
  
  function updateStatus(element, result) {
    if (result.isValid) {
      element.innerHTML = result.isCanonical 
        ? `<span class="text-gray-500">Using canonical letter: <strong>${result.name}</strong></span>`
        : `<span class="text-green-600">✓ Unique name: <strong>${result.name}</strong></span>`;
      input.classList.remove('border-red-500');
      input.classList.add('border-gray-300');
    } else {
      element.innerHTML = `<span class="text-red-600">⚠️ Name "${result.name}" is not unique!</span>`;
      input.classList.remove('border-gray-300');
      input.classList.add('border-red-500');
    }
  }
}