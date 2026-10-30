import { getSheetData as readSheetValues } from './sheetsClient';
import { logger } from '../logger';
import { useEffect } from "react";

import { ENV_CONFIG } from '../../config/environment';
import { tokenManager } from '../auth/tokenManager';
import { notifyGlobal } from '../ui/globalNotification';
const log = logger.scope('utils/google/googleSheetUtils');


const GOOGLE_CLIENT_ID = ENV_CONFIG.GOOGLE_CLIENT_ID; // ENV v2: VITE_GOOGLE_CLIENT_ID에서 읽는 클라이언트 ID

let isGoogleAPIInitialized = false;
let googleAPIInitPromise: Promise<void> | null = null;

/**
 * @brief Google API 초기화 상태 초기화
 * @details 로그아웃 또는 계정 전환 시 Google API 초기화 상태를 리셋합니다.
 */
export const resetGoogleAPIInitialization = (): void => {
    isGoogleAPIInitialized = false;
    googleAPIInitPromise = null;
};

export const initializeGoogleAPIOnce = async (): Promise<void> => {
  if (isGoogleAPIInitialized) return;
  if (googleAPIInitPromise) return googleAPIInitPromise;

  googleAPIInitPromise = (async () => {
    try {
      const waitForGapi = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 30;
          const checkGapi = () => {
            attempts++;
            if (typeof window !== 'undefined' && window.gapi) {
              resolve();
            } else if (attempts >= maxAttempts) {
              reject(new Error("gapi 스크립트 로드 타임아웃"));
            } else {
              setTimeout(checkGapi, 100);
            }
          };
          checkGapi();
        });
      };
      await waitForGapi();
      const gapi = window.gapi;

      await new Promise<void>((resolve, reject) => {
        gapi.load('client', async () => {
          try {
            await gapi.client.init({
              clientId: GOOGLE_CLIENT_ID,
              discoveryDocs: [
                'https://sheets.googleapis.com/$discovery/rest?version=v4',
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
              ]
            });
            const token = tokenManager.get();
            if (token) {
              (gapi.client as any).setToken({ access_token: token });
            }
            isGoogleAPIInitialized = true;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      isGoogleAPIInitialized = false;
      googleAPIInitPromise = null;
      throw error;
    }
  })();
  return googleAPIInitPromise;
};

export const getSheetIdByName = async (name: string): Promise<string | null> => {
  const cachedId = localStorage.getItem(`spreadsheet_id_${name}`);
  if (cachedId) {
    log.debug(`Found cached spreadsheet ID for "${name}"`);
    return cachedId;
  }

  try {
    const response = await window.gapi.client.drive.files.list({
      q: `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id,name,owners,parents)',
      orderBy: 'name',
      spaces: 'drive',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives'
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      const fileId = files[0].id;
      localStorage.setItem(`spreadsheet_id_${name}`, fileId);
      return fileId;
    } else {
      notifyGlobal(`Spreadsheet with name "${name}" not found.`, 'error');
      return null;
    }
  } catch (error) {
    log.debug('Error searching for spreadsheet. Check console for details.');
    return null;
  }
};

export const updateSheetCell = async (spreadsheetId: string, sheetName: string, rowIndex: number, columnIndex: number, value: string): Promise<void> => {
    await initializeGoogleAPIOnce();
    const gapi = window.gapi;

    const range = `${sheetName}!${String.fromCharCode(65 + columnIndex)}${rowIndex}`;

    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[value]]
        }
    });
};

// This function is not used in this file, but it was in App.tsx
// Keeping it here for now, but it might be removed later if not needed.
export const resetGoogleAPIState = () => {
  isGoogleAPIInitialized = false;
  googleAPIInitPromise = null;
};

// This useEffect is not used in this file, but it was in App.tsx
// Keeping it here for now, but it might be removed later if not needed.
export const useResetGoogleAPIStateOnUnload = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', resetGoogleAPIState);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', resetGoogleAPIState);
      }
    };
  }, []);
};

export const deleteSheetRow = async (spreadsheetId: string, sheetName: string, rowIndex: number): Promise<void> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  const sheetIdResponse = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });

  const sheet = sheetIdResponse.result.sheets.find(
    (s: { properties: { title: string } }) => s.properties.title === sheetName
  );

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet.`);
  }
  const sheetId = sheet.properties.sheetId;

  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
};

export const checkSheetExists = async (spreadsheetId: string, sheetName: string): Promise<boolean> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const sheet = response.result.sheets.find(
      (s: { properties: { title: string } }) => s.properties.title === sheetName
    );

    return !!sheet;
  } catch (error) {
    log.error('Error checking for sheet:', error);
    return false;
  }
};

export const createNewSheet = async (spreadsheetId: string, sheetName: string): Promise<void> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  } catch (error) {
    log.error('Error creating new sheet:', error);
  }
};

