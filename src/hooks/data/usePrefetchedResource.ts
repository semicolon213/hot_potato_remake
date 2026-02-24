/**
 * @file usePrefetchedResource.ts
 * @brief 캐시 우선 조회 후 없을 때만 fetch하는 공통 훅
 * @details cacheManager를 먼저 조회하고, 캐시 미스 시에만 fetchFn을 호출합니다.
 *          초기 로딩/프리페치 전략과 결합해 사용할 수 있습니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCacheManager } from '../../utils/cache/cacheManager';

const DEFAULT_TTL = 5 * 60 * 1000; // 5분

export interface UsePrefetchedResourceOptions<T> {
  /** 캐시 키 (cacheManager에 사용) */
  cacheKey: string;
  /** 캐시 미스 시 호출할 fetch 함수 */
  fetchFn: () => Promise<T>;
  /** 캐시 TTL(ms). 미지정 시 5분 */
  ttl?: number;
  /** 비활성화 시 fetch 하지 않음 (조건부 호출) */
  enabled?: boolean;
}

export interface UsePrefetchedResourceResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 캐시를 먼저 조회하고, 없을 때만 fetch하는 훅.
 * useLedgerManagement, 위젯 데이터 등에서 재사용 가능.
 */
export function usePrefetchedResource<T>({
  cacheKey,
  fetchFn,
  ttl = DEFAULT_TTL,
  enabled = true
}: UsePrefetchedResourceOptions<T>): UsePrefetchedResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const load = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const cacheManager = getCacheManager();
    try {
      const cached = await cacheManager.get<T>(cacheKey);
      if (cached != null) {
        setData(cached);
        setIsLoading(false);
        return;
      }
      const result = await fetchFnRef.current();
      await cacheManager.set(cacheKey, result, ttl);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, ttl, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
