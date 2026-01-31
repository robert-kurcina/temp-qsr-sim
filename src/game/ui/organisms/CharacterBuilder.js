// /src/ui/organisms/CharacterBuilder.js
import { SelectInput } from '../atoms/SelectInput.js';
import { Button } from '../atoms/Button.js';
import { BPStatusIndicator } from '../molecules/BPStatusIndicator.js';
import { getGameSizeOptions } from '../../engine/GameSizeService.js';
import { CharacterBuilder } from '../../builder/CharacterBuilder.js';
import { ProfileManager } from '../../builder/ProfileManager.js';

/**
 * Character Builder Organism
 */
export const CharacterBuilder = {
  render(data) {
    const gameSizeOptions = getGameSizeOptions();
    const archetypeOptions = this.getArchetypeOptions(data.archetypes);
    const weaponOptions = this.getWeaponOptions(data.weapons);

    return `
      <div class="character-builder organism-card">
        <h2>👤 Build Character Profile</h2>

        ${SelectInput({
          label: 'Archetype',
          id: 'archetype-select',
          options: archetypeOptions,
          value: 'Veteran'
        })}

        ${SelectInput({
          label: 'Variant Trait',
          id: 'variant-select',
          options: [
            { value: '', label: 'None' },
            { value: 'Fighter', label: 'Fighter (+12 BP)' },
            { value: 'Wise', label: 'Wise (+20 BP)' },
            { value: 'Tactician', label: 'Tactician (+20 BP)' },
            { value: 'Brawler', label: 'Brawler (+12 BP)' }
          ],
          value: ''
        })}

        ${SelectInput({
          label: 'Primary Weapon',
          id: 'weapon-select',
          options: weaponOptions,
          value: 'Sword, Broad'
        })}

        ${SelectInput({
          label: 'Game Size',
          id: 'game-size-select',
          options: gameSizeOptions,
          value: 'medium'
        })}

        <div class="armor-section mt-4">
          <h3>🛡️ Armor</h3>
          ${this.renderArmorSection(data.armors)}
        </div>

        <div class="equipment-section mt-4">
          <h3>🎒 Equipment</h3>
          ${SelectInput({
            label: 'Equipment',
            id: 'equipment-select',
            options: [
              { value: '', label: 'None' },
              ...data.equipment.map(e => ({ value: e.name, label: e.name }))
            ],
            value: ''
          })}
        </div>

        <div class="bp-summary mt-6 p-3 bg-gray-50 rounded-lg">
          <div class="flex justify-between items-center">
            <span class="font-medium">Total Build Points:</span>
            <span id="bp-total-display">0 BP</span>
          </div>
        </div>

        <div class="mt-6">
          ${Button({
            text: 'Save Profile',
            variant: 'primary',
            size: 'lg',
            icon: '👤',
            id: 'save-profile-btn'
          })}
        </div>
      </div>
    `;
  },

  getArchetypeOptions(archetypes) {
    return archetypes.common.map(a => ({
      value: a.name,
      label: `${a.name} (${a.bp} BP)`
    }));
  },

  getWeaponOptions(weapons) {
    return weapons.map(w => ({
      value: w.name,
      label: `${w.name} (${w.bp} BP)`
    }));
  },

  renderArmorSection(armors) {
    const armorClasses = ['Helm', 'Armor', 'Shield']; // 'Armor' is the class for suits

    return armorClasses.map(armorClass => {
      const armorOptions = armors
        .filter(a => a.class === armorClass)
        .map(a => ({ value: a.name, label: `${a.name} (${a.bp} BP)` }));

      const label = armorClass === 'Armor' ? 'Suit' : armorClass;

      return `
        ${SelectInput({
          label: `${label} Armor`,
          id: `armor-${label.toLowerCase()}`,
          options: [{ value: '', label: 'None' }, ...armorOptions],
          value: ''
        })}
      `;
    }).join('');
  },

  // Initialize dynamic behavior
  init(data) {
    // Set global data reference
    window.APP_DATA = data;

    // BP calculation
    this.setupBPListener(data);

    // Save handler
    document.getElementById('save-profile-btn')?.addEventListener('click', () => {
      this.saveProfile();
    });
  },

  setupBPListener(data) {
    const updateBP = () => {
      const archetype = document.getElementById('archetype-select').value;
      const variant = document.getElementById('variant-select').value;
      const weapon = document.getElementById('weapon-select').value;

      const armor = [];
      const helm = document.getElementById('armor-helm').value;
      if (helm) armor.push(helm);
      const suit = document.getElementById('armor-suit').value;
      if (suit) armor.push(suit);
      const shield = document.getElementById('armor-shield').value;
      if (shield) armor.push(shield);

      const equipment = document.getElementById('equipment-select').value;

      const config = {
        archetype,
        variant,
        weapons: weapon ? [weapon] : [],
        armor,
        equipment,
      };

      try {
        const profile = CharacterBuilder.build(config);
        document.getElementById('bp-total-display').textContent = `${profile.bp} BP`;
      } catch (error) {
        console.error("Failed to calculate BP:", error);
        document.getElementById('bp-total-display').textContent = `Error`;
      }
    };

    // Listen for changes
    ['archetype-select', 'variant-select', 'weapon-select', 'game-size-select', 'armor-helm', 'armor-suit', 'armor-shield', 'equipment-select']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateBP);
      });

    updateBP(); // Initial calculation
  },

  saveProfile() {
    const name = prompt('Enter profile name:');
    if (!name) return;

    const archetype = document.getElementById('archetype-select').value;
    const variant = document.getElementById('variant-select').value;
    const weapon = document.getElementById('weapon-select').value;

    const armor = [];
    const helm = document.getElementById('armor-helm').value;
    if (helm) armor.push(helm);
    const suit = document.getElementById('armor-suit').value;
    if (suit) armor.push(suit);
    const shield = document.getElementById('armor-shield').value;
    if (shield) armor.push(shield);

    const equipment = document.getElementById('equipment-select').value;

    const config = {
      archetype,
      variant,
      weapons: weapon ? [weapon] : [],
      armor,
      equipment,
    };

    try {
      const profile = CharacterBuilder.build(config);
      ProfileManager.save(name, profile);
      alert(`Profile "${name}" saved!`);
    } catch (error)
      {
      console.error("Failed to save profile:", error);
      alert(`Error saving profile: ${error.message}`);
    }
  }
};