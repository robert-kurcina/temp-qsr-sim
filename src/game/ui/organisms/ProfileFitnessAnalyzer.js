// /src/ui/organisms/ProfileFitnessAnalyzer.js

// Replace hardcoded values with imported data
import { GAME_SIZES } from '../../engine/GameSizeService.js';


/**
 * Analyzes profile efficiency and trait effectiveness
 */
export const ProfileFitnessAnalyzer = {
  render(data) {
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    const profileList = Object.keys(profiles);
    
    if (profileList.length === 0) {
      return `
        <div class="organism-card">
          <h2>🔍 Profile Fitness Analyzer</h2>
          <p class="text-gray-500">No profiles saved. Create one in the Builder first!</p>
        </div>
      `;
    }
    
    // Get selected profile or default to first
    const urlParams = new URLSearchParams(window.location.search);
    const selectedProfile = urlParams.get('profile') || profileList[0];
    const profile = profiles[selectedProfile];
    
    if (!profile) {
      return `<div class="organism-card"><p>Profile not found</p></div>`;
    }
    
    const analysis = this.analyzeProfile(profile, data);
    
    return `
      <div class="profile-fitness organism-card">
        <h2>🔍 ${profile.name} Analysis</h2>
        
        <!-- Profile Selector -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Select Profile</label>
          <select id="analysis-profile-select" class="w-full px-3 py-2 border rounded min-h-[48px]">
            ${profileList.map(name => 
              `<option value="${name}" ${name === selectedProfile ? 'selected' : ''}>${name}</option>`
            ).join('')}
          </select>
        </div>
        
        <!-- BP Allocation -->
        <div class="bp-allocation mt-4">
          <h3 class="font-medium mb-2">BP Allocation</h3>
          ${this.renderBPAllocation(analysis.bpBreakdown)}
        </div>
        
        <!-- Trait Efficiency -->
        <div class="trait-efficiency mt-6">
          <h3 class="font-medium mb-2">Trait Efficiency</h3>
          ${this.renderTraitEfficiency(analysis.traits)}
        </div>
        
        <!-- Recommendations -->
        <div class="recommendations mt-6">
          <h3 class="font-medium mb-2">Recommendations</h3>
          ${this.renderRecommendations(analysis.recommendations)}
        </div>
        
        <!-- Game Size Compliance -->
        <div class="game-size-compliance mt-6">
          <h3 class="font-medium mb-2">Game Size Compliance</h3>
          ${this.renderGameSizeCompliance(profile.bp)}
        </div>
      </div>
    `;
  },
  
  analyzeProfile(profile, data) {
    const bpBreakdown = this.calculateBPBreakdown(profile, data);
    const traits = this.analyzeTraits(profile);
    const recommendations = this.generateRecommendations(profile, bpBreakdown);
    
    return {
      bpBreakdown,
      traits,
      recommendations
    };
  },
  
  calculateBPBreakdown(profile, data) {
    let archetypeBP = 30; // Default Average
    let weaponBP = 0;
    let armorBP = 0;
    let equipmentBP = 0;
    
    // Archetype BP
    const archetype = data.archetypes.common.find(a => a.name === profile.archetype);
    if (archetype) archetypeBP = archetype.bp;
    
    // Weapon BP
    const weapon = data.weapons.find(w => w.name === profile.weapon);
    if (weapon) weaponBP = weapon.bp;
    
    // Armor BP
    if (profile.armor) {
      if (profile.armor.helm !== 'None') {
        const helm = data.armors.find(a => a.type === 'Helm');
        if (helm) {
          const sizeData = helm.sizes.find(s => s.size === profile.armor.helm);
          if (sizeData) armorBP += sizeData.bp;
        }
      }
      if (profile.armor.suit !== 'None') {
        const suit = data.armors.find(a => a.type === 'Armor');
        if (suit) {
          const sizeData = suit.sizes.find(s => s.size === profile.armor.suit);
          if (sizeData) armorBP += sizeData.bp;
        }
      }
      if (profile.armor.shield !== 'None') {
        const shield = data.armors.find(a => a.type === 'Shield');
        if (shield) {
          const sizeData = shield.sizes.find(s => s.size === profile.armor.shield);
          if (sizeData) armorBP += sizeData.bp;
        }
      }
    }
    
    // Equipment BP
    if (profile.equipment) {
      const equip = data.equipment.find(e => e.name === profile.equipment);
      if (equip) equipmentBP = equip.bp;
    }
    
    // Unarmed reduction
    let unarmedReduction = 0;
    if (!profile.weapon || profile.weapon === 'Unarmed') {
      unarmedReduction = -3;
    }
    
    return {
      archetype: archetypeBP,
      weapon: weaponBP,
      armor: armorBP,
      equipment: equipmentBP,
      unarmedReduction: unarmedReduction,
      total: archetypeBP + weaponBP + armorBP + equipmentBP + unarmedReduction
    };
  },
  
  analyzeTraits(profile) {
    const traits = [];
    
    if (profile.equipment === 'Alcohol') {
      traits.push({
        name: 'Advantage Grit',
        efficiency: 'Medium',
        description: 'Grants Advantage on Grit tests'
      });
    }
    
    return traits;
  },
  
  getTraitDescription(trait) {
    const descriptions = {
      'Fighter': 'Reduces penalty dice in combat by 1',
      'Wise': 'Leadership trait for command actions',
      'Tactician': 'Tactics trait for strategic advantages',
      'Brawler': 'Brawl trait for melee combat'
    };
    return descriptions[trait] || 'Trait effect not documented';
  },
  
  generateRecommendations(profile, bpBreakdown) {
    const recommendations = [];
    
    // BP allocation balance
    const weaponPct = (bpBreakdown.weapon / bpBreakdown.total) * 100;
    if (weaponPct > 30) {
      recommendations.push('Weapon cost is high (>30% of total BP)');
    }
    
    const armorPct = (bpBreakdown.armor / bpBreakdown.total) * 100;
    if (armorPct > 25) {
      recommendations.push('Armor cost is high (>25% of total BP)');
    }
    
    return recommendations;
  },
  
  renderBPAllocation(breakdown) {
    const total = breakdown.total;
    const items = [
      { label: 'Archetype', value: breakdown.archetype },
      { label: 'Weapon', value: breakdown.weapon },
      { label: 'Armor', value: breakdown.armor },
      { label: 'Equipment', value: breakdown.equipment }
    ].filter(item => item.value > 0);
    
    if (breakdown.unarmedReduction < 0) {
      items.push({ label: 'Unarmed Reduction', value: breakdown.unarmedReduction });
    }
    
    return `
      <div class="space-y-2">
        ${items.map(item => `
          <div class="flex justify-between">
            <span>${item.label}:</span>
            <span>${item.value > 0 ? '+' : ''}${item.value} BP (${((item.value/total)*100).toFixed(0)}%)</span>
          </div>
        `).join('')}
        <div class="border-t pt-2 font-bold">
          <div class="flex justify-between">
            <span>Total:</span>
            <span>${total} BP</span>
          </div>
        </div>
      </div>
    `;
  },
  
  renderTraitEfficiency(traits) {
    if (traits.length === 0) {
      return '<p class="text-gray-500">No traits detected</p>';
    }
    
    return `
      <div class="space-y-2">
        ${traits.map(trait => `
          <div class="flex justify-between items-center p-2 bg-blue-50 rounded">
            <div>
              <div class="font-medium">${trait.name}</div>
              <div class="text-sm text-gray-600">${trait.description}</div>
            </div>
            <span class="status-success font-medium">${trait.efficiency}</span>
          </div>
        `).join('')}
      </div>
    `;
  },
  
  renderRecommendations(recommendations) {
    if (recommendations.length === 0) {
      return '<p class="text-green-600">✓ No issues detected</p>';
    }
    
    return `
      <div class="space-y-2">
        ${recommendations.map(rec => `
          <div class="flex items-start p-2 bg-yellow-50 rounded">
            <span class="status-warning mr-2">⚠️</span>
            <span>${rec}</span>
          </div>
        `).join('')}
      </div>
    `;
  },
  
 // Replace renderGameSizeCompliance method
renderGameSizeCompliance(bp) {
  const gameSizes = Object.entries(GAME_SIZES).map(([key, config]) => {
    const isValid = bp >= config.minBP && bp <= config.maxBP;
    return {
      name: config.name,
      min: config.minBP,
      max: config.maxBP,
      status: isValid ? 'success' : 'error'
    };
  });
  
  return `
    <div class="space-y-2">
      ${gameSizes.map(size => `
        <div class="flex justify-between items-center p-2 rounded ${size.status === 'success' ? 'bg-green-100' : 'bg-red-100'}">
          <span>${size.name}</span>
          <div>
            <span class="text-sm">${size.min}-${size.max} BP</span>
            <span class="${size.status === 'success' ? 'status-success' : 'status-error'} ml-1">
              ${size.status === 'success' ? '✓' : '✗'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
},
  
  init() {
    // Profile selection handler
    document.getElementById('analysis-profile-select')?.addEventListener('change', (e) => {
      const profile = e.target.value;
      const url = new URL(window.location);
      url.searchParams.set('profile', profile);
      window.history.pushState({}, '', url);
      // Re-render with new profile
      const data = window.APP_DATA;
      document.getElementById('analysis-sub-content').innerHTML = this.render(data);
    });
  }
};