import type { AIContext } from './AIController';

type WaitForecastLike = {
  expectedTriggerCount?: number;
};

export function evaluateWaitTacticalConditions(
  context: AIContext,
  waitForecast: WaitForecastLike,
  interactableMarkers: NonNullable<AIContext['objectiveMarkers']>
): number {
  let tacticalBonus = 0;

  const lowRefEnemies = context.enemies.filter(enemy => {
    if (enemy.state.isEliminated || enemy.state.isKOd) return false;
    const enemyRef = enemy.finalAttributes.ref ?? enemy.attributes.ref ?? 2;
    return enemyRef <= 2;
  }).length;
  if (lowRefEnemies > 0) {
    tacticalBonus += lowRefEnemies * 0.6;
  }

  const expectedTriggers = waitForecast.expectedTriggerCount ?? 0;
  if (expectedTriggers >= 2) {
    tacticalBonus += (expectedTriggers - 1) * 0.4;
  }

  const characterPos = context.battlefield.getCharacterPosition(context.character);
  if (characterPos && interactableMarkers.length > 0) {
    const nearMarker = interactableMarkers.some(marker => {
      if (!marker.position) return false;
      const dist = Math.hypot(
        characterPos.x - marker.position.x,
        characterPos.y - marker.position.y
      );
      return dist <= 4;
    });
    if (nearMarker) {
      tacticalBonus += 0.8;
    }
  }

  const apRemaining = context.apRemaining ?? 2;
  if (apRemaining <= 1) {
    tacticalBonus += (1 - apRemaining) * 0.5;
  }

  if (context.scoringContext?.amILeading && context.scoringContext.vpMargin >= 2) {
    tacticalBonus += 0.5;
  }

  if (!context.scoringContext?.amILeading &&
      context.scoringContext?.losingKeys?.includes('elimination')) {
    tacticalBonus += 0.4;
  }

  const maxBonus = 3.0;
  const minBonus = -2.0;
  return Math.max(minBonus, Math.min(tacticalBonus, maxBonus));
}
