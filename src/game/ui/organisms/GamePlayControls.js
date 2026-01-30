// /src/ui/organisms/GameplayControls.js
import { Button } from '../atoms/Button.js';
import { BPStatusIndicator } from '../molecules/BPStatusIndicator.js';
import { GAME_SIZES } from '../../engine/GameSizeService.js';

function checkLOSCompliance() {
    const violations = runLOSValidation(); // Your existing LOS validation
    
    const warningEl = document.getElementById('los-warning');
    if (violations.length > 0) {
      warningEl.classList.remove('hidden');
      // Allow gameplay despite violations (per your requirement)
      console.warn(`LOS violations detected: ${violations.length} paths > 8 MU`);
    } else {
      warningEl.classList.add('hidden');
    }
  }

/**
 * Gameplay controls organism with dynamic mission data
 */
export const GameplayControls = {
  // Store current mission state
  currentState: {
    missionName: 'New Mission',
    gameSize: 'medium',
    sideA: { total: 0, models: 0 },
    sideB: { total: 0, models: 0 }
  },
  
  
  render(data) {
    // Get mission data from localStorage or default
    const missionData = this.loadMissionData();
    this.currentState = missionData;
    
    const { gameSize, sideA, sideB } = this.currentState;
    const gameSizeConfig = GAME_SIZES[gameSize];
    
    return `
      <div class="gameplay-controls organism-card">
        <h2>🎮 ${this.currentState.missionName}</h2>
        
        <!-- Game Size Selector -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Game Size</label>
          <select id="game-size-selector" class="w-full px-3 py-2 border rounded min-h-[48px]">
            <option value="small" ${gameSize === 'small' ? 'selected' : ''}>
              Small (${gameSizeConfig.maxBP} BP, ${gameSizeConfig.minModels}-${gameSizeConfig.maxModels} models)
            </option>
            <option value="medium" ${gameSize === 'medium' ? 'selected' : ''}>
              Medium (${GAME_SIZES.medium.maxBP} BP, ${GAME_SIZES.medium.minModels}-${GAME_SIZES.medium.maxModels} models)
            </option>
            <option value="large" ${gameSize === 'large' ? 'selected' : ''}>
              Large (${GAME_SIZES.large.maxBP} BP, ${GAME_SIZES.large.minModels}-${GAME_SIZES.large.maxModels} models)
            </option>
          </select>
        </div>

        <div class="terrain-legend mt-4 text-xs">
          <h4 class="font-medium mb-1">Terrain Types:</h4>
          <div class="grid grid-cols-2 gap-1">
            <div><span class="inline-block w-3 h-3 bg-blue-400 mr-1"></span> Clear (1 AP)</div>
            <div><span class="inline-block w-3 h-3 bg-orange-400 mr-1"></span> Rough (2 AP)</div>
            <div><span class="inline-block w-3 h-3 bg-red-500 mr-1"></span> Difficult (3 AP)</div>
            <div><span class="inline-block w-3 h-3 bg-black mr-1"></span> Impassable</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <!-- Existing controls -->
          ${AIControls()}
          ${BattlefieldControls()}
        </div>

        <div class="model-placement mt-6">
          <h3 class="font-medium mb-2">Place Models</h3>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <button id="select-side-a" class="btn btn-secondary ${this.currentState.selectedSide === 'side-a' ? 'active' : ''}">
              🔴 Side A
            </button>
            <button id="select-side-b" class="btn btn-secondary ${this.currentState.selectedSide === 'side-b' ? 'active' : ''}">
              🔵 Side B
            </button>
          </div>
          <button id="place-character" class="btn btn-primary w-full">
            👤 Place Character
          </button>
        </div>

        
        <!-- Side BP Display -->
        <div class="side-bp grid grid-cols-2 gap-4 mb-6">
          <div class="side-a p-3 bg-red-50 rounded-lg">
            <div class="text-red-800 font-medium">Side A</div>
            ${BPStatusIndicator({ bp: sideA.total, gameSize })}
            <div class="text-sm mt-1">${sideA.models} models 
              <span class="${this.getModelCountStatus(sideA.models, gameSize)}">
                ${this.getModelCountStatus(sideA.models, gameSize) === 'error' ? '⚠️' : '✓'}
              </span>
            </div>
          </div>
          <div class="side-b p-3 bg-blue-50 rounded-lg">
            <div class="text-blue-800 font-medium">Side B</div>
            ${BPStatusIndicator({ bp: sideA.total, gameSize })}
            <div class="text-sm mt-1">${sideB.models} models 
              <span class="${this.getModelCountStatus(sideB.models, gameSize)}">
                ${this.getModelCountStatus(sideB.models, gameSize) === 'error' ? '⚠️' : '✓'}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Terrain Placement -->
        <div class="terrain-section mb-6">
          <h3 class="font-medium mb-2">Place Terrain</h3>
          <div class="grid grid-cols-2 gap-2">
            ${['Wall', 'Woods', 'Hill', 'Debris'].map(type => 
              Button({ 
                text: type, 
                variant: 'secondary',
                size: 'md',
                id: `place-${type.toLowerCase()}`
              })
            ).join('')}
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="action-buttons space-y-3">
          ${Button({ 
            text: 'Validate LOS', 
            variant: 'primary',
            size: 'lg',
            icon: '👁️',
            id: 'validate-los-btn'
          })}
          ${Button({ 
            text: 'End Turn', 
            variant: 'secondary',
            size: 'lg',
            icon: '⏭️',
            id: 'end-turn-btn'
          })}
        </div>
      </div>
    `;
  },
  
  loadissionData() {
    // Try to get mission from URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const missionName = urlParams.get('mission');
    
    if (missionName) {
      // Load saved mission
      const missions = JSON.parse(localStorage.getItem('mest_missions') || '{}');
      const mission = missions[missionName];
      
      if (mission) {
        // Calculate actual BP and model counts
        const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
        const assemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
        
        const calculateSide = (assemblyNames) => {
          let totalBP = 0;
          let totalModels = 0;
          
          assemblyNames.forEach(assemblyName => {
            const assembly = assemblies[assemblyName];
            if (assembly) {
              assembly.profiles.forEach(profileName => {
                const profile = profiles[profileName];
                if (profile) {
                  totalBP += profile.bp || 0;
                  totalModels += 1;
                }
              });
            }
          });
          
          return { total: totalBP, models: totalModels };
        };
        
        return {
          missionName,
          gameSize: mission.gameSize || 'medium',
          sideA: calculateSide(mission.sideA || []),
          sideB: calculateSide(mission.sideB || [])
        };
      }
    }
    
    // Default empty mission
    return {
      missionName: missionName || 'New Mission',
      gameSize: 'medium',
      sideA: { total: 0, models: 0 },
      sideB: { total: 0, models: 0 }
    };
  },
  
  getModelCountStatus(modelCount, gameSize) {
    const config = GAME_SIZES[gameSize];
    if (!config) return 'normal';
    
    if (modelCount < config.minModels || modelCount > config.maxModels) {
      return 'error';
    }
    return 'success';
  },
  
  init() {
    // Terrain placement handlers
    ['wall', 'woods', 'hill', 'debris'].forEach(type => {
      document.getElementById(`place-${type}`)?.addEventListener('click', () => {
        this.placeTerrain(type);
      });
    });
    document.getElementById('validate-los-btn')?.addEventListener('click', () => {


    // Validate LOS handler
    document.getElementById('validate-los-btn')?.addEventListener('click', () => {
      this.validateLOS();
    });
    
    // End turn handler
    document.getElementById('end-turn-btn')?.addEventListener('click', () => {
      alert('Turn ended! (Placeholder)');
    });
    
    // Game size change handler
    document.getElementById('game-size-selector')?.addEventListener('change', (e) => {
      this.changeGameSize(e.target.value);
    });

    function initNameInputs(side, profiles) {
      if (!window.NAME_MANAGER) {
        window.NAME_MANAGER = new NameManager();
      }
      
      profiles.forEach((p, index) => {
        const uniqueId = `name-${side}-${p.name}-${index}`;
        initNameInput(uniqueId, side, window.NAME_MANAGER, '');
      });
    }
  },
  
  
  placeTerrain(type) {
    if (!window.BATTLEFIELD_ENGINE) {
      alert('Battlefield not ready yet!');
      return;
    }
    
    // In a real app, this would:
    // 1. Get click position on canvas
    // 2. Create terrain mesh using TerrainFactory
    // 3. Add to scene and store in BATTLEFIELD_ENGINE.terrain
    
    alert(`Click on battlefield to place ${type} (implementation pending)`);
  },
  
  validateLOS() {
    if (!window.BATTLEFIELD_ENGINE) {
      alert('Battlefield not ready yet!');
      return;
    }
    
    // In a real app, this would:
    // 1. Use Three.js raycaster to check LOS between models
    // 2. Draw red violation lines for paths > 8 MU
    // 3. Show results in UI
    
    // Initialize enhanced LOS engine
    const losEngine = new LOSEngine(
      window.BATTLEFIELD_ENGINE.scene,
      window.BATTLEFIELD_ENGINE.models,
      window.BATTLEFIELD_ENGINE.terrain,
      window.BATTLEFIELD_ENGINE.battlefieldSizeMU
    );
    
    window.LOS_ENGINE = losEngine;
    
    // Validate all opposing model pairs
    const violations = [];
    for (const modelA of sideAModels) {
      for (const modelB of sideBModels) {
        const result = losEngine.validateLOS(modelA, modelB);
        if (result.hasLOS && result.distance > 8) {
          violations.push({
            modelA: modelA.id,
            modelB: modelB.id,
            distance: result.distance,
            type: 'violation'
          });
          
          // Add violation line
          losEngine.addViolationLine(modelA.position, modelB.position);
        }
      }
    }
    
    // Show results
    if (violations.length === 0) {
      alert('✅ No LOS violations! Battlefield is QSR compliant.');
    } else {
      alert(`⚠️ ${violations.length} LOS violations found! Red lines show clear paths > 8 MU.`);
    }
  },

  // Helper method
  updateButtonStates() {
    document.getElementById('select-side-a')?.classList.toggle('active', 
      window.BATTLEFIELD_ENGINE?.selectedSide === 'side-a');
    document.getElementById('select-side-b')?.classList.toggle('active', 
      window.BATTLEFIELD_ENGINE?.selectedSide === 'side-b');
  },
  
  changeGameSize(gameSize) {
    // Update current state
    this.currentState.gameSize = gameSize;
    
    // Save to mission if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const missionName = urlParams.get('mission');
    
    if (missionName) {
      const missions = JSON.parse(localStorage.getItem('mest_missions') || '{}');
      if (missions[missionName]) {
        missions[missionName].gameSize = gameSize;
        localStorage.setItem('mest_missions', JSON.stringify(missions));
      }
    }
    
    // Reload page with new game size
    window.location.search = `?mission=${missionName}&gameSize=${gameSize}`;
  },

  // Check if sides are within 25 BP
  isBalanced(sideA, sideB) {
    const tolerance = 25; // From game_rules.json
    return Math.abs(sideA.total - sideB.total) <= tolerance;
  },

  // Add to GameplayControls.js
  validateLOS() {
    if (!window.BATTLEFIELD_ENGINE) {
      alert('Battlefield not ready yet!');
      return;
    }
    
    // Get current mission data
    const urlParams = new URLSearchParams(window.location.search);
    const missionName = urlParams.get('mission');
    
    if (!missionName) {
      alert('No mission loaded! Create a mission first.');
      return;
    }
    
    const missions = JSON.parse(localStorage.getItem('mest_missions') || '{}');
    const mission = missions[missionName];
    
    if (!mission) {
      alert('Mission not found!');
      return;
    }
    
    // Get model positions from battlefield
    const models = window.BATTLEFIELD_ENGINE.models;
    const terrain = window.BATTLEFIELD_ENGINE.terrain;
    
    if (models.length === 0) {
      alert('Place models on the battlefield first!');
      return;
    }
    
    // Map assemblies to model IDs
    const profiles = JSON.parse(localStorage.getItem('mest_profiles') || '{}');
    const assemblies = JSON.parse(localStorage.getItem('mest_assemblies') || '{}');
    
    const getModelIdsForSide = (assemblyNames) => {
      const modelIds = [];
      assemblyNames.forEach(assemblyName => {
        const assembly = assemblies[assemblyName];
        if (assembly) {
          assembly.profiles.forEach(profileName => {
            // Create unique model ID
            const modelId = `${assemblyName}_${profileName}_${Date.now()}`;
            modelIds.push(modelId);
          });
        }
      });
      return modelIds;
    };
    
    const sideAIds = getModelIdsForSide(mission.sideA || []);
    const sideBIds = getModelIdsForSide(mission.sideB || []);
    
    // Initialize LOS Engine
    const losEngine = new LOSEngine(
      window.BATTLEFIELD_ENGINE.scene,
      models,
      terrain
    );
    
    // Run validation
    const violations = losEngine.validateAllLOS(sideAIds, sideBIds);
    
    // Show results
    if (violations.length === 0) {
      alert('✅ No LOS violations found! All paths > 8 MU are properly blocked.');
    } else {
      alert(`⚠️ Found ${violations.length} LOS violation(s)! Red lines show clear paths > 8 MU.`);
      
      // Log details to console
      console.log('LOS Violations:', violations);
    }
  }
};