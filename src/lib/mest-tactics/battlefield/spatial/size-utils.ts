export function getBaseDiameterFromSiz(siz: number): number {
  const table: Record<number, number> = {
    0: 0.5,
    1: 0.6,
    2: 0.8,
    3: 1,
    4: 1.2,
    5: 1.6,
    6: 2,
    7: 2.4,
  };
  if (Number.isFinite(siz) && siz in table) {
    return table[siz];
  }
  if (!Number.isFinite(siz)) return 1;
  // Fallback: scale from SIZ 3 = 1 MU, +0.4 MU per size above 5.
  if (siz <= 0) return 0.5;
  if (siz <= 3) return 1 + (siz - 3) * 0.2;
  if (siz <= 5) return 1 + (siz - 3) * 0.3;
  return 1.6 + (siz - 5) * 0.4;
}
