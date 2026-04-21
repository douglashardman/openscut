import sodium from 'libsodium-wrappers';

let readyPromise: Promise<typeof sodium> | null = null;

export function getSodium(): Promise<typeof sodium> {
  if (!readyPromise) {
    readyPromise = sodium.ready.then(() => sodium);
  }
  return readyPromise;
}
