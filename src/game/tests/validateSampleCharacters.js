// /src/test/validateSampleCharacters.js
import { SampleCharacterValidator } from '../core/SampleCharacterValidator.js';

/**
 * Runs sample character validation on page load
 * Displays results in browser console
 */
export function runValidation() {
  try {
    console.log('🔍 Validating sample characters against QSR data...');
    const result = SampleCharacterValidator.validate();
    
    if (result.isValid) {
      console.log('%c✅ All sample characters are BP-consistent.', 'color: green; font-weight: bold;');
    } else {
      console.log('%c❌ Sample character validation failed:', 'color: red; font-weight: bold;');
      result.issues.forEach(issue => {
        if (issue.type === 'bp_mismatch') {
          console.log(
            `%c  • ${issue.name}: declared=${issue.declared}, computed=${issue.computed} (Δ=${issue.diff})`,
            'color: orange;'
          );
        } else if (issue.type === 'construction_error') {
          console.log(`%c  • Construction error: ${issue.error}`, 'color: red;');
        }
      });
      
      // Optional: Add to UI
      const statusDiv = document.getElementById('validation-status');
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="color: red; background: #ffebee; padding: 10px; border-radius: 4px;">
            <strong>Validation Failed</strong><br>
            Check console for details.
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('%c💥 Validation crashed:', 'color: red; font-weight: bold;', error);
    const statusDiv = document.getElementById('validation-status');
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div style="color: red; background: #ffebee; padding: 10px; border-radius: 4px;">
          <strong>Validation Crashed</strong><br>
          ${error.message}
        </div>
      `;
    }
  }
}

// Auto-run when module is loaded
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runValidation);
  } else {
    runValidation();
  }
}