/**
 * AI Stratagems Module
 * 
 * Export all stratagem-related functionality.
 */

export {
  TacticalDoctrine,
  EngagementStyle,
  PlanningPriority,
  AggressionLevel,
  getDoctrineComponents,
  type AIStratagems,
  DEFAULT_TACTICAL_DOCTRINE,
  type StratagemModifiers,
  calculateStratagemModifiers,
  TACTICAL_DOCTRINE_INFO,
  getDoctrinesByEngagement,
  validateStratagems,
} from './AIStratagems';

export {
  applyStratagemModifiersToActions,
  applyStratagemModifiersToTargets,
  applyStratagemModifiersToPositions,
  calculateOptimalEngagementRange,
  isWithinOptimalRange,
  shouldRetreat,
  shouldCharge,
} from './StratagemIntegration';

export {
  type DoctrineUIOption,
  getDoctrineUIOptions,
  getDoctrineUIOption,
  compareDoctrines,
  getRecommendedDoctrines,
} from './DoctrineUIHelpers';
