// /src/ui/organisms/ProfileManager.js
import { Button } from '../atoms/Button.js';
import { ProfileManager } from '../../builder/ProfileManager.js';

export const ProfileManagerUI = {
  render() {
    const profiles = ProfileManager.getAll();
    return `
      <div class="profile-manager organism-card">
        <h2>👥 Saved Profiles</h2>
        <div id="profile-list" class="mt-4">
          ${this.renderProfileList(profiles)}
        </div>
      </div>
    `;
  },

  renderProfileList(profiles) {
    if (Object.keys(profiles).length === 0) {
      return '<p>No profiles saved yet.</p>';
    }

    return `
      <ul>
        ${Object.keys(profiles).map(name => `
          <li class="flex justify-between items-center mb-2">
            <span>${name}</span>
            <div>
              ${Button({ text: 'Delete', variant: 'danger', 'data-profile-name': name, class: 'delete-profile-btn' })}
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  },

  init() {
    const profileList = document.getElementById('profile-list');
    if (!profileList) return;

    profileList.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const profileName = target.dataset.profileName;

      if (target.classList.contains('load-profile-btn')) {
        this.loadProfile(profileName);
      }

      if (target.classList.contains('delete-profile-btn')) {
        this.deleteProfile(profileName);
      }
    });
  },

  loadProfile(name) {
    const profile = ProfileManager.get(name);
    if (!profile) {
      alert(`Profile "${name}" not found!`);
      return;
    }

    // Update CharacterBuilder UI
    document.getElementById('archetype-select').value = profile.archetype;
    document.getElementById('weapon-select').value = profile.weapons[0] || '';
    document.getElementById('equipment-select').value = profile.equipment || '';

    // Armor
    document.getElementById('armor-helm').value = profile.armor.find(a => a.includes('Helm')) || '';
    document.getElementById('armor-suit').value = profile.armor.find(a => a.includes('Armor')) || '';
    document.getElementById('armor-shield').value = profile.armor.find(a => a.includes('Shield')) || '';

    // Trigger BP calculation
    const changeEvent = new Event('change');
    document.getElementById('archetype-select').dispatchEvent(changeEvent);
  },

  deleteProfile(name) {
    if (confirm(`Are you sure you want to delete the profile "${name}"?`)) {
      ProfileManager.delete(name);
      alert(`Profile "${name}" deleted!`);
      // Re-render the entire ProfileManagerUI
      const profileManagerContainer = document.querySelector('.profile-manager').parentElement;
      profileManagerContainer.innerHTML = this.render();
      this.init(); // Re-initialize event listeners
    }
  }
};
