import { MissionSide, SideMember, getActiveMembers, getDeploymentPositions } from './MissionSide';
import { Battlefield } from '../battlefield/Battlefield';
import { ModelRegistry } from '../battlefield/spatial/model-registry';
import { EngagementManager } from '../battlefield/spatial/engagement-manager';
import { MoveValidator } from '../battlefield/terrain/move-validator';
import { Position } from '../battlefield/Position';
import { Character } from '../core/Character';

/**
 * Spatial binding for a MissionSide
 * Connects side members to spatial systems (registry, engagement, movement)
 */
export interface SideSpatialBinding {
  /** The side this binding is for */
  side: MissionSide;
  /** Model registry for spatial queries */
  registry: ModelRegistry;
  /** Engagement manager for melee tracking */
  engagementManager: EngagementManager;
  /** Move validator for movement validation */
  moveValidator: MoveValidator;
}

/**
 * Create spatial bindings for a MissionSide
 */
export function createSideSpatialBinding(
  side: MissionSide,
  battlefield: Battlefield
): SideSpatialBinding {
  const registry = new ModelRegistry();
  
  // Register all active members with positions
  for (const member of side.members) {
    if (member.position) {
      registry.register(member.character, member.position);
    }
  }

  const engagementManager = new EngagementManager(registry);
  const moveValidator = new MoveValidator(battlefield, registry, engagementManager);

  return {
    side,
    registry,
    engagementManager,
    moveValidator,
  };
}

/**
 * Create spatial bindings for multiple sides
 */
export function createMultiSideSpatialBindings(
  sides: MissionSide[],
  battlefield: Battlefield
): Map<string, SideSpatialBinding> {
  const bindings = new Map<string, SideSpatialBinding>();

  for (const side of sides) {
    bindings.set(side.id, createSideSpatialBinding(side, battlefield));
  }

  return bindings;
}

/**
 * Update all model positions in a side's registry from member positions
 */
export function syncSidePositions(binding: SideSpatialBinding): void {
  for (const member of binding.side.members) {
    if (member.position) {
      binding.registry.updatePosition(member.id, member.position);
    }
  }
}

/**
 * Update model status flags from character state
 */
export function syncSideStatus(binding: SideSpatialBinding): void {
  for (const member of binding.side.members) {
    binding.registry.updateStatus(member.id, member.character);
  }
}

/**
 * Place all side members on the battlefield
 */
export function placeSideOnBattlefield(
  binding: SideSpatialBinding,
  positions: Map<string, Position>
): { placed: number; failed: number } {
  let placed = 0;
  let failed = 0;

  for (const member of binding.side.members) {
    const position = positions.get(member.id);
    if (position) {
      const success = placeMember(binding, member.id, position);
      if (success) {
        placed++;
      } else {
        failed++;
      }
    }
  }

  return { placed, failed };
}

/**
 * Place a single member on the battlefield
 */
export function placeMember(
  binding: SideSpatialBinding,
  memberId: string,
  position: Position
): boolean {
  const member = binding.side.members.find(m => m.id === memberId);
  if (!member) {
    return false;
  }

  // Register in spatial system
  binding.registry.register(member.character, position);
  
  // Update member position
  member.position = position;

  return true;
}

/**
 * Move a member and validate the movement
 */
export function moveMember(
  binding: SideSpatialBinding,
  memberId: string,
  from: Position,
  to: Position,
  options: {
    maxDistance?: number;
    checkEngagement?: boolean;
    allowEngagementBreak?: boolean;
  } = {}
): {
  success: boolean;
  valid: boolean;
  engagementBroken: boolean;
  reason?: string;
} {
  const member = binding.side.members.find(m => m.id === memberId);
  if (!member) {
    return { success: false, valid: false, engagementBroken: false, reason: 'Member not found' };
  }

  // Validate the move
  const validation = binding.moveValidator.validateMove(member.character, from, to, {
    maxDistance: options.maxDistance,
    checkEngagement: options.checkEngagement ?? true,
  });

  if (!validation.valid) {
    return {
      success: false,
      valid: false,
      engagementBroken: validation.engagementBroken,
      reason: validation.blockedBy ? `Blocked by ${validation.blockedBy}` : 'Invalid move',
    };
  }

  // Check if engagement break is allowed
  if (validation.engagementBroken && !options.allowEngagementBreak) {
    return {
      success: false,
      valid: true,
      engagementBroken: true,
      reason: 'Cannot break engagement without disengage action',
    };
  }

  // Execute the move
  member.position = to;
  binding.registry.updatePosition(memberId, to);

  return {
    success: true,
    valid: true,
    engagementBroken: validation.engagementBroken,
  };
}

