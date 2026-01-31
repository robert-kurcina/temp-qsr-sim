import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ActionSystem } from './ActionSystem.js';

describe('ActionSystem', () => {
  let character;

  beforeEach(() => {
    // Mock Character object
    character = {
      getAvailableAP: vi.fn(),
      hasUsedFiddleAction: vi.fn(),
      spendAP: vi.fn(),
      incrementFiddleActions: vi.fn(),
      handManager: {
        switchItem: vi.fn(),
      },
    };
  });

  describe('switchItem', () => {
    test('should successfully switch an item with sufficient AP', () => {
      // Arrange
      character.getAvailableAP.mockReturnValue(1);
      character.hasUsedFiddleAction.mockReturnValue(false); // First fiddle action is free
      character.handManager.switchItem.mockReturnValue('Pistol is now in hand.');

      // Act
      const result = ActionSystem.switchItem(character, 'Pistol');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.messages).toEqual(['Pistol is now in hand.']);
      expect(character.spendAP).toHaveBeenCalledWith(0); // Free fiddle action
      expect(character.incrementFiddleActions).toHaveBeenCalledTimes(1);
      expect(character.handManager.switchItem).toHaveBeenCalledWith('Pistol');
    });

    test('should fail to switch an item with insufficient AP', () => {
      // Arrange
      character.getAvailableAP.mockReturnValue(0);
      character.hasUsedFiddleAction.mockReturnValue(true); // Subsequent fiddle actions cost 1 AP

      // Act
      const result = ActionSystem.switchItem(character, 'Pistol');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.messages).toEqual(['Insufficient AP. Needs 1, has 0.']);
      expect(character.spendAP).not.toHaveBeenCalled();
      expect(character.incrementFiddleActions).not.toHaveBeenCalled();
      expect(character.handManager.switchItem).not.toHaveBeenCalled();
    });

    test('should handle HandManager errors gracefully', () => {
      // Arrange
      character.getAvailableAP.mockReturnValue(1);
      character.hasUsedFiddleAction.mockReturnValue(false);
      character.handManager.switchItem.mockReturnValue('Not enough free hands to switch to Pistol.');

      // Act
      const result = ActionSystem.switchItem(character, 'Pistol');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.messages).toEqual(['Not enough free hands to switch to Pistol.']);
      expect(character.spendAP).not.toHaveBeenCalled();
      expect(character.incrementFiddleActions).not.toHaveBeenCalled();
      expect(character.handManager.switchItem).toHaveBeenCalledWith('Pistol');
    });
  });
});
