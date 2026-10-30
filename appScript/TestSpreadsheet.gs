/**
 * TestSpreadsheet.gs
 * 스프레드시트 관련 테스트 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 스프레드시트 테스트 함수들 =====

/**
 * 스프레드시트 연결 테스트
 * @returns {Object} 테스트 결과
 */
function testSpreadsheetConnection() {
  
  try {
    const spreadsheetId = SpreadsheetCore.getHpMemberSpreadsheetId();
    logDebug_('TestSpreadsheet', '스프레드시트 ID:', spreadsheetId);
    
    if (!spreadsheetId) {
      throw new Error('스프레드시트 ID를 찾을 수 없습니다');
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = spreadsheet.getName();
    logDebug_('TestSpreadsheet', '스프레드시트 이름:', sheetName);
    
    return {
      success: true,
      message: '스프레드시트 연결 성공',
      spreadsheetId: spreadsheetId,
      sheetName: sheetName
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '스프레드시트 연결 실패:', error);
    return {
      success: false,
      message: '스프레드시트 연결 실패: ' + error.message
    };
  }
}

/**
 * 시트 데이터 읽기 테스트
 * @returns {Object} 테스트 결과
 */
function testSheetDataReading() {
  
  try {
    const sheetData = SpreadsheetCore.getSheetData('HP_Member');
    
    if (!sheetData || !Array.isArray(sheetData)) {
      throw new Error('시트 데이터를 읽을 수 없습니다');
    }
    
    if (sheetData.length > 1) {
    }
    
    return {
      success: true,
      message: '시트 데이터 읽기 성공',
      rowCount: sheetData.length,
      headers: sheetData[0] || [],
      sampleData: sheetData[1] || null
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '시트 데이터 읽기 실패:', error);
    return {
      success: false,
      message: '시트 데이터 읽기 실패: ' + error.message
    };
  }
}

/**
 * 시트 데이터 추가 테스트
 * @returns {Object} 테스트 결과
 */
function testSheetDataAppending() {
  
  try {
    const testData = [
      'TEST_' + new Date().getTime(),
      'test@example.com',
      'Test User',
      '010-0000-0000',
      'Test Department',
      'Test Position',
      'Test Status',
      new Date().toISOString()
    ];
    
    const result = SpreadsheetCore.appendSheetData('HP_Member', testData);
    
    if (!result.success) {
      throw new Error('데이터 추가 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '시트 데이터 추가 성공',
      testData: testData
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '시트 데이터 추가 실패:', error);
    return {
      success: false,
      message: '시트 데이터 추가 실패: ' + error.message
    };
  }
}

/**
 * 시트 데이터 업데이트 테스트
 * @returns {Object} 테스트 결과
 */
function testSheetDataUpdating() {
  
  try {
    const testData = [
      'UPDATED_' + new Date().getTime(),
      'updated@example.com',
      'Updated User',
      '010-1111-1111',
      'Updated Department',
      'Updated Position',
      'Updated Status',
      new Date().toISOString()
    ];
    
    const result = SpreadsheetCore.updateSheetData('HP_Member', testData, 0);
    
    if (!result.success) {
      throw new Error('데이터 업데이트 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '시트 데이터 업데이트 성공',
      testData: testData
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '시트 데이터 업데이트 실패:', error);
    return {
      success: false,
      message: '시트 데이터 업데이트 실패: ' + error.message
    };
  }
}

/**
 * 시트 존재 확인 테스트
 * @returns {Object} 테스트 결과
 */
function testSheetExistence() {
  
  try {
    const existingSheet = SpreadsheetCore.checkSheetExists('HP_Member');
    const nonExistingSheet = SpreadsheetCore.checkSheetExists('NonExistingSheet');
    
    logDebug_('TestSpreadsheet', 'HP_Member 시트 존재:', existingSheet);
    logDebug_('TestSpreadsheet', 'NonExistingSheet 시트 존재:', nonExistingSheet);
    
    return {
      success: true,
      message: '시트 존재 확인 테스트 성공',
      results: {
        existingSheet: existingSheet,
        nonExistingSheet: nonExistingSheet
      }
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '시트 존재 확인 테스트 실패:', error);
    return {
      success: false,
      message: '시트 존재 확인 테스트 실패: ' + error.message
    };
  }
}

/**
 * 새 시트 생성 테스트
 * @returns {Object} 테스트 결과
 */
function testNewSheetCreation() {
  
  try {
    const testSheetName = 'TestSheet_' + new Date().getTime();
    logDebug_('TestSpreadsheet', '생성할 시트 이름:', testSheetName);
    
    const result = SpreadsheetCore.createNewSheet(testSheetName);
    
    if (!result.success) {
      throw new Error('시트 생성 실패: ' + result.message);
    }
    
    // 생성된 시트 확인
    const exists = SpreadsheetCore.checkSheetExists(testSheetName);
    logDebug_('TestSpreadsheet', '생성된 시트 존재 확인:', exists);
    
    return {
      success: true,
      message: '새 시트 생성 테스트 성공',
      sheetName: testSheetName,
      created: result.success,
      exists: exists
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '새 시트 생성 테스트 실패:', error);
    return {
      success: false,
      message: '새 시트 생성 테스트 실패: ' + error.message
    };
  }
}

/**
 * 전체 스프레드시트 테스트 실행
 * @returns {Object} 전체 테스트 결과
 */
function runAllSpreadsheetTests() {
  
  try {
    const results = {
      connection: testSpreadsheetConnection(),
      dataReading: testSheetDataReading(),
      dataAppending: testSheetDataAppending(),
      dataUpdating: testSheetDataUpdating(),
      sheetExistence: testSheetExistence(),
      newSheetCreation: testNewSheetCreation()
    };
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    Object.keys(results).forEach(testName => {
      const result = results[testName];
    });
    
    return {
      success: successCount === totalCount,
      message: `스프레드시트 테스트 결과: ${successCount}/${totalCount} 성공`,
      results: results
    };
    
  } catch (error) {
    logError_('TestSpreadsheet', '전체 스프레드시트 테스트 실패:', error);
    return {
      success: false,
      message: '전체 스프레드시트 테스트 실패: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getTestSpreadsheetInfo() {
  return {
    version: '1.0.0',
    description: '스프레드시트 관련 테스트 함수들',
    functions: [
      'testSpreadsheetConnection',
      'testSheetDataReading',
      'testSheetDataAppending',
      'testSheetDataUpdating',
      'testSheetExistence',
      'testNewSheetCreation',
      'runAllSpreadsheetTests'
    ],
    dependencies: [
      'SpreadsheetCore.gs'
    ]
  };
}