export const appendSheetData = async (spreadsheetId: string, sheetName: string, values: string[][]): Promise<void> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values,
      },
    });
  } catch (error) {
    log.error('Error appending sheet data:', error);
  }
};

export const getSheetData = async (spreadsheetId: string, sheetName: string, range: string): Promise<string[][] | null> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    // API 호출 전에 토큰 재설정 (최신 토큰 보장)
    const token = tokenManager.get();
    if (token && gapi.client) {
      try {
        gapi.client.setToken({ access_token: token });
      } catch {
        log.warn("토큰 설정 실패");
      }
    }

    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!${range}`,
    });
    return response.result.values;
  } catch (error: any) {
    log.error('Error getting sheet data:', error);
    
    // 403 오류 처리 (권한 문제)
    if (error.status === 403 || error.code === 403) {
      log.warn(`403 권한 오류: 스프레드시트 ${spreadsheetId}에 접근 권한이 없습니다.`);
      log.warn('오류 상세:', error.message || error.error?.message || '알 수 없는 오류');
      return null;
    }
    
    // 401 오류인 경우 토큰 재설정 후 재시도
    if (error.status === 401 || error.code === 401) {
      log.warn('401 오류 감지, 토큰 재설정 후 재시도');
      const token = tokenManager.get();
      if (token && gapi.client) {
        try {
          gapi.client.setToken({ access_token: token });
          // 재시도
          const retryResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!${range}`,
          });
          return retryResponse.result.values;
        } catch (retryError) {
          log.error('재시도 실패:', retryError);
        }
      }
    }
    
    return null;
  }
};

/**
 * 장부 스프레드시트에서 카테고리별 수입/지출 금액 집계
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Promise<Array<{category: string, income: number, expense: number}>>} 카테고리별 집계 데이터
 */
export const getAccountingCategorySummary = async (spreadsheetId: string): Promise<{ category: string; income: number; expense: number }[]> => {
  try {
    
    
    // gapi 클라이언트에 토큰 설정
    if (window.gapi && window.gapi.client) {
      const token = tokenManager.get();
      if (token) {
        try {
          window.gapi.client.setToken({ access_token: token });
        } catch {
          log.warn("토큰 설정 실패");
        }
      }
    }
    
    // "장부" 시트 데이터 가져오기 (시트명 하드코딩, ENV로 분리 가능)
    const data = await readSheetValues(spreadsheetId, '장부');
    
    if (!data || !data.values || data.values.length < 2) {
      log.warn('데이터가 없습니다.');
      return [];
    }
    
    // 헤더 행 찾기
    const headers = data.values[0].map((h: string) => String(h).toLowerCase().trim());
    const categoryIndex = headers.indexOf('category') !== -1 ? headers.indexOf('category') : headers.indexOf('카테고리');
    const amountIndex = headers.indexOf('amount') !== -1 ? headers.indexOf('amount') : headers.indexOf('금액');
    const transactionTypeIndex = headers.findIndex((h: string) => 
      h === 'transaction_type' || h === 'transaction_typ' || h === '거래유형'
    );
    
    if (categoryIndex === -1 || amountIndex === -1 || transactionTypeIndex === -1) {
      log.warn('필요한 열을 찾을 수 없습니다. 헤더:', headers);
      return [];
    }
    
    // 카테고리별 집계
    const summary: Record<string, { category: string; income: number; expense: number }> = {};
    
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      const category = String(row[categoryIndex] || '').trim();
      const amount = parseFloat(String(row[amountIndex] || '0')) || 0;
      const transactionType = String(row[transactionTypeIndex] || '').toLowerCase().trim();
      
      if (!category || category === '') continue;
      
      if (!summary[category]) {
        summary[category] = { category: category, income: 0, expense: 0 };
      }
      
      if (transactionType === 'income' || transactionType === '수입') {
        summary[category].income += amount;
      } else if (transactionType === 'expense' || transactionType === '지출') {
        summary[category].expense += Math.abs(amount);
      }
    }
    
    const result = Object.values(summary);
    return result;
    
  } catch (error) {
    log.error('카테고리별 집계 오류:', error);
    return [];
  }
};

