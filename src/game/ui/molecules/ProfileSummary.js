// /src/ui/molecules/ProfileSummary.js
import { BPCounter } from '../atoms/BPCounter.js';

export function ProfileSummary({ profile }) {
  return `
    <div class="profile-summary border p-4 rounded-lg">
      <h3>${profile.name}</h3>
      ${BPCounter({ value: profile.bp })}
      <div>Traits: ${profile.traits.join(', ')}</div>
    </div>
  `;
}