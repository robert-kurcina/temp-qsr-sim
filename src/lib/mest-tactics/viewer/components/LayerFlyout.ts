/**
 * Layer Flyout Component
 * 
 * Reusable layer toggle dropdown for battle viewer and terrain audit.
 * Can be embedded in any HTML page.
 * 
 * @example
 * ```javascript
 * const flyout = new LayerFlyout({
 *   container: document.getElementById('layer-container'),
 *   layers: [
 *     { id: 'grid', label: 'Grid', enabled: true },
 *     { id: 'terrain', label: 'Terrain', enabled: true },
 *   ],
 *   onToggle: (layerId, enabled) => {
 *     console.log(`Layer ${layerId} is now ${enabled ? 'enabled' : 'disabled'}`);
 *   }
 * });
 * ```
 */

export interface LayerConfig {
  id: string;
  label: string;
  enabled: boolean;
  icon?: string;
}

export interface LayerFlyoutOptions {
  container: HTMLElement;
  layers: LayerConfig[];
  onToggle: (layerId: string, enabled: boolean) => void;
  buttonLabel?: string;
}

export class LayerFlyout {
  private container: HTMLElement;
  private layers: LayerConfig[];
  private onToggle: (layerId: string, enabled: boolean) => void;
  private buttonLabel: string;
  private flyoutElement: HTMLElement | null = null;
  private buttonElement: HTMLButtonElement | null = null;

  constructor(options: LayerFlyoutOptions) {
    this.container = options.container;
    this.layers = options.layers;
    this.onToggle = options.onToggle;
    this.buttonLabel = options.buttonLabel || '⚙️ Layers';
    
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the flyout component
   */
  private render(): void {
    // Create container wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'layer-flyout-wrapper';
    wrapper.style.cssText = 'position: relative; display: inline-block;';

    // Create toggle button
    this.buttonElement = document.createElement('button');
    this.buttonElement.className = 'layer-flyout-btn';
    this.buttonElement.textContent = `${this.buttonLabel} ▼`;
    this.buttonElement.style.cssText = `
      background: #0f3460;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    `;

    // Create flyout menu
    this.flyoutElement = document.createElement('div');
    this.flyoutElement.className = 'layer-flyout-menu';
    this.flyoutElement.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 4px;
      padding: 0.5rem;
      min-width: 180px;
      z-index: 1000;
      margin-top: 0.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    // Add layer checkboxes
    for (const layer of this.layers) {
      const label = document.createElement('label');
      label.className = 'layer-flyout-option';
      label.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.5rem;
        cursor: pointer;
        font-size: 0.8rem;
        color: #eee;
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = layer.enabled;
      checkbox.dataset.layerId = layer.id;
      checkbox.style.cssText = 'width: 14px; height: 14px; cursor: pointer;';

      const labelText = document.createElement('span');
      labelText.textContent = layer.icon ? `${layer.icon} ${layer.label}` : layer.label;

      label.appendChild(checkbox);
      label.appendChild(labelText);
      this.flyoutElement.appendChild(label);
    }

    wrapper.appendChild(this.buttonElement);
    wrapper.appendChild(this.flyoutElement);
    this.container.appendChild(wrapper);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.buttonElement || !this.flyoutElement) return;

    // Toggle flyout on button click
    this.buttonElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = this.flyoutElement!.style.display === 'block';
      this.flyoutElement!.style.display = isVisible ? 'none' : 'block';
    });

    // Handle layer toggles
    this.flyoutElement.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName === 'INPUT' && target.type === 'checkbox') {
        const layerId = target.dataset.layerId;
        if (layerId) {
          this.onToggle(layerId, target.checked);
          // Update internal state
          const layer = this.layers.find(l => l.id === layerId);
          if (layer) {
            layer.enabled = target.checked;
          }
        }
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.flyoutElement!.style.display = 'none';
      }
    });
  }

  /**
   * Update layer enabled state programmatically
   */
  public setLayerEnabled(layerId: string, enabled: boolean): void {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      layer.enabled = enabled;
      const checkbox = this.flyoutElement?.querySelector(`input[data-layer-id="${layerId}"]`) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = enabled;
      }
    }
  }

  /**
   * Get current layer states
   */
  public getLayerStates(): Record<string, boolean> {
    const states: Record<string, boolean> = {};
    for (const layer of this.layers) {
      states[layer.id] = layer.enabled;
    }
    return states;
  }

  /**
   * Destroy the component and clean up
   */
  public destroy(): void {
    this.container.innerHTML = '';
    this.flyoutElement = null;
    this.buttonElement = null;
  }
}

/**
 * Default layer configurations for different modes
 */
export const LAYER_PRESETS = {
  /** Battle viewer layers */
  battleViewer: [
    { id: 'grid', label: 'Grid', enabled: true },
    { id: 'deployment', label: 'Deployment Zones', enabled: true },
    { id: 'terrain', label: 'Terrain', enabled: true },
    { id: 'delaunay', label: 'Pathfinding Mesh', enabled: false },
    { id: 'models', label: 'Models', enabled: true },
    { id: 'vectors', label: 'Vectors', enabled: true },
    { id: 'movement', label: 'Movement Arrows', enabled: true },
  ],

  /** Terrain audit layers */
  terrainAudit: [
    { id: 'grid', label: 'Grid', enabled: true },
    { id: 'deployment', label: 'Deployment Zones', enabled: true },
    { id: 'terrain', label: 'Terrain', enabled: true },
    { id: 'delaunay', label: 'Pathfinding Mesh', enabled: true },
    { id: 'overlaps', label: 'Show Overlaps', enabled: true, icon: '⚠️' },
    { id: 'fitness', label: 'Fitness Scores', enabled: true, icon: '📊' },
  ],
};

/**
 * Create a LayerFlyout with preset configuration
 */
export function createLayerFlyout(
  container: HTMLElement,
  preset: 'battleViewer' | 'terrainAudit',
  onToggle: (layerId: string, enabled: boolean) => void
): LayerFlyout {
  const layers = LAYER_PRESETS[preset].map(l => ({ ...l }));
  return new LayerFlyout({
    container,
    layers,
    onToggle,
  });
}