/**
 * 장부의 총 잔액 계산 (모든 통장의 currentBalance 합산)
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Promise<number>} 장부의 총 잔액
 */
export const getLedgerBalance = async (spreadsheetId: string): Promise<number> => {
  try {
    
    
    // gapi 클라이언트에 토큰 설정
    if (window.gapi && window.gapi.client) {
      const token = tokenManager.get();
      if (token) {
        try {
          window.gapi.client.setToken({ access_token: token });
        } catch {
          log.warn("토큰 설정 실패");
        }
      }
    }
    
    // "통장" 시트 데이터 가져오기 (시트명 하드코딩, ENV로 분리 가능)
    const data = await readSheetValues(spreadsheetId, '통장');
    
    if (!data || !data.values || data.values.length < 2) {
      log.warn('통장 데이터가 없습니다.');
      return 0;
    }
    
    // 헤더 행 찾기
    const headers = data.values[0].map((h: string) => String(h).toLowerCase().trim());
    const currentBalanceIndex = headers.indexOf('current_balance') !== -1 ? headers.indexOf('current_balance') : headers.indexOf('현재잔액');
    
    if (currentBalanceIndex === -1) {
      log.warn('현재잔액 열을 찾을 수 없습니다.');
      return 0;
    }
    
    // 모든 통장의 잔액 합산
    let totalBalance = 0;
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      const balance = parseFloat(String(row[currentBalanceIndex] || '0')) || 0;
      totalBalance += balance;
    }
    return totalBalance;
    
  } catch (error) {
    log.error('장부 잔액 계산 오류:', error);
    return 0;
  }
};

/**
 * 예산계획에서 사용자가 검토/승인/집행해야 하는 항목 조회
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} userEmail - 사용자 이메일
 * @returns {Promise<Array<{budget_id: string, title: string, total_amount: number, status: string, action_required: string}>>} 대기 항목 목록
 */
