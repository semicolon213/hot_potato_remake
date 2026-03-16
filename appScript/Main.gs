/**
 * Main.gs
 * 메인 엔트리 포인트 - UserManagement.gs 연동
 * Hot Potato Admin Key Management System
 */

// ===== 메인 엔트리 포인트 =====
function doPost(e) {
  try {
    console.log('🚀 === 메인 doPost 시작 ===');
    console.log('📥 요청 데이터:', e);
    
    // 요청 데이터 파싱
    const req = parseRequest(e);
    console.log('📋 파싱된 요청:', req);
    console.log('🎯 액션:', req.action);
    
    // 암복호화 액션 처리
    if (req.action === 'encryptEmail') {
      console.log('🔐 암호화 요청 받음:', req.data);
      try {
        const encrypted = encryptEmailMain(req.data);
        console.log('🔐 암호화 결과:', encrypted);
        const response = {
          success: true, 
          data: encrypted,
          debug: {
            original: req.data,
            encrypted: encrypted,
            source: 'Encryption.gs encryptEmailMain',
            timestamp: new Date().toISOString()
          }
        };
        console.log('🔐 최종 응답:', response);
        return ContentService
          .createTextOutput(JSON.stringify(response))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('🔐 암호화 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: '암호화 중 오류가 발생했습니다: ' + error.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'decryptEmail') {
      console.log('🔓 복호화 요청 받음:', req.data);
      try {
        const decrypted = decryptEmailMain(req.data);
        console.log('🔓 복호화 결과:', decrypted);
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, data: decrypted }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('🔓 복호화 오류:', error);
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
        console.log('🔓 일괄 복호화 완료:', values.length, '개');
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, data: decrypted }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('🔓 일괄 복호화 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, message: '복호화 중 오류가 발생했습니다: ' + error.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 문서 생성 액션 처리
    if (req.action === 'createDocument') {
      console.log('📄 문서 생성 요청 받음:', req);
      
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
          console.log('✅ DocumentCreation 모듈 사용');
          document = DocumentCreation.createGoogleDocument(title, templateType);
        } else {
          console.log('⚠️ DocumentCreation 모듈 로드 실패, 직접 함수 호출');
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
          console.log('🔐 권한 설정 시작 - 전달된 데이터:', { documentId, creatorEmail, editors });
          
          // 입력 데이터 검증
          if (!documentId) {
            throw new Error('문서 ID가 필요합니다');
          }
          
          const file = DriveApp.getFileById(documentId);
          console.log('📄 문서 정보:', { id: file.getId(), name: file.getName() });
          
          // 모든 사용자에게 편집 권한 부여 (생성자 + 편집자)
          const allUsers = [creatorEmail, ...(editors || [])].filter((email, index, arr) => 
            email && email.trim() !== '' && arr.indexOf(email) === index // 중복 제거
          );
          
          console.log('🔐 권한 부여할 사용자 목록:', allUsers);
          console.log('🔐 사용자 수:', allUsers.length);
          
          if (allUsers.length === 0) {
            console.warn('⚠️ 권한 부여할 사용자가 없습니다');
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
            console.log('🔐 권한 설정 전 편집자:', beforePermissionsList.map(p => p.emailAddress));
            
            let successCount = 0;
            let failCount = 0;
            
            // 각 사용자에게 편집 권한 부여 (Drive API - 메일 알림 없음)
            for (const userEmail of allUsers) {
              try {
                console.log('🔐 권한 부여 시도:', userEmail);
                
                // 이미 권한이 있는지 확인
                const hasPermission = beforePermissionsList.some(p => p.emailAddress === userEmail && p.role === 'writer');
                if (hasPermission) {
                  console.log('✅ 이미 권한이 있는 사용자:', userEmail);
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
                console.log('✅ 편집 권한 부여 완료 (메일 알림 없음):', userEmail);
                successCount++;
                
                // 잠시 대기 (API 제한 방지)
                Utilities.sleep(100);
                
              } catch (permError) {
                console.error('❌ 권한 설정 실패:', userEmail, permError.message);
                failCount++;
              }
            }
            
            // 권한 설정 후 결과 확인
            const afterPermissions = Drive.Permissions.list(documentId);
            const afterPermissionsList = afterPermissions.items || [];
            console.log('🔐 권한 설정 후 편집자:', afterPermissionsList.map(p => p.emailAddress));
            
            permissionResult = {
              success: successCount > 0,
              message: `권한 설정 완료: 성공 ${successCount}명, 실패 ${failCount}명`,
              grantedUsers: allUsers,
              currentEditors: afterPermissionsList.map(p => p.emailAddress),
              successCount: successCount,
              failCount: failCount
            };
            
            console.log('🔐 최종 권한 설정 결과:', permissionResult);
          }
          
        } catch (permissionError) {
          console.error('❌ 문서 권한 설정 실패:', permissionError);
          permissionResult = {
            success: false,
            message: '권한 설정 중 오류가 발생했습니다: ' + permissionError.message
          };
        }
        
        // 문서를 지정된 폴더로 이동
        try {
          if (typeof DocumentFolder !== 'undefined' && typeof DocumentFolder.findOrCreateFolder === 'function') {
            console.log('✅ DocumentFolder 모듈 사용');
            moveDocumentToSharedFolderWithModule(documentId);
          } else {
            console.log('⚠️ DocumentFolder 모듈 로드 실패, 직접 함수 호출');
            moveDocumentToSharedFolder(documentId);
          }
        } catch (moveError) {
          console.warn('문서 폴더 이동 실패:', moveError);
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
        
        console.log('📄 문서 생성 결과:', result);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
          
      } catch (error) {
        console.error('📄 문서 생성 오류:', error);
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
      console.log('📄 문서 목록 조회 요청 받음:', req);
      const result = (typeof handleGetDocuments === 'function') ? handleGetDocuments(req) : (typeof DocumentSpreadsheet !== 'undefined' && DocumentSpreadsheet.handleGetDocuments ? DocumentSpreadsheet.handleGetDocuments(req) : { success: false, message: 'DocumentSpreadsheet is not defined' });
      console.log('📄 문서 목록 조회 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 공유 템플릿 업로드(파일 업로드 + 메타데이터 저장)
    if (req.action === 'uploadSharedTemplate') {
      console.log('📄 공유 템플릿 업로드 요청:', { name: req.fileName, mimeType: req.fileMimeType });
      const result = uploadSharedTemplate(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 공유 문서 업로드(파일 업로드 + 권한 설정 + 폴더 이동)
    if (req.action === 'uploadSharedDocument') {
      console.log('📤 공유 문서 업로드 요청:', { name: req.fileName, mimeType: req.fileMimeType });
      const result = uploadSharedDocument(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공유 템플릿 메타데이터 수정
    if (req.action === 'updateSharedTemplateMeta') {
      console.log('🛠️ 공유 템플릿 메타 수정 요청:', { id: req.fileId });
      const result = updateSharedTemplateMeta(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공유 템플릿 목록(메타데이터 우선) 조회
    if (req.action === 'getSharedTemplates') {
      console.log('📄 공유 템플릿 목록 요청');
      const result = getSharedTemplates();
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공유 템플릿 삭제
    if (req.action === 'deleteSharedTemplate') {
      console.log('🗑️ 공유 템플릿 삭제 요청:', { id: req.fileId });
      const result = deleteSharedTemplate(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 스프레드시트 ID 목록 조회
    if (req.action === 'getSpreadsheetIds') {
      console.log('📊 스프레드시트 ID 목록 조회 요청:', req);
      const result = getSpreadsheetIds(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 목록 조회
    if (req.action === 'getStaticTags') {
      console.log('🏷️ 기본 태그 목록 조회 요청:', req);
      const result = getStaticTags(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 추가
    if (req.action === 'addStaticTag') {
      console.log('🏷️ 기본 태그 추가 요청:', req);
      const result = addStaticTag(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 수정
    if (req.action === 'updateStaticTag') {
      console.log('🏷️ 기본 태그 수정 요청:', req);
      const result = updateStaticTag(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 태그 삭제
    if (req.action === 'deleteStaticTag') {
      console.log('🏷️ 기본 태그 삭제 요청:', req);
      const result = deleteStaticTag(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 문서 삭제 액션 처리
    if (req.action === 'deleteDocuments') {
      console.log('🗑️ 문서 삭제 요청 받음:', req);
      const result = (typeof handleDeleteDocuments === 'function') ? handleDeleteDocuments(req) : (typeof DocumentSpreadsheet !== 'undefined' && DocumentSpreadsheet.handleDeleteDocuments ? DocumentSpreadsheet.handleDeleteDocuments(req) : { success: false, message: 'DocumentSpreadsheet is not defined' });
      console.log('🗑️ 문서 삭제 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 템플릿 목록 조회 액션 처리
    if (req.action === 'getTemplates') {
      console.log('📄 템플릿 목록 조회 요청 받음:', req);
      
      // Drive API 확인
      if (typeof Drive === 'undefined') {
        console.error('📄 Drive API가 정의되지 않았습니다');
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
        console.log('📄 템플릿 목록 조회 결과:', result);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('📄 템플릿 목록 조회 오류:', error);
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
      console.log('🔧 Drive API 테스트 요청 받음:', req);
      
      // DocumentTests 함수 직접 호출
      try {
        const result = testDriveApiConnection();
        console.log('🔧 Drive API 테스트 결과:', result);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('🔧 Drive API 테스트 오류:', error);
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
      console.log('🔍 템플릿 폴더 디버깅 테스트 요청 받음:', req);
      try {
        const result = testTemplateFolderDebug();
        console.log('🔍 템플릿 폴더 디버깅 테스트 결과:', result);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('🔍 템플릿 폴더 디버깅 테스트 오류:', error);
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
      console.log('🔍 특정 폴더 ID 테스트 요청 받음:', req);
      try {
        const result = testSpecificFolder();
        console.log('🔍 특정 폴더 ID 테스트 결과:', result);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('🔍 특정 폴더 ID 테스트 오류:', error);
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
      console.log('👤 사용자 상태 확인 요청:', req.email);
      const result = handleCheckRegistrationStatus(req.email);
      console.log('👤 사용자 상태 확인 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 이메일로 사용자 이름 조회 액션 처리
    if (req.action === 'getUserNameByEmail') {
      console.log('👤 사용자 이름 조회 요청:', req.email);
      try {
        const result = getUserNameByEmail(req.email);
        console.log('👤 사용자 이름 조회 결과:', result);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('👤 사용자 이름 조회 오류:', error);
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
      console.log('📝 사용자 등록 요청:', req);
      const result = handleSubmitRegistrationRequest(req);
      console.log('📝 사용자 등록 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (req.action === 'verifyAdminKey') {
      console.log('🔑 관리자 키 검증 요청:', req.adminKey);
      const result = verifyAdminKeyData(req.adminKey);
      console.log('🔑 관리자 키 검증 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 인증 관련 액션 처리
    if (req.action === 'checkApprovalStatus') {
      console.log('사용자 승인 상태 확인 요청:', req.email);
      const result = checkUserStatus(req.email);
      console.log('사용자 승인 상태 확인 응답:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 회계 관련 액션
    if (req.action === 'createLedger') {
      console.log('📁 장부 생성 요청:', req);
      try {
        const result = createLedgerStructure(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 장부 생성 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '장부 생성 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'getLedgerList') {
      console.log('📋 장부 목록 조회 요청');
      try {
        const result = getLedgerList();
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            data: result
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 장부 목록 조회 오류:', error);
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
      console.log('👥 서브 관리자 목록 업데이트 요청:', req);
      try {
        const result = updateAccountSubManagers(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 서브 관리자 목록 업데이트 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '서브 관리자 목록 업데이트 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (req.action === 'getAccountingFolderId') {
      console.log('📁 회계 폴더 ID 조회 요청');
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
        console.error('❌ 회계 폴더 ID 조회 오류:', error);
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
      console.log('📊 장부 카테고리 조회 요청:', req.spreadsheetId);
      try {
        const categories = getAccountingCategories(req.spreadsheetId);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            data: categories
          }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 장부 카테고리 조회 오류:', error);
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
      console.log('📚 학생 유급 여부 조회 요청:', req);
      try {
        const result = getStudentRetainedStatus(req.studentId, req.spreadsheetId);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 학생 유급 여부 조회 오류:', error);
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
      console.log('📚 학생 유급 여부 업데이트 요청:', req);
      try {
        const result = updateStudentRetained(req.studentId, req.spreadsheetId, req.isRetained);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 학생 유급 여부 업데이트 오류:', error);
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
        console.error('❌ getGraduationGrade 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // 졸업 학년 설정 (조교만)
    if (req.action === 'setGraduationGrade') {
      try {
        const result = setGraduationGrade(req.spreadsheetId, req.grade, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ setGraduationGrade 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // 학생 학년 업데이트 (학년 관리에서 조교 수동 실행)
    if (req.action === 'updateStudentGrades') {
      console.log('📚 학생 학년 업데이트 요청:', req);
      try {
        const result = updateStudentGrades(req.spreadsheetId, req.graduationGrade, req.graduationYear, req.graduationTerm);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 학생 학년 업데이트 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '학년 업데이트 중 오류가 발생했습니다: ' + error.message
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
        console.error('validateStudentForEmployment 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'getEmploymentByStdNum') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = getEmploymentByStdNum(sid, req.std_num);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('getEmploymentByStdNum 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, data: null, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'saveEmployment') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = saveEmployment(sid, req.payload || req);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('saveEmployment 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'updateEmploymentAfter') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = updateEmploymentAfter(sid, req.std_num, req.payload || {});
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('updateEmploymentAfter 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'getFieldList') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = getFieldList(sid);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('getFieldList 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, data: [], message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'createField') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = createField(sid, req.field_num, req.field_name, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('createField 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'updateField') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = updateField(sid, req.field_num, req.field_name, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('updateField 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (req.action === 'deleteField') {
      try {
        const sid = req.spreadsheetId || getStudentSpreadsheetIdForEmployment(req.spreadsheetId);
        const result = deleteField(sid, req.field_num, req.userEmail);
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('deleteField 오류:', error);
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // UserManagement.gs의 doPostAuthInternal 함수 호출
    const result = callUserManagementPost(req);
    console.log('UserManagement.gs 응답:', result);
    
    return result;
  } catch (error) {
    console.error('메인 doPost 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '서버 오류: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== 요청 데이터 파싱 =====
function parseRequest(e) {
  let req = {};
  
  if (e.postData && e.postData.contents) {
    try {
      // JSON 형태의 요청 처리
      req = JSON.parse(e.postData.contents);
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
        console.error('요청 파싱 오류:', urlError);
        req = {};
      }
    }
  }
  
  // 쿼리 파라미터도 추가
  if (e.parameter) {
    for (const key in e.parameter) {
      if (e.parameter.hasOwnProperty(key)) {
        req[key] = e.parameter[key];
      }
    }
  }
  
  return req;
}

// ===== UserManagement.gs 함수 호출 래퍼 =====
function callUserManagementPost(req) {
  try {
    console.log('🔍 요청 액션:', req.action);
    console.log('🔍 요청 데이터 전체:', JSON.stringify(req));
    
    // 액션 비교를 위해 정규화 (trim 및 타입 변환)
    const action = req.action ? String(req.action).trim() : '';
    
    // 관리자 관련 액션 처리 - 기존 함수들 호출
    if (action === 'getAllUsers') {
      console.log('👥 모든 사용자 목록 조회 요청');
      try {
        const result = getAllUsers();
        if (!result) {
          console.error('👥 getAllUsers가 undefined를 반환했습니다.');
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              message: '사용자 목록 조회 중 오류가 발생했습니다.',
              users: [],
              pendingUsers: [],
              approvedUsers: []
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        console.log('👥 모든 사용자 목록 조회 결과:', result);
        console.log('👥 응답 타입:', typeof result);
        console.log('👥 응답 success:', result.success);
        console.log('👥 응답 users 길이:', result.users ? result.users.length : 'undefined');
        const response = ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
        console.log('👥 ContentService 응답 생성 완료');
        return response;
      } catch (error) {
        console.error('👥 getAllUsers 호출 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '사용자 목록 조회 중 오류가 발생했습니다: ' + error.message,
            users: [],
            pendingUsers: [],
            approvedUsers: [],
            error: error.toString()
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getPendingUsers') {
      console.log('👥 대기 중인 사용자 목록 조회 요청');
      const result = getPendingUsers();
      console.log('👥 대기 중인 사용자 목록 조회 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'approveUserWithGroup') {
      console.log('✅ 사용자 승인 및 그룹스 권한 설정 요청:', req.studentId, req.groupRole);
      const result = approveUserWithGroup(req.studentId, req.groupRole);
      console.log('✅ 사용자 승인 및 그룹스 권한 설정 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'rejectUser') {
      console.log('❌ 사용자 거부 요청:', req.studentId);
      const result = rejectUser(req.studentId);
      console.log('❌ 사용자 거부 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'addUsersToSpreadsheet') {
      console.log('📊 사용자 일괄 추가 요청:', req.users?.length || 0, '명');
      const result = addUsersToSpreadsheet(req);
      console.log('📊 사용자 일괄 추가 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'clearUserCache') {
      console.log('🗑️ 사용자 캐시 초기화 요청');
      const result = clearUserCache();
      console.log('🗑️ 사용자 캐시 초기화 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'sendAdminKeyEmail') {
      console.log('📧 관리자 키 이메일 전송 요청:', req.userEmail);
      const result = sendAdminKeyEmail(req.userEmail);
      console.log('📧 관리자 키 이메일 전송 결과:', result);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 공지사항 관련 액션 처리
    if (action === 'getAnnouncements') {
      console.log('📢 공지사항 목록 조회 요청:', req);
      const result = getAnnouncements(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'createAnnouncement') {
      console.log('📢 공지사항 작성 요청:', req);
      const result = createAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'updateAnnouncement') {
      console.log('📢 공지사항 수정 요청:', req);
      const result = updateAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'deleteAnnouncement') {
      console.log('📢 공지사항 삭제 요청:', req);
      const result = deleteAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'incrementAnnouncementView') {
      console.log('📢 공지사항 조회수 증가 요청:', req);
      const result = incrementViewCount(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'requestPinnedAnnouncement') {
      console.log('📌 고정 공지사항 승인 요청:', req);
      const result = requestPinnedAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'approvePinnedAnnouncement') {
      console.log('📌 고정 공지사항 승인/거절:', req);
      const result = approvePinnedAnnouncement(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getPinnedAnnouncementRequests') {
      console.log('📌 고정 공지사항 승인 대기 목록 조회:', req);
      const result = getPinnedAnnouncementRequests(req);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getAnnouncementUserList') {
      console.log('👥 공지사항 권한 설정용 사용자 목록 조회:', req);
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
      console.log('🔐 워크플로우 권한 부여:', req);
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
        console.error('❌ 워크플로우 권한 부여 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '권한 부여 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowStatus') {
      console.log('📋 워크플로우 상태 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getWorkflowStatus(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 상태 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 상태 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyPendingWorkflows') {
      console.log('📋 내 담당 워크플로우 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getMyPendingWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 내 담당 워크플로우 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내 담당 워크플로우 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyRequestedWorkflows') {
      console.log('📋 내가 올린 결재 목록 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getMyRequestedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 내가 올린 결재 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내가 올린 결재 목록 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getCompletedWorkflows') {
      console.log('📋 결재 완료된 리스트 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getCompletedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 완료된 리스트 조회 오류:', error);
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
      console.log('✅ 검토 승인:', req);
      try {
        initializeWorkflowSheets();
        const result = approveReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 검토 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectReview') {
      console.log('❌ 검토 반려:', req);
      try {
        initializeWorkflowSheets();
        const result = rejectReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 검토 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdReview') {
      console.log('⏸️ 검토 보류:', req);
      try {
        initializeWorkflowSheets();
        const result = holdReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 검토 보류 오류:', error);
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
      console.log('✅ 결재 승인:', req);
      try {
        initializeWorkflowSheets();
        const result = approvePayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectPayment') {
      console.log('❌ 결재 반려:', req);
      try {
        initializeWorkflowSheets();
        const result = rejectPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdPayment') {
      console.log('⏸️ 결재 보류:', req);
      try {
        initializeWorkflowSheets();
        const result = holdPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 보류 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 보류 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'resubmitWorkflow') {
      console.log('🔄 워크플로우 재제출:', req);
      try {
        initializeWorkflowSheets();
        const result = resubmitWorkflow(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 재제출 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 재제출 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowHistory') {
      console.log('📋 워크플로우 히스토리 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getWorkflowHistory(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 히스토리 조회 오류:', error);
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
      console.log('🔐 워크플로우 권한 부여:', req);
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
        console.error('❌ 워크플로우 권한 부여 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '권한 부여 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowStatus') {
      console.log('📋 워크플로우 상태 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getWorkflowStatus(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 상태 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 상태 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyPendingWorkflows') {
      console.log('📋 내 담당 워크플로우 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getMyPendingWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 내 담당 워크플로우 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내 담당 워크플로우 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getMyRequestedWorkflows') {
      console.log('📋 내가 올린 결재 목록 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getMyRequestedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 내가 올린 결재 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '내가 올린 결재 목록 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getCompletedWorkflows') {
      console.log('📋 결재 완료된 리스트 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getCompletedWorkflows(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 완료된 리스트 조회 오류:', error);
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
      console.log('✅ 검토 승인:', req);
      try {
        initializeWorkflowSheets();
        const result = approveReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 검토 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectReview') {
      console.log('❌ 검토 반려:', req);
      try {
        initializeWorkflowSheets();
        const result = rejectReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 검토 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '검토 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdReview') {
      console.log('⏸️ 검토 보류:', req);
      try {
        initializeWorkflowSheets();
        const result = holdReview(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 검토 보류 오류:', error);
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
      console.log('✅ 결재 승인:', req);
      try {
        initializeWorkflowSheets();
        const result = approvePayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 승인 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 승인 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'rejectPayment') {
      console.log('❌ 결재 반려:', req);
      try {
        initializeWorkflowSheets();
        const result = rejectPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 반려 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 반려 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'holdPayment') {
      console.log('⏸️ 결재 보류:', req);
      try {
        initializeWorkflowSheets();
        const result = holdPayment(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 결재 보류 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '결재 보류 처리 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'resubmitWorkflow') {
      console.log('🔄 워크플로우 재제출:', req);
      try {
        initializeWorkflowSheets();
        const result = resubmitWorkflow(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 재제출 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '워크플로우 재제출 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowHistory') {
      console.log('📋 워크플로우 히스토리 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getWorkflowHistory(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 히스토리 조회 오류:', error);
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
      console.log('📋 워크플로우 템플릿 생성:', req);
      try {
        initializeWorkflowSheets();
        const result = createWorkflowTemplate(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 템플릿 생성 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 생성 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'getWorkflowTemplates') {
      console.log('📋 워크플로우 템플릿 목록 조회:', req);
      try {
        initializeWorkflowSheets();
        const result = getWorkflowTemplates(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 템플릿 목록 조회 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 목록 조회 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'updateWorkflowTemplate') {
      console.log('📋 워크플로우 템플릿 수정:', req);
      try {
        initializeWorkflowSheets();
        const result = updateWorkflowTemplate(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 템플릿 수정 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 수정 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === 'deleteWorkflowTemplate') {
      console.log('📋 워크플로우 템플릿 삭제:', req);
      try {
        initializeWorkflowSheets();
        const result = deleteWorkflowTemplate(req);
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        console.error('❌ 워크플로우 템플릿 삭제 오류:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            message: '템플릿 삭제 중 오류가 발생했습니다: ' + error.message
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 알 수 없는 액션
    console.log('❌ 알 수 없는 액션:', req.action);
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
    console.error('UserManagement.gs 호출 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '인증 처리 오류: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== GET 요청 처리 =====
function doGet(e) {
  try {
    console.log('=== 메인 doGet 시작 ===');
    console.log('GET 요청:', e);
    
    // UserManagement.gs의 doGetAuthInternal 함수 호출
    return callUserManagementGet(e);
  } catch (error) {
    console.error('메인 doGet 오류:', error);
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
    console.error('UserManagement.gs GET 호출 오류:', error);
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
  console.log('=== 메인 테스트 시작 ===');
  
  // 테스트 요청 데이터
  const testReq = {
    action: 'test',
    message: '메인 함수 테스트'
  };
  
  try {
    const result = callUserManagementPost(testReq);
    console.log('테스트 결과:', result);
    return result;
  } catch (error) {
    console.error('테스트 오류:', error);
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
    console.log('📁 문서 폴더 이동 시작:', documentId);
    
    // DriveApp API 확인
    if (typeof DriveApp === 'undefined') {
      console.error('📁 DriveApp API가 정의되지 않았습니다');
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
      console.error('📁 대상 폴더를 찾을 수 없습니다');
      return {
        success: false,
        message: '대상 폴더를 찾을 수 없습니다.'
      };
    }
    
    // 문서를 폴더로 이동
    file.moveTo(targetFolder);
    console.log('✅ 문서가 공유 폴더로 이동되었습니다:', targetFolder.getName());
    
    return {
      success: true,
      message: '문서가 공유 폴더로 이동되었습니다.'
    };
    
  } catch (error) {
    console.error('📁 문서 폴더 이동 오류:', error);
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
    console.log('📁 문서 폴더 이동 시작 (모듈 사용):', documentId);
    
    // 문서 가져오기
    const file = DriveApp.getFileById(documentId);
    
    // 폴더 경로: 환경변수 또는 기본값 사용
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const documentFolderName = PropertiesService.getScriptProperties().getProperty('DOCUMENT_FOLDER_NAME') || 'document';
    const sharedFolderName = PropertiesService.getScriptProperties().getProperty('SHARED_DOCUMENT_FOLDER_NAME') || 'shared_documents';
    const folderPath = rootFolderName + '/' + documentFolderName + '/' + sharedFolderName;
    const targetFolder = DocumentFolder.findOrCreateFolder(folderPath);
    
    if (!targetFolder) {
      console.error('📁 대상 폴더를 찾을 수 없습니다');
      return {
        success: false,
        message: '대상 폴더를 찾을 수 없습니다.'
      };
    }
    
    // 문서를 폴더로 이동
    file.moveTo(targetFolder);
    console.log('✅ 문서가 공유 폴더로 이동되었습니다:', targetFolder.getName());
    
    return {
      success: true,
      message: '문서가 공유 폴더로 이동되었습니다.'
    };
    
  } catch (error) {
    console.error('📁 문서 폴더 이동 오류:', error);
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
    console.log('📁 폴더 경로 찾기/생성:', folderPath);
    
    let currentFolder = DriveApp.getRootFolder();
    
    for (const folderName of folderPath) {
      const folders = currentFolder.getFoldersByName(folderName);
      
      if (folders.hasNext()) {
        currentFolder = folders.next();
        console.log('📁 기존 폴더 발견:', folderName);
      } else {
        currentFolder = currentFolder.createFolder(folderName);
        console.log('📁 새 폴더 생성:', folderName);
      }
    }
    
    return currentFolder;
    
  } catch (error) {
    console.error('📁 폴더 경로 생성 오류:', error);
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
    console.log('📄 Google 문서 생성 시도 (직접 구현):', { title, templateType });
    
    // DriveApp API 확인
    if (typeof DriveApp === 'undefined') {
      console.error('📄 DriveApp API가 정의되지 않았습니다');
      return {
        success: false,
        message: 'DriveApp API가 활성화되지 않았습니다. Google Apps Script에서 DriveApp API를 활성화해주세요.'
      };
    }
    
    // 빈 문서인 경우
    if (templateType === 'empty' || !templateType) {
      console.log('📄 빈 문서 생성 (템플릿 없음)');
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
      console.log('📄 커스텀 템플릿 복사 시도:', templateType);
      
      try {
        // 기존 문서를 복사
        const templateFile = DriveApp.getFileById(templateType);
        const copiedFile = templateFile.makeCopy(title);
        
        console.log('📄 템플릿 복사 성공:', copiedFile.getId());
        
        return {
          success: true,
          data: {
            id: copiedFile.getId(),
            name: title,
            webViewLink: copiedFile.getUrl()
          }
        };
      } catch (copyError) {
        console.error('📄 템플릿 복사 실패:', copyError);
        // 복사 실패 시 빈 문서로 생성
        console.log('📄 복사 실패로 빈 문서 생성 시도');
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
    console.log('📄 빈 문서 생성 시도');
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
    console.error('📄 문서 생성 오류:', error);
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
    console.log('🔐 문서 권한 설정 시작 (백업 함수):', { documentId, creatorEmail, editors });
    
    // 입력 데이터 검증
    if (!documentId) {
      throw new Error('문서 ID가 필요합니다');
    }
    
    const file = DriveApp.getFileById(documentId);
    console.log('📄 문서 정보:', { id: file.getId(), name: file.getName() });
    
    // 모든 사용자에게 편집 권한 부여 (생성자 + 편집자)
    const allUsers = [creatorEmail, ...(editors || [])].filter((email, index, arr) => 
      email && email.trim() !== '' && arr.indexOf(email) === index // 중복 제거
    );
    
    console.log('🔐 권한 부여할 사용자 목록:', allUsers);
    console.log('🔐 사용자 수:', allUsers.length);
    
    if (allUsers.length === 0) {
      console.warn('⚠️ 권한 부여할 사용자가 없습니다');
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
    console.log('🔐 권한 설정 전 편집자:', beforePermissionsList.map(p => p.emailAddress));
    
    let successCount = 0;
    let failCount = 0;
    
    // 각 사용자에게 편집 권한 부여 (Drive API - 메일 알림 없음)
    for (const userEmail of allUsers) {
      try {
        console.log('🔐 권한 부여 시도:', userEmail);
        
        // 이미 권한이 있는지 확인
        const hasPermission = beforePermissionsList.some(p => p.emailAddress === userEmail && p.role === 'writer');
        if (hasPermission) {
          console.log('✅ 이미 권한이 있는 사용자:', userEmail);
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
        console.log('✅ 편집 권한 부여 완료 (메일 알림 없음):', userEmail);
        successCount++;
        
        // 잠시 대기 (API 제한 방지)
        Utilities.sleep(100);
        
      } catch (permError) {
        console.error('❌ 권한 설정 실패:', userEmail, permError.message);
        failCount++;
      }
    }
    
    // 권한 설정 후 결과 확인
    const afterPermissions = Drive.Permissions.list(documentId);
    const afterPermissionsList = afterPermissions.items || [];
    console.log('🔐 권한 설정 후 편집자:', afterPermissionsList.map(p => p.emailAddress));
    
    const result = {
      success: successCount > 0,
      message: `권한 설정 완료: 성공 ${successCount}명, 실패 ${failCount}명`,
      grantedUsers: allUsers,
      currentEditors: afterPermissionsList.map(p => p.emailAddress),
      successCount: successCount,
      failCount: failCount
    };
    
    console.log('🔐 최종 권한 설정 결과:', result);
    return result;
    
  } catch (error) {
    console.error('❌ 문서 권한 설정 오류:', error);
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
    console.log('🧪 권한 설정 테스트 시작');
    
    // 테스트용 문서 ID (실제 문서 ID로 변경 필요)
    const testDocumentId = '1oqY3J_1zPuHfGn61SPDM0-72tvYSavjorciAl9fHpbA';
    const testCreatorEmail = 'khk213624@gmail.com';
    const testEditors = ['ach021105@gmail.com', 'answnsdud1004@gmail.com'];
    
    console.log('🧪 테스트 데이터:', { testDocumentId, testCreatorEmail, testEditors });
    
    // DocumentPermissions 모듈 확인
    if (typeof DocumentPermissions !== 'undefined') {
      console.log('✅ DocumentPermissions 모듈 사용 가능');
      const result = DocumentPermissions.setDocumentPermissions(testDocumentId, testCreatorEmail, testEditors);
      console.log('🧪 테스트 결과:', result);
      return result;
    } else {
      console.error('❌ DocumentPermissions 모듈이 로드되지 않았습니다');
      return {
        success: false,
        message: 'DocumentPermissions 모듈이 로드되지 않았습니다'
      };
    }
    
  } catch (error) {
    console.error('🧪 테스트 오류:', error);
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
    console.log('👤 사용자 등록 상태 확인 시작:', email);
    
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
    console.error('👤 사용자 등록 상태 확인 오류:', error);
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
    console.log('📝 사용자 등록 요청 처리 시작:', req);
    
    // UserRegistration.gs의 submitRegistrationRequest 함수 사용
    const result = submitRegistrationRequest(req);
    
    return result;
    
  } catch (error) {
    console.error('📝 사용자 등록 요청 처리 오류:', error);
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
    console.log('🔑 관리자 키 검증 시작');
    
    // 관리자 키 검증 로직 (기존 KeyManagement.gs 활용)
    const isValid = verifyAdminKey(adminKey);
    
    console.log('🔑 관리자 키 검증 결과:', isValid);
    
    return {
      success: isValid,
      isValid: isValid,
      message: isValid ? '유효한 관리자 키입니다' : '유효하지 않은 관리자 키입니다'
    };
    
  } catch (error) {
    console.error('🔑 관리자 키 검증 오류:', error);
    return { success: false, isValid: false, error: error.message };
  }
}

/**
 * 일일 관리자 키 갱신 트리거 함수
 * 매일 자정에 자동으로 실행되어 관리자 키를 갱신합니다.
 */
function handleDailyKeyUpdate() {
  try {
    console.log('🔄 === 일일 관리자 키 갱신 시작 ===');
    console.log('⏰ 실행 시간:', new Date().toISOString());
    
    // 1. 새로운 관리자 키 생성
    console.log('🔑 새로운 관리자 키 생성 중...');
    const keyResult = generateNewAdminKey();
    
    if (!keyResult.success) {
      throw new Error('관리자 키 생성 실패: ' + keyResult.message);
    }
    
    console.log('✅ 관리자 키 생성 완료');
    console.log('🔑 생성된 키 (처음 20자):', keyResult.key.substring(0, 20) + '...');
    console.log('🔐 사용된 레이어:', keyResult.layers);
    
    // 2. 기존 키 백업 생성
    console.log('💾 기존 키 백업 생성 중...');
    const backupResult = createKeyBackup(keyResult.key, keyResult.layers);
    
    if (backupResult.success) {
      console.log('✅ 키 백업 생성 완료');
    } else {
      console.warn('⚠️ 키 백업 생성 실패:', backupResult.message);
    }
    
    // 3. 스프레드시트에 새 키 업데이트
    console.log('📊 스프레드시트에 새 키 업데이트 중...');
    const updateResult = updateAdminKey(keyResult.key, keyResult.layers);
    
    if (!updateResult.success) {
      throw new Error('키 업데이트 실패: ' + updateResult.message);
    }
    
    console.log('✅ 스프레드시트 업데이트 완료');
    console.log('⏰ 업데이트 시간:', updateResult.timestamp);
    
    // 4. 성공 로그 기록
    console.log('🎉 === 일일 관리자 키 갱신 완료 ===');
    console.log('🔑 새 키:', keyResult.key.substring(0, 20) + '...');
    console.log('🔐 레이어:', keyResult.layers.join(', '));
    console.log('⏰ 완료 시간:', new Date().toISOString());
    
    return {
      success: true,
      message: '관리자 키가 성공적으로 갱신되었습니다.',
      key: keyResult.key,
      layers: keyResult.layers,
      timestamp: updateResult.timestamp,
      backupCreated: backupResult.success
    };
    
  } catch (error) {
    console.error('❌ 일일 관리자 키 갱신 실패:', error);
    console.error('❌ 오류 상세:', error.message);
    console.error('❌ 스택 트레이스:', error.stack);
    
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
      console.error('이메일 알림 전송 실패:', emailError);
    }
    
    return {
      success: false,
      message: '관리자 키 갱신에 실패했습니다: ' + error.message,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}