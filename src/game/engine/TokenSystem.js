export class TokenSystem {
  constructor() {
    this.tokens = new Map(); // Map<modelId, Array<tokenType>>
  }

  addToken(modelId, tokenType) {
    if (!this.tokens.has(modelId)) {
      this.tokens.set(modelId, []);
    }
    this.tokens.get(modelId).push(tokenType);
  }

  getTokens(modelId) {
    return this.tokens.get(modelId) || [];
  }
}
