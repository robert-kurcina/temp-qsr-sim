// /src/ui/organisms/CharacterBuilder.js
import { SelectInput } from '../atoms/SelectInput.js';
import { Button } from '../atoms/Button.js';
import { BPStatusIndicator } from '../molecules/BPStatusIndicator.js';
import { getGameSizeOptions } from '../../engine/GameSizeService.js';

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
          ${this.renderArmorSection()}
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
  
  renderArmorSection() {
    const armorTypes = ['Helm', 'Suit', 'Shield'];
    const sizes = ['None', 'Light', 'Medium', 'Heavy'];
    
    return armorTypes.map(type => `
      ${SelectInput({
        label: `${type} Armor`,
        id: `armor-${type.toLowerCase()}`,
        options: sizes.map(s => ({ value: s, label: s })),
        value: 'None'
      })}
    `).join('');
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
      const archetype = document.getElementById('archetype-select')?.value || 'Veteran';
      const variant = document.getElementById('variant-select')?.value || '';
      const weapon = document.getElementById('weapon-select')?.value || 'Unarmed';
      const gameSize = document.getElementById('game-size-select')?.value || 'medium';
      
      // Calculate BP (simplified - would use CharacterBuilder logic)
      let bp = 30; // Default Average
      if (archetype === 'Veteran') bp = 61;
      if (archetype === 'Elite') bp = 129;
      
      if (variant === 'Fighter' || variant === 'Brawler') bp += 12;
      if (variant === 'Wise' || variant === 'Tactician') bp += 20;
      
      const weaponData = data.weapons.find(w => w.name === weapon);
      if (weaponData) bp += weaponData.bp;
      
      // Update display
      document.getElementById('bp-total-display').textContent = `${bp} BP`;
    };
    
    // Listen for changes
    ['archetype-select', 'variant-select', 'weapon-select', 'game-size-select']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateBP);
      });
    
    updateBP(); // Initial calculation
  },
  
  saveProfile() {
    const name = prompt('Enter profile name:');
    if (!name) return;
    
    const profile = {
      name,
      archetype: document.getElementById('archetype-select').value,
      variant: document.getElementById('variant-select').value,
      weapon: document.getElementById('weapon-select').value,
      armor: {
        helm: document.getElementById('armor-helm').value,
        suit: document.getElementById('armor-suit').value,
        shield: document.getElementById('armor-shield').value
      },
      equipment: document.getElementById('equipment-select').value,
      gameSize: document.getElementById('game-size-select').value,
      bp: parseInt(document.getElementById('bp-total-display').textContent)
    };
    
    // Save to localStorage
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    profiles[name] = profile;
    localStorage.setItem('mest_profiles', JSON.stringify(profiles));
    
    alert(`Profile "${name}" saved!`);
  }
};