/**
 * Get engagement state for a member
 */
export function getMemberEngagementState(
  binding: SideSpatialBinding,
  memberId: string,
  opposingSideIds: Set<string>
): {
  isEngaged: boolean;
  engagedModels: string[];
  isCornered: boolean;
  isFlanked: boolean;
  isSurrounded: boolean;
} {
  return binding.engagementManager.queryEngagement(memberId, opposingSideIds);
}

/**
 * Get all engaged members on a side
 */
export function getEngagedMembers(binding: SideSpatialBinding, opposingSideIds: Set<string>): SideMember[] {
  const engaged: SideMember[] = [];

  for (const member of binding.side.members) {
    const engagement = binding.engagementManager.queryEngagement(member.id, opposingSideIds);
    if (engagement.isEngaged) {
      engaged.push(member);
    }
  }

  return engaged;
}

/**
 * Check if a member can see a target (LOS check)
 */
export function hasLineOfSight(
  binding: SideSpatialBinding,
  memberId: string,
  targetId: string
): boolean {
  const model = binding.registry.getModel(memberId);
  const target = binding.registry.getModel(targetId);

  if (!model || !target) {
    return false;
  }

  return (binding.side as any).battlefieldHasLOS?.(model, target) ?? false;
}

/**
 * Get valid movement destinations for a member
 */
export function getValidDestinations(
  binding: SideSpatialBinding,
  memberId: string,
  maxDistance: number,
  options: {
    allowEngagementBreak?: boolean;
  } = {}
): Position[] {
  const member = binding.side.members.find(m => m.id === memberId);
  if (!member || !member.position) {
    return [];
  }

  return binding.moveValidator.getValidDestinations(
    member.character,
    member.position,
    maxDistance,
    {
      allowEngagementBreak: options.allowEngagementBreak ?? false,
    }
  );
}

/**
 * Check compulsory actions for a member
 */
export function checkCompulsoryActions(
  binding: SideSpatialBinding,
  memberId: string
): Array<{
  triggered: boolean;
  actionType: 'disengage' | 'fall_back' | 'compulsory_move' | 'morale_test';
  reason: string;
}> {
  const member = binding.side.members.find(m => m.id === memberId);
  if (!member) {
    return [];
  }

  return binding.moveValidator.checkCompulsoryActions(member.character);
}

/**
 * Get the safest retreat position for a member
 */
export function getSafestRetreat(
  binding: SideSpatialBinding,
  memberId: string,
  maxDistance: number
): Position | null {
  const member = binding.side.members.find(m => m.id === memberId);
  if (!member || !member.position) {
    return null;
  }

  return binding.moveValidator.getSafestMoveDirection(
    member.character,
    member.position,
    maxDistance
  );
}

/**
 * Update side state from spatial state
 */
export function updateSideStateFromSpatial(binding: SideSpatialBinding): void {
  for (const member of binding.side.members) {
    // Update character state from registry
    const model = binding.registry.getModel(member.id);
    if (model) {
      member.character.state.isAttentive = model.isAttentive ?? true;
      member.character.state.isOrdered = model.isOrdered ?? true;
    }

    // Update side state based on character status
    if (member.character.state.isEliminated) {
      member.status = 'Eliminated' as import('./MissionSide').ModelSlotStatus;
    } else if (member.character.state.isKOd) {
      member.status = 'KO' as import('./MissionSide').ModelSlotStatus;
    }
  }
}

/**
 * Export all character positions for a side
 */
export function exportSidePositions(binding: SideSpatialBinding): Map<string, Position> {
  return getDeploymentPositions(binding.side);
}

/**
 * Import character positions and register with spatial systems
 */
export function importSidePositions(
  binding: SideSpatialBinding,
  positions: Map<string, Position>
): void {
  for (const [memberId, position] of positions.entries()) {
    const member = binding.side.members.find(m => m.id === memberId);
    if (member) {
      member.position = position;
      binding.registry.register(member.character, position);
    }
  }
}
