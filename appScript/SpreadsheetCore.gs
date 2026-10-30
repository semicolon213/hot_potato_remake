/**
 * SpreadsheetCore.gs
 * 스프레드시트 핵심 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 스프레드시트 핵심 함수들 =====

var hpMemberSpreadsheetMemo_ = null;

/**
 * hp_member 스프레드시트 가져오기 (연결된 스프레드시트 사용)
 * @returns {Object} 스프레드시트 객체
 */
function getHpMemberSpreadsheet() {
  if (hpMemberSpreadsheetMemo_) return hpMemberSpreadsheetMemo_;

  const spreadsheetId = getSpreadsheetId();
  if (spreadsheetId) {
    logDebug_('SpreadsheetCore', '스크립트 속성 SPREADSHEET_ID 사용:', spreadsheetId);
    hpMemberSpreadsheetMemo_ = SpreadsheetApp.openById(spreadsheetId);
    return hpMemberSpreadsheetMemo_;
  }

  try {
    // Apps Script 프로젝트에 연결된 스프레드시트 사용
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (spreadsheet) {
      hpMemberSpreadsheetMemo_ = spreadsheet;
      return hpMemberSpreadsheetMemo_;
    }
  } catch (error) {
    logWarn_('SpreadsheetCore', '연결된 스프레드시트를 찾을 수 없습니다:', error.message);
  }
  
  throw new Error('스프레드시트를 찾을 수 없습니다. 프로젝트 설정 > 스크립트 속성에 SPREADSHEET_ID(회원/로그인용 스프레드시트 ID)를 설정하세요.');
}

/**
 * hp_member 스프레드시트 ID 가져오기 (하위 호환성 유지)
 * @returns {string} 스프레드시트 ID
 */
function getHpMemberSpreadsheetId() {
  try {
    const spreadsheet = getHpMemberSpreadsheet();
    return spreadsheet.getId();
  } catch (error) {
    logError_('SpreadsheetCore', '스프레드시트 ID 가져오기 실패:', error);
    return null;
  }
}

/**
 * 스프레드시트 데이터 읽기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} range - 범위 (예: 'A1:Z100')
 * @returns {Array} 데이터 배열
 */
function getSheetData(spreadsheetId, sheetName, range) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      logWarn_('SpreadsheetCore', '시트를 찾을 수 없습니다:', sheetName);
      return null;
    }
    
    const data = sheet.getRange(range).getValues();
    
    return data;
    
  } catch (error) {
    logError_('SpreadsheetCore', '스프레드시트 데이터 읽기 오류:', error);
    return null;
  }
}

/**
 * 스프레드시트 데이터 쓰기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} range - 범위 (예: 'A1:Z100')
 * @param {Array} data - 데이터 배열
 * @returns {boolean} 성공 여부
 */
function setSheetData(spreadsheetId, sheetName, range, data) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      logWarn_('SpreadsheetCore', '시트를 찾을 수 없습니다:', sheetName);
      return false;
    }
    
    sheet.getRange(range).setValues(data);
    
    return true;
    
  } catch (error) {
    logError_('SpreadsheetCore', '스프레드시트 데이터 쓰기 오류:', error);
    return false;
  }
}

/**
 * 스프레드시트에 데이터 추가
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {Array} data - 추가할 데이터 배열
 * @returns {boolean} 성공 여부
 */
function appendSheetData(spreadsheetId, sheetName, data) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      logWarn_('SpreadsheetCore', '시트를 찾을 수 없습니다:', sheetName);
      return false;
    }
    
    // 데이터가 2차원 배열인지 확인
    if (Array.isArray(data) && Array.isArray(data[0])) {
      // 여러 행 추가
      data.forEach(row => {
        sheet.appendRow(row);
      });
    } else {
      // 단일 행 추가
      sheet.appendRow(data);
    }
    return true;
    
  } catch (error) {
    logError_('SpreadsheetCore', '스프레드시트 데이터 추가 오류:', error);
    return false;
  }
}

/**
 * 시트 존재 확인
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @returns {boolean} 시트 존재 여부
 */
function checkSheetExists(spreadsheetId, sheetName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    return sheet !== null;
  } catch (error) {
    logError_('SpreadsheetCore', '시트 존재 확인 오류:', error);
    return false;
  }
}

/**
 * 새 시트 생성
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @returns {boolean} 성공 여부
 */
function createNewSheet(spreadsheetId, sheetName) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.insertSheet(sheetName);
    return true;
    
  } catch (error) {
    logError_('SpreadsheetCore', '새 시트 생성 오류:', error);
    return false;
  }
}

/**
 * 시트 삭제
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @returns {boolean} 성공 여부
 */
function deleteSheet(spreadsheetId, sheetName) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (sheet) {
      spreadsheet.deleteSheet(sheet);
      return true;
    } else {
      logWarn_('SpreadsheetCore', '삭제할 시트를 찾을 수 없습니다:', sheetName);
      return false;
    }
    
  } catch (error) {
    logError_('SpreadsheetCore', '시트 삭제 오류:', error);
    return false;
  }
}

/**
 * 시트 이름 변경
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} oldName - 기존 시트 이름
 * @param {string} newName - 새 시트 이름
 * @returns {boolean} 성공 여부
 */
function renameSheet(spreadsheetId, oldName, newName) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(oldName);
    
    if (sheet) {
      sheet.setName(newName);
      return true;
    } else {
      logWarn_('SpreadsheetCore', '이름을 변경할 시트를 찾을 수 없습니다:', oldName);
      return false;
    }
    
  } catch (error) {
    logError_('SpreadsheetCore', '시트 이름 변경 오류:', error);
    return false;
  }
}

/**
 * 스프레드시트 정보 가져오기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Object} 스프레드시트 정보
 */
function getSpreadsheetInfo(spreadsheetId) {
  try {
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheets = spreadsheet.getSheets();
    
    const info = {
      id: spreadsheet.getId(),
      name: spreadsheet.getName(),
      url: spreadsheet.getUrl(),
      sheetCount: sheets.length,
      sheets: sheets.map(sheet => ({
        name: sheet.getName(),
        id: sheet.getSheetId(),
        rowCount: sheet.getLastRow(),
        columnCount: sheet.getLastColumn()
      }))
    };
    return info;
    
  } catch (error) {
    logError_('SpreadsheetCore', '스프레드시트 정보 가져오기 오류:', error);
    return null;
  }
}

// ===== 배포 정보 =====
function getSpreadsheetCoreInfo() {
  return {
    version: '1.0.0',
    description: '스프레드시트 핵심 함수들',
    functions: [
      'getHpMemberSpreadsheet',
      'getHpMemberSpreadsheetId',
      'getSheetData',
      'setSheetData',
      'appendSheetData',
      'checkSheetExists',
      'createNewSheet',
      'deleteSheet',
      'renameSheet',
      'getSpreadsheetInfo'
    ],
    dependencies: ['CONFIG.gs']
  };
}
