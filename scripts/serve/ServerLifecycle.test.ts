import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { killExistingServer, printServerBanner } from './ServerLifecycle';

describe('ServerLifecycle', () => {
  it('ignores missing lsof results', () => {
    vi.mocked(execSync).mockImplementationOnce(() => '' as any);
    killExistingServer(3001);
    expect(execSync).toHaveBeenCalledWith('lsof -ti :3001', expect.any(Object));
  });

  it('prints banner including port', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printServerBanner(3001);
    expect(spy).toHaveBeenCalled();
    const output = String(spy.mock.calls[0]?.[0] || '');
    expect(output).toContain('http://localhost:3001/dashboard');
    spy.mockRestore();
  });
});
