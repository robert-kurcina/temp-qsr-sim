import { describe, expect, it } from 'vitest';
import { normalizeCommand, resolveDispatch } from './sim';

describe('normalizeCommand', () => {
  it('maps help aliases', () => {
    expect(normalizeCommand('--help')).toBe('help');
    expect(normalizeCommand('-h')).toBe('help');
  });

  it('returns null for unknown command', () => {
    expect(normalizeCommand('unknown')).toBeNull();
  });
});

describe('resolveDispatch', () => {
  it('defaults to quick command when omitted', () => {
    const resolved = resolveDispatch([]);
    expect(resolved.command).toBe('quick');
    expect(resolved.target?.script).toContain('scripts/ai-battle-setup.ts');
    expect(resolved.target?.args).toEqual([]);
  });

  it('treats positional size/density as quick args', () => {
    const resolved = resolveDispatch(['VERY_SMALL', '0']);
    expect(resolved.command).toBe('quick');
    expect(resolved.target?.args).toEqual(['VERY_SMALL', '0']);
  });

  it('routes interactive command to ai-battle setup', () => {
    const resolved = resolveDispatch(['interactive']);
    expect(resolved.command).toBe('interactive');
    expect(resolved.target?.script).toContain('scripts/ai-battle-setup.ts');
    expect(resolved.target?.args[0]).toBe('--interactive');
  });

  it('treats removed compatibility command as help', () => {
    const resolved = resolveDispatch(['battle', '--audit']);
    expect(resolved.command).toBe('help');
    expect(resolved.target).toBeUndefined();
  });

  it('routes serve-reports to dashboard server script', () => {
    const resolved = resolveDispatch(['serve-reports']);
    expect(resolved.command).toBe('serve-reports');
    expect(resolved.target?.script).toContain('scripts/serve-terrain-audit.ts');
    expect(resolved.target?.args).toEqual([]);
  });
});
