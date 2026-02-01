import { attributeModifier } from './traits/attribute-modifier';

/**
 * A central registry that maps trait names to their corresponding logic modules.
 * The key is the lowercase name of the trait as it appears in the trait's `name` property.
 * The value is the logic object containing hooks like `onAttributeCalculation`.
 */
export const traitLogicRegistry = {
  // For now, we only have one generic modifier.
  // As we add more traits like "Sturdy" or "Damper", we will add their
  // specific logic modules here.
  cca: attributeModifier,
  rca: attributeModifier,
  ref: attributeModifier,
  int: attributeModifier,
  pow: attributeModifier,
  str: attributeModifier,
  for: attributeModifier,
  mov: attributeModifier,
  siz: attributeModifier,
};
