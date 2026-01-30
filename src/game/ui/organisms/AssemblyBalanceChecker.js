// /src/ui/organisms/AssemblyBalanceChecker.js
/**
 * Checks assembly balance against game size limits
 */
export const AssemblyBalanceChecker = {
  render(data) {
    const assemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
    const assemblyList = Object.keys(assemblies);
    
    if (assemblyList.length === 0) {
      return `
        <div class="organism-card">
          <h2>📈 Assembly Balance Checker</h2>
          <p class="text-gray-500">No assemblies saved. Create one in the Builder first!</p>
        </div>
      `;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const selectedAssembly = urlParams.get('assembly') || assemblyList[0];
    const assembly = assemblies[selectedAssembly];
    
    if (!assembly) {
      return `<div class="organism-card"><p>Assembly not found</p></div>`;
    }
    
    const analysis = this.analyzeAssembly(assembly, data);
    
    return `
      <div class="assembly-balance organism-card">
        <h2>📈 ${assembly.name} Analysis</h2>
        
        <!-- Assembly Selector -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Select Assembly</label>
          <select id="analysis-assembly-select" class="w-full px-3 py-2 border rounded min-h-[48px]">
            ${assemblyList.map(name => 
              `<option value="${name}" ${name === selectedAssembly ? 'selected' : ''}>${name}</option>`
            ).join('')}
          </select>
        </div>
        
        <!-- Summary Stats -->
        <div class="summary-stats grid grid-cols-2 gap-4 mb-6">
          <div class="p-3 bg-blue-50 rounded-lg">
            <div class="text-blue-800 font-medium">Total BP</div>
            <div class="text-2xl font-bold">${analysis.totalBP} BP</div>
          </div>
          <div class="p-3 bg-green-50 rounded-lg">
            <div class="text-green-800 font-medium">Models</div>
            <div class="text-2xl font-bold">${analysis.modelCount}</div>
          </div>
        </div>
        
        <!-- Game Size Compliance -->
        <div class="game-size-compliance mt-6">
          <h3 class="font-medium mb-2">Game Size Compliance</h3>
          ${this.renderGameSizeCompliance(analysis.totalBP, analysis.modelCount)}
        </div>
        
        <!-- Profile Breakdown -->
        <div class="profile-breakdown mt-6">
          <h3 class="font-medium mb-2">Profile Breakdown</h3>
          ${this.renderProfileBreakdown(analysis.profiles)}
        </div>
      </div>
    `;
  },
  
  analyzeAssembly(assembly, data) {
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    const profileData = assembly.profiles.map(name => profiles[name]).filter(p => p);
    
    const totalBP = profileData.reduce((sum, p) => sum + (p.bp || 0), 0);
    const modelCount = profileData.length;
    
    return {
      totalBP,
      modelCount,
      profiles: profileData
    };
  },
  
  // Replace renderGameSizeCompliance method
renderGameSizeCompliance(bp, models) {
  const gameSizes = Object.entries(GAME_SIZES).map(([key, config]) => {
    const bpValid = bp >= config.minBP && bp <= config.maxBP;
    const modelValid = models >= config.minModels && models <= config.maxModels;
    
    return {
      name: config.name,
      bpRange: `${config.minBP}-${config.maxBP}`,
      modelRange: `${config.minModels}-${config.maxModels}`,
      bpStatus: bpValid ? 'success' : 'error',
      modelStatus: modelValid ? 'success' : 'error'
    };
  });
  
  return `
    <div class="space-y-3">
      ${gameSizes.map(size => `
        <div class="p-3 border rounded">
          <div class="font-medium mb-2">${size.name}</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-sm">BP: ${bp}/${size.bpRange}</div>
              <div class="${size.bpStatus === 'success' ? 'status-success' : 'status-error'}">
                ${size.bpStatus === 'success' ? '✓' : '✗'}
              </div>
            </div>
            <div>
              <div class="text-sm">Models: ${models}/${size.modelRange}</div>
              <div class="${size.modelStatus === 'success' ? 'status-success' : 'status-error'}">
                ${size.modelStatus === 'success' ? '✓' : '✗'}
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
},
  
  renderProfileBreakdown(profiles) {
    return `
      <div class="space-y-2">
        ${profiles.map(profile => `
          <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span>${profile.name}</span>
            <span>${profile.bp} BP</span>
          </div>
        `).join('')}
      </div>
    `;
  },
  
  init() {
    // Assembly selection handler
    document.getElementById('analysis-assembly-select')?.addEventListener('change', (e) => {
      const assembly = e.target.value;
      const url = new URL(window.location);
      url.searchParams.set('assembly', assembly);
      window.history.pushState({}, '', url);
      // Re-render with new assembly
      const data = window.APP_DATA;
      document.getElementById('analysis-sub-content').innerHTML = this.render(data);
    });
  }
};