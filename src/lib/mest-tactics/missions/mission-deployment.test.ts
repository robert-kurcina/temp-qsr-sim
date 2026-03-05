import { describe, expect, it } from 'vitest';
import {
  getMissionDeploymentDepth,
  getMissionDeploymentProfile,
  getMissionDeploymentType,
} from './mission-deployment';

describe('mission-deployment', () => {
  it('maps known mission IDs to deployment types', () => {
    expect(getMissionDeploymentType('QAI_11')).toBe('opposing_edges');
    expect(getMissionDeploymentType('QAI_12')).toBe('corners');
    expect(getMissionDeploymentType('QAI_19')).toBe('custom');
  });

  it('falls back to opposing_edges for unknown mission IDs', () => {
    expect(getMissionDeploymentType('UNKNOWN_MISSION')).toBe('opposing_edges');
  });

  it('uses canonical game-size depth when no mission override exists', () => {
    expect(getMissionDeploymentDepth('VERY_SMALL', 'QAI_11')).toBe(2);
    expect(getMissionDeploymentDepth('MEDIUM', 'QAI_12')).toBe(4);
  });

  it('builds deployment profiles from mission + size', () => {
    const profile = getMissionDeploymentProfile('QAI_17', 'SMALL');
    expect(profile).toEqual({
      deploymentType: 'corners',
      deploymentDepth: 2,
    });
  });
});
