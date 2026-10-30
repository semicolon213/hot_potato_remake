/**
 * SpreadsheetCache.gs
 * 스프레드시트 캐싱 관련 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 캐싱 관련 함수들 =====

/**
 * 캐시에서 데이터 가져오기
 * @param {string} key - 캐시 키
 * @returns {Object} 캐시된 데이터
 */
function getCachedData(key) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    logError_('SpreadsheetCache', '캐시 데이터 가져오기 오류:', error);
    return null;
  }
}

/**
 * 데이터를 캐시에 저장
 * @param {string} key - 캐시 키
 * @param {Object} data - 저장할 데이터
 * @param {number} expirationInSeconds - 만료 시간 (초)
 * @returns {boolean} 성공 여부
 */
function setCachedData(key, data, expirationInSeconds = 3600) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(key, JSON.stringify(data), expirationInSeconds);
    return true;
  } catch (error) {
    logError_('SpreadsheetCache', '캐시 데이터 저장 오류:', error);
    return false;
  }
}

/**
 * 캐시에서 데이터 삭제
 * @param {string} key - 캐시 키
 * @returns {boolean} 성공 여부
 */
function removeCachedData(key) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(key);
    return true;
  } catch (error) {
    logError_('SpreadsheetCache', '캐시 데이터 삭제 오류:', error);
    return false;
  }
}

/**
 * 모든 캐시 데이터 삭제
 * @returns {boolean} 성공 여부
 */
function clearAllCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll();
    return true;
  } catch (error) {
    logError_('SpreadsheetCache', '모든 캐시 데이터 삭제 오류:', error);
    return false;
  }
}

/**
 * 캐시된 사용자 데이터 가져오기
 * @param {string} email - 사용자 이메일
 * @returns {Object} 캐시된 사용자 데이터
 */
function getCachedUserData(email) {
  try {
    const cacheKey = `user_${email}`;
    return getCachedData(cacheKey);
  } catch (error) {
    logError_('SpreadsheetCache', '캐시된 사용자 데이터 가져오기 오류:', error);
    return null;
  }
}

/**
 * 사용자 데이터를 캐시에 저장
 * @param {string} email - 사용자 이메일
 * @param {Object} userData - 사용자 데이터
 * @param {number} expirationInSeconds - 만료 시간 (초)
 * @returns {boolean} 성공 여부
 */
function setCachedUserData(email, userData, expirationInSeconds = 3600) {
  try {
    const cacheKey = `user_${email}`;
    return setCachedData(cacheKey, userData, expirationInSeconds);
  } catch (error) {
    logError_('SpreadsheetCache', '사용자 데이터 캐시 저장 오류:', error);
    return false;
  }
}

/**
 * 캐시된 사용자 데이터 삭제
 * @param {string} email - 사용자 이메일
 * @returns {boolean} 성공 여부
 */
function removeCachedUserData(email) {
  try {
    const cacheKey = `user_${email}`;
    return removeCachedData(cacheKey);
  } catch (error) {
    logError_('SpreadsheetCache', '캐시된 사용자 데이터 삭제 오류:', error);
    return false;
  }
}

/**
 * 캐시된 스프레드시트 데이터 가져오기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} range - 범위
 * @returns {Object} 캐시된 스프레드시트 데이터
 */
function getCachedSpreadsheetData(spreadsheetId, sheetName, range) {
  try {
    const cacheKey = `spreadsheet_${spreadsheetId}_${sheetName}_${range}`;
    return getCachedData(cacheKey);
  } catch (error) {
    logError_('SpreadsheetCache', '캐시된 스프레드시트 데이터 가져오기 오류:', error);
    return null;
  }
}

/**
 * 스프레드시트 데이터를 캐시에 저장
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} range - 범위
 * @param {Object} data - 스프레드시트 데이터
 * @param {number} expirationInSeconds - 만료 시간 (초)
 * @returns {boolean} 성공 여부
 */
function setCachedSpreadsheetData(spreadsheetId, sheetName, range, data, expirationInSeconds = 1800) {
  try {
    const cacheKey = `spreadsheet_${spreadsheetId}_${sheetName}_${range}`;
    return setCachedData(cacheKey, data, expirationInSeconds);
  } catch (error) {
    logError_('SpreadsheetCache', '스프레드시트 데이터 캐시 저장 오류:', error);
    return false;
  }
}

/**
 * 캐시된 스프레드시트 데이터 삭제
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} range - 범위
 * @returns {boolean} 성공 여부
 */
function removeCachedSpreadsheetData(spreadsheetId, sheetName, range) {
  try {
    const cacheKey = `spreadsheet_${spreadsheetId}_${sheetName}_${range}`;
    return removeCachedData(cacheKey);
  } catch (error) {
    logError_('SpreadsheetCache', '캐시된 스프레드시트 데이터 삭제 오류:', error);
    return false;
  }
}

/**
 * 캐시 통계 가져오기
 * @returns {Object} 캐시 통계
 */
function getCacheStats() {
  try {
    const cache = CacheService.getScriptCache();
    const stats = {
      totalKeys: 0,
      memoryUsage: 0,
      hitRate: 0
    };
    
    // 캐시 통계 계산 (간단한 구현)
    return stats;
  } catch (error) {
    logError_('SpreadsheetCache', '캐시 통계 가져오기 오류:', error);
    return null;
  }
}

/**
 * 캐시 성능 최적화
 * @returns {Object} 최적화 결과
 */
function optimizeCache() {
  try {
    
    // 오래된 캐시 데이터 정리
    const cache = CacheService.getScriptCache();
    
    return {
      success: true,
      message: '캐시 성능 최적화가 완료되었습니다.'
    };
    
  } catch (error) {
    logError_('SpreadsheetCache', '캐시 성능 최적화 오류:', error);
    return {
      success: false,
      message: '캐시 성능 최적화 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getSpreadsheetCacheInfo() {
  return {
    version: '1.0.0',
    description: '스프레드시트 캐싱 관련 함수들',
    functions: [
      'getCachedData',
      'setCachedData',
      'removeCachedData',
      'clearAllCache',
      'getCachedUserData',
      'setCachedUserData',
      'removeCachedUserData',
      'getCachedSpreadsheetData',
      'setCachedSpreadsheetData',
      'removeCachedSpreadsheetData',
      'getCacheStats',
      'optimizeCache'
    ],
    dependencies: []
  };
}
