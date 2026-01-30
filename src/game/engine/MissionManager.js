// /src/engine/MissionManager.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { MISSION_SCHEMA } from '../data/missionSchema.js';

/**
 * Mission Manager - handles mission setup, validation, and execution
 */
export class MissionManager {
  constructor(battlefieldEngine, tokenManager, profileGenerator, terrainFactory) {
    this.battlefieldEngine = battlefieldEngine;
    this.tokenManager = tokenManager;
    this.profileGenerator = profileGenerator;
    this.terrainFactory = terrainFactory;
    this.currentMission = null;
    this.objectiveTracker = new ObjectiveTracker();
    this.missionState = {
      turn: 1,
      points: { 'side-a': 0, 'side-b': 0 },
      completedObjectives: [],
      activeReinforcements: []
    };
  }
  
  /**
   * Load and validate mission
   */
  loadMission(missionConfig) {
    // Validate against schema
    if (!this.validateMission(missionConfig)) {
      throw new Error('Invalid mission configuration');
    }
    
    this.currentMission = missionConfig;
    this.objectiveTracker.setObjectives(missionConfig.objectives);
    return true;
  }
  
  /**
   * Validate mission against schema
   */
  validateMission(config) {
    // Simple validation - in production use a proper JSON schema validator
    try {
      if (!config.name || !config.sideA || !config.sideB) {
        return false;
      }
      
      // Validate BP limits
      const gameSizeBP = {
        small: 500,
        medium: 750,
        large: 1000
      };
      
      const expectedBP = gameSizeBP[config.gameSize] || 500;
      if (config.sideA.bp !== expectedBP || config.sideB.bp !== expectedBP) {
        console.warn(`BP mismatch: expected ${expectedBP}, got ${config.sideA.bp}/${config.sideB.bp}`);
      }
      
      return true;
    } catch (error) {
      console.error('Mission validation error:', error);
      return false;
    }
  }
  
  /**
   * Setup mission battlefield
   */
  async setupMission() {
    if (!this.currentMission) {
      throw new Error('No mission loaded');
    }
    
    // Clear existing battlefield
    this.battlefieldEngine.clearBattlefield();
    
    // Setup terrain
    await this.setupTerrain();
    
    // Setup models
    await this.setupModels();
    
    // Apply initial tokens
    this.applyInitialTokens();
    
    console.log(`Mission "${this.currentMission.name}" setup complete`);
  }
  
  /**
   * Setup terrain based on mission config
   */
  async setupTerrain() {
    const terrainConfig = this.currentMission.terrain || {};
    
    if (terrainConfig.preset) {
      // Load preset terrain
      const presetTerrain = await this.loadTerrainPreset(terrainConfig.preset);
      this.battlefieldEngine.addTerrain(presetTerrain);
    }
    
    if (terrainConfig.custom && terrainConfig.custom.length > 0) {
      // Add custom terrain elements
      const customTerrain = terrainConfig.custom.map(element => 
        this.terrainFactory.createTerrainElement(element)
      );
      this.battlefieldEngine.addTerrain(customTerrain);
    }
  }
  
  /**
   * Setup models based on mission config
   */
  async setupModels() {
    // Setup Side A
    await this.setupSide(this.currentMission.sideA, 'side-a');
    
    // Setup Side B  
    await this.setupSide(this.currentMission.sideB, 'side-b');
  }
  
  /**
   * Setup individual side
   */
  async setupSide(sideConfig, sideId) {
    const models = [];
    
    for (let i = 0; i < sideConfig.models.length; i++) {
      const modelId = sideConfig.models[i];
      const identifier = modelId;
      
      // Generate profile if needed
      let profile = null;
      if (sideConfig.assembly) {
        profile = this.profileGenerator.generateProfileFromAssembly(
          sideConfig.assembly, 
          i
        );
      }
      
      // Determine position based on deployment
      const position = this.calculateDeploymentPosition(
        sideConfig, 
        sideId, 
        i, 
        sideConfig.models.length
      );
      
      // Create model
      const model = ModelFactory.createCharacter(
        modelId,
        position.x,
        position.y,
        sideId,
        identifier,
        0.03175 // MU_TO_METERS
      );
      
      if (profile) {
        model.profile = profile;
      }
      
      models.push(model);
      this.battlefieldEngine.addModel(model);
    }
    
    return models;
  }
  
