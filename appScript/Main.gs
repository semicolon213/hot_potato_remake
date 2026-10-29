/**
 * Main.gs
 * 메인 엔트리 포인트 - UserManagement.gs 연동
 * Hot Potato Admin Key Management System
 */

// ===== 메인 엔트리 포인트 =====
function getBootstrapData(req) {
  function run(name, action) {
    try {
      return action();
    } catch (error) {
      logError_('Main', name + ' 부트스트랩 조회 오류:', error);
      return { success: false, message: name + ' 조회 중 오류가 발생했습니다: ' + error.message };
    }
  }

  return {
    success: true,
    data: {
      getStaticTags: run('기본 태그', function() { return getStaticTags(req); }),
      getWorkflowTemplates: run('워크플로우 템플릿', function() {
        initializeWorkflowSheets();
        return getWorkflowTemplates(req);
      }),
      getLedgerList: run('장부 목록', function() {
        return { success: true, data: getLedgerList() };
      }),
      getTemplates: run('템플릿 목록', function() { return getTemplatesFromFolder(); }),
      getAnnouncements: run('공지사항', function() { return getAnnouncements(req); })
    }
  };
}

function doPost(e) {
  try {
    // 요청 데이터 파싱
    const req = parseRequest(e);

    if (req.action === 'getBootstrapData') {
      return ContentService
        .createTextOutput(JSON.stringify(getBootstrapData(req)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 암복호화 액션 처리
    if (req.action === 'encryptEmail') {
      try {
        const encrypted = encryptEmailMain(req.data);
        const response = {
          success: true, 
          data: encrypted
        };
        return ContentService
          .createTextOutput(JSON.stringify(response))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '암호화 오류');
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: '암호화 중 오류가 발생했습니다: ' + error.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'decryptEmail') {
      try {
        const decrypted = decryptEmailMain(req.data);
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, data: decrypted }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '복호화 오류');
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: '복호화 중 오류가 발생했습니다: ' + error.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 일괄 복호화 (여러 값을 한 번의 API 호출로 처리)
    if (req.action === 'decryptEmailBatch') {
      const values = req.data;
      if (!Array.isArray(values)) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: 'data는 배열이어야 합니다.' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      try {
        const decrypted = values.map(function(v) { return decryptEmailMain(v || ''); });
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, data: decrypted }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '일괄 복호화 오류');
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: '복호화 중 오류가 발생했습니다: ' + error.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 문서 생성 액션 처리
    if (req.action === 'createDocument') {
      
      try {
        const { title, templateType, creatorEmail, editors, role } = req;
        
        if (!title || !creatorEmail) {
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              message: '제목과 생성자 이메일이 필요합니다.'
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        
        // DocumentCreation 모듈 확인 및 문서 생성
        let document;
        if (typeof DocumentCreation !== 'undefined' && typeof DocumentCreation.createGoogleDocument === 'function') {
          logDebug_('Main', 'DocumentCreation 모듈 사용');
          document = DocumentCreation.createGoogleDocument(title, templateType);
        } else {
          logWarn_('Main', 'DocumentCreation 모듈 로드 실패, 직접 함수 호출');
          document = createGoogleDocumentDirect(title, templateType);
        }
        if (!document.success) {
          return ContentService
            .createTextOutput(JSON.stringify(document))
            .setMimeType(ContentService.MimeType.JSON);
        }
        
        const documentId = document.data.id;
        const documentUrl = document.data.webViewLink;
        
        // 권한 설정 (직접 처리)
        let permissionResult = null;
        try {
          
          // 입력 데이터 검증
          if (!documentId) {
            throw new Error('문서 ID가 필요합니다');
          }
          
          const file = DriveApp.getFileById(documentId);
          
          // 모든 사용자에게 편집 권한 부여 (생성자 + 편집자)
          const allUsers = [creatorEmail, ...(editors || [])].filter((email, index, arr) => 
            email && email.trim() !== '' && arr.indexOf(email) === index // 중복 제거
          );
          logDebug_('Main', '사용자 수:', allUsers.length);
          
          if (allUsers.length === 0) {
            logWarn_('Main', '권한 부여할 사용자가 없습니다');
            permissionResult = {
              success: true,
              message: '권한 부여할 사용자가 없습니다',
              grantedUsers: [],
              currentEditors: []
            };
          } else {
            // 권한 설정 전 현재 상태 확인 (Drive API 사용)
            const beforePermissions = Drive.Permissions.list(documentId);
            const beforePermissionsList = beforePermissions.items || [];
            
            let successCount = 0;
            let failCount = 0;
            
            // 각 사용자에게 편집 권한 부여 (Drive API - 메일 알림 없음)
            for (const userEmail of allUsers) {
              try {
                
                // 이미 권한이 있는지 확인
                const hasPermission = beforePermissionsList.some(p => p.emailAddress === userEmail && p.role === 'writer');
                if (hasPermission) {
                  successCount++;
                  continue;
                }
                
                // 권한 부여 (메일 알림 없이)
                Drive.Permissions.insert({
                  role: 'writer',
                  type: 'user',
                  value: userEmail,
                  sendNotificationEmails: false
                }, documentId);
                successCount++;
                
                // 잠시 대기 (API 제한 방지)
                Utilities.sleep(100);
                
              } catch (permError) {
                logError_('Main', '권한 설정 실패:', permError.message);
                failCount++;
              }
            }
            
            // 권한 설정 후 결과 확인
            const afterPermissions = Drive.Permissions.list(documentId);
            const afterPermissionsList = afterPermissions.items || [];
            
            permissionResult = {
              success: successCount > 0,
              message: `권한 설정 완료: 성공 ${successCount}명, 실패 ${failCount}명`,
              grantedUsers: allUsers,
              currentEditors: afterPermissionsList.map(p => p.emailAddress),
              successCount: successCount,
              failCount: failCount
            };
          }
          
        } catch (permissionError) {
          logError_('Main', '문서 권한 설정 실패:', permissionError);
          permissionResult = {
            success: false,
            message: '권한 설정 중 오류가 발생했습니다: ' + permissionError.message
          };
        }
        
        // 문서를 지정된 폴더로 이동
        try {
          if (typeof DocumentFolder !== 'undefined' && typeof DocumentFolder.findOrCreateFolder === 'function') {
            logDebug_('Main', 'DocumentFolder 모듈 사용');
            moveDocumentToSharedFolderWithModule(documentId);
          } else {
            logWarn_('Main', 'DocumentFolder 모듈 로드 실패, 직접 함수 호출');
            moveDocumentToSharedFolder(documentId);
          }
        } catch (moveError) {
          logWarn_('Main', '문서 폴더 이동 실패:', moveError);
        }
        
        const result = {
          success: true,
          data: {
            documentId: documentId,
            documentUrl: documentUrl,
            title: title,
            creatorEmail: creatorEmail,
            editors: editors || []
          },
          message: '문서가 성공적으로 생성되었습니다.',
          permissionResult: permissionResult,
          debug: {
            requestedEditors: editors || [],
            permissionSuccess: permissionResult ? permissionResult.success : false,
            permissionMessage: permissionResult ? permissionResult.message : '권한 설정 없음',
            grantedUsers: permissionResult ? permissionResult.grantedUsers : [],
            currentEditors: permissionResult ? permissionResult.currentEditors : []
          }
        };
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
          
      } catch (error) {
        logError_('Main', '문서 생성 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '문서 생성 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 문서 목록 조회 액션 처리
    if (req.action === 'getDocuments') {
      const result = (typeof handleGetDocuments === 'function') ? handleGetDocuments(req) : (typeof DocumentSpreadsheet !== 'undefined' && DocumentSpreadsheet.handleGetDocuments ? DocumentSpreadsheet.handleGetDocuments(req) : { success: false, message: 'DocumentSpreadsheet is not defined' });
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 공유 템플릿 업로드(파일 업로드 + 메타데이터 저장)
    if (req.action === 'uploadSharedTemplate') {
      const result = uploadSharedTemplate(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 공유 문서 업로드(파일 업로드 + 권한 설정 + 폴더 이동)
    if (req.action === 'uploadSharedDocument') {
      const result = uploadSharedDocument(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공유 템플릿 메타데이터 수정
    if (req.action === 'updateSharedTemplateMeta') {
      const result = updateSharedTemplateMeta(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공유 템플릿 목록(메타데이터 우선) 조회
    if (req.action === 'getSharedTemplates') {
      const result = getSharedTemplates();
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공유 템플릿 삭제
    if (req.action === 'deleteSharedTemplate') {
      const result = deleteSharedTemplate(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 스프레드시트 ID 목록 조회
    if (req.action === 'getSpreadsheetIds') {
      const result = getSpreadsheetIds(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 목록 조회
    if (req.action === 'getStaticTags') {
      const result = getStaticTags(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 추가
    if (req.action === 'addStaticTag') {
      const result = addStaticTag(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 수정
    if (req.action === 'updateStaticTag') {
      const result = updateStaticTag(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 삭제
    if (req.action === 'deleteStaticTag') {
      const result = deleteStaticTag(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 문서 삭제 액션 처리
    if (req.action === 'deleteDocuments') {
      const result = (typeof handleDeleteDocuments === 'function') ? handleDeleteDocuments(req) : (typeof DocumentSpreadsheet !== 'undefined' && DocumentSpreadsheet.handleDeleteDocuments ? DocumentSpreadsheet.handleDeleteDocuments(req) : { success: false, message: 'DocumentSpreadsheet is not defined' });
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 템플릿 목록 조회 액션 처리
    if (req.action === 'getTemplates') {
      
      // Drive API 확인
      if (typeof Drive === 'undefined') {
        logError_('Main', 'Drive API가 정의되지 않았습니다');
        const errorResult = {
          success: false,
          message: 'Drive API가 활성화되지 않았습니다. Google Apps Script에서 Drive API를 활성화해주세요.',
          debugInfo: ['❌ Drive API가 정의되지 않았습니다']
        };
        return ContentService
          .createTextOutput(JSON.stringify(errorResult))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // DocumentTemplates 함수 직접 호출
      try {
        const result = getTemplatesFromFolder();
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '템플릿 목록 조회 오류:', error);
        const errorResult = {
          success: false,
          message: '템플릿 목록 조회 중 오류가 발생했습니다: ' + error.message,
          debugInfo: ['❌ getTemplatesFromFolder 함수 호출 실패']
        };
        return ContentService
          .createTextOutput(JSON.stringify(errorResult))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Drive API 연결 테스트 액션 처리
    if (req.action === 'testDriveApi') {
      
      // DocumentTests 함수 직접 호출
      try {
        const result = testDriveApiConnection();
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'Drive API 테스트 오류:', error);
        const errorResult = {
          success: false,
          message: 'Drive API 테스트 중 오류가 발생했습니다: ' + error.message,
          debugInfo: ['❌ testDriveApiConnection 함수 호출 실패']
        };
        return ContentService
          .createTextOutput(JSON.stringify(errorResult))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 템플릿 폴더 디버깅 테스트 액션 처리
    if (req.action === 'testTemplateFolderDebug') {
      try {
        const result = testTemplateFolderDebug();
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '템플릿 폴더 디버깅 테스트 오류:', error);
        const errorResult = {
          success: false,
          message: '템플릿 폴더 디버깅 테스트 중 오류가 발생했습니다: ' + error.message,
          debugInfo: ['❌ testTemplateFolderDebug 함수 호출 실패']
        };
        return ContentService
          .createTextOutput(JSON.stringify(errorResult))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 특정 폴더 ID 테스트 액션 처리
    if (req.action === 'testSpecificFolder') {
      try {
        const result = testSpecificFolder();
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '특정 폴더 ID 테스트 오류:', error);
        const errorResult = {
          success: false,
          message: '특정 폴더 ID 테스트 중 오류가 발생했습니다: ' + error.message,
          debugInfo: ['❌ testSpecificFolder 함수 호출 실패']
        };
        return ContentService
          .createTextOutput(JSON.stringify(errorResult))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    
    // 사용자 인증 관련 액션들
    if (req.action === 'checkUserStatus') {
      const result = handleCheckRegistrationStatus(req.email);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 이메일로 사용자 이름 조회 액션 처리
    if (req.action === 'getUserNameByEmail') {
      try {
        const result = getUserNameByEmail(req.email);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '사용자 이름 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '사용자 이름 조회 중 오류가 발생했습니다: ' + error.message,
            name: req.email // 오류 시 원본 이메일 반환
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'registerUser') {
      const result = handleSubmitRegistrationRequest(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (req.action === 'verifyAdminKey') {
      const result = verifyAdminKeyData(req.adminKey);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 인증 관련 액션 처리
    if (req.action === 'checkApprovalStatus') {
      const result = checkUserStatus(req.email);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 회계 관련 액션
    if (req.action === 'createLedger') {
      try {
        const ledgerReq = flattenCreateLedgerRequest_(req);
        const result = createLedgerStructure(ledgerReq);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '장부 생성 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '장부 생성 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'getLedgerList') {
      try {
        const result = getLedgerList();
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            data: result
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '장부 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '장부 목록 조회 중 오류가 발생했습니다: ' + error.message,
            data: []
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'updateAccountSubManagers') {
      try {
        const result = updateAccountSubManagers(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '서브 관리자 목록 업데이트 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '서브 관리자 목록 업데이트 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'getAccountingFolderId') {
      try {
        const folderId = initializeAccountingFolder();
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            data: {
              accountingFolderId: folderId
            }
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '회계 폴더 ID 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '회계 폴더 ID 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 장부 카테고리 조회
    if (req.action === 'getAccountingCategories') {
      try {
        const categories = getAccountingCategories(req.spreadsheetId);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            data: categories
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '장부 카테고리 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '장부 카테고리 조회 중 오류가 발생했습니다: ' + error.message,
            data: []
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 학생 유급 여부 조회
    if (req.action === 'getStudentRetainedStatus') {
      try {
        const result = getStudentRetainedStatus(req.studentId, req.spreadsheetId);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '학생 유급 여부 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '유급 여부 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 학생 유급 여부 업데이트
    if (req.action === 'updateStudentRetained') {
      try {
        const result = updateStudentRetained(req.studentId, req.spreadsheetId, req.isRetained);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '학생 유급 여부 업데이트 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '유급 여부 업데이트 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 졸업 학년 조회
    if (req.action === 'getGraduationGrade') {
      try {
        const result = getGraduationGrade(req.spreadsheetId);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'getGraduationGrade 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // 졸업 학년 설정 (조교만)
    if (req.action === 'setGraduationGrade') {
      try {
        const result = setGraduationGrade(req.spreadsheetId, req.grade, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'setGraduationGrade 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // 학생 학년 업데이트 (학년 관리에서 조교 수동 실행)
    if (req.action === 'updateStudentGrades') {
      try {
        const result = updateStudentGrades(req.spreadsheetId, req.graduationGrade, req.graduationYear, req.graduationTerm);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '학생 학년 업데이트 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '학년 업데이트 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    // 선택 학생 학년 업데이트 (학년 관리에서 선택 실행)
    if (req.action === 'updateStudentGradesSelected') {
      try {
        const result = updateStudentGradesSelected(
          req.spreadsheetId,
          req.studentIds || [],
          req.graduationGrade,
          req.graduationYear,
          req.graduationTerm
        );
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '선택 학생 학년 업데이트 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '선택 학생 학년 업데이트 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    // 이번 졸업 대상 진학 여부 반영
    if (req.action === 'setGraduatedAdvanced') {
      try {
        const result = setGraduatedAdvanced(
          req.spreadsheetId,
          req.graduatedStudentIds || [],
          req.advancedStudentIds || []
        );
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '졸업 대상 진학 반영 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '졸업 대상 진학 반영 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ===== 학생 취업관리 (로그인 없이 / 학생관리 탭) =====
    if (req.action === 'validateStudentForEmployment') {
      try {
        const result = validateStudentForEmployment(req.spreadsheetId, req.std_num, req.name, req.phone);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'validateStudentForEmployment 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'getEmploymentByStdNum') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = getEmploymentByStdNum(sid, req.std_num);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'getEmploymentByStdNum 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, data: null, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'saveEmployment') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = saveEmployment(sid, req.payload || req);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'saveEmployment 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'updateEmploymentAfter') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = updateEmploymentAfter(sid, req.std_num, req.payload || {});
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'updateEmploymentAfter 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'getFieldList') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = getFieldList(sid);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'getFieldList 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, data: [], message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'createField') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = createField(sid, req.field_num, req.field_name, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'createField 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'updateField') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = updateField(sid, req.field_num, req.field_name, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'updateField 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'deleteField') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = deleteField(sid, req.field_num, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', 'deleteField 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // UserManagement.gs의 doPostAuthInternal 함수 호출
    const result = callUserManagementPost(req);
    
    return result;
  } catch (error) {
    logError_('Main', '메인 doPost 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '서버 오류: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== 요청 데이터 파싱 =====
function parseRequest(e) {
  // 쿼리 문자열(e.parameter)을 먼저 담고, JSON 본문으로 덮어씀 (본문 우선).
  // 이전에는 본문 후에 쿼리로 덮어써서 evidenceFolderName 등이 빈 쿼리값으로 지워질 수 있었음.
  let req = {};
  
  if (e.parameter) {
    for (const key in e.parameter) {
      if (Object.prototype.hasOwnProperty.call(e.parameter, key)) {
        req[key] = e.parameter[key];
      }
    }
  }
  
  if (e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        req = Object.assign({}, req, body);
      }
    } catch (jsonError) {
      try {
        // URL 인코딩된 형태의 요청 처리
        const params = e.postData.contents.split('&');
        for (const param of params) {
          const [key, value] = param.split('=');
          if (key && value) {
            req[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        }
      } catch (urlError) {
        logError_('Main', '요청 파싱 오류:', urlError);
      }
    }
  }
  
  return req;
}

/**
 * createLedger: { data: { ...필드 } } 형태도 지원 (본문 필드가 data 안에만 있을 때)
 * @param {Object} req
 * @returns {Object}
 */
function flattenCreateLedgerRequest_(req) {
  if (!req || typeof req !== 'object') return req;
  var nested = req.data;
  if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
    return Object.assign({}, nested, req);
  }
  return req;
}

// ===== UserManagement.gs 함수 호출 래퍼 =====
function callUserManagementPost(req) {
  try {
    // 액션 비교를 위해 정규화 (trim 및 타입 변환)
    const action = req.action ? String(req.action).trim() : '';
    
    // 관리자 관련 액션 처리 - 기존 함수들 호출
    if (action === 'getAllUsers') {
      try {
        const result = getAllUsers();
        if (!result) {
          logError_('Main', 'getAllUsers가 undefined를 반환했습니다.');
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              message: '사용자 목록 조회 중 오류가 발생했습니다.',
              users: []
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        const response = ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
        return response;
      } catch (error) {
        logError_('Main', 'getAllUsers 호출 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '사용자 목록 조회 중 오류가 발생했습니다: ' + error.message,
            users: [],
            error: error.toString()
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getPendingUsers') {
      const result = getPendingUsers();
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'approveUserWithGroup') {
      const result = approveUserWithGroup(req.studentId, req.groupRole);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'rejectUser') {
      const result = rejectUser(req.studentId);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'addUsersToSpreadsheet') {
      const result = addUsersToSpreadsheet(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'clearUserCache') {
      const result = clearUserCache();
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'sendAdminKeyEmail') {
      const result = sendAdminKeyEmail(req.userEmail);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공지사항 관련 액션 처리
    if (action === 'getAnnouncements') {
      const result = getAnnouncements(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'createAnnouncement') {
      const result = createAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'updateAnnouncement') {
      const result = updateAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'deleteAnnouncement') {
      const result = deleteAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'incrementAnnouncementView') {
      const result = incrementViewCount(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'requestPinnedAnnouncement') {
      const result = requestPinnedAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'approvePinnedAnnouncement') {
      const result = approvePinnedAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getPinnedAnnouncementRequests') {
      const result = getPinnedAnnouncementRequests(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getAnnouncementUserList') {
      const result = getUserList();
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          users: result
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 워크플로우 관련 액션 처리
    if (action === 'requestWorkflow') {
      try {
        // 워크플로우 스프레드시트 초기화
        initializeWorkflowSheets();
        const result = requestWorkflow(req);
        
        // 성공 응답에 디버그 정보 포함
        return ContentService
          .createTextOutput(JSON.stringify({
            ...result,
            debug: {
              actionReceived: req.action,
              actionType: typeof req.action,
              actionTrimmed: action,
              hasRequesterEmail: !!req.requesterEmail,
              hasReviewLine: !!req.reviewLine,
              reviewLineLength: req.reviewLine ? req.reviewLine.length : 0,
              hasPaymentLine: !!req.paymentLine,
              paymentLineLength: req.paymentLine ? req.paymentLine.length : 0,
              requestKeys: Object.keys(req)
            }
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        // 에러 응답에 상세 디버그 정보 포함
        return ContentService
          .createTextOutput(JSON.stringify({ 
            success: false, 
            message: '워크플로우 요청 처리 중 오류가 발생했습니다: ' + error.message,
            error: error.toString(),
            stack: error.stack,
            debug: {
              actionReceived: req.action,
              actionType: typeof req.action,
              actionTrimmed: action,
              hasRequesterEmail: !!req.requesterEmail,
              hasReviewLine: !!req.reviewLine,
              reviewLineLength: req.reviewLine ? req.reviewLine.length : 0,
              hasPaymentLine: !!req.paymentLine,
              paymentLineLength: req.paymentLine ? req.paymentLine.length : 0,
              requestKeys: Object.keys(req),
              requestData: JSON.stringify(req)
            }
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'grantWorkflowPermissions') {
      try {
        let documentId = null;
        if (req.documentId) {
          documentId = req.documentId;
        } else if (req.workflowDocumentId) {
          documentId = req.workflowDocumentId;
        } else if (req.attachedDocumentId) {
          documentId = req.attachedDocumentId;
        }
        
        if (!documentId) {
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              message: '문서 ID가 필요합니다 (documentId, workflowDocumentId, 또는 attachedDocumentId 중 하나)'
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        
        const result = grantWorkflowPermissions(
          documentId,
          req.userEmails || [],
          req.permissionType || 'reader'
        );
        
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            message: `권한 부여 완료: 성공 ${result.successCount}명, 실패 ${result.failCount}명`,
            data: result
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 권한 부여 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '권한 부여 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowStatus') {
      try {
        initializeWorkflowSheets();
        const result = getWorkflowStatus(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 상태 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 상태 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyPendingWorkflows') {
      try {
        initializeWorkflowSheets();
        const result = getMyPendingWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '내 담당 워크플로우 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내 담당 워크플로우 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyRequestedWorkflows') {
      try {
        initializeWorkflowSheets();
        const result = getMyRequestedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '내가 올린 결재 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내가 올린 결재 목록 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getCompletedWorkflows') {
      try {
        initializeWorkflowSheets();
        const result = getCompletedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 완료된 리스트 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 완료된 리스트 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 검토 단계 액션
    if (action === 'approveReview') {
      try {
        initializeWorkflowSheets();
        const result = approveReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '검토 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectReview') {
      try {
        initializeWorkflowSheets();
        const result = rejectReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '검토 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdReview') {
      try {
        initializeWorkflowSheets();
        const result = holdReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '검토 보류 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 보류 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 결재 단계 액션
    if (action === 'approvePayment') {
      try {
        initializeWorkflowSheets();
        const result = approvePayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectPayment') {
      try {
        initializeWorkflowSheets();
        const result = rejectPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdPayment') {
      try {
        initializeWorkflowSheets();
        const result = holdPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 보류 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 보류 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'resubmitWorkflow') {
      try {
        initializeWorkflowSheets();
        const result = resubmitWorkflow(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 재제출 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 재제출 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowHistory') {
      try {
        initializeWorkflowSheets();
        const result = getWorkflowHistory(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 히스토리 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 히스토리 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 워크플로우 관련 액션 처리
    if (action === 'requestWorkflow') {
      try {
        // 워크플로우 스프레드시트 초기화
        initializeWorkflowSheets();
        const result = requestWorkflow(req);
        
        // 성공 응답에 디버그 정보 포함
        return ContentService
          .createTextOutput(JSON.stringify({
            ...result,
            debug: {
              actionReceived: req.action,
              actionType: typeof req.action,
              actionTrimmed: action,
              hasRequesterEmail: !!req.requesterEmail,
              hasReviewLine: !!req.reviewLine,
              reviewLineLength: req.reviewLine ? req.reviewLine.length : 0,
              hasPaymentLine: !!req.paymentLine,
              paymentLineLength: req.paymentLine ? req.paymentLine.length : 0,
              requestKeys: Object.keys(req)
            }
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        // 에러 응답에 상세 디버그 정보 포함
        return ContentService
          .createTextOutput(JSON.stringify({ 
            success: false, 
            message: '워크플로우 요청 처리 중 오류가 발생했습니다: ' + error.message,
            error: error.toString(),
            stack: error.stack,
            debug: {
              actionReceived: req.action,
              actionType: typeof req.action,
              actionTrimmed: action,
              hasRequesterEmail: !!req.requesterEmail,
              hasReviewLine: !!req.reviewLine,
              reviewLineLength: req.reviewLine ? req.reviewLine.length : 0,
              hasPaymentLine: !!req.paymentLine,
              paymentLineLength: req.paymentLine ? req.paymentLine.length : 0,
              requestKeys: Object.keys(req),
              requestData: JSON.stringify(req)
            }
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'grantWorkflowPermissions') {
      try {
        let documentId = null;
        if (req.documentId) {
          documentId = req.documentId;
        } else if (req.workflowDocumentId) {
          documentId = req.workflowDocumentId;
        } else if (req.attachedDocumentId) {
          documentId = req.attachedDocumentId;
        }
        
        if (!documentId) {
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              message: '문서 ID가 필요합니다 (documentId, workflowDocumentId, 또는 attachedDocumentId 중 하나)'
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        
        const result = grantWorkflowPermissions(
          documentId,
          req.userEmails || [],
          req.permissionType || 'reader'
        );
        
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            message: `권한 부여 완료: 성공 ${result.successCount}명, 실패 ${result.failCount}명`,
            data: result
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 권한 부여 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '권한 부여 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowStatus') {
      try {
        initializeWorkflowSheets();
        const result = getWorkflowStatus(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 상태 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 상태 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyPendingWorkflows') {
      try {
        initializeWorkflowSheets();
        const result = getMyPendingWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '내 담당 워크플로우 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내 담당 워크플로우 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyRequestedWorkflows') {
      try {
        initializeWorkflowSheets();
        const result = getMyRequestedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '내가 올린 결재 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내가 올린 결재 목록 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getCompletedWorkflows') {
      try {
        initializeWorkflowSheets();
        const result = getCompletedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 완료된 리스트 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 완료된 리스트 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 검토 단계 액션
    if (action === 'approveReview') {
      try {
        initializeWorkflowSheets();
        const result = approveReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '검토 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectReview') {
      try {
        initializeWorkflowSheets();
        const result = rejectReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '검토 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdReview') {
      try {
        initializeWorkflowSheets();
        const result = holdReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '검토 보류 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 보류 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 결재 단계 액션
    if (action === 'approvePayment') {
      try {
        initializeWorkflowSheets();
        const result = approvePayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectPayment') {
      try {
        initializeWorkflowSheets();
        const result = rejectPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdPayment') {
      try {
        initializeWorkflowSheets();
        const result = holdPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '결재 보류 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 보류 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'resubmitWorkflow') {
      try {
        initializeWorkflowSheets();
        const result = resubmitWorkflow(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 재제출 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 재제출 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowHistory') {
      try {
        initializeWorkflowSheets();
        const result = getWorkflowHistory(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 히스토리 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 히스토리 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 워크플로우 템플릿 관리
    if (action === 'createWorkflowTemplate') {
      try {
        initializeWorkflowSheets();
        const result = createWorkflowTemplate(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 템플릿 생성 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 생성 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowTemplates') {
      try {
        initializeWorkflowSheets();
        const result = getWorkflowTemplates(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 템플릿 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 목록 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'updateWorkflowTemplate') {
      try {
        initializeWorkflowSheets();
        const result = updateWorkflowTemplate(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 템플릿 수정 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 수정 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'deleteWorkflowTemplate') {
      try {
        initializeWorkflowSheets();
        const result = deleteWorkflowTemplate(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        logError_('Main', '워크플로우 템플릿 삭제 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 삭제 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        message: '알 수 없는 액션입니다: ' + req.action,
        debug: {
          receivedAction: req.action,
          actionTrimmed: action,
          allActions: [
            'getAllUsers',
            'getPendingUsers',
            'approveUserWithGroup',
            'rejectUser',
            'clearUserCache',
            'sendAdminKeyEmail',
            'requestWorkflow',
            'grantWorkflowPermissions',
            'getWorkflowStatus',
            'getMyPendingWorkflows',
            'getMyRequestedWorkflows',
            'getCompletedWorkflows',
            'approveReview',
            'rejectReview',
            'holdReview',
            'approvePayment',
            'rejectPayment',
            'holdPayment',
            'resubmitWorkflow',
            'getWorkflowHistory',
            'createWorkflowTemplate',
            'getWorkflowTemplates',
            'updateWorkflowTemplate',
            'deleteWorkflowTemplate'
          ],
          requestKeys: Object.keys(req),
          requestActionType: typeof req.action,
          requestActionValue: String(req.action)
        }
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    logError_('Main', 'UserManagement.gs 호출 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '인증 처리 오류: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== GET 요청 처리 =====
function doGet(e) {
  try {
    
    // UserManagement.gs의 doGetAuthInternal 함수 호출
    return callUserManagementGet(e);
  } catch (error) {
    logError_('Main', '메인 doGet 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '서버 오류: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== UserManagement.gs GET 함수 호출 래퍼 =====
function callUserManagementGet(e) {
  try {
    // 간단한 연결 테스트 응답
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Hot Potato App Script is running',
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    logError_('Main', 'UserManagement.gs GET 호출 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'GET 처리 오류: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== 유틸리티 함수들 =====
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 테스트 함수 =====
function testMain() {
  
  // 테스트 요청 데이터
  const testReq = {
    action: 'test',
    message: '메인 함수 테스트'
  };
  
  try {
    const result = callUserManagementPost(testReq);
    return result;
  } catch (error) {
    logError_('Main', '테스트 오류:', error);
    return { success: false, message: '테스트 실패: ' + error.message };
  }
}

// ===== 문서 생성 함수들 =====

/**
 * 문서를 공유 폴더로 이동
 * @param {string} documentId - 문서 ID
 * @returns {Object} 이동 결과
 */
function moveDocumentToSharedFolder(documentId) {
  try {
    
    // DriveApp API 확인
    if (typeof DriveApp === 'undefined') {
      logError_('Main', 'DriveApp API가 정의되지 않았습니다');
      return {
        success: false,
        message: 'DriveApp API가 활성화되지 않았습니다.'
      };
    }
    
    // 문서 가져오기
    const file = DriveApp.getFileById(documentId);
    
    // 폴더 경로: 환경변수 또는 기본값 사용
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const documentFolderName = PropertiesService.getScriptProperties().getProperty('DOCUMENT_FOLDER_NAME') || 'document';
    const sharedFolderName = PropertiesService.getScriptProperties().getProperty('SHARED_DOCUMENT_FOLDER_NAME') || 'shared_documents';
    const targetFolder = findOrCreateFolderPath([rootFolderName, documentFolderName, sharedFolderName]);
    
    if (!targetFolder) {
      logError_('Main', '대상 폴더를 찾을 수 없습니다');
      return {
        success: false,
        message: '대상 폴더를 찾을 수 없습니다.'
      };
    }
    
    // 문서를 폴더로 이동
    file.moveTo(targetFolder);
    logDebug_('Main', '문서가 공유 폴더로 이동되었습니다:', targetFolder.getName());
    
    return {
      success: true,
      message: '문서가 공유 폴더로 이동되었습니다.'
    };
    
  } catch (error) {
    logError_('Main', '문서 폴더 이동 오류:', error);
    return {
      success: false,
      message: '문서 폴더 이동 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 문서를 공유 폴더로 이동 (DocumentFolder 모듈 사용)
 * @param {string} documentId - 문서 ID
 * @returns {Object} 이동 결과
 */
function moveDocumentToSharedFolderWithModule(documentId) {
  try {
    
    // 문서 가져오기
    const file = DriveApp.getFileById(documentId);
    
    // 폴더 경로: 환경변수 또는 기본값 사용
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const documentFolderName = PropertiesService.getScriptProperties().getProperty('DOCUMENT_FOLDER_NAME') || 'document';
    const sharedFolderName = PropertiesService.getScriptProperties().getProperty('SHARED_DOCUMENT_FOLDER_NAME') || 'shared_documents';
    const folderPath = rootFolderName + '/' + documentFolderName + '/' + sharedFolderName;
    const targetFolder = DocumentFolder.findOrCreateFolder(folderPath);
    
    if (!targetFolder) {
      logError_('Main', '대상 폴더를 찾을 수 없습니다');
      return {
        success: false,
        message: '대상 폴더를 찾을 수 없습니다.'
      };
    }
    
    // 문서를 폴더로 이동
    file.moveTo(targetFolder);
    logDebug_('Main', '문서가 공유 폴더로 이동되었습니다:', targetFolder.getName());
    
    return {
      success: true,
      message: '문서가 공유 폴더로 이동되었습니다.'
    };
    
  } catch (error) {
    logError_('Main', '문서 폴더 이동 오류:', error);
    return {
      success: false,
      message: '문서 폴더 이동 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 폴더 경로를 찾거나 생성 (직접 구현)
 * @param {Array} folderPath - 폴더 경로 배열
 * @returns {Object} 폴더 객체 또는 null
 */
function findOrCreateFolderPath(folderPath) {
  try {
    logDebug_('Main', '폴더 경로 찾기/생성:', folderPath);
    
    let currentFolder = DriveApp.getRootFolder();
    
    for (const folderName of folderPath) {
      const folders = currentFolder.getFoldersByName(folderName);
      
      if (folders.hasNext()) {
        currentFolder = folders.next();
        logDebug_('Main', '기존 폴더 발견:', folderName);
      } else {
        currentFolder = currentFolder.createFolder(folderName);
        logDebug_('Main', '새 폴더 생성:', folderName);
      }
    }
    
    return currentFolder;
    
  } catch (error) {
    logError_('Main', '폴더 경로 생성 오류:', error);
    return null;
  }
}

/**
 * Google 문서 생성 (직접 구현 - 백업용)
 * @param {string} title - 문서 제목
 * @param {string} templateType - 템플릿 타입 또는 documentId
 * @returns {Object} 생성 결과
 */
function createGoogleDocumentDirect(title, templateType) {
  try {
    
    // DriveApp API 확인
    if (typeof DriveApp === 'undefined') {
      logError_('Main', 'DriveApp API가 정의되지 않았습니다');
      return {
        success: false,
        message: 'DriveApp API가 활성화되지 않았습니다. Google Apps Script에서 DriveApp API를 활성화해주세요.'
      };
    }
    
    // 빈 문서인 경우
    if (templateType === 'empty' || !templateType) {
      logDebug_('Main', '빈 문서 생성 (템플릿 없음)');
      const file = DriveApp.createFile(Blob.createFromString(''), MimeType.GOOGLE_DOCS);
      file.setName(title);
      
      return {
        success: true,
        data: {
          id: file.getId(),
          name: title,
          webViewLink: file.getUrl()
        }
      };
    }
    // templateType이 documentId인 경우 (템플릿 복사)
    else if (templateType && templateType.length > 20 && !templateType.includes('http')) {
      logDebug_('Main', '커스텀 템플릿 복사 시도:', templateType);
      
      try {
        // 기존 문서를 복사
        const templateFile = DriveApp.getFileById(templateType);
        const copiedFile = templateFile.makeCopy(title);
        
        return {
          success: true,
          data: {
            id: copiedFile.getId(),
            name: title,
            webViewLink: copiedFile.getUrl()
          }
        };
      } catch (copyError) {
        logError_('Main', '템플릿 복사 실패:', copyError);
        // 복사 실패 시 빈 문서로 생성
        logWarn_('Main', '복사 실패로 빈 문서 생성 시도');
        const file = DriveApp.createFile(Blob.createFromString(''), MimeType.GOOGLE_DOCS);
        file.setName(title);
        
        return {
          success: true,
          data: {
            id: file.getId(),
            name: title,
            webViewLink: file.getUrl()
          }
        };
      }
    }
    
    // 기본 문서 생성
    logDebug_('Main', '빈 문서 생성 시도');
    const file = DriveApp.createFile(Blob.createFromString(''), MimeType.GOOGLE_DOCS);
    file.setName(title);
    
    return {
      success: true,
      data: {
        id: file.getId(),
        name: title,
        webViewLink: file.getUrl()
      }
    };
    
  } catch (error) {
    logError_('Main', '문서 생성 오류:', error);
    return {
      success: false,
      message: '문서 생성 중 오류가 발생했습니다: ' + error.message
    };
  }
}


// ===== 테스트 함수들 (Encryption.gs에서 제공) =====

// ===== 백업 함수들 =====

/**
 * 문서 권한 설정 (백업용 - DocumentPermissions 모듈이 로드되지 않을 때 사용)
 */
function setDocumentPermissions(documentId, creatorEmail, editors) {
  try {
    
    // 입력 데이터 검증
    if (!documentId) {
      throw new Error('문서 ID가 필요합니다');
    }
    
    const file = DriveApp.getFileById(documentId);
    
    // 모든 사용자에게 편집 권한 부여 (생성자 + 편집자)
    const allUsers = [creatorEmail, ...(editors || [])].filter((email, index, arr) => 
      email && email.trim() !== '' && arr.indexOf(email) === index // 중복 제거
    );
    logDebug_('Main', '사용자 수:', allUsers.length);
    
    if (allUsers.length === 0) {
      logWarn_('Main', '권한 부여할 사용자가 없습니다');
      return {
        success: true,
        message: '권한 부여할 사용자가 없습니다',
        grantedUsers: [],
        currentEditors: []
      };
    }
    
    // 권한 설정 전 현재 상태 확인 (Drive API 사용)
    const beforePermissions = Drive.Permissions.list(documentId);
    const beforePermissionsList = beforePermissions.items || [];
    
    let successCount = 0;
    let failCount = 0;
    
    // 각 사용자에게 편집 권한 부여 (Drive API - 메일 알림 없음)
    for (const userEmail of allUsers) {
      try {
        
        // 이미 권한이 있는지 확인
        const hasPermission = beforePermissionsList.some(p => p.emailAddress === userEmail && p.role === 'writer');
        if (hasPermission) {
          successCount++;
          continue;
        }
        
        // 권한 부여 (메일 알림 없이)
        Drive.Permissions.insert({
          role: 'writer',
          type: 'user',
          value: userEmail,
          sendNotificationEmails: false
        }, documentId);
        successCount++;
        
        // 잠시 대기 (API 제한 방지)
        Utilities.sleep(100);
        
      } catch (permError) {
        logError_('Main', '권한 설정 실패:', permError.message);
        failCount++;
      }
    }
    
    // 권한 설정 후 결과 확인
    const afterPermissions = Drive.Permissions.list(documentId);
    const afterPermissionsList = afterPermissions.items || [];
    
    const result = {
      success: successCount > 0,
      message: `권한 설정 완료: 성공 ${successCount}명, 실패 ${failCount}명`,
      grantedUsers: allUsers,
      currentEditors: afterPermissionsList.map(p => p.emailAddress),
      successCount: successCount,
      failCount: failCount
    };
    return result;
    
  } catch (error) {
    logError_('Main', '문서 권한 설정 오류:', error);
    return {
      success: false,
      message: '문서 권한 설정 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 테스트 함수들 =====

/**
 * 권한 설정 테스트 함수
 */
function testDocumentPermissions() {
  try {
    
    // 테스트용 문서 ID (실제 문서 ID로 변경 필요)
    const testDocumentId = '1oqY3J_1zPuHfGn61SPDM0-72tvYSavjorciAl9fHpbA';
    const testCreatorEmail = 'khk213624@gmail.com';
    const testEditors = ['ach021105@gmail.com', 'answnsdud1004@gmail.com'];
    
    // DocumentPermissions 모듈 확인
    if (typeof DocumentPermissions !== 'undefined') {
      logDebug_('Main', 'DocumentPermissions 모듈 사용 가능');
      const result = DocumentPermissions.setDocumentPermissions(testDocumentId, testCreatorEmail, testEditors);
      return result;
    } else {
      logError_('Main', 'DocumentPermissions 모듈이 로드되지 않았습니다');
      return {
        success: false,
        message: 'DocumentPermissions 모듈이 로드되지 않았습니다'
      };
    }
    
  } catch (error) {
    logError_('Main', '테스트 오류:', error);
    return {
      success: false,
      message: '테스트 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getDeploymentInfo() {
  return {
    version: '1.16.0',
    description: '메인 엔트리 포인트 - 요청 라우팅 및 함수 호출만 담당',
    functions: [
      'doPost',
      'doGet', 
      'parseRequest',
      'callUserManagementPost',
      'callUserManagementGet',
      'testMain',
      'verifyAdminKeyData'
    ],
  dependencies: [
    'UserAuth.gs',
    'UserApproval.gs',
    'UserRegistration.gs',
    'SpreadsheetCore.gs',
    'SpreadsheetCache.gs',
    'SpreadsheetUtils.gs',
    'CONFIG.gs',
    'EncryptionCore.gs',
    'EncryptionAlgorithms.gs',
    'EncryptionKeyManagement.gs',
    'EncryptionEmail.gs',
    'DocumentTemplates.gs',
    'DocumentTests.gs',
    'DocumentCreation.gs',
    'DocumentPermissions.gs',
    'DocumentFolder.gs',
    'DocumentSpreadsheet.gs',
    'KeyVerification.gs',
    'KeyGeneration.gs',
    'TimeUtils.gs',
    'TestBasic.gs',
    'TestSpreadsheet.gs',
    'TestUserManagement.gs',
    'TestDocumentManagement.gs',
    'MigrationVerification.gs',
    'OptimizationVerification.gs',
    'ComprehensiveVerification.gs'
  ],
    notes: [
      '문서 생성: DocumentCreation.gs에서 처리',
      '문서 권한: DocumentPermissions.gs에서 처리',
      '폴더 관리: DocumentFolder.gs에서 처리',
      '스프레드시트: DocumentSpreadsheet.gs에서 처리',
      '템플릿 관리: DocumentTemplates.gs에서 처리',
      '테스트: DocumentTests.gs에서 처리',
      '암호화 핵심: EncryptionCore.gs에서 처리',
      '암호화 알고리즘: EncryptionAlgorithms.gs에서 처리',
      '암호화 키 관리: EncryptionKeyManagement.gs에서 처리',
      '이메일 암호화: EncryptionEmail.gs에서 처리',
      '사용자 인증: UserAuth.gs에서 처리',
      '사용자 승인: UserApproval.gs에서 처리',
      '사용자 등록: UserRegistration.gs에서 처리',
      '스프레드시트 핵심: SpreadsheetCore.gs에서 처리',
      '스프레드시트 캐시: SpreadsheetCache.gs에서 처리',
      '스프레드시트 유틸: SpreadsheetUtils.gs에서 처리',
      '키 검증: KeyVerification.gs에서 처리',
      '키 생성: KeyGeneration.gs에서 처리',
      '시간 유틸: TimeUtils.gs에서 처리',
      '설정: CONFIG.gs에서 관리',
      '기본 테스트: TestBasic.gs에서 처리',
      '스프레드시트 테스트: TestSpreadsheet.gs에서 처리',
      '사용자 관리 테스트: TestUserManagement.gs에서 처리',
      '문서 관리 테스트: TestDocumentManagement.gs에서 처리',
      '마이그레이션 검증: MigrationVerification.gs에서 처리',
      '최적화 확인: OptimizationVerification.gs에서 처리',
      '종합 검증: ComprehensiveVerification.gs에서 처리'
    ]
  };
}

// ===== 사용자 인증 관련 함수들 =====

/**
 * 사용자 등록 상태 확인
 * @param {string} email - 사용자 이메일
 * @returns {Object} 등록 상태 확인 결과
 */
function handleCheckRegistrationStatus(email) {
  try {
    
    if (!email) {
      return {
        success: false,
        message: '이메일이 필요합니다.'
      };
    }
    
    // UserAuth.gs의 checkUserStatus 함수 사용
    const result = checkUserStatus(email);
    
    if (result.success) {
      const userData = result.data;
      return {
        success: true,
        isRegistered: userData.status !== 'not_registered',
        isApproved: userData.status === 'approved',
        approvalStatus: userData.status,
        studentId: userData.user ? userData.user.student_id : '',
        user: userData.user
      };
    } else {
      return {
        success: false,
        isRegistered: false,
        isApproved: false,
        approvalStatus: 'not_requested',
        studentId: '',
        message: result.message
      };
    }
    
  } catch (error) {
    logError_('Main', '사용자 등록 상태 확인 오류:', error);
    return {
      success: false,
      isRegistered: false,
      isApproved: false,
      approvalStatus: 'not_requested',
      studentId: '',
      message: '사용자 상태 확인 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 사용자 등록 요청 처리
 * @param {Object} req - 등록 요청 데이터
 * @returns {Object} 등록 결과
 */
function handleSubmitRegistrationRequest(req) {
  try {
    
    // UserRegistration.gs의 submitRegistrationRequest 함수 사용
    const result = submitRegistrationRequest(req);
    
    return result;
    
  } catch (error) {
    logError_('Main', '사용자 등록 요청 처리 오류:', error);
    return {
      success: false,
      message: '사용자 등록 요청 처리 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 관리자 키 검증
 */
function verifyAdminKeyData(adminKey) {
  try {
    
    // 관리자 키 검증 로직 (기존 KeyManagement.gs 활용)
    const isValid = verifyAdminKey(adminKey);
    
    return {
      success: isValid,
      isValid: isValid,
      message: isValid ? '유효한 관리자 키입니다' : '유효하지 않은 관리자 키입니다'
    };
    
  } catch (error) {
    logError_('Main', '관리자 키 검증 오류');
    return { success: false, isValid: false, error: error.message };
  }
}

/**
 * 일일 관리자 키 갱신 트리거 함수
 * 매일 자정에 자동으로 실행되어 관리자 키를 갱신합니다.
 */
function handleDailyKeyUpdate() {
  try {
    logDebug_('Main', '실행 시간:', new Date().toISOString());
    const keyResult = generateNewAdminKey();
    
    if (!keyResult.success) {
      throw new Error('관리자 키 생성 실패: ' + keyResult.message);
    }
    logDebug_('Main', '사용된 레이어');
    const backupResult = createKeyBackup(keyResult.key, keyResult.layers);
    
    if (backupResult.success) {
    } else {
      logWarn_('Main', '키 백업 생성 실패');
    }
    const updateResult = updateAdminKey(keyResult.key, keyResult.layers);
    
    if (!updateResult.success) {
      throw new Error('키 업데이트 실패: ' + updateResult.message);
    }
    logDebug_('Main', '레이어');
    
    return {
      success: true,
      message: '관리자 키가 성공적으로 갱신되었습니다.',
      key: keyResult.key,
      layers: keyResult.layers,
      timestamp: updateResult.timestamp,
      backupCreated: backupResult.success
    };
    
  } catch (error) {
    logError_('Main', '일일 관리자 키 갱신 실패');
    logError_('Main', '오류 상세:', error.message);
    logError_('Main', '스택 트레이스:', error.stack);
    
    // 오류 발생 시 이메일 알림 (선택사항)
    try {
      const errorMessage = `
일일 관리자 키 갱신에 실패했습니다.

오류: ${error.message}
시간: ${new Date().toISOString()}

시스템 관리자에게 문의하세요.
      `;
      
      // 관리자 이메일로 오류 알림 (필요시)
      // GmailApp.sendEmail('admin@example.com', '관리자 키 갱신 실패', errorMessage);
      
    } catch (emailError) {
      logError_('Main', '이메일 알림 전송 실패');
    }
    
    return {
      success: false,
      message: '관리자 키 갱신에 실패했습니다: ' + error.message,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
