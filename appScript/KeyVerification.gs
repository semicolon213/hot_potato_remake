/**
 * KeyVerification.gs
 * 관리자 키 검증 관련 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 관리자 키 검증 함수들 =====

/**
 * 입력된 키가 현재 저장된 관리자 키와 일치하는지 확인
 * @param {string} inputKey - 입력된 키
 * @returns {Object} 검증 결과
 */
function verifyAdminKey(inputKey) {
  try {
    const spreadsheet = getHpMemberSpreadsheet();
    const sheet = spreadsheet.getSheetByName('admin_keys');
    
    if (!sheet) {
      throw new Error('admin_keys 시트를 찾을 수 없습니다');
    }
    
    // hp_member의 admin_keys 시트에서 현재 키와 레이어 정보 가져오기
    const data = sheet.getRange('A2:D2').getValues();
    
    if (!data || data.length === 0 || !data[0][0]) {
      throw new Error('저장된 관리자 키를 찾을 수 없습니다');
    }
    
    const storedKey = data[0][0];
    const layersUsed = data[0][3];
    
    // 키 비교
    if (inputKey === storedKey) {
      return {
        success: true,
        message: '관리자 키가 유효합니다.',
        key: storedKey,
        layers: layersUsed
      };
    } else {
      return {
        success: false,
        message: '유효하지 않은 관리자 키입니다.',
        key: null,
        layers: null
      };
    }
    
  } catch (error) {
    logError_('KeyVerification', '관리자 키 검증 오류:');
    return {
      success: false,
      message: '관리자 키 검증 중 오류가 발생했습니다: ' + error.message,
      key: null,
      layers: null
    };
  }
}

/**
 * 키 복호화 및 검증
 * @param {string} encryptedKey - 암호화된 키
 * @param {Array} layers - 암호화 레이어
 * @returns {Object} 복호화 및 검증 결과
 */
function decryptAndVerifyKey(encryptedKey, layers) {
  try {
    
    if (!encryptedKey || !layers) {
      return {
        success: false,
        message: '암호화된 키와 레이어 정보가 필요합니다.'
      };
    }
    
    // 레이어 정보 파싱
    const layerArray = layers.split(',').map(layer => layer.trim());
    
    // 역순으로 복호화
    let decryptedKey = encryptedKey;
    for (let i = layerArray.length - 1; i >= 0; i--) {
      const layer = layerArray[i];
      const beforeDecrypt = decryptedKey;
      decryptedKey = applyDecryption(decryptedKey, layer, '');
    }
    
    // 키 형식 검증
    const isValidFormat = decryptedKey.startsWith('ADMIN_') && decryptedKey.includes('_');
    
    return {
      success: isValidFormat,
      decryptedKey: decryptedKey,
      isValidFormat: isValidFormat,
      message: isValidFormat ? '키가 유효합니다' : '키 형식이 올바르지 않습니다'
    };
    
  } catch (error) {
    logError_('KeyVerification', '키 복호화 및 검증 오류:');
    return {
      success: false,
      error: error.message,
      message: '키 복호화 및 검증 중 오류가 발생했습니다'
    };
  }
}

/**
 * 키 강도 분석
 * @param {string} key - 분석할 키
 * @param {Array} layers - 사용된 레이어
 * @returns {Object} 키 강도 분석 결과
 */
function analyzeKeyStrength(key, layers) {
  try {
    
    const analysis = {
      keyLength: key.length,
      layerCount: layers ? layers.length : 0,
      layers: layers,
      complexity: 0,
      strength: 'weak'
    };
    
    // 복잡도 계산
    analysis.complexity = analysis.layerCount * 10;
    
    // 키 길이에 따른 보너스
    if (key.length > 50) {
      analysis.complexity += 20;
    } else if (key.length > 30) {
      analysis.complexity += 10;
    }
    
    // 강도 평가
    if (analysis.complexity >= 80) {
      analysis.strength = 'very_strong';
    } else if (analysis.complexity >= 60) {
      analysis.strength = 'strong';
    } else if (analysis.complexity >= 40) {
      analysis.strength = 'medium';
    } else {
      analysis.strength = 'weak';
    }
    
    return {
      success: true,
      analysis: analysis
    };
    
  } catch (error) {
    logError_('KeyVerification', '키 강도 분석 오류:');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 키 유효성 검사
 * @param {string} key - 검사할 키
 * @returns {Object} 유효성 검사 결과
 */
function validateKeyFormat(key) {
  try {
    
    if (!key || typeof key !== 'string') {
      return {
        success: false,
        message: '키가 유효하지 않습니다.'
      };
    }
    
    // 기본 형식 검사
    const isValidFormat = key.startsWith('ADMIN_') && key.includes('_');
    
    // 길이 검사
    const isValidLength = key.length >= 20 && key.length <= 100;
    
    // 특수 문자 검사
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(key);
    
    return {
      success: isValidFormat && isValidLength && !hasSpecialChars,
      isValidFormat: isValidFormat,
      isValidLength: isValidLength,
      hasSpecialChars: hasSpecialChars,
      message: isValidFormat && isValidLength && !hasSpecialChars 
        ? '키가 유효합니다' 
        : '키 형식이 올바르지 않습니다'
    };
    
  } catch (error) {
    logError_('KeyVerification', '키 유효성 검사 오류:');
    return {
      success: false,
      message: '키 유효성 검사 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 키 비교
 * @param {string} key1 - 첫 번째 키
 * @param {string} key2 - 두 번째 키
 * @returns {Object} 비교 결과
 */
function compareKeys(key1, key2) {
  try {
    
    if (!key1 || !key2) {
      return {
        success: false,
        message: '비교할 키가 필요합니다.'
      };
    }
    
    const isEqual = key1 === key2;
    
    return {
      success: true,
      isEqual: isEqual,
      message: isEqual ? '키가 일치합니다' : '키가 일치하지 않습니다'
    };
    
  } catch (error) {
    logError_('KeyVerification', '키 비교 오류:');
    return {
      success: false,
      message: '키 비교 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getKeyVerificationInfo() {
  return {
    version: '1.0.0',
    description: '관리자 키 검증 관련 함수들',
    functions: [
      'verifyAdminKey',
      'decryptAndVerifyKey',
      'analyzeKeyStrength',
      'validateKeyFormat',
      'compareKeys'
    ],
    dependencies: ['SpreadsheetCore.gs', 'EncryptionCore.gs', 'CONFIG.gs']
  };
}