export const getPendingBudgetPlans = async (spreadsheetId: string, userEmail: string): Promise<{ budget_id: string; title: string; total_amount: number; status: string; action_required: string }[]> => {
  try {
    
    
    // gapi 클라이언트에 토큰 설정
    if (window.gapi && window.gapi.client) {
      const token = tokenManager.get();
      if (token) {
        try {
          window.gapi.client.setToken({ access_token: token });
        } catch {
          log.warn("토큰 설정 실패");
        }
      }
    }
    
    // "예산계획" 시트 데이터 가져오기 (시트명 하드코딩, ENV로 분리 가능)
    const data = await readSheetValues(spreadsheetId, '예산계획');
    
    if (!data || !data.values || data.values.length < 2) {
      log.warn('데이터가 없습니다.');
      return [];
    }
    
    // 통장 정보 먼저 가져오기 (account_id -> 관리인 매핑, 시트명 하드코딩)
    const accountData = await readSheetValues(spreadsheetId, '통장');
    const accountMap: Record<string, { mainManagerId: string; subManagerIds: string[] }> = {};
    
    if (accountData && accountData.values && accountData.values.length > 1) {
      const accountHeaders = accountData.values[0].map((h: string) => String(h).toLowerCase().trim());
      const accountIdIndex = accountHeaders.indexOf('account_id');
      const mainManagerIdIndex = accountHeaders.indexOf('main_manager_id');
      const subManagerIdsIndex = accountHeaders.indexOf('sub_manager_ids');
      
      for (let i = 1; i < accountData.values.length; i++) {
        const accountRow = accountData.values[i];
        const accountId = String(accountRow[accountIdIndex] || '').trim();
        const mainManagerId = mainManagerIdIndex >= 0 ? String(accountRow[mainManagerIdIndex] || '').trim() : '';
        const subManagerIdsStr = subManagerIdsIndex >= 0 ? String(accountRow[subManagerIdsIndex] || '').trim() : '[]';
        
        let subManagerIds: string[] = [];
        try {
          subManagerIds = subManagerIdsStr ? JSON.parse(subManagerIdsStr) : [];
        } catch (e) {
          log.warn(`통장 ${accountId}의 sub_manager_ids 파싱 실패:`, e, '원본:', subManagerIdsStr);
        }
        
        if (accountId) {
          accountMap[accountId] = {
            mainManagerId,
            subManagerIds: Array.isArray(subManagerIds) ? subManagerIds : []
          };
        }
      }
    }
    
    // 헤더 행 찾기
    const headers = data.values[0].map((h: string) => String(h).toLowerCase().trim());
    const budgetIdIndex = headers.findIndex((h: string) => h === 'budget_id' || h === 'budget_plan_id');
    const accountIdIndex = headers.findIndex((h: string) => h === 'account_id');
    const titleIndex = headers.indexOf('title') !== -1 ? headers.indexOf('title') : headers.indexOf('제목');
    const totalAmountIndex = headers.findIndex((h: string) => h === 'total_amount' || h === '총액');
    const statusIndex = headers.findIndex((h: string) => h === 'status' || h === '상태');
    const subManagerReviewedIndex = headers.findIndex((h: string) => h === 'sub_manager_reviewed');
    const mainManagerApprovedIndex = headers.findIndex((h: string) => 
      h === 'main_manager_approved' || h.includes('main_manager_approved')
    );
    const executedDateIndex = headers.findIndex((h: string) => h === 'executed_date');
    
    if (budgetIdIndex === -1 || titleIndex === -1 || accountIdIndex === -1) {
      log.warn('필요한 열을 찾을 수 없습니다. budgetIdIndex:', budgetIdIndex, 'titleIndex:', titleIndex, 'accountIdIndex:', accountIdIndex);
      return [];
    }
    
    // 사용자가 관련된 항목만 필터링
    const pendingItems: { budget_id: string; title: string; total_amount: number; status: string; action_required: string }[] = [];
    
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      const budgetId = String(row[budgetIdIndex] || '').trim();
      const accountId = String(row[accountIdIndex] || '').trim();
      const title = String(row[titleIndex] || '').trim();
      const totalAmount = parseFloat(String(row[totalAmountIndex] || '0')) || 0;
      const status = statusIndex >= 0 ? String(row[statusIndex] || '').trim().toLowerCase() : '';
      const subManagerReviewed = subManagerReviewedIndex >= 0 ? String(row[subManagerReviewedIndex] || '').trim().toUpperCase() : '';
      const mainManagerApproved = mainManagerApprovedIndex >= 0 ? String(row[mainManagerApprovedIndex] || '').trim().toUpperCase() : '';
      const executedDate = executedDateIndex >= 0 ? String(row[executedDateIndex] || '').trim() : '';
      
      if (!budgetId || !accountId || !title) continue;
      
      // 통장 정보 가져오기
      const account = accountMap[accountId];
      if (!account) {
        log.warn(`통장 ${accountId} 정보를 찾을 수 없습니다. accountMap:`);
        continue;
      }
      
      // 사용자가 검토자, 승인자, 또는 집행자인지 확인
      let actionRequired = '';
      let isRelated = false;
      
      const isSubManager = account.subManagerIds.includes(userEmail);
      const isMainManager = account.mainManagerId === userEmail;
      
      // 검토자 확인: sub_manager_ids에 포함되어 있고, status가 pending이며, 아직 검토하지 않은 경우
      if (isSubManager && status === 'pending' && subManagerReviewed !== 'TRUE') {
        actionRequired = 'review';
        isRelated = true;
        log.debug(`검토 필요: ${budgetId} (${title})`);
      }
      
      // 승인자 확인: main_manager_id이고, status가 pending이며, 검토 완료되었지만 아직 승인하지 않은 경우
      if (isMainManager && status === 'pending' && subManagerReviewed === 'TRUE' && mainManagerApproved !== 'TRUE') {
        actionRequired = 'approve';
        isRelated = true;
        log.debug(`승인 필요: ${budgetId} (${title})`);
      }
      
      // 집행자 확인: 승인 완료되었지만 아직 집행하지 않은 경우 (주관리인 또는 별도 관리인)
      if ((isMainManager || isSubManager) && status === 'pending' && mainManagerApproved === 'TRUE' && (!executedDate || executedDate === '')) {
        actionRequired = 'execute';
        isRelated = true;
        log.debug(`집행 필요: ${budgetId} (${title})`);
      }
      
      if (isRelated && actionRequired) {
        pendingItems.push({
          budget_id: budgetId,
          title: title,
          total_amount: totalAmount,
          status: status,
          action_required: actionRequired
        });
      } else {
        log.debug(`건너뜀: ${budgetId} (${title}) - 관련 없음`);
      }
    }
    return pendingItems;
    
  } catch (error) {
    log.error('예산계획 대기 항목 조회 오류:', error);
    return [];
  }
};

