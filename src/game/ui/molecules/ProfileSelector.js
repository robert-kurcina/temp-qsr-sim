// /src/ui/molecules/ProfileSelector.js
import { SelectInput } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';

/**
 * Molecule: Profile selection with add/remove
 */
export function ProfileSelector({ profiles, onAdd, onRemove }) {
  const profileOptions = profiles.map(p => ({ 
    value: p.name, 
    label: `${p.name} (${p.bp} BP)` 
  }));

  return `
    <div class="profile-selector">
      ${SelectInput({
        label: 'Select Profile',
        id: 'profile-select',
        options: profileOptions,
        value: profileOptions[0]?.value || ''
      })}
      
      <div class="action-buttons flex gap-2">
        ${Button({ 
          text: 'Add to Assembly', 
          variant: 'primary',
          icon: '➕'
        })}
        ${Button({ 
          text: 'Remove', 
          variant: 'secondary',
          icon: '➖'
        })}
      </div>
    </div>
  `;
}