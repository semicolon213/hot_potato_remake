import { logger } from '../logger';
// Apps Script 마이그레이션 테스트 스크립트
import { apiClient } from './apiClient';
const log = logger.scope('utils/api/migrationTest');


// 마이그레이션 테스트 함수
export const testAppsScriptMigration = async () => {
  
  const results = {
    systemInfo: false,
    pendingUsers: false,
    emailEncryption: false,
    allTests: false
  };

  try {
  // 1. 시스템 정보 테스트 (환경변수 URL 사용)
  try {
    const systemResponse = await fetch(apiClient['baseUrl'], {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    await systemResponse.json();
    results.systemInfo = true;
  } catch (error) {
    log.error('시스템 정보 테스트 실패:', error);
  }

    // 2. 사용자 목록 조회 테스트
    try {
      await apiClient.getPendingUsers();
      results.pendingUsers = true;
    } catch (error) {
      log.error('사용자 목록 조회 테스트 실패:', error);
    }
    try {
      await apiClient.testEmailEncryption();
      results.emailEncryption = true;
    } catch {
      log.error('이메일 암호화 테스트 실패');
    }

    // 4. 전체 테스트
    try {
      await apiClient.testAllAppScript();
      results.allTests = true;
    } catch (error) {
      log.error('전체 테스트 실패:', error);
    }

    // 결과 요약
    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    if (successCount === totalCount) {
      // Intentionally ignored.

    } else {
      log.error('일부 테스트가 실패했습니다. 설정을 확인해주세요.');
    }

    return results;
  } catch (error) {
    log.error('마이그레이션 테스트 중 오류 발생:', error);
    return results;
  }
};

// 브라우저 콘솔에서 실행할 수 있도록 전역 함수로 등록
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).testAppsScriptMigration = testAppsScriptMigration;
  (window as Record<string, unknown>).testConnection = () => apiClient.testConnection();
  (window as Record<string, unknown>).apiClient = apiClient;
  
  // 직접 URL 테스트 함수
  (window as Record<string, unknown>).testDirectUrl = async () => {
    const url = 'https://script.google.com/macros/s/AKfycbwW-XbxPLmQcx_gzMB0ZGQkubfaXFjJ-hSenVP0ORxI9niLJPQN6EB_hGKglo_eNBvw/exec';
    try {
      log.debug('직접 URL 테스트:', url);
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      const data = await response.json();
      return data;
    } catch (error) {
      log.error('직접 URL 실패:', error);
      return error;
    }
  };
  
  // 프록시 URL 테스트 함수
  (window as Record<string, unknown>).testProxyUrl = async () => {
    const url = '/api';
    try {
      log.debug('프록시 URL 테스트:', url);
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json();
      return data;
    } catch (error) {
      log.error('프록시 URL 실패:', error);
      return error;
    }
  };
  
  log.debug('브라우저 콘솔에서 다음 함수들을 사용할 수 있습니다');
  log.debug('- testAppsScriptMigration(): 전체 마이그레이션 테스트');
  log.debug('- testConnection(): 간단한 연결 테스트');
  log.debug('- testDirectUrl(): 직접 Apps Script URL 테스트');
  log.debug('- testProxyUrl(): Vite 프록시 URL 테스트');
  log.debug('- apiClient: API 클라이언트 인스턴스');
}
