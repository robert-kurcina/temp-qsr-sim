// /src/ui/molecules/ProfileBuilderForm.js
import { SelectInput } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';
import { BPCounter } from '../atoms/BPCounter.js';

export function ProfileBuilderForm({ archetypes, weapons, bpTotal }) {
  return `
    <div class="profile-builder-form">
      ${SelectInput({
        label: 'Archetype',
        id: 'archetype',
        options: archetypes.map(a => ({ value: a.name, label: a.name })),
        value: 'Veteran'
      })}
      
      ${SelectInput({
        label: 'Primary Weapon',
        id: 'weapon',
        options: weapons.map(w => ({ value: w.name, label: `${w.name} (${w.bp} BP)` })),
        value: 'Sword, Broad'
      })}
      
      <div class="bp-summary mb-4">
        Total: ${BPCounter({ bp: bpTotal, status: bpTotal > 150 ? 'warning' : 'normal' })}
      </div>
      
      ${Button({ 
        text: 'Save Profile', 
        variant: 'primary', 
        size: 'lg',
        icon: '👤'
      })}
    </div>
  `;
}