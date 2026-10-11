import { describe, expect, it } from 'vitest';
import { withUserCredentialLock } from './credentialLock.js';

describe('per-user credential lock', () => {
  it('serializes credential operations for the same user', async () => {
    const events = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = withUserCredentialLock('user-1', async () => {
      events.push('first-start');
      await firstGate;
      events.push('first-end');
    });
    const second = withUserCredentialLock('user-1', async () => {
      events.push('second-start');
      events.push('second-end');
    });

    await Promise.resolve();
    expect(events).toEqual(['first-start']);

    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual([
      'first-start',
      'first-end',
      'second-start',
      'second-end',
    ]);
  });

  it('allows credential operations for different users to run concurrently', async () => {
    const events = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = withUserCredentialLock('user-1', async () => {
      events.push('user-1-start');
      await firstGate;
    });
    const second = withUserCredentialLock('user-2', async () => {
      events.push('user-2-start');
    });

    await Promise.resolve();
    expect(events).toEqual(['user-1-start', 'user-2-start']);

    releaseFirst();
    await Promise.all([first, second]);
  });
});
