// /src/ui/molecules/ArmorPicker.js
import { SelectInput } from '../atoms/Input.js';

/**
 * Molecule: Armor selection group
 */
export function ArmorPicker({ helm, suit, shield, onChange }) {
  const armorTypes = [
    { type: 'Helm', options: ['None', 'Light', 'Medium', 'Heavy'] },
    { type: 'Suit', options: ['None', 'Light', 'Medium', 'Heavy'] },
    { type: 'Shield', options: ['None', 'Light', 'Medium', 'Heavy'] }
  ];

  return `
    <div class="armor-picker grid gap-4">
      ${armorTypes.map(armor => `
        ${SelectInput({
          label: `${armor.type} Armor`,
          id: `armor-${armor.type.toLowerCase()}`,
          options: armor.options.map(opt => ({ value: opt, label: opt })),
          value: armor.type === 'Helm' ? helm : 
                 armor.type === 'Suit' ? suit : shield
        })}
      `).join('')}
    </div>
  `;
}