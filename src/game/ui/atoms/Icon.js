// /src/ui/atoms/Icon.js
/**
 * Icon atom using Unicode symbols (no external dependencies)
 * @param {string} name - Icon name (e.g., 'dashboard', 'builder')
 * @returns {string} Unicode symbol
 */
export function Icon(name) {
  const icons = {
    dashboard: '🏠',
    builder: '🛠️',
    gameplay: '🎮',
    analysis: '📊',
    settings: '⚙️',
    profile: '👤',
    assembly: '🧩',
    mission: '⚔️',
    add: '➕',
    remove: '➖',
    back: '←',
    menu: '☰',
    close: '✕'
  };
  
  return icons[name] || '❓';
}