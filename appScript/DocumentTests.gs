/**
 * DocumentTests.gs
 * 문서 관련 테스트 함수들
 * Hot Potato Document Management System
 */

// ===== 테스트 함수들 =====

/**
 * 문서 생성 테스트
 */
function testDocumentCreation() {
  console.log('🧪 문서 생성 테스트 시작');
  
  const testReq = {
    title: '테스트 문서',
    templateType: 'meeting',
    creatorEmail: 'test@example.com',
    editors: ['editor1@example.com', 'editor2@example.com'],
    role: 'student'
  };
  
  const result = DocumentCreation.handleCreateDocument(testReq);
  console.log('🧪 문서 생성 테스트 결과:', result);
  
  return result;
}

/**
 * 폴더 생성 테스트
 */
function testFolderCreation() {
  console.log('🧪 폴더 생성 테스트 시작');
  
  const folder = DocumentFolder.findOrCreateFolder('hot_potato_remake/document');
  console.log('🧪 폴더 생성 테스트 결과:', folder);
  
  return folder;
}

/**
 * 빈 문서 템플릿 테스트
 */
function testEmptyDocumentTemplate() {
  console.log('🧪 빈 문서 템플릿 테스트 시작');
  
  const testReq = {
    title: '테스트 빈 문서',
    templateType: 'empty',
    creatorEmail: 'test@example.com',
    editors: [],
    role: 'student'
  };
  
  const result = DocumentCreation.handleCreateDocument(testReq);
  console.log('🧪 빈 문서 템플릿 테스트 결과:', result);
  
  return result;
}

/**
 * 기본 템플릿 테스트
 */
function testDefaultTemplate() {
  console.log('🧪 기본 템플릿 테스트 시작');
  
  const testReq = {
    title: '테스트 회의록',
    templateType: 'meeting',
    creatorEmail: 'test@example.com',
    editors: [],
    role: 'student'
  };
  
  const result = DocumentCreation.handleCreateDocument(testReq);
  console.log('🧪 기본 템플릿 테스트 결과:', result);
  
  return result;
}

/**
 * Drive API 연결 테스트
 */
function testDriveApiConnection() {
  console.log('🔧 Drive API 연결 테스트 시작');
  
  try {
    // Drive API 사용 가능 여부 확인
    if (typeof Drive === 'undefined') {
      console.error('❌ Drive API가 정의되지 않았습니다');
      return {
        success: false,
        message: 'Drive API가 활성화되지 않았습니다. Google Apps Script에서 Drive API를 활성화해주세요.',
        driveApiAvailable: false
      };
    }
    
    console.log('✅ Drive API 사용 가능');
    
    // 간단한 API 호출 테스트
    const testQuery = "mimeType='application/vnd.google-apps.folder' and trashed=false";
    console.log('🔧 테스트 쿼리:', testQuery);
    
    const result = Drive.Files.list({
      q: testQuery,
      fields: 'files(id,name)',
      maxResults: 1
    });
    
    console.log('✅ Drive API 호출 성공:', result);
    
    return {
      success: true,
      message: 'Drive API 연결 성공',
      driveApiAvailable: true,
      testResult: result
    };
    
  } catch (error) {
    console.error('❌ Drive API 테스트 실패:', error);
    return {
      success: false,
      message: 'Drive API 테스트 실패: ' + error.message,
      driveApiAvailable: typeof Drive !== 'undefined',
      error: error.toString()
    };
  }
}

/**
 * 문서 권한 테스트
 */
function testDocumentPermissions() {
  console.log('🧪 문서 권한 테스트 시작');
  
  try {
    // 테스트 문서 생성
    const testDoc = DocumentCreation.createGoogleDocument('권한 테스트 문서', 'empty');
    if (!testDoc.success) {
      return testDoc;
    }
    
    const documentId = testDoc.data.id;
    
    // 권한 설정 테스트
    const permissionResult = DocumentPermissions.setDocumentPermissions(
      documentId, 
      'test@example.com', 
      ['editor1@example.com', 'editor2@example.com']
    );
    
    // 권한 확인 테스트
    const checkResult = DocumentPermissions.getDocumentPermissions(documentId);
    
    // 테스트 문서 삭제
    try {
      Drive.Files.remove(documentId);
    } catch (deleteError) {
      console.warn('테스트 문서 삭제 실패:', deleteError);
    }
    
    return {
      success: permissionResult.success && checkResult.success,
      message: '문서 권한 테스트 완료',
      permissionResult: permissionResult,
      checkResult: checkResult
    };
    
  } catch (error) {
    console.error('🧪 문서 권한 테스트 오류:', error);
    return {
      success: false,
      message: '문서 권한 테스트 실패: ' + error.message
    };
  }
}

/**
 * 스프레드시트 연동 테스트
 */
function testSpreadsheetIntegration() {
  console.log('🧪 스프레드시트 연동 테스트 시작');
  
  try {
    // 테스트 문서 생성
    const testDoc = DocumentCreation.createGoogleDocument('스프레드시트 테스트 문서', 'empty');
    if (!testDoc.success) {
      return testDoc;
    }
    
    const documentId = testDoc.data.id;
    const documentUrl = testDoc.data.webViewLink;
    
    // 스프레드시트에 추가 테스트
    const addResult = DocumentSpreadsheet.addDocumentToSpreadsheet(
      documentId,
      '스프레드시트 테스트 문서',
      'test@example.com',
      documentUrl,
      'student'
    );
    
    // 문서 목록 조회 테스트
    const getResult = DocumentSpreadsheet.handleGetDocuments({
      role: 'student',
      page: 1,
      limit: 10
    });
    
    // 테스트 문서 삭제
    try {
      Drive.Files.remove(documentId);
    } catch (deleteError) {
      console.warn('테스트 문서 삭제 실패:', deleteError);
    }
    
    return {
      success: addResult.success && getResult.success,
      message: '스프레드시트 연동 테스트 완료',
      addResult: addResult,
      getResult: getResult
    };
    
  } catch (error) {
    console.error('🧪 스프레드시트 연동 테스트 오류:', error);
    return {
      success: false,
      message: '스프레드시트 연동 테스트 실패: ' + error.message
    };
  }
}

/**
 * 전체 통합 테스트
 */
function testFullIntegration() {
  console.log('🧪 전체 통합 테스트 시작');
  
  const results = {
    driveApi: testDriveApiConnection(),
    documentCreation: testDocumentCreation(),
    permissions: testDocumentPermissions(),
    spreadsheet: testSpreadsheetIntegration(),
    templates: DocumentTemplates.getTemplatesFromFolder()
  };
  
  const allSuccess = Object.values(results).every(result => result.success);
  
  console.log('🧪 전체 통합 테스트 결과:', results);
  
  return {
    success: allSuccess,
    message: allSuccess ? '전체 통합 테스트 성공' : '전체 통합 테스트 실패',
    results: results
  };
}

// ===== 배포 정보 =====
function getDocumentTestsInfo() {
  return {
    version: '1.0.0',
    description: '문서 관련 테스트 함수들',
    functions: [
      'testDocumentCreation',
      'testFolderCreation',
      'testEmptyDocumentTemplate',
      'testDefaultTemplate',
      'testDriveApiConnection',
      'testDocumentPermissions',
      'testSpreadsheetIntegration',
      'testFullIntegration'
    ],
    dependencies: [
      'DocumentCreation.gs',
      'DocumentPermissions.gs',
      'DocumentFolder.gs',
      'DocumentSpreadsheet.gs',
      'DocumentTemplates.gs',
      'CONFIG.gs'
    ]
  };
}
