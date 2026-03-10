import { describe, expect, it, vi } from 'vitest';
import { applyActionExecutionReactPostProcessingForRunner } from './ActionExecutionReactPostProcessing';

describe('ActionExecutionReactPostProcessing', () => {
  it('returns unchanged payload when action was not executed', () => {
    const result = applyActionExecutionReactPostProcessingForRunner({
      actionExecuted: false,
      character: { id: 'c1' } as any,
      enemies: [],
      battlefield: {
        getCharacterPosition: vi.fn(() => ({ x: 1, y: 1 })),
      } as any,
      gameManager: {} as any,
      visibilityOrMu: 8,
      startPos: { x: 0, y: 0 } as any,
      stepVectors: [],
      stepInteractions: [],
      stepOpposedTest: undefined,
      stepDetails: { foo: 'bar' },
      snapshotModelState: vi.fn(() => ({} as any)),
      createMovementVector: vi.fn(() => ({} as any)),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      processReacts: vi.fn(() => ({ executed: false } as any)),
      trackReactOutcome: vi.fn(),
    });

    expect(result.movedDistance).toBe(0);
    expect(result.stepDetails).toEqual({ foo: 'bar' });
  });

  it('tracks movement and react merge when action executed', () => {
    const stepVectors: any[] = [];
    const stepInteractions: any[] = [];
    const processReacts = vi.fn(() => ({
      executed: false,
      vector: undefined,
      details: { kind: 'react' },
      resultCode: 'react=false',
    }));
    const result = applyActionExecutionReactPostProcessingForRunner({
      actionExecuted: true,
      character: { id: 'c1' } as any,
      enemies: [],
      battlefield: {
        getCharacterPosition: vi.fn(() => ({ x: 3, y: 4 })),
      } as any,
      gameManager: {} as any,
      visibilityOrMu: 8,
      startPos: { x: 0, y: 0 } as any,
      stepVectors,
      stepInteractions,
      stepOpposedTest: undefined,
      stepDetails: undefined,
      snapshotModelState: vi.fn(() => ({} as any)),
      createMovementVector: vi.fn(() => ({
        kind: 'movement' as const,
        from: { x: 0, y: 0 },
        to: { x: 3, y: 4 },
        distanceMu: 5,
      })),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      processReacts,
      trackReactOutcome: vi.fn(),
    });

    expect(result.movedDistance).toBe(5);
    expect(stepVectors.length).toBe(1);
    expect(processReacts).toHaveBeenCalledTimes(1);
    expect(processReacts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'Move',
      5,
      false,
      8
    );
  });

  it('marks reactingToEngaged when movement newly enters base-contact', () => {
    const processReacts = vi.fn(() => ({ executed: false }));
    const character = {
      id: 'c1',
      attributes: { siz: 3 },
      finalAttributes: { siz: 3 },
    } as any;
    const enemy = {
      id: 'e1',
      attributes: { siz: 3 },
      finalAttributes: { siz: 3 },
    } as any;

    applyActionExecutionReactPostProcessingForRunner({
      actionExecuted: true,
      character,
      enemies: [enemy],
      battlefield: {
        getCharacterPosition: vi.fn((model: any) => {
          if (model.id === 'c1') return { x: 1, y: 0 }; // end position
          if (model.id === 'e1') return { x: 2, y: 0 }; // base-contact at end for siz 3
          return undefined;
        }),
      } as any,
      gameManager: {} as any,
      visibilityOrMu: 8,
      startPos: { x: 0, y: 0 } as any,
      stepVectors: [],
      stepInteractions: [],
      stepOpposedTest: undefined,
      stepDetails: undefined,
      snapshotModelState: vi.fn(() => ({} as any)),
      createMovementVector: vi.fn(() => ({
        kind: 'movement' as const,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        distanceMu: 1,
      })),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      processReacts,
      trackReactOutcome: vi.fn(),
    });

    expect(processReacts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'Move',
      1,
      true,
      8
    );
  });

  it('uses NonMove react trigger when the executed action does not move', () => {
    const processReacts = vi.fn(() => ({ executed: false }));
    applyActionExecutionReactPostProcessingForRunner({
      actionExecuted: true,
      character: { id: 'c1', attributes: { siz: 3 }, finalAttributes: { siz: 3 } } as any,
      enemies: [],
      battlefield: {
        getCharacterPosition: vi.fn(() => ({ x: 4, y: 4 })),
      } as any,
      gameManager: {} as any,
      visibilityOrMu: 8,
      startPos: { x: 4, y: 4 } as any,
      stepVectors: [],
      stepInteractions: [],
      stepOpposedTest: undefined,
      stepDetails: undefined,
      snapshotModelState: vi.fn(() => ({} as any)),
      createMovementVector: vi.fn(() => ({
        kind: 'movement' as const,
        from: { x: 4, y: 4 },
        to: { x: 4, y: 4 },
        distanceMu: 0,
      })),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      processReacts,
      trackReactOutcome: vi.fn(),
    });

    expect(processReacts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'NonMove',
      0,
      false,
      8
    );
  });

  it('resolves hidden exposure after movement and records reveal details', () => {
    const processReacts = vi.fn(() => ({ executed: false }));
    const character = {
      id: 'c-hidden',
      state: { isHidden: true },
      attributes: { siz: 3 },
      finalAttributes: { siz: 3 },
    } as any;
    const resolveHiddenExposure = vi.fn(() => ({
      revealed: true,
      repositioned: false,
    }));

    const result = applyActionExecutionReactPostProcessingForRunner({
      actionExecuted: true,
      character,
      enemies: [{ id: 'e1' } as any],
      battlefield: {
        getCharacterPosition: vi.fn((model: any) => {
          if (model.id === 'c-hidden') return { x: 5, y: 5 };
          return { x: 8, y: 5 };
        }),
      } as any,
      gameManager: {
        resolveHiddenExposure,
      } as any,
      visibilityOrMu: 8,
      startPos: { x: 4, y: 5 } as any,
      stepVectors: [],
      stepInteractions: [],
      stepOpposedTest: undefined,
      stepDetails: { initial: true },
      snapshotModelState: vi.fn(() => ({} as any)),
      createMovementVector: vi.fn(() => ({
        kind: 'movement' as const,
        from: { x: 4, y: 5 },
        to: { x: 5, y: 5 },
        distanceMu: 1,
      })),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      processReacts,
      trackReactOutcome: vi.fn(),
    });

    expect(resolveHiddenExposure).toHaveBeenCalledWith(
      character,
      expect.any(Array),
      expect.objectContaining({
        allowReposition: false,
        visibilityOrMu: 8,
      })
    );
    expect(result.stepDetails).toEqual(
      expect.objectContaining({
        initial: true,
        hiddenExposure: expect.objectContaining({
          revealed: true,
          repositioned: false,
        }),
      })
    );
    expect(processReacts).toHaveBeenCalledTimes(1);
  });
});
