// /src/engine/TooltipSystem.js
/**
 * Shows character tooltips on hover
 */
export class TooltipSystem {
  constructor(scene, models, profiles) {
    this.scene = scene;
    this.models = models;
    this.profiles = profiles;
    this.tooltip = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initTooltipElement();
    this.bindEvents();
  }

  initTooltipElement() {
    this.tooltip = document.createElement('div');
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.background = 'rgba(0,0,0,0.9)';
    this.tooltip.style.color = 'white';
    this.tooltip.style.padding = '8px 12px';
    this.tooltip.style.borderRadius = '4px';
    this.tooltip.style.fontFamily = 'monospace';
    this.tooltip.style.fontSize = '12px';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.display = 'none';
    this.tooltip.style.zIndex = '1000';
    document.body.appendChild(this.tooltip);
  }

  bindEvents() {
    const canvas = this.scene.userData.canvas;
    canvas.addEventListener('mousemove', (event) => {
      this.onMouseMove(event);
    });

    canvas.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    // Raycast
    this.raycaster.setFromCamera(this.mouse, window.BATTLEFIELD_ENGINE.camera);
    const intersects = this.raycaster.intersectObjects(
      this.models.map(m => m.mesh), false
    );

    if (intersects.length > 0) {
      const model = this.models.find(m => m.mesh === intersects[0].object);
      if (model) {
        this.showTooltip(model, event.clientX, event.clientY);
        return;
      }
    }

    this.hideTooltip();
  }

  hideTooltip() {
    this.tooltip.style.display = 'none';
  }

  // In TooltipSystem.js
  showTooltip(model, x, y) {
    const profile = this.profiles[model.id] || {};

    // Build written form
    const writtenForm = `${profile.CCA || 0} ${profile.RCA || 0} ${profile.REF || 0} | ${profile.INT || 0} ${profile.POW || 0} ${profile.STR || 0} | ${profile.FOR || 0} ${profile.MOV || 0} ${profile.SIZ || 0}`;

    // Build items list
    const items = [];
    if (profile.weapon) items.push(`Weapon: ${profile.weapon}`);
    if (profile.armor?.suit) items.push(`Armor: ${profile.armor.suit}`);
    if (profile.armor?.shield) items.push(`Shield: ${profile.armor.shield}`);
    if (profile.armor?.helm) items.push(`Helm: ${profile.armor.helm}`);
    if (profile.equipment) items.push(`Equipment: ${profile.equipment}`);

    // Get active tokens
    const tokens = window.TOKEN_SYSTEM?.getTokens(model.id) || new Set();
    const tokenArray = Array.from(tokens);

    // Get hindrances and derived statuses
    const hindrances = window.HINDRANCE_TRACKER?.getHindrances(model.id) || { fear: 0, delay: 0, wounds: 0 };
    const derivedStatuses = model.derivedStatus || [];

    // Determine base statuses (implicit)
    const baseStatuses = [];

    // Attentive: true unless Hidden
    if (!tokens.has('hidden')) {
      baseStatuses.push('Attentive');
    }

    // Ordered: true unless Disordered/Panicked
    const hasDisorder = derivedStatuses.some(s => s === 'Disordered' || s === 'Panicked');
    if (!hasDisorder) {
      baseStatuses.push('Ordered');
    }

    // Revealed: true unless Hidden
    if (!tokens.has('hidden')) {
      baseStatuses.push('Revealed');
    }

    let tooltipHTML = `
    <strong>ID: ${model.identifier}</strong><br>
    <em>${writtenForm}</em><br>
    ${items.length > 0 ? items.join('<br>') : 'No items'}
  `;

    // Add active tokens
    if (tokenArray.length > 0) {
      tooltipHTML += `<br><strong>Tokens:</strong><br>${tokenArray.join(', ')}`;
    }

    // Add derived statuses
    if (derivedStatuses.length > 0) {
      tooltipHTML += `<br><strong>Derived Status:</strong><br>${derivedStatuses.join('<br>')}`;
    }

    // Add base statuses
    if (baseStatuses.length > 0) {
      tooltipHTML += `<br><strong>Base Status:</strong><br>${baseStatuses.join('<br>')}`;
    }

    // Check ammo status
    const hasAmmoMarker = window.AMMO_MARKER_SYSTEM?.hasAmmoMarker(model.id, 'ranged');
    if (hasAmmoMarker) {
      tooltipHTML += `<br><strong>Weapon Status:</strong><br>Out of Ammo!`;
    }

    this.tooltip.innerHTML = tooltipHTML;
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = (x + 10) + 'px';
    this.tooltip.style.top = (y + 10) + 'px';
  }
}