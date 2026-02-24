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
      console.warn('⚠️ Google API가 초기화되지 않았습니다.');
      return [];
    }

    const token = tokenManager.get();
    if (!token) {
      console.warn('⚠️ Google API 인증 토큰이 없습니다.');
      return [];
    }

    try {
      window.gapi.client.setToken({ access_token: token });
    } catch (tokenError) {
      console.warn('⚠️ 토큰 설정 실패:', tokenError);
    }

    // 회계 폴더 ID는 항상 Apps Script를 통해 가져오기 (로컬 저장값 사용 안 함)
    console.log('📁 Apps Script를 통해 회계 폴더 ID 가져오는 중...');
    let folderId: string | null = null;
    
    try {
      const { apiClient } = await import('../../utils/api/apiClient');
      const response = await apiClient.request('getAccountingFolderId', {});
      console.log('📁 Apps Script 응답 전체:', response);
      console.log('📁 Apps Script 응답 JSON:', JSON.stringify(response, null, 2));
      console.log('📁 response.data:', response.data);
      console.log('📁 response.data?.accountingFolderId:', response.data?.accountingFolderId);
      
      if (response.success && response.data?.accountingFolderId) {
        folderId = response.data.accountingFolderId;
        console.log('✅ 회계 폴더 ID 가져오기 성공:', folderId);
        console.log('✅ 폴더 ID 원본 (JSON):', JSON.stringify(folderId));
        console.log('✅ 폴더 ID 문자 배열:', folderId.split(''));
        console.log('✅ 폴더 ID 유효성 검사:', folderId.length, '자');
      } else {
        console.warn('⚠️ Apps Script 응답에서 회계 폴더 ID를 찾을 수 없습니다.');
        console.warn('⚠️ 응답 데이터:', response.data);
        return [];
      }
    } catch (apiError: unknown) {
      console.error('❌ Apps Script를 통한 회계 폴더 ID 조회 실패:', apiError);
      const err = apiError as { status?: number; message?: string };
      // 403 에러인 경우 권한 문제
      if (err?.status === 403 || err?.message?.includes('PERMISSION_DENIED')) {
        console.error('❌ Google Drive 권한이 없습니다. 권한을 확인해주세요.');
      }
      return [];
    }

    if (!folderId) {
      console.warn('⚠️ 회계 폴더 ID를 가져올 수 없습니다.');
      return [];
    }

    // 폴더 ID 유효성 검사
    if (typeof folderId !== 'string' || folderId.length < 10) {
      console.error('❌ 회계 폴더 ID가 유효하지 않습니다:', folderId);
      return [];
    }
    
    console.log('📁 사용할 회계 폴더 ID:', folderId);
    console.log('📁 폴더 ID 타입:', typeof folderId);
    console.log('📁 폴더 ID 원본:', JSON.stringify(folderId));
    console.log('📁 폴더 ID 문자 배열:', folderId.split(''));

    const gapi = window.gapi.client;
    
    // 회계 폴더 정보 먼저 확인
    const folderIdToUse = folderId; // 변수 복사하여 사용
    console.log('📁 API 호출 전 폴더 ID 확인:', folderIdToUse);
    console.log('📁 API 호출 전 폴더 ID 문자 배열:', folderIdToUse.split(''));
    
    try {
      console.log('📁 gapi.drive.files.get 호출 시작, fileId:', folderIdToUse);
      const folderInfo = await gapi.drive.files.get({
        fileId: folderIdToUse,
        fields: 'id, name, mimeType'
      });
      console.log('📁 회계 폴더 정보:', folderInfo.result);
    } catch (folderError: unknown) {
      console.error('❌ 회계 폴더 정보 조회 실패:', folderError);
      console.error('❌ 사용된 폴더 ID:', folderIdToUse);
      console.error('❌ 폴더 ID 문자 배열:', folderIdToUse.split(''));
      const err = folderError as { status?: number };
      if (err.status === 403) {
        throw new Error('회계 폴더에 대한 읽기 권한이 없습니다.');
      }
      throw folderError;
    }
    
    // 회계 폴더 내의 모든 항목 조회 (폴더와 파일 모두)
    const folderIdForQuery = folderId; // 변수 복사하여 사용
    console.log('🔍 회계 폴더 내 항목 조회 시작, 폴더 ID:', folderIdForQuery);
    console.log('🔍 폴더 ID 문자 배열:', folderIdForQuery.split(''));
    const query = `'${folderIdForQuery}' in parents and trashed=false`;
    console.log('🔍 쿼리:', query);
    console.log('🔍 쿼리 문자 배열:', query.split(''));
    
    let response;
    try {
      response = await gapi.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        orderBy: 'createdTime desc',
        pageSize: 100
      });
      console.log('✅ 회계 폴더 내 항목 조회 성공:', response.result);
      console.log('📊 조회된 항목 수:', response.result.files?.length || 0);
      
      if (response.result.files && response.result.files.length > 0) {
        console.log('📋 조회된 항목 목록:');
        response.result.files.forEach((item: FileItem, index: number) => {
          console.log(`  ${index + 1}. ${item.name} (${item.mimeType})`);
        });
      }
    } catch (listError: unknown) {
      console.error('❌ 회계 폴더 내 항목 조회 실패:', listError);
      console.error('❌ 에러 상세:', JSON.stringify(listError, null, 2));
      const err = listError as { status?: number };
      if (err.status === 403) {
        throw new Error('회계 폴더 내 항목을 읽을 권한이 없습니다. 폴더 접근 권한을 확인해주세요.');
      }
      throw listError;
    }

    if (!response.result.files || response.result.files.length === 0) {
      console.log('📁 회계 폴더에 항목이 없습니다.');
      return [];
    }

    // 폴더만 필터링 (장부 폴더)
    const folders = response.result.files.filter((item: DriveFile) => 
      item.mimeType === 'application/vnd.google-apps.folder' &&
      item.name !== ENV_CONFIG.EVIDENCE_FOLDER_NAME
    );

    console.log('📁 필터링된 장부 폴더 수:', folders.length);
    if (folders.length === 0) {
      console.log('📁 장부 폴더가 없습니다. (모든 항목이 파일이거나 증빙 폴더일 수 있습니다)');
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
    console.error('❌ 장부 폴더 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 특정 장부 폴더의 상세 정보 조회
 * @param {string} folderId - 장부 폴더 ID
 * @returns {Promise<LedgerInfo | null>} 장부 정보
 */
export const getLedgerInfo = async (folderId: string): Promise<LedgerInfo | null> => {
  try {
    if (!window.gapi || !window.gapi.client) {
      console.warn('⚠️ Google API가 초기화되지 않았습니다.');
      return null;
    }

    const gapi = window.gapi.client;

    // 폴더 정보 조회
    const folderResponse = await gapi.drive.files.get({
      fileId: folderId,
      fields: 'id, name, createdTime'
    });

    const folderName = folderResponse.result.name;
    const createdDate = folderResponse.result.createdTime;

    // 폴더 내 파일 목록 조회
    const filesResponse = await gapi.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)'
    });

    let spreadsheetId: string | null = null;
    let evidenceFolderId: string | null = null;

    // 스프레드시트 파일 찾기
    const spreadsheetFile = filesResponse.result.files?.find((file: DriveFile) => 
      file.mimeType === 'application/vnd.google-apps.spreadsheet'
    );
    if (spreadsheetFile) {
      spreadsheetId = spreadsheetFile.id;
    }

    // 증빙 폴더 찾기
    const evidenceFolder = filesResponse.result.files?.find((file: DriveFile) => 
      file.mimeType === 'application/vnd.google-apps.folder' && 
      file.name === ENV_CONFIG.EVIDENCE_FOLDER_NAME
    );
    if (evidenceFolder) {
      evidenceFolderId = evidenceFolder.id;
    }

    return {
      folderId: folderId,
      folderName: folderName,
      spreadsheetId: spreadsheetId || '',
      evidenceFolderId: evidenceFolderId || '',
      createdDate: createdDate
    };

  } catch (error) {
    console.error('❌ 장부 정보 조회 오류:', error);
    return null;
  }
};

/**
 * 회계 폴더 ID 설정 (papyrusManager에서 호출)
 */
export const setAccountingFolderId = (folderId: string | null): void => {
  // papyrusManager의 accountingFolderId 변수는 직접 접근하지 않고
  // getAccountingFolderId() 함수를 통해 접근
  console.log('📁 회계 폴더 ID 설정:', folderId);
};

