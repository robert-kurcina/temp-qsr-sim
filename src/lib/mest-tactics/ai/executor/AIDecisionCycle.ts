import type { AIContext, AIResult, CharacterKnowledge } from '../core/AIController';

export interface AIDecisionCycleCallbacks {
  updateKnowledge?: () => CharacterKnowledge;
  decideAction: () => AIResult;
  assignKnowledgeToContext?: boolean;
}

export function runAIDecisionCycle(
  context: AIContext,
  callbacks: AIDecisionCycleCallbacks
): AIResult {
  if (callbacks.updateKnowledge) {
    const knowledge = callbacks.updateKnowledge();
    if (callbacks.assignKnowledgeToContext !== false) {
      context.knowledge = knowledge;
    }
  }

  return callbacks.decideAction();
}