export const updateTitleInSheetByDocId = async (
  spreadsheetId: string,
  sheetName: string,
  docId: string,
  newTitle: string
): Promise<void> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    const data = await getSheetData(spreadsheetId, sheetName, 'A:C'); // Assuming id is in A, title in C
    if (!data || data.length === 0) return;

    const header = data[0];
    const docIdColIndex = header.indexOf('document_id');
    const titleColIndex = header.indexOf('title');

    if (docIdColIndex === -1 || titleColIndex === -1) {
      log.error('Required columns (document_id, title) not found.');
      return;
    }

    const rowIndex = data.findIndex(row => row[docIdColIndex] === docId);

    if (rowIndex !== -1) {
      const range = `${sheetName}!${String.fromCharCode(65 + titleColIndex)}${rowIndex + 1}`;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[newTitle]],
        },
      });
    }
  } catch (error) {
    log.error('Error updating title in sheet:', error);
  }
};

export const updateLastModifiedInSheetByDocId = async (
  spreadsheetId: string,
  sheetName: string,
  docId: string,
  newLastModified: string
): Promise<void> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    const data = await getSheetData(spreadsheetId, sheetName, 'A:D'); // Assuming id is in A, last_modified in D
    if (!data || data.length === 0) return;

    const header = data[0];
    const docIdColIndex = header.indexOf('document_id');
    const lastModifiedColIndex = header.indexOf('last_modified');

    if (docIdColIndex === -1 || lastModifiedColIndex === -1) {
      log.error('Required columns (document_id, last_modified) not found.');
      return;
    }

    const rowIndex = data.findIndex(row => row[docIdColIndex] === docId);

    if (rowIndex !== -1) {
      const range = `${sheetName}!${String.fromCharCode(65 + lastModifiedColIndex)}${rowIndex + 1}`;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[newLastModified]],
        },
      });
    }
  } catch (error) {
    log.error('Error updating last_modified in sheet:', error);
  }
};

/**
 * @brief 개인 문서 폴더 찾기
 * @details 환경변수에 설정된 경로로 개인 문서 폴더를 찾습니다
 */
export const findPersonalDocumentFolder = async (): Promise<string | null> => {
  if (!window.gapi?.client?.drive) {
    log.error('Google Drive API가 초기화되지 않았습니다.');
    return null;
  }
  try {
    const { ENV_CONFIG } = await import('../../config/environment');
    const { getOrCreatePersonalFolderPath } = await import('../database/personalConfigManager');
    return await getOrCreatePersonalFolderPath([ENV_CONFIG.DOCUMENT_FOLDER_NAME, ENV_CONFIG.PERSONAL_DOCUMENT_FOLDER_NAME]);
  } catch (error) {
    log.error('개인 문서 폴더 찾기 오류:', error);
    return null;
  }
};

