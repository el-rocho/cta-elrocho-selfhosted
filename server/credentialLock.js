const credentialLocks = new Map();

export async function withUserCredentialLock(userId, operation) {
  const previous = credentialLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  credentialLocks.set(userId, queued);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (credentialLocks.get(userId) === queued) {
      credentialLocks.delete(userId);
    }
  }
}
