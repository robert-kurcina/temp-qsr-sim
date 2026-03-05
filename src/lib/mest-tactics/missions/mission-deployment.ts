import {
  CANONICAL_GAME_SIZES,
  CANONICAL_GAME_SIZE_ORDER,
  type CanonicalGameSize,
} from '../mission/game-size-canonical';

export type MissionDeploymentType = 'opposing_edges' | 'corners' | 'custom';

export interface MissionDeploymentProfile {
  deploymentType: MissionDeploymentType;
  deploymentDepth: number;
}

const DEFAULT_DEPLOYMENT_TYPE: MissionDeploymentType = 'opposing_edges';

const MISSION_DEPLOYMENT_TYPE_BY_ID: Record<string, MissionDeploymentType> = {
  QAI_11: 'opposing_edges',
  QAI_12: 'corners',
  QAI_13: 'opposing_edges',
  QAI_14: 'opposing_edges',
  QAI_15: 'opposing_edges',
  QAI_16: 'opposing_edges',
  QAI_17: 'corners',
  QAI_18: 'opposing_edges',
  QAI_19: 'custom',
  QAI_20: 'opposing_edges',
};

type DeploymentDepthOverride = Partial<Record<CanonicalGameSize, number>>;

/**
 * Mission-specific deployment depth overrides (MU), keyed by mission id.
 * Values are optional; when omitted the canonical game-size depth is used.
 */
const MISSION_DEPLOYMENT_DEPTH_OVERRIDES: Partial<Record<string, DeploymentDepthOverride>> = {};

/**
 * Deployment-type-level depth overrides (MU), keyed by mission deployment type.
 * Values are optional; when omitted the canonical game-size depth is used.
 */
const DEPLOYMENT_TYPE_DEPTH_OVERRIDES: Partial<Record<MissionDeploymentType, DeploymentDepthOverride>> = {};

function normalizeGameSize(value: string | undefined): CanonicalGameSize {
  if (value && (CANONICAL_GAME_SIZE_ORDER as readonly string[]).includes(value)) {
    return value as CanonicalGameSize;
  }
  return 'SMALL';
}

export function getMissionDeploymentType(missionId: string | undefined): MissionDeploymentType {
  if (!missionId) {
    return DEFAULT_DEPLOYMENT_TYPE;
  }
  return MISSION_DEPLOYMENT_TYPE_BY_ID[missionId] ?? DEFAULT_DEPLOYMENT_TYPE;
}

export function getMissionDeploymentDepth(
  gameSize: CanonicalGameSize | string,
  missionId?: string
): number {
  const normalizedSize = normalizeGameSize(gameSize);
  const canonicalDepth = CANONICAL_GAME_SIZES[normalizedSize].deploymentDepth;
  const deploymentType = getMissionDeploymentType(missionId);

  const missionOverride = missionId
    ? MISSION_DEPLOYMENT_DEPTH_OVERRIDES[missionId]?.[normalizedSize]
    : undefined;
  const deploymentTypeOverride = DEPLOYMENT_TYPE_DEPTH_OVERRIDES[deploymentType]?.[normalizedSize];

  const resolvedDepth = missionOverride ?? deploymentTypeOverride ?? canonicalDepth;
  return Math.max(1, Math.floor(resolvedDepth));
}

export function getMissionDeploymentProfile(
  missionId: string | undefined,
  gameSize: CanonicalGameSize | string
): MissionDeploymentProfile {
  return {
    deploymentType: getMissionDeploymentType(missionId),
    deploymentDepth: getMissionDeploymentDepth(gameSize, missionId),
  };
}
