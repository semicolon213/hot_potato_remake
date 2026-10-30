/**
 * KeyGeneration.gs
 * 관리자 키 생성 관련 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 관리자 키 생성 함수들 =====

/**
 * 새로운 관리자 키 생성
 * @returns {Object} 생성된 키 정보
 */
function generateNewAdminKey() {
  try {
    
    // CONFIG에서 암호화 방법들 가져오기
    const methods = getConfig('encryption_methods');
    const layerConfig = getConfig('layer_config');
    
    const layerCount = Math.floor(Math.random() * (layerConfig.MAX_LAYERS - layerConfig.MIN_LAYERS + 1)) + layerConfig.MIN_LAYERS;
    const selectedMethods = [];
    
    for (let i = 0; i < layerCount; i++) {
      const randomIndex = Math.floor(Math.random() * methods.length);
      selectedMethods.push(methods[randomIndex]);
    }
    
    // 안전한 랜덤 문자열 생성
    const randomPart1 = Math.random().toString(36).substring(2);
    const randomPart2 = Math.random().toString(36).substring(2);
    const randomPart = randomPart1 + randomPart2;
    const dateStr = new Date().toISOString().split('T')[0];
    const baseKey = `ADMIN_${dateStr}_${randomPart.substring(0, 13)}`;
    
    let encryptedKey = baseKey;
    for (let i = 0; i < selectedMethods.length; i++) {
      const method = selectedMethods[i];
      const beforeEncrypt = encryptedKey;
      encryptedKey = applyEncryption(encryptedKey, method, '');
      
      if (!encryptedKey || encryptedKey === 'undefined' || encryptedKey.includes('undefined')) {
        logError_('KeyGeneration', `암호화 실패: ${method}에서 undefined 반환`);
        throw new Error(`암호화 실패: ${method}에서 undefined 반환`);
      }
    }
    
    return {
      success: true,
      key: encryptedKey,
      layers: selectedMethods,
      originalKey: baseKey,
      message: '새로운 관리자 키가 생성되었습니다.'
    };
    
  } catch (error) {
    logError_('KeyGeneration', '새로운 관리자 키 생성 오류');
    return {
      success: false,
      message: '관리자 키 생성 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 관리자 키 업데이트
 * @param {string} newKey - 새로운 키
 * @param {Array} layers - 사용된 레이어
 * @returns {Object} 업데이트 결과
 */
function updateAdminKey(newKey, layers) {
  try {
    
    const spreadsheet = getHpMemberSpreadsheet();
    const sheet = spreadsheet.getSheetByName('admin_keys');
    
    if (!sheet) {
      throw new Error('admin_keys 시트를 찾을 수 없습니다');
    }
    
    // 현재 시간 가져오기
    const currentTime = getKSTTime();
    const formattedTime = formatKSTTime(currentTime);
    
    // 새 키 정보를 스프레드시트에 저장
    const newRow = [
      newKey,
      formattedTime,
      'active',
      layers.join(', ')
    ];
    
    // 기존 데이터 삭제 후 새 데이터 추가
    sheet.clear();
    
    // 헤더 추가
    const headers = ['encrypted_key', 'created_at', 'status', 'layers_used'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 새 키 데이터 추가
    sheet.getRange(2, 1, 1, newRow.length).setValues([newRow]);
    
    return {
      success: true,
      message: '관리자 키가 업데이트되었습니다.',
      key: newKey,
      layers: layers,
      timestamp: formattedTime
    };
    
  } catch (error) {
    logError_('KeyGeneration', '관리자 키 업데이트 오류');
    return {
      success: false,
      message: '관리자 키 업데이트 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 관리자 키 백업 생성
 * @param {string} key - 백업할 키
 * @param {Array} layers - 사용된 레이어
 * @returns {Object} 백업 결과
 */
function createKeyBackup(key, layers) {
  try {
    
    const currentTime = getKSTTime();
    const formattedTime = formatKSTTime(currentTime);
    
    const backup = {
      key: key,
      layers: layers,
      timestamp: formattedTime,
      version: '1.0.0'
    };
    
    // 백업을 스프레드시트에 저장
    const spreadsheet = getHpMemberSpreadsheet();
    const sheet = spreadsheet.getSheetByName('admin_keys_backup');
    
    if (!sheet) {
      // 백업 시트가 없으면 생성
      const newSheet = spreadsheet.insertSheet('admin_keys_backup');
      const headers = ['backup_key', 'layers', 'created_at', 'version'];
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // 백업 데이터 추가
    const backupRow = [
      key,
      layers.join(', '),
      formattedTime,
      '1.0.0'
    ];
    
    sheet.appendRow(backupRow);
    
    return {
      success: true,
      message: '관리자 키 백업이 생성되었습니다.',
      backup: backup
    };
    
  } catch (error) {
    logError_('KeyGeneration', '관리자 키 백업 생성 오류');
    return {
      success: false,
      message: '관리자 키 백업 생성 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 관리자 키 백업 복원
 * @param {string} backupKey - 복원할 백업 키
 * @returns {Object} 복원 결과
 */
function restoreKeyBackup(backupKey) {
  try {
    
    const spreadsheet = getHpMemberSpreadsheet();
    const sheet = spreadsheet.getSheetByName('admin_keys_backup');
    
    if (!sheet) {
      return {
        success: false,
        message: '백업 시트를 찾을 수 없습니다.'
      };
    }
    
    // 백업 데이터 검색
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const backupData = data.slice(1);
    
    const backup = backupData.find(row => row[0] === backupKey);
    
    if (!backup) {
      return {
        success: false,
        message: '해당 백업 키를 찾을 수 없습니다.'
      };
    }
    
    const key = backup[0];
    const layers = backup[1].split(',').map(layer => layer.trim());
    const timestamp = backup[2];
    
    // 키 복원
    const restoreResult = updateAdminKey(key, layers);
    
    if (restoreResult.success) {
      
      return {
        success: true,
        message: '관리자 키 백업이 복원되었습니다.',
        key: key,
        layers: layers,
        timestamp: timestamp
      };
    } else {
      return restoreResult;
    }
    
  } catch (error) {
    logError_('KeyGeneration', '관리자 키 백업 복원 오류');
    return {
      success: false,
      message: '관리자 키 백업 복원 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 관리자 키 히스토리 조회
 * @returns {Object} 히스토리 조회 결과
 */
function getKeyHistory() {
  try {
    
    const spreadsheet = getHpMemberSpreadsheet();
    const sheet = spreadsheet.getSheetByName('admin_keys_backup');
    
    if (!sheet) {
      return {
        success: true,
        data: [],
        message: '백업 시트가 없습니다.'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const historyData = data.slice(1);
    
    const history = historyData.map(row => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      return item;
    });
    
    return {
      success: true,
      data: history,
      total: history.length,
      message: `${history.length}개의 키 히스토리가 있습니다.`
    };
    
  } catch (error) {
    logError_('KeyGeneration', '관리자 키 히스토리 조회 오류');
    return {
      success: false,
      message: '관리자 키 히스토리 조회 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getKeyGenerationInfo() {
  return {
    version: '1.0.0',
    description: '관리자 키 생성 관련 함수들',
    functions: [
      'generateNewAdminKey',
      'updateAdminKey',
      'createKeyBackup',
      'restoreKeyBackup',
      'getKeyHistory'
    ],
    dependencies: ['SpreadsheetCore.gs', 'EncryptionCore.gs', 'CONFIG.gs']
  };
}
