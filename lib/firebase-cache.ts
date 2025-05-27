// Placeholder firebase cache file
export async function getCachedData(key: string) {
  return null;
}

export async function setCachedData(key: string, data: any) {
  return true;
}

export const firebaseCache = {
  get: getCachedData,
  set: setCachedData
};
