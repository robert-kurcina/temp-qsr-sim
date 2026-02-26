/**
 * AI Module Exports
 *
 * Hierarchical AI System for MEST Tactics
 * 
 * Architecture:
 * - SideAICoordinator: Side/Player-level strategy (god mode, perfect coordination)
 * - CharacterAI: Character-level tactics (puppets executing Side strategy)
 * 
 * Players control Sides with perfect information. Characters have no autonomy.
 */

// Core interfaces and types
export * from './AIController';

// Side-level coordination (god mode)
export * from './SideAICoordinator';

// Behavior Tree
export * from './BehaviorTree';

// Hierarchical FSM
export * from './HierarchicalFSM';

// Utility Scoring
export * from './UtilityScorer';

// Knowledge Base
export * from './KnowledgeBase';

// Character AI (tactical executor)
export * from './CharacterAI';