  /**
   * Calculate deployment position
   */
  calculateDeploymentPosition(sideConfig, sideId, index, totalModels) {
    const basePos = sideConfig.initialPosition || { x: 0, y: 0 };
    
    switch(sideConfig.deployment) {
      case 'infiltration':
        // Random positions within deployment zone
        const spread = 5;
        return {
          x: basePos.x + (Math.random() - 0.5) * spread,
          y: basePos.y + (Math.random() - 0.5) * spread
        };
        
      case 'standard':
        // Grid formation
        const rows = Math.ceil(Math.sqrt(totalModels));
        const cols = Math.ceil(totalModels / rows);
        const row = Math.floor(index / cols);
        const col = index % cols;
        const spacing = 2;
        
        return {
          x: basePos.x + (col - cols/2) * spacing,
          y: basePos.y + (row - rows/2) * spacing
        };
        
      case 'reinforcements':
        // Start off-board, will be placed later
        return { x: basePos.x, y: basePos.y };
        
      default:
        return basePos;
    }
  }
  
  /**
   * Apply initial tokens based on deployment
   */
  applyInitialTokens() {
    // Apply Hidden tokens for infiltration deployment
    if (this.currentMission.sideA.deployment === 'infiltration') {
      this.currentMission.sideA.models.forEach(modelId => {
        this.tokenManager.addToken(modelId, 'hidden');
      });
    }
    
    if (this.currentMission.sideB.deployment === 'infiltration') {
      this.currentMission.sideB.models.forEach(modelId => {
        this.tokenManager.addToken(modelId, 'hidden');
      });
    }
  }
  
  /**
   * Check if mission is complete
   */
  isMissionComplete() {
    if (!this.currentMission) return false;
    
    const specialRules = this.currentMission.specialRules || {};
    
    // Check turn limit
    if (specialRules.turnLimit && this.missionState.turn > specialRules.turnLimit) {
      return true;
    }
    
    // Check victory conditions
    const sideAPoints = this.missionState.points['side-a'];
    const sideBPoints = this.missionState.points['side-b'];
    
    const vcA = this.currentMission.victoryConditions.sideA;
    const vcB = this.currentMission.victoryConditions.sideB;
    
    // Check if either side has met victory conditions
    if (vcA.minimumPoints && sideAPoints >= vcA.minimumPoints) {
      return true;
    }
    
    if (vcB.minimumPoints && sideBPoints >= vcB.minimumPoints) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get mission result
   */
  getMissionResult() {
    const sideAPoints = this.missionState.points['side-a'];
    const sideBPoints = this.missionState.points['side-b'];
    
    let winner = 'draw';
    if (sideAPoints > sideBPoints) {
      winner = 'side-a';
    } else if (sideBPoints > sideAPoints) {
      winner = 'side-b';
    }
    
    return {
      winner: winner,
      points: this.missionState.points,
      turns: this.missionState.turn,
      completedObjectives: this.missionState.completedObjectives,
      casualties: this.getCasualtyCount()
    };
  }
  
  /**
   * Get casualty count
   */
  getCasualtyCount() {
    const casualties = { 'side-a': 0, 'side-b': 0 };
    
    this.battlefieldEngine.models.forEach(model => {
      const tokens = this.tokenManager.getTokenCounts(model.id);
      if (tokens.ko || tokens.eliminated) {
        casualties[model.side]++;
      }
    });
    
    return casualties;
  }
  
  /**
   * Update mission state after each turn
   */
  updateMissionState() {
    // Check objectives
    this.checkObjectives();
    
    // Handle reinforcements
    this.handleReinforcements();
    
    // Increment turn
    this.missionState.turn++;
  }
  
  /**
   * Check objectives and award points
   */
  checkObjectives() {
    const results = this.objectiveTracker.checkObjectives(
      this.battlefieldEngine.models,
      this.tokenManager
    );
    
    results.completed.forEach(objective => {
      if (!this.missionState.completedObjectives.includes(objective.id)) {
        this.missionState.completedObjectives.push(objective.id);
        this.missionState.points[objective.side || 'side-a'] += objective.points;
        console.log(`Objective completed: ${objective.description} (+${objective.points} points)`);
      }
    });
  }
  
  /**
   * Handle reinforcement spawning
   */
  handleReinforcements() {
    const reinforcementTurns = this.currentMission.specialRules?.reinforcementTurns || [];
    
    if (reinforcementTurns.includes(this.missionState.turn)) {
      console.log(`Reinforcements arriving on turn ${this.missionState.turn}`);
      // Implementation would spawn new models
    }
  }
}