export const copyGoogleDocument = async (fileId: string, newTitle: string): Promise<{ id: string, webViewLink: string } | null> => {
  try {
    // 토큰 확인
    const token = tokenManager.get();
    if (!token || !tokenManager.isValid()) {
      const errorMsg = 'Google 인증 토큰이 없거나 만료되었습니다. 다시 로그인해주세요.';
      log.error('', errorMsg);
      throw new Error(errorMsg);
    }

    // Google API 초기화 (googleApiInitializer의 개선된 버전 사용)
    const { initializeGoogleAPIOnce: initAPI } = await import('./googleApiInitializer');
    try {
      await initAPI(null);
    } catch (initError: any) {
      log.error('Google API 초기화 실패:', initError);
      // idpiframe_initialization_failed 에러인 경우 특별 처리
      if (initError?.error === 'idpiframe_initialization_failed' || initError?.result?.error?.error === 'idpiframe_initialization_failed') {
        log.warn('idpiframe 초기화 실패 - 이미 초기화되었을 수 있습니다. 계속 진행합니다.');
      } else {
        // 다른 에러는 재시도
        throw initError;
      }
    }
    
    // gapi 스크립트가 로드될 때까지 대기
    let attempts = 0;
    const maxAttempts = 50;
    while (!window.gapi?.client?.drive && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    const gapi = window.gapi;
    if (!gapi?.client?.drive) {
      const errorMsg = 'Google Drive API가 초기화되지 않았습니다. 페이지를 새로고침해주세요.';
      log.error('', errorMsg);
      throw new Error(errorMsg);
    }

    // 토큰을 gapi client에 명시적으로 설정
    try {
      gapi.client.setToken({ access_token: token });
      log.debug('토큰이 gapi client에 설정되었습니다.');
    } catch {
      log.warn('토큰 설정 실패');
      // 토큰 설정 실패해도 계속 진행 (이미 설정되었을 수 있음)
    }

    // 개인 문서 폴더 찾기
    const personalDocFolderId = await findPersonalDocumentFolder();
    
    if (!personalDocFolderId) {
      const errorMsg = '개인 문서 폴더를 찾을 수 없습니다. 폴더가 생성되어 있는지 확인해주세요.';
      log.error('', errorMsg);
      throw new Error(errorMsg);
    }

    log.debug('개인 문서 폴더 찾음:', personalDocFolderId);

    // 개인 문서 폴더에 문서 복사
    const DriveAPI = gapi.client.drive.files as unknown as {
      copy: (params: {
        fileId: string;
        resource: { name: string; parents: string[] };
        fields: string;
      }) => Promise<{ result: { id: string; webViewLink: string } }>;
    };
    
    const response = await DriveAPI.copy({
      fileId: fileId,
      resource: {
        name: newTitle,
        parents: [personalDocFolderId] // 개인 문서 폴더에 저장
      },
      fields: 'id, webViewLink',
    });
    
    return response.result;
  } catch (error: any) {
    log.error('Google 문서 복사 오류:', error);
    
    // 에러 상세 정보 로깅
    if (error.result?.error) {
      log.error('에러 상세');
    }
    if (error.status) {
      log.error('HTTP 상태 코드:', error.status);
    }
    
    // 사용자 친화적인 에러 메시지
    let errorMessage = 'Google 문서를 복사하는 중 오류가 발생했습니다.';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.result?.error?.message) {
      errorMessage = error.result.error.message;
    } else if (error.status === 403) {
      errorMessage = 'Google Drive 접근 권한이 없습니다. 다시 로그인해주세요.';
    } else if (error.status === 404) {
      errorMessage = '템플릿 문서를 찾을 수 없습니다.';
    }
    
    throw new Error(errorMessage);
  }
};

