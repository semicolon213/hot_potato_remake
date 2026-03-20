/**
 * @file useLedgerManagement.ts
 * @brief 장부 관리 훅
 * @details 장부 목록 조회 및 관리 기능을 제공합니다. 초기 로딩 캐시가 있으면 즉시 표시하고 백그라운드 갱신합니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { useState, useEffect, useCallback } from 'react';
import { getLedgerInfo } from '../../../utils/google/accountingFolderManager';
import { apiClient } from '../../../utils/api/apiClient';
import { ENV_CONFIG } from '../../../config/environment';
import { getCacheManager } from '../../../utils/cache/cacheManager';
import { generateCacheKey } from '../../../utils/cache/cacheUtils';
import type { LedgerInfo, CreateLedgerRequest, LedgerResponse } from '../../../types/features/accounting';

const LEDGER_LIST_CACHE_KEY = generateCacheKey('accounting', 'getLedgerList', {});

function toLedgerInfoList(data: LedgerResponse[] | undefined): LedgerInfo[] {
  if (!data || !Array.isArray(data)) return [];
  return data.map((ledger: LedgerResponse) => ({
    folderId: ledger.folderId || '',
    folderName: ledger.folderName || '',
    spreadsheetId: ledger.spreadsheetId || '',
    evidenceFolderId: ledger.evidenceFolderId || '',
    createdDate: ledger.createdDate || ''
  }));
}

export const useLedgerManagement = () => {
  const [ledgers, setLedgers] = useState<LedgerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 장부 목록 새로고침. silent=true면 로딩 UI 없이 백그라운드 갱신(캐시 우선 표시 후 사용).
   * forceRefresh=true면 getLedgerList 캐시를 먼저 비움(생성·삭제 직후 목록이 안 바뀔 때).
   */
  const refreshLedgers = useCallback(async (silent = false, forceRefresh = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const response = await apiClient.getLedgerList({ forceRefresh });
      if (response.success && response.data) {
        setLedgers(toLedgerInfoList(response.data));
      } else {
        if (!silent) setLedgers([]);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string; status?: number };
      const errorMessage = errObj?.message || '장부 목록을 불러오는데 실패했습니다.';
      setError(
        errObj?.status === 403 || errObj?.message?.includes('PERMISSION_DENIED')
          ? 'Google Drive 권한이 없습니다. 권한을 확인해주세요.'
          : errorMessage
      );
      if (!silent) setLedgers([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  /**
   * 장부 생성
   */
  const createLedger = useCallback(async (request: CreateLedgerRequest) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const userInfo = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('user') || '{}') 
        : {};
      
      const response = await apiClient.createLedger({
        ledgerName: request.ledgerName,
        accountName: request.accountName,
        initialBalance: request.initialBalance,
        creatorEmail: userInfo.email || request.creatorEmail || '',
        accessUsers: request.accessUsers,
        accessGroups: request.accessGroups,
        mainManagerEmail: request.mainManagerEmail,
        subManagerEmails: request.subManagerEmails,
        evidenceFolderName: ENV_CONFIG.EVIDENCE_FOLDER_NAME || 'evidence',
      });

      if (!response.success) {
        throw new Error(response.message || '장부 생성에 실패했습니다.');
      }

      // 장부 목록 새로고침 (캐시된 목록이 남지 않도록)
      await refreshLedgers(false, true);
      
      return response.data;
      
    } catch (err: unknown) {
      console.error('❌ 장부 생성 오류:', err);
      const error = err as { message?: string };
      setError(error.message || '장부 생성에 실패했습니다.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshLedgers]);

  /**
   * 특정 장부 정보 조회
   */
  const getLedger = useCallback(async (folderId: string): Promise<LedgerInfo | null> => {
    try {
      return await getLedgerInfo(folderId);
    } catch (err) {
      console.error('❌ 장부 정보 조회 오류:', err);
      return null;
    }
  }, []);

  // 초기 로드: 캐시가 있으면 즉시 표시 후 백그라운드 갱신, 없으면 로딩 표시 후 요청
  useEffect(() => {
    let cancelled = false;
    const cacheManager = getCacheManager();
    (async () => {
      const cached = await cacheManager.get<{ success: boolean; data?: LedgerResponse[] }>(LEDGER_LIST_CACHE_KEY);
      if (cancelled) return;
      if (cached?.success && cached.data) {
        setLedgers(toLedgerInfoList(cached.data));
        refreshLedgers(true);
        return;
      }
      refreshLedgers();
    })();
    return () => { cancelled = true; };
  }, [refreshLedgers]);

  return {
    ledgers,
    isLoading,
    error,
    refreshLedgers,
    createLedger,
    getLedger
  };
};

