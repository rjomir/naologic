import { LRUCache } from 'lru-cache';

export function createLruCache<
  K extends NonNullable<unknown>,
  V extends NonNullable<unknown>,
>(options: { max: number; ttlMs?: number }): LRUCache<K, V> {
  return new LRUCache<K, V>({
    max: options.max,
    ...(options.ttlMs !== undefined && { ttl: options.ttlMs }),
  });
}
