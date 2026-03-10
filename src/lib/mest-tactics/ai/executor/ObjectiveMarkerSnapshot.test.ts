import { describe, expect, it } from 'vitest';
import { buildAIObjectiveMarkerSnapshot, getMarkerKeyIdsInHand } from './ObjectiveMarkerSnapshot';

describe('buildAIObjectiveMarkerSnapshot', () => {
  it('maps objective marker fields into AI context snapshot', () => {
    const snapshot = buildAIObjectiveMarkerSnapshot({
      getObjectiveMarkers: () => [
        {
          id: 'om-1',
          name: 'Key Alpha',
          state: 'carried',
          position: { x: 1, y: 2 },
          carriedBy: 'char-1',
          scoringSideId: 'Alpha',
          controlledBy: 'Alpha',
          omTypes: ['Key'],
          switchState: 'on',
          isNeutral: false,
          metadata: {
            aiInteractable: false,
            missionSource: 'QAI_11',
          },
        },
      ],
    });

    expect(snapshot).toHaveLength(1);
    expect(snapshot?.[0]).toEqual({
      id: 'om-1',
      name: 'Key Alpha',
      state: 'carried',
      position: { x: 1, y: 2 },
      carriedBy: 'char-1',
      scoringSideId: 'Alpha',
      controlledBy: 'Alpha',
      omTypes: ['Key'],
      switchState: 'on',
      isNeutral: false,
      interactable: false,
      missionSource: 'QAI_11',
    });
  });

  it('defaults interactable=true and omTypes=[]', () => {
    const snapshot = buildAIObjectiveMarkerSnapshot({
      getObjectiveMarkers: () => [
        {
          id: 'om-2',
          name: 'Switch',
          state: 'idle',
          metadata: {},
        },
      ],
    });
    expect(snapshot?.[0]?.interactable).toBe(true);
    expect(snapshot?.[0]?.omTypes).toEqual([]);
  });

  it('returns key marker ids held by a character', () => {
    const provider = {
      getObjectiveMarkers: () => [
        {
          id: 'om-key',
          name: 'Key Marker',
          state: 'carried',
          carriedBy: 'char-1',
          omTypes: ['Key'],
          metadata: {},
        },
        {
          id: 'om-token',
          name: 'Token Marker',
          state: 'carried',
          carriedBy: 'char-1',
          omTypes: ['Switch'],
          metadata: {},
        },
      ],
    };

    expect(getMarkerKeyIdsInHand('char-1', provider)).toEqual(['om-key']);
    expect(getMarkerKeyIdsInHand('char-2', provider)).toEqual([]);
  });
});
