/**
 * @file useDataSyncState.ts
 * @brief DataSync 관련 상태만 분리한 훅
 * @details 초기 로딩/동기화 진행률·마지막 동기화 시각 등. 점진적 useAppState 분리용.
 */

import { useState, useRef } from 'react';
import { getDataSyncService } from '../../services/dataSyncService';

export interface DataSyncProgress {
  current: number;
  total: number;
  message?: string;
}

export function useDataSyncState() {
  const [isInitializingData, setIsInitializingData] = useState(false);
  const [dataSyncProgress, setDataSyncProgress] = useState<DataSyncProgress>({ current: 0, total: 0, message: '' });
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const dataSyncServiceRef = useRef(getDataSyncService());

  return {
    isInitializingData,
    setIsInitializingData,
    dataSyncProgress,
    setDataSyncProgress,
    lastSyncTime,
    setLastSyncTime,
    hasInitialized,
    setHasInitialized,
    dataSyncServiceRef,
  };
}
