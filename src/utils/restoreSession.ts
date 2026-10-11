export function isRestoreSessionCurrent(
  initialGeneration: number,
  currentGeneration: number,
  initialUserId: string,
  currentUserId: string | null
): boolean {
  return initialGeneration === currentGeneration && initialUserId === currentUserId;
}