export const deleteRowsByDocIds = async (
  spreadsheetId: string,
  sheetName: string,
  docIds: string[]
): Promise<void> => {
  await initializeGoogleAPIOnce();
  const gapi = window.gapi;

  try {
    // 1. Find the sheetId (numeric) for the given sheetName
    const sheetIdResponse = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    const sheet = sheetIdResponse.result.sheets.find(
      (s: { properties: { title: string } }) => s.properties.title === sheetName
    );
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }
    const numericSheetId = sheet.properties.sheetId;

    // 2. Get all data to find the header and document_id column
    const data = await getSheetData(spreadsheetId, sheetName, 'A:Z'); // Get enough columns
    if (!data || data.length === 0) return;

    const header = data[0];
    const docIdColIndex = header.indexOf('document_id');

    if (docIdColIndex === -1) {
      log.error('Required column "document_id" not found.');
      return;
    }

    const rowsToDelete: number[] = [];
    data.forEach((row, index) => {
      if (index > 0 && docIds.includes(row[docIdColIndex])) { // index > 0 to skip header
        rowsToDelete.push(index);
      }
    });

    if (rowsToDelete.length === 0) {
      return; // No rows to delete
    }

    // 3. Sort row indices in descending order
    rowsToDelete.sort((a, b) => b - a);

    // 4. Create batch update requests
    const requests = rowsToDelete.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: numericSheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

    // 5. Execute the batch update
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: requests,
      },
    });
  } catch (error) {
    log.error('Error deleting rows from sheet:', error);
        throw error; // Re-throw the error to be caught by the caller
      }
    };
    
    /**
     * @brief 회계 장부 데이터 가져오기
     * @details 특정 스프레드시트의 "카테고리" 시트에서 데이터를 가져와 파싱합니다.
     * @param {string} spreadsheetId - 데이터를 가져올 스프레드시트의 ID
     * @returns {Promise<string[] | null>} 파싱된 카테고리 이름 배열 또는 null
     */
    export const getAccountingData = async (spreadsheetId: string): Promise<string[] | null> => {
      try {
        
        
        // gapi 클라이언트에 토큰 설정
        if (window.gapi && window.gapi.client) {
          const token = tokenManager.get();
          if (token) {
            try {
              window.gapi.client.setToken({ access_token: token });
            } catch {
              log.warn("토큰 설정 실패");
            }
          }
        }
        
        // "카테고리" 시트 데이터 가져오기 (시트명 하드코딩, ENV로 분리 가능)
        const data = await readSheetValues(spreadsheetId, '카테고리');
        
        if (!data || !data.values || data.values.length <= 1) {
          return [];
        }
    
        // 헤더에서 category_name 열 찾기
        const headers = data.values[0].map((h: string) => String(h).toLowerCase().trim());
        const categoryNameIndex = headers.findIndex((h: string) => 
          h === 'category_name' || h === '카테고리명' || h === '카테고리'
        );
        const isActiveIndex = headers.findIndex((h: string) => 
          h === 'is_active' || h === '활성' || h === 'active'
        );
        
        const categories: string[] = [];
        const seen = new Set<string>();
        
        for (let i = 1; i < data.values.length; i++) {
          const row = data.values[i];
          // is_active 체크
          if (isActiveIndex >= 0 && row[isActiveIndex]) {
            const isActive = String(row[isActiveIndex] || '').toUpperCase();
            if (isActive !== 'TRUE') {
              continue;
            }
          }
          // category_name 열에서 카테고리 이름 가져오기 (없으면 B열 사용)
          const categoryIndex = categoryNameIndex >= 0 ? categoryNameIndex : 1;
          const category = String(row[categoryIndex] || '').trim();
          if (category && category !== '' && !seen.has(category)) {
            seen.add(category);
            categories.push(category);
          }
        }
        return categories;
    
      } catch (error: any) {
        log.error("장부 카테고리 조회 오류:", error);
        
        // 오류 메시지 정리
        let errorMessage = '알 수 없는 오류';
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.status === 401 || error?.code === 401) {
          errorMessage = '인증 토큰이 만료되었습니다. 다시 로그인해주세요.';
        } else if (error?.status === 403 || error?.code === 403) {
          errorMessage = '시트에 접근 권한이 없습니다. 권한을 확인해주세요.';
        } else if (error?.status === 404 || error?.code === 404) {
          errorMessage = '시트를 찾을 수 없습니다.';
        }
        
        throw new Error(`장부 데이터를 가져오는 중 오류가 발생했습니다: ${errorMessage}`);
      }
    };
