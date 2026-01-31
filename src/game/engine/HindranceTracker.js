export class HindranceTracker {
  constructor(tokenSystem) {
    this.tokenSystem = tokenSystem;
  }

  getHindrances(modelId) {
    const tokens = this.tokenSystem.getTokens(modelId);
    const hindrances = { fear: 0, delay: 0, wounds: 0 };
    for (const token of tokens) {
      if (hindrances.hasOwnProperty(token)) {
        hindrances[token]++;
      }
    }
    return hindrances;
  }

  addHindrance(modelId, hindranceType) {
    this.tokenSystem.addToken(modelId, hindranceType);
  }
}
