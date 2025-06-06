// @ts-nocheck
// /opt/productionapp/lib/api-cache.ts (NEW FILE)
import { connection } from './queues';

/**
 * Cache API response in Redis
 */
export async function cacheApiResponse(key: string, response: Response, ttl: number = 60) {
  // Only cache successful responses
  if (!response.ok) return response;

  try {
    // Clone response for caching
    const clonedResponse = response.clone();
    
    // Extract response properties
    const status = clonedResponse.status;
    const headers = Object.fromEntries(clonedResponse.headers.entries());
    const body = await clonedResponse.text();
    
    // Store in Redis
    const cacheData = JSON.stringify({ status, headers, body });
    await connection.set(key, cacheData, 'EX', ttl);
    
    // Add cache header
    response.headers.set('X-Cache', 'MISS');
    
  } catch (error) {
    console.warn('Redis response caching error:', error);
  }
  
  return response;
}
