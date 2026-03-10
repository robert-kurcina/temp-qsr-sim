import { AuditService } from '../../audit/AuditService';

/**
 * AI Game Loop configuration
 */
export interface AIGameLoopConfig {
  /** Enable strategic layer (SideAI) */
  enableStrategic: boolean;
  /** Enable tactical layer (AssemblyAI) */
  enableTactical: boolean;
  /** Enable character-level AI */
  enableCharacterAI: boolean;
  /** Enable action validation */
  enableValidation: boolean;
  /** Enable replanning on failure */
  enableReplanning: boolean;
  /** Verbose logging */
  verboseLogging: boolean;
  /** Maximum actions per character per turn */
  maxActionsPerTurn: number;
  /** Allow attacks against KO'd targets (default false) */
  allowKOdAttacks?: boolean;
  /** Optional controller traits for Puppet KO'd rules */
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  /** Optional coordinator traits for Puppet KO'd rules */
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
  /** Optional callback after each turn resolves */
  onTurnEnd?: (turn: number) => void;
  /** Session visibility OR in MU (default 16 / Day, Clear) */
  visibilityOrMu?: number;
  /** Session Max ORM for normal OR checks (default 3) */
  maxOrm?: number;
  /** Allow Concentrate range extension for AI range gating (default true) */
  allowConcentrateRangeExtension?: boolean;
  /** If true, require per-character LOS/FOV gates in AI range/path checks */
  perCharacterFovLos?: boolean;
  /** Allow selecting Wait actions */
  allowWaitAction?: boolean;
  /** Allow selecting Hide actions */
  allowHideAction?: boolean;
  /** Enable audit capture */
  auditService?: AuditService;
  /** Mission ID for audit */
  missionId?: string;
  /** Mission name for audit */
  missionName?: string;
  /** Lighting condition for audit */
  lighting?: string;
}

/**
 * Default AI Game Loop configuration
 */
export const DEFAULT_AI_GAME_LOOP_CONFIG: AIGameLoopConfig = {
  enableStrategic: true,
  enableTactical: true,
  enableCharacterAI: true,
  enableValidation: true,
  enableReplanning: true,
  verboseLogging: false,
  maxActionsPerTurn: 3,
  allowKOdAttacks: false,
  onTurnEnd: undefined,
  visibilityOrMu: 16,
  maxOrm: 3,
  allowConcentrateRangeExtension: true,
  perCharacterFovLos: false,
  allowWaitAction: true,
  allowHideAction: true,
};

/**
 * AI Game Loop execution result
 */
export interface AIGameLoopResult {
  /** Total actions executed */
  totalActions: number;
  /** Successful actions */
  successfulActions: number;
  /** Failed actions */
  failedActions: number;
  /** Actions that required replanning */
  replannedActions: number;
  /** Turn number when game ended */
  finalTurn: number;
  /** Reason for game end */
  endReason?: string;
}
