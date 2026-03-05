/**
 * Represents a parsed, structured Trait object.
 * This is the machine-readable format used by the simulator after the
 * initial string-parsing is complete.
 */
export interface Trait {
  /**
   * The canonical name of the trait, e.g., "Sturdy", "Damper", "INT".
   */
  name: string;

  /**
   * The numeric level of the trait, e.g., 3 for "Sturdy 3".
   */
  level?: number;

  /**
   * Backward compatibility alias for legacy tests/parsers.
   */
  value?: number;

  /**
   * The specific type or target of the trait, e.g., "Fear" for "Damper 4 > Fear".
   */
  type?: string;

  /**
   * A list of sub-traits or keywords, e.g., ["Grit", "Fight"] for "Augment 2 > [Grit, Fight]".
   */
  list?: string[];

  /**
   * The original string representation of the trait, e.g., "Damper 4 > Fear".
   * Useful for display and debugging.
   * Made optional for backward compatibility with test code.
   */
  source?: string;

  /**
   * Whether this trait is a disability (enclosed in brackets).
   */
  isDisability?: boolean;
}
