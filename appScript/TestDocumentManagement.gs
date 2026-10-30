/**
 * TestDocumentManagement.gs
 * 문서 관리 관련 테스트 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 문서 관리 테스트 함수들 =====

/**
 * 문서 생성 테스트
 * @returns {Object} 테스트 결과
 */
function testDocumentCreation() {
  
  try {
    const testTitle = 'Test Document ' + new Date().getTime();
    const testTemplateType = 'empty';
    const testCreatorEmail = 'test@example.com';
    const testEditors = ['editor1@example.com', 'editor2@example.com'];
    const testRole = 'student';
    
    const result = DocumentCreation.createGoogleDocument(testTitle, testTemplateType);
    
    if (!result.success) {
      throw new Error('문서 생성 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '문서 생성 테스트 성공',
      documentId: result.data.id,
      documentUrl: result.data.webViewLink,
      testData: {
        title: testTitle,
        templateType: testTemplateType,
        creatorEmail: testCreatorEmail,
        editors: testEditors,
        role: testRole
      }
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '문서 생성 테스트 실패:', error);
    return {
      success: false,
      message: '문서 생성 테스트 실패: ' + error.message
    };
  }
}

/**
 * 문서 권한 설정 테스트
 * @returns {Object} 테스트 결과
 */
function testDocumentPermissions() {
  
  try {
    const testDocumentId = 'test_document_id';
    const testCreatorEmail = 'test@example.com';
    const testEditors = ['editor1@example.com', 'editor2@example.com'];
    
    const result = DocumentPermissions.setDocumentPermissions(testDocumentId, testCreatorEmail, testEditors);
    
    if (!result.success) {
      throw new Error('문서 권한 설정 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '문서 권한 설정 테스트 성공',
      testData: {
        documentId: testDocumentId,
        creatorEmail: testCreatorEmail,
        editors: testEditors
      }
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '문서 권한 설정 테스트 실패:', error);
    return {
      success: false,
      message: '문서 권한 설정 테스트 실패: ' + error.message
    };
  }
}

/**
 * 문서 폴더 이동 테스트
 * @returns {Object} 테스트 결과
 */
function testDocumentFolderMove() {
  
  try {
    const testDocumentId = 'test_document_id';
    logDebug_('TestDocumentManagement', '이동할 문서 ID:', testDocumentId);
    
    const result = DocumentFolder.moveDocumentToFolder(testDocumentId);
    
    if (!result.success) {
      throw new Error('문서 폴더 이동 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '문서 폴더 이동 테스트 성공',
      testData: {
        documentId: testDocumentId
      }
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '문서 폴더 이동 테스트 실패:', error);
    return {
      success: false,
      message: '문서 폴더 이동 테스트 실패: ' + error.message
    };
  }
}

/**
 * 문서 스프레드시트 추가 테스트
 * @returns {Object} 테스트 결과
 */
function testDocumentSpreadsheetAdd() {
  
  try {
    const testDocumentId = 'test_document_id';
    const testTitle = 'Test Document';
    const testCreatorEmail = 'test@example.com';
    const testDocumentUrl = 'https://docs.google.com/document/d/test_document_id/edit';
    const testRole = 'student';
    
    const result = DocumentSpreadsheet.addDocumentToSpreadsheet(
      testDocumentId,
      testTitle,
      testCreatorEmail,
      testDocumentUrl,
      testRole
    );
    
    if (!result.success) {
      throw new Error('문서 스프레드시트 추가 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '문서 스프레드시트 추가 테스트 성공',
      testData: {
        documentId: testDocumentId,
        title: testTitle,
        creatorEmail: testCreatorEmail,
        documentUrl: testDocumentUrl,
        role: testRole
      }
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '문서 스프레드시트 추가 테스트 실패:', error);
    return {
      success: false,
      message: '문서 스프레드시트 추가 테스트 실패: ' + error.message
    };
  }
}

/**
 * 템플릿 폴더에서 템플릿 가져오기 테스트
 * @returns {Object} 테스트 결과
 */
function testTemplateFolderAccess() {
  
  try {
    const result = DocumentTemplates.getTemplatesFromFolder();
    
    if (!result.success) {
      throw new Error('템플릿 폴더 접근 실패: ' + result.message);
    }
    
    const templates = result.data || [];
    logDebug_('TestDocumentManagement', '가져온 템플릿 수:', templates.length);
    
    if (templates.length > 0) {
    }
    
    return {
      success: true,
      message: '템플릿 폴더에서 템플릿 가져오기 테스트 성공',
      templateCount: templates.length,
      sampleTemplate: templates[0] || null
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '템플릿 폴더에서 템플릿 가져오기 테스트 실패:', error);
    return {
      success: false,
      message: '템플릿 폴더에서 템플릿 가져오기 테스트 실패: ' + error.message
    };
  }
}

/**
 * 특정 폴더 테스트
 * @returns {Object} 테스트 결과
 */
function testSpecificFolder() {
  
  try {
    const result = DocumentTemplates.testSpecificFolder();
    
    if (!result.success) {
      throw new Error('특정 폴더 테스트 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '특정 폴더 테스트 성공',
      result: result
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '특정 폴더 테스트 실패:', error);
    return {
      success: false,
      message: '특정 폴더 테스트 실패: ' + error.message
    };
  }
}

/**
 * 전체 문서 관리 테스트 실행
 * @returns {Object} 전체 테스트 결과
 */
function runAllDocumentManagementTests() {
  
  try {
    const results = {
      documentCreation: testDocumentCreation(),
      documentPermissions: testDocumentPermissions(),
      documentFolderMove: testDocumentFolderMove(),
      documentSpreadsheetAdd: testDocumentSpreadsheetAdd(),
      templateFolderAccess: testTemplateFolderAccess(),
      specificFolder: testSpecificFolder()
    };
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    Object.keys(results).forEach(testName => {
      const result = results[testName];
    });
    
    return {
      success: successCount === totalCount,
      message: `문서 관리 테스트 결과: ${successCount}/${totalCount} 성공`,
      results: results
    };
    
  } catch (error) {
    logError_('TestDocumentManagement', '전체 문서 관리 테스트 실패:', error);
    return {
      success: false,
      message: '전체 문서 관리 테스트 실패: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getTestDocumentManagementInfo() {
  return {
    version: '1.0.0',
    description: '문서 관리 관련 테스트 함수들',
    functions: [
      'testDocumentCreation',
      'testDocumentPermissions',
      'testDocumentFolderMove',
      'testDocumentSpreadsheetAdd',
      'testTemplateFolderAccess',
      'testSpecificFolder',
      'runAllDocumentManagementTests'
    ],
    dependencies: [
      'DocumentCreation.gs',
      'DocumentPermissions.gs',
      'DocumentFolder.gs',
      'DocumentSpreadsheet.gs',
      'DocumentTemplates.gs'
    ]
  };
}
