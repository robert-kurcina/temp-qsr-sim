// /src/ui/organisms/MissionBuilder.js
/**
 * Mission Builder Organism
 */
export const MissionBuilder = {
  render(data) {
    const assemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
    const assemblyList = Object.keys(assemblies).map(name => name);
    
    return `
      <div class="mission-builder organism-card">
        <h2>⚔️ Build Mission</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Mission Name</label>
          <input type="text" id="mission-name" class="w-full px-3 py-2 border rounded min-h-[48px]" 
                 placeholder="Enter mission name">
        </div>
        
        ${SelectInput({
          label: 'Game Size',
          id: 'mission-game-size',
          options: getGameSizeOptions(),
          value: 'medium'
        })}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div class="side-a">
            <h3 class="font-medium mb-2">Side A</h3>
            ${this.renderAssemblySelector(assemblyList, 'side-a')}
            <div id="side-a-list" class="mt-2"></div>
          </div>
          
          <div class="side-b">
            <h3 class="font-medium mb-2">Side B</h3>
            ${this.renderAssemblySelector(assemblyList, 'side-b')}
            <div id="side-b-list" class="mt-2"></div>
          </div>
        </div>
        
        <div class="mission-total mt-6 p-3 bg-gray-50 rounded-lg">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="font-medium">Side A Total:</span>
              <span id="side-a-total">0 BP</span>
            </div>
            <div>
              <span class="font-medium">Side B Total:</span>
              <span id="side-b-total">0 BP</span>
            </div>
          </div>
        </div>
        
        <div class="mt-6">
          ${Button({ 
            text: 'Save Mission', 
            variant: 'primary',
            size: 'lg',
            icon: '⚔️',
            id: 'save-mission-btn'
          })}
        </div>
      </div>
    `;
  },
  
  renderAssemblySelector(assemblies, side) {
    if (assemblies.length === 0) {
      return '<p class="text-gray-500">No assemblies saved.</p>';
    }
    
    return `
      <select id="assembly-${side}" class="w-full px-3 py-2 border rounded min-h-[48px]">
        <option value="">Select assembly</option>
        ${assemblies.map(name => `<option value="${name}">${name}</option>`).join('')}
      </select>
      <button id="add-${side}-btn" class="btn btn-primary mt-2">➕ Add to ${side.toUpperCase()}</button>
    `;
  },
  
  init() {
    // Add assembly handlers
    ['side-a', 'side-b'].forEach(side => {
      document.getElementById(`add-${side}-btn`)?.addEventListener('click', () => {
        const select = document.getElementById(`assembly-${side}`);
        if (select && select.value) {
          this.addAssemblyToSide(side, select.value);
        }
      });
    });
    
    // Save mission handler
    document.getElementById('save-mission-btn')?.addEventListener('click', () => {
      this.saveMission();
    });
    
    this.updateTotals();
  },

  // Add balance validation
validateMission() {
  const sideA = this.calculateSideTotal('side-a');
  const sideB = this.calculateSideTotal('side-b');
  const gameSize = document.getElementById('mission-game-size').value;
  
  // Check individual side limits
  if (!isValidBP(sideA.total, gameSize)) {
    alert(`Side A BP (${sideA.total}) outside ${GAME_SIZES[gameSize].minBP}-${GAME_SIZES[gameSize].maxBP} range`);
    return false;
  }
  
  if (!isValidBP(sideB.total, gameSize)) {
    alert(`Side B BP (${sideB.total}) outside ${GAME_SIZES[gameSize].minBP}-${GAME_SIZES[gameSize].maxBP} range`);
    return false;
  }
  
  // Check inter-player balance
  if (!isBalanced(sideA.total, sideB.total)) {
    alert(`Sides must be within 25 BP of each other (difference: ${Math.abs(sideA.total - sideB.total)})`);
    return false;
  }
  
  return true;
},
  
  addAssemblyToSide(side, assemblyName) {
    const key = `mest_mission_${side}`;
    const assemblies = JSON.parse(localStorage.getItem(key) || '[]');
    if (!assemblies.includes(assemblyName)) {
      assemblies.push(assemblyName);
      localStorage.setItem(key, JSON.stringify(assemblies));
      this.refreshSideList(side);
      this.updateTotals();
    }

    // Initialize name inputs for this side
    const profiles = /* get profiles for this assembly */;
    this.initNameInputs(side, profiles);
  },
  
  refreshSideList(side) {
    const key = `mest_mission_${side}`;
    const assemblies = JSON.parse(localStorage.getItem(key) || '[]');
    const allAssemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
    
    document.getElementById(`${side}-list`).innerHTML = 
      assemblies.map(name => `
        <div class="flex justify-between items-center p-2 bg-${side === 'side-a' ? 'red' : 'blue'}-50 rounded mb-1">
          <span>${name}</span>
          <button class="remove-assembly ml-2 text-red-600" data-side="${side}" data-name="${name}">×</button>
        </div>
      `).join('');
  },
  
  updateTotals() {
    ['side-a', 'side-b'].forEach(side => {
      const key = `mest_mission_${side}`;
      const assemblies = JSON.parse(localStorage.getItem(key) || '[]');
      const allAssemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
      const allProfiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
      
      let total = 0;
      assemblies.forEach(assemblyName => {
        const assembly = allAssemblies[assemblyName];
        if (assembly) {
          assembly.profiles.forEach(profileName => {
            total += allProfiles[profileName]?.bp || 0;
          });
        }
      });
      
      document.getElementById(`${side}-total`).textContent = `${total} BP`;
    });
  },
  
  saveMission() {
    const name = document.getElementById('mission-name')?.value || 'New Mission';
    const gameSize = document.getElementById('mission-game-size')?.value || 'medium';
    
    const sideA = JSON.parse(localStorage.getItem('mest_mission_side-a') || '[]');
    const sideB = JSON.parse(localStorage.getItem('mest_mission_side-b') || '[]');
    
    if (sideA.length === 0 || sideB.length === 0) {
      alert('Both sides need at least one assembly!');
      return;
    }
    
    const missions = JSON.parse(localStorage.getItem('mest_missions') || '{}');
    missions[name] = { name, gameSize, sideA, sideB };
    localStorage.setItem('mest_missions', JSON.stringify(missions));
    
    alert(`Mission "${name}" saved!`);
  },

  initNameInputs(side, profiles) {
    // Clear previous name assignments for this side
    // (Implementation depends on your data structure)
    
    profiles.forEach((profile, index) => {
      const uniqueId = `mission-name-${side}-${profile.name}-${index}`;
      initNameInput(uniqueId, side, window.NAME_MANAGER, '');
    });
  }
};

// Helper function (would be imported in real app)
function getGameSizeOptions() {
  return [
    { value: 'small', label: 'Small (250 BP)' },
    { value: 'medium', label: 'Medium (500 BP)' },
    { value: 'large', label: 'Large (1000 BP)' }
  ];
}

// Check if sides are within 25 BP
function isBalanced(sideA, sideB) {
  const tolerance = 25; // From game_rules.json
  return Math.abs(sideA.total - sideB.total) <= tolerance;
}