/**
 * @file clearUserData.ts
 * @brief 사용자 데이터 정리 유틸리티
 * @details 로그아웃 또는 계정 전환 시 모든 사용자 관련 데이터를 정리합니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { clearSpreadsheetIds } from '../database/papyrusManager';
import { clearPersonalConfigSpreadsheetId } from '../database/personalConfigManager';
import { resetGoogleAPIInitialization } from '../google/googleSheetUtils';
import { resetGoogleApiInitializer } from '../google/googleApiInitializer';
import { tokenManager } from '../auth/tokenManager';

/**
 * @brief localStorage에서 사용자 관련 항목 제거
 * @details 로그아웃 시 localStorage에 저장된 모든 사용자 관련 데이터를 제거합니다.
 */
export const clearLocalStorageUserData = (): void => {
    console.log('🧹 localStorage 사용자 데이터 정리 시작...');
    
    // 기본 사용자 데이터 (토큰은 tokenManager 단일 소스로 제거)
    localStorage.removeItem('user');
    tokenManager.clear();
    localStorage.removeItem('searchTerm');
    
    // 템플릿 관련 데이터
    localStorage.removeItem('defaultTemplateOrder');
    localStorage.removeItem('userProfile');
    
    // 캘린더 관련 데이터
    localStorage.removeItem('recentSearchTerms');
    
    // 스프레드시트 ID 캐시 정리 (spreadsheet_id_*)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            // 스프레드시트 ID 캐시
            if (key.startsWith('spreadsheet_id_')) {
                keysToRemove.push(key);
            }
            // 템플릿 문서 ID 캐시
            if (key.startsWith('template_doc_id_')) {
                keysToRemove.push(key);
            }
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`  ✅ 제거됨: ${key}`);
    });
    
    // Zustand persist 스토리지 정리
    localStorage.removeItem('auth-storage');
    
    console.log('🧹 localStorage 사용자 데이터 정리 완료');
};

/**
 * @brief Google API 토큰 정리
 * @details gapi.client의 토큰을 제거합니다.
 */
export const clearGoogleAPIToken = (): void => {
    try {
        if (typeof window !== 'undefined' && window.gapi && window.gapi.client) {
            // 토큰 제거
            window.gapi.client.setToken({ access_token: '' });
            console.log('🧹 Google API 토큰 제거 완료');
        }
    } catch (error) {
        console.warn('Google API 토큰 제거 중 오류:', error);
    }
};

/**
 * @brief 모든 사용자 데이터 정리
 * @details 로그아웃 또는 계정 전환 시 모든 사용자 관련 데이터를 정리합니다.
 * @param {Object} options - 정리 옵션
 * @param {boolean} options.clearLocalStorage - localStorage 정리 여부 (기본값: true)
 * @param {boolean} options.clearGlobalVariables - 전역 변수 정리 여부 (기본값: true)
 * @param {boolean} options.clearGoogleToken - Google API 토큰 정리 여부 (기본값: true)
 */
export const clearAllUserData = (options: {
    clearLocalStorage?: boolean;
    clearGlobalVariables?: boolean;
    clearGoogleToken?: boolean;
} = {}): void => {
    const {
        clearLocalStorage = true,
        clearGlobalVariables = true,
        clearGoogleToken = true
    } = options;
    
    console.log('🧹 사용자 데이터 정리 시작...');
    
    // localStorage 정리
    if (clearLocalStorage) {
        clearLocalStorageUserData();
    }
    
    // 전역 변수 정리
    if (clearGlobalVariables) {
        clearSpreadsheetIds();
        clearPersonalConfigSpreadsheetId();
        resetGoogleAPIInitialization();
        resetGoogleApiInitializer();
    }
    
    // Google API 토큰 정리
    if (clearGoogleToken) {
        clearGoogleAPIToken();
    }
    
    console.log('🧹 사용자 데이터 정리 완료');
};

