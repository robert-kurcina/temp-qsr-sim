// /src/ui/organisms/AssemblyManager.js
/**
 * Assembly Manager Organism
 */
export const AssemblyManager = {
  render(data) {
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    const profileList = Object.entries(profiles).map(([name, profile]) => ({
      name,
      bp: profile.bp
    }));
    
    return `
      <div class="assembly-manager organism-card">
        <h2>🧩 Build Assembly</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Assembly Name</label>
          <input type="text" id="assembly-name" class="w-full px-3 py-2 border rounded min-h-[48px]" 
                 placeholder="Enter assembly name">
        </div>
        
        ${this.renderProfileSelector(profileList)}
        ${this.renderSelectedProfiles(profileList)}
        
        <div class="total-bp mt-6 p-3 bg-gray-50 rounded-lg">
          <div class="flex justify-between items-center">
            <span class="font-medium">Assembly Total:</span>
            <span id="assembly-total">0 BP</span>
          </div>
        </div>
        
        <div class="mt-6">
          ${Button({ 
            text: 'Save Assembly', 
            variant: 'primary',
            size: 'lg',
            icon: '🧩',
            id: 'save-assembly-btn'
          })}
        </div>
      </div>
    `;
  },
  
  renderProfileSelector(profiles) {
    if (profiles.length === 0) {
      return '<p class="text-gray-500">No profiles saved. Create one first!</p>';
    }
    
    return `
      <div class="profile-selector mb-4">
        <h3 class="font-medium mb-2">Available Profiles</h3>
        <select id="profile-select" class="w-full px-3 py-2 border rounded min-h-[48px]">
          ${profiles.map(p => `<option value="${p.name}">${p.name} (${p.bp} BP)</option>`).join('')}
        </select>
        <button id="add-profile-btn" class="btn btn-primary mt-2">➕ Add to Assembly</button>
      </div>
    `;
  },
  
  renderSelectedProfiles(profiles, side = 'side-a') {
    // Initialize name manager if not exists
    if (!window.NAME_MANAGER) {
      window.NAME_MANAGER = new NameManager();
    }
    
    return `
      <div class="selected-profiles mt-4">
        <h3 class="font-medium mb-2">In Assembly (${profiles.length})</h3>
        <div id="selected-profiles-list">
          ${profiles.map((p, index) => {
            const uniqueId = `name-${side}-${p.name}-${index}`;
            return `
              <div class="flex items-center p-2 bg-${side === 'side-a' ? 'red' : 'blue'}-50 rounded mb-2">
                <span class="mr-2">${p.name}</span>
                ${CharacterNameInput({ 
                  id: uniqueId, 
                  side: side,
                  currentName: '' 
                })}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },
  
  init() {
    // Add profile handler
    document.getElementById('add-profile-btn')?.addEventListener('click', () => {
      const select = document.getElementById('profile-select');
      if (select && select.value) {
        this.addProfileToAssembly(select.value);
      }
    });
    
    // Remove profile handler (delegated)
    document.getElementById('selected-profiles-list')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-profile')) {
        const name = e.target.dataset.name;
        this.removeProfileFromAssembly(name);
      }
    });
    
    // Save assembly handler
    document.getElementById('save-assembly-btn')?.addEventListener('click', () => {
      this.saveAssembly();
    });
    
    this.updateTotal();
  },
  
  addProfileToAssembly(name) {
    const selected = JSON.parse(localStorage.getItem('mest_assembly_selected') || '[]');
    if (!selected.includes(name)) {
      selected.push(name);
      localStorage.setItem('mest_assembly_selected', JSON.stringify(selected));
      this.refreshSelectedProfiles();
      this.updateTotal();
    }
  },
  
  removeProfileFromAssembly(name) {
    let selected = JSON.parse(localStorage.getItem('mest_assembly_selected') || '[]');
    selected = selected.filter(n => n !== name);
    localStorage.setItem('mest_assembly_selected', JSON.stringify(selected));
    this.refreshSelectedProfiles();
    this.updateTotal();
  },
  
  refreshSelectedProfiles() {
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    const selected = JSON.parse(localStorage.getItem('mest_assembly_selected') || '[]');
    const selectedProfiles = selected.map(name => ({
      name,
      bp: profiles[name]?.bp || 0
    }));
    
    document.getElementById('selected-profiles-list').innerHTML = 
      selectedProfiles.map(p => `
        <div class="flex justify-between items-center p-2 bg-blue-50 rounded mb-1">
          <span>${p.name}</span>
          <div>
            <span>${p.bp} BP</span>
            <button class="remove-profile ml-2 text-red-600" data-name="${p.name}">×</button>
          </div>
        </div>
      `).join('');
  },
  
  updateTotal() {
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    const selected = JSON.parse(localStorage.getItem('mest_assembly_selected') || '[]');
    const total = selected.reduce((sum, name) => sum + (profiles[name]?.bp || 0), 0);
    document.getElementById('assembly-total').textContent = `${total} BP`;
  },
  
  saveAssembly() {
    const name = document.getElementById('assembly-name')?.value || 'New Assembly';
    const selected = JSON.parse(localStorage.getItem('mest_assembly_selected') || '[]');
    
    if (selected.length === 0) {
      alert('Add at least one profile to the assembly!');
      return;
    }
    
    const assemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
    assemblies[name] = { name, profiles: selected };
    localStorage.setItem('mest_assemblies', JSON.stringify(assemblies));
    
    alert(`Assembly "${name}" saved!`);
  }
};