import { describe, it, expect } from 'vitest';
import { parseTrait } from './trait-parser';

describe('parseTrait', () => {
  it('should return null for invalid input', () => {
    expect(parseTrait(null)).toBeNull();
    expect(parseTrait(undefined)).toBeNull();
    expect(parseTrait('')).toBeNull();
  });

  // Test cases for standard traits
  it('should parse a simple trait with no value', () => {
    expect(parseTrait('Reach')).toEqual({ name: 'Reach', value: 1, isDisability: false });
  });

  it('should parse a trait with a numeric value', () => {
    expect(parseTrait('Reach 2')).toEqual({ name: 'Reach', value: 2, isDisability: false });
  });

  it('should parse a trait with an explicit X= value', () => {
    expect(parseTrait('Reach X=1')).toEqual({ name: 'Reach', value: 1, isDisability: false });
  });

  it('should parse a trait with an explicit X= value and a larger number', () => {
    expect(parseTrait('Reach X=2')).toEqual({ name: 'Reach', value: 2, isDisability: false });
  });

  // Test cases for disability traits
  it('should parse a simple disability trait with no value', () => {
    expect(parseTrait('[Laden]')).toEqual({ name: 'Laden', value: 1, isDisability: true });
  });

  it('should parse a disability trait with a numeric value', () => {
    expect(parseTrait('[Laden 3]')).toEqual({ name: 'Laden', value: 3, isDisability: true });
  });

  it('should parse a disability trait with an explicit X= value', () => {
    expect(parseTrait('[Laden X=1]')).toEqual({ name: 'Laden', value: 1, isDisability: true });
  });

  it('should parse a disability trait with an explicit X= value and a larger number', () => {
    expect(parseTrait('[Laden X=3]')).toEqual({ name: 'Laden', value: 3, isDisability: true });
  });

  it('should handle another disability trait example', () => {
    expect(parseTrait('[Stub]')).toEqual({ name: 'Stub', value: 1, isDisability: true });
  });
});
