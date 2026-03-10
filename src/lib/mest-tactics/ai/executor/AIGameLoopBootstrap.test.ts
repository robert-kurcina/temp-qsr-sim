import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapAIGameLoopState } from './AIGameLoopBootstrap';
import { DEFAULT_AI_GAME_LOOP_CONFIG } from './AIGameLoopTypes';

const mockCreateAIExecutor = vi.fn();
const mockInitializeAILayers = vi.fn();
const mockCreateDecisionRuntime = vi.fn();

vi.mock('./AIActionExecutor', () => ({
  createAIExecutor: (...args: unknown[]) => mockCreateAIExecutor(...args),
}));

vi.mock('./AILayerInitializationSupport', () => ({
  initializeAILayersForGameLoop: (...args: unknown[]) => mockInitializeAILayers(...args),
}));

vi.mock('./AIGameLoopDecisionRuntime', () => ({
  createAIGameLoopDecisionRuntime: (...args: unknown[]) => mockCreateDecisionRuntime(...args),
}));

describe('bootstrapAIGameLoopState', () => {
  beforeEach(() => {
    mockCreateAIExecutor.mockReset();
    mockInitializeAILayers.mockReset();
    mockCreateDecisionRuntime.mockReset();
  });

  it('builds executor, ai layers, and decision runtime in order', () => {
    const manager = { characters: [] } as any;
    const battlefield = { width: 24, height: 24 } as any;
    const sides = [{ id: 'A' }, { id: 'B' }] as any;
    const config = { ...DEFAULT_AI_GAME_LOOP_CONFIG };
    const logger = null;

    const fakeExecutor = { id: 'executor' };
    const fakeAiLayers = {
      sideIds: ['A', 'B'],
      characterSideById: new Map<string, string>(),
      characterAssemblyById: new Map<string, string>(),
      sideAIs: new Map(),
      assemblyAIs: new Map(),
      characterAIs: new Map(),
    };
    const fakeDecisionRuntime = { id: 'runtime' };

    mockCreateAIExecutor.mockReturnValue(fakeExecutor);
    mockInitializeAILayers.mockReturnValue(fakeAiLayers);
    mockCreateDecisionRuntime.mockReturnValue(fakeDecisionRuntime);

    const result = bootstrapAIGameLoopState({
      manager,
      battlefield,
      sides,
      config,
      logger,
    });

    expect(mockCreateAIExecutor).toHaveBeenCalledTimes(1);
    expect(mockInitializeAILayers).toHaveBeenCalledTimes(1);
    expect(mockCreateDecisionRuntime).toHaveBeenCalledTimes(1);

    expect(result.executor).toBe(fakeExecutor);
    expect(result.aiLayers).toBe(fakeAiLayers);
    expect(result.decisionRuntime).toBe(fakeDecisionRuntime);
  });
});
