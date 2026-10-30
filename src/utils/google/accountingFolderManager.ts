import { logger } from '../logger';
/**
 * @file accountingFolderManager.ts
 * @brief 회계 폴더 관리 유틸리티
 * @details Google Drive API를 사용하여 회계 폴더 및 장부 폴더를 관리합니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { getAccountingFolderId as getPapyrusAccountingFolderId } from '../database/papyrusManager';
import { tokenManager } from '../auth/tokenManager';
import { ENV_CONFIG } from '../../config/environment';
import type { LedgerInfo } from '../../types/features/accounting';
import type { FileItem, DriveFile, FolderItem } from '../../types/google';
const log = logger.scope('utils/google/accountingFolderManager');


/**
 * 회계 폴더 ID 가져오기
 */
export const getAccountingFolderId = (): string | null => {
  return getPapyrusAccountingFolderId();
};

/**
 * 장부 폴더 목록 조회
 * @returns {Promise<LedgerInfo[]>} 장부 목록
 */
export const getLedgerFolders = async (): Promise<LedgerInfo[]> => {
  try {
    // Google API가 준비될 때까지 대기
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts && (!window.gapi || !window.gapi.client)) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!window.gapi || !window.gapi.client) {
      log.warn('Google API가 초기화되지 않았습니다.');
      return [];
    }

    const token = tokenManager.get();
    if (!token) {
      log.warn('Google API 인증 토큰이 없습니다.');
      return [];
    }

    try {
      window.gapi.client.setToken({ access_token: token });
    } catch {
      log.warn('토큰 설정 실패');
    }
    let folderId: string | null = null;
    
    try {
      const { apiClient } = await import('../../utils/api/apiClient');
      const response = await apiClient.request('getAccountingFolderId', {});
      
      if (response.success && response.data?.accountingFolderId) {
        folderId = response.data.accountingFolderId;
        log.debug('폴더 ID 문자 배열:', folderId.split(''));
        log.debug('폴더 ID 유효성 검사:', folderId.length, '자');
      } else {
        log.warn('Apps Script 응답에서 회계 폴더 ID를 찾을 수 없습니다.');
        log.warn('응답 데이터');
        return [];
      }
    } catch (apiError: unknown) {
      log.error('Apps Script를 통한 회계 폴더 ID 조회 실패:', apiError);
      const err = apiError as { status?: number; message?: string };
      // 403 에러인 경우 권한 문제
      if (err?.status === 403 || err?.message?.includes('PERMISSION_DENIED')) {
        log.error('Google Drive 권한이 없습니다. 권한을 확인해주세요.');
      }
      return [];
    }

    if (!folderId) {
      log.warn('회계 폴더 ID를 가져올 수 없습니다.');
      return [];
    }

    // 폴더 ID 유효성 검사
    if (typeof folderId !== 'string' || folderId.length < 10) {
      log.error('회계 폴더 ID가 유효하지 않습니다:', folderId);
      return [];
    }
    
    log.debug('사용할 회계 폴더 ID:', folderId);
    log.debug('폴더 ID 타입:', typeof folderId);
    log.debug('폴더 ID 문자 배열:', folderId.split(''));

    const gapi = window.gapi.client;
    
    // 회계 폴더 정보 먼저 확인
    const folderIdToUse = folderId; // 변수 복사하여 사용
    log.debug('API 호출 전 폴더 ID 확인:', folderIdToUse);
    log.debug('API 호출 전 폴더 ID 문자 배열:', folderIdToUse.split(''));
    
    try {
      await gapi.drive.files.get({
        fileId: folderIdToUse,
        fields: 'id, name, mimeType'
      });
    } catch (folderError: unknown) {
      log.error('회계 폴더 정보 조회 실패:', folderError);
      log.error('사용된 폴더 ID:', folderIdToUse);
      log.error('폴더 ID 문자 배열:', folderIdToUse.split(''));
      const err = folderError as { status?: number };
      if (err.status === 403) {
        throw new Error('회계 폴더에 대한 읽기 권한이 없습니다.');
      }
      throw folderError;
    }
    
    // 회계 폴더 내의 모든 항목 조회 (폴더와 파일 모두)
    const folderIdForQuery = folderId;
    log.debug('폴더 ID 문자 배열:', folderIdForQuery.split(''));
    const query = `'${folderIdForQuery}' in parents and trashed=false`;
    log.debug('쿼리:', query);
    log.debug('쿼리 문자 배열:', query.split(''));
    
    let response;
    try {
      response = await gapi.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        orderBy: 'createdTime desc',
        pageSize: 100
      });
      
      if (response.result.files && response.result.files.length > 0) {
        response.result.files.forEach((item: FileItem, index: number) => {
          log.debug(`${index + 1}. ${item.name} (${item.mimeType})`);
        });
      }
    } catch (listError: unknown) {
      log.error('회계 폴더 내 항목 조회 실패:', listError);
      log.error('에러 상세:', JSON.stringify(listError, null, 2));
      const err = listError as { status?: number };
      if (err.status === 403) {
        throw new Error('회계 폴더 내 항목을 읽을 권한이 없습니다. 폴더 접근 권한을 확인해주세요.');
      }
      throw listError;
    }

    if (!response.result.files || response.result.files.length === 0) {
      log.debug('회계 폴더에 항목이 없습니다.');
      return [];
    }

    // 폴더만 필터링 (장부 폴더)
    const folders = response.result.files.filter((item: DriveFile) => 
      item.mimeType === 'application/vnd.google-apps.folder' &&
      item.name !== ENV_CONFIG.EVIDENCE_FOLDER_NAME // ENV v2: VITE_FOLER_NAME(ACCOUNT_EVIDENCE) 기반
    );
    if (folders.length === 0) {
      log.debug('장부 폴더가 없습니다. (모든 항목이 파일이거나 증빙 폴더일 수 있습니다)');
      return [];
    }

    // 각 장부 폴더의 상세 정보 조회
    const ledgers: LedgerInfo[] = await Promise.all(
      folders.map(async (folder: FolderItem) => {
        const ledgerInfo = await getLedgerInfo(folder.id);
        return ledgerInfo;
      })
    );

    // null 제거 및 필터링
    return ledgers.filter((ledger): ledger is LedgerInfo => ledger !== null);
    
  } catch (error) {
    log.error('장부 폴더 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 특정 장부 폴더의 상세 정보 조회
 * @param {string} folderId - 장부 폴더 ID
 * @returns {Promise<LedgerInfo | null>} 장부 정보
 */
export const getLedgerInfo = async (folderId: string): Promise<LedgerInfo | null> => {
  // 회계 폴더는 배포자 소유라 사용자 드라이브 권한(drive.file)으로는 조회되지 않으므로 서버의 장부 목록을 쓴다
  return findLedger(ledger => ledger.folderId === folderId);
};

/**
 * @brief 서버 장부 목록에서 조건에 맞는 장부 찾기
 */
export const findLedger = async (predicate: (ledger: LedgerInfo) => boolean): Promise<LedgerInfo | null> => {
  try {
    const { apiClient } = await import('../api/apiClient');
    const response = await apiClient.getLedgerList();
    const ledgers = (response.success && Array.isArray(response.data) ? response.data : []) as LedgerInfo[];
    return ledgers.find(predicate) || null;
  } catch (error) {
    log.error('장부 정보 조회 오류:', error);
    return null;
  }
};

/**
 * 회계 폴더 ID 설정 (papyrusManager에서 호출)
 */
export const setAccountingFolderId = (folderId: string | null): void => {
  // papyrusManager의 accountingFolderId 변수는 직접 접근하지 않고
  // getAccountingFolderId() 함수를 통해 접근
  log.debug('회계 폴더 ID 설정:', folderId);
};

