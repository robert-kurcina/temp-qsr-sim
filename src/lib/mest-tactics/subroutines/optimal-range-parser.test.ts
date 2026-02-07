
import { parseOptimalRange } from './optimal-range-parser';
import { FinalAttributes } from '../Attributes';
import { describe, it, expect } from 'vitest';

describe('parseOptimalRange', () => {
    const attributes: FinalAttributes = {
        str: 4,
        agi: 5,
        int: 6,
        per: 7,
        mov: 8,
        rca: 9,
        cca: 10,
        ref: 11,
    };

    it('should return 0 for undefined input', () => {
        expect(parseOptimalRange(undefined, attributes)).toBe(0);
    });

    it('should parse a simple numeric OR', () => {
        expect(parseOptimalRange('OR(12)', attributes)).toBe(12);
    });

    it('should parse an attribute-based OR', () => {
        expect(parseOptimalRange('OR(Agi)', attributes)).toBe(5);
    });

    it('should parse a mixed OR with addition', () => {
        expect(parseOptimalRange('OR(Str+2)', attributes)).toBe(6);
    });

    it('should handle multiple attributes', () => {
        expect(parseOptimalRange('OR(Per+Int)', attributes)).toBe(13);
    });

    it('should handle complex expressions', () => {
        expect(parseOptimalRange('OR(Str+Agi+2)', attributes)).toBe(11);
    });
});
