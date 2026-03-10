export const MISSION_NAME_BY_ID: Record<string, string> = {
  QAI_11: 'Elimination',
  QAI_12: 'Convergence',
  QAI_13: 'Assault',
  QAI_14: 'Dominion',
  QAI_15: 'Recovery',
  QAI_16: 'Escort',
  QAI_17: 'Triumvirate',
  QAI_18: 'Stealth',
  QAI_19: 'Defiance',
  QAI_20: 'Breach',
};

export function resolveMissionName(missionId: string): string {
  const key = String(missionId || '').trim().toUpperCase();
  return MISSION_NAME_BY_ID[key] ?? key;
}
