// /src/app/StateManager.js
/**
 * Manages application state and navigation
 */
export class StateManager {
  static currentState = 'dashboard';
  static data = null;

  static initialize(data) {
    this.data = data;
    this.render();
  }

  static switchTab(tabName) {
    // Update active state
    this.currentState = tabName;
    
    // Update UI
    this.updateActiveTab();
    this.renderContent();
    
    // Close mobile menu
    document.getElementById('mobile-menu')?.classList.add('hidden');
  }

  static updateActiveTab() {
    // Desktop tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.currentState);
    });
    
    // Mobile menu items
    document.querySelectorAll('.menu-list a').forEach(link => {
      link.style.backgroundColor = 
        link.dataset.tab === this.currentState ? '#f3f4f6' : '';
    });
  }

  static renderContent() {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Show current tab
    const tabElement = document.getElementById(this.currentState);
    if (tabElement) {
      tabElement.classList.remove('hidden');
    }
    
    // Hide loading screen
    document.getElementById('loading')?.classList.add('hidden');
  }

  static render() {
    this.renderContent();
    this.updateActiveTab();
  }
}