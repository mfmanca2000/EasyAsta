// Simple in-memory cache for API responses
class SimpleCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private maxSize = 100; // Prevent memory leaks

  set(key: string, data: any, ttlMs: number) {
    // Clear oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Clear expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const apiCache = new SimpleCache();

// Cleanup expired entries every 5 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    apiCache.cleanup();
  }, 5 * 60 * 1000);
}

export { apiCache };

// Cache key generators
export const getCacheKey = {
  dashboard: (userId: string) => `dashboard:${userId}`,
  leagues: (userId: string) => `leagues:${userId}`,
  auction: (leagueId: string) => `auction:${leagueId}`,
  players: (leagueId: string, filters?: string) => `players:${leagueId}:${filters || 'all'}`,
};

// TTL constants (in milliseconds)
export const CACHE_TTL = {
  DASHBOARD: 30 * 1000,      // 30 seconds - relatively dynamic data
  LEAGUES: 60 * 1000,        // 1 minute - semi-static data
  AUCTION: 5 * 1000,         // 5 seconds - highly dynamic during auctions
  PLAYERS: 5 * 60 * 1000,    // 5 minutes - mostly static data
} as const;