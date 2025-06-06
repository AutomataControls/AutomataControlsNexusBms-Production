// @ts-nocheck
// lib/firebase/rtdb/utils.ts

import { Database, get, ref } from 'firebase/database'

/**
 * Fetches all RTDB locations from the `/locations` node.
 */
export async function fetchAllRtdbLocations(database: Database) {
  const locationsRef = ref(database, '/locations')
  return await get(locationsRef)
}
