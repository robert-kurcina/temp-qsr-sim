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
  AIStratagems,
  DEFAULT_TACTICAL_DOCTRINE,
  StratagemModifiers,
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
  DoctrineUIOption,
  getDoctrineUIOptions,
  getDoctrineUIOption,
  compareDoctrines,
  getRecommendedDoctrines,
} from './DoctrineUIHelpers';
