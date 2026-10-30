/**
 * DocumentTemplates.gs
 * 문서 템플릿 관리 관련 기능
 * Hot Potato Document Management System
 */

// ===== 템플릿 관련 함수들 =====

/**
 * hot_potato_remake/document/shared_forms 폴더에서 템플릿 목록 가져오기
 * @returns {Object} 템플릿 목록 결과
 */
function getTemplatesFromFolder() {
  
  try {
    
    // Drive API 확인
    if (typeof Drive === 'undefined') {
      return {
        success: false,
        message: 'Drive API가 활성화되지 않았습니다. Google Apps Script에서 Drive API를 활성화해주세요.',
      };
    }
    
    
    // 스크립트 속성에서 폴더 이름 가져오기
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const documentFolderName = PropertiesService.getScriptProperties().getProperty('DOCUMENT_FOLDER_NAME') || 'document';
    const templateFolderName = PropertiesService.getScriptProperties().getProperty('TEMPLATE_FOLDER_NAME') || 'shared_forms';
    
    // 여러 가능한 폴더 경로 시도 (하위 호환성을 위해 유지)
    const possiblePaths = [
      getTemplateFolderPath(),
      rootFolderName + '/' + documentFolderName + '/' + templateFolderName,
      rootFolderName.replace(' ', '_') + '/' + documentFolderName + '/' + templateFolderName,
      documentFolderName + '/' + templateFolderName,
      templateFolderName
    ];
    
    
    let folder = null;
    let successfulPath = null;
    
    for (const path of possiblePaths) {
      const result = findOrCreateFolder(path);
      
      if (result && result.success && result.data && result.data.id) {
        folder = result;
        successfulPath = path;
        break;
      } else {
      }
    }
    
    if (!folder) {
      return {
        success: false,
        message: '템플릿 폴더를 찾을 수 없습니다. 폴더 경로를 확인해주세요.',
      };
    }
    
    
    // 폴더 ID로 직접 검색해보기
    try {
      const directFolder = Drive.Files.get(folder.data.id, {
        fields: 'id,name,parents,owners,permissions'
      });
      
      // 폴더 소유자 정보 확인
      if (directFolder.owners && directFolder.owners.length > 0) {
      }
      
      // 폴더 권한 정보 확인
      if (directFolder.permissions && directFolder.permissions.length > 0) {
        directFolder.permissions.forEach((perm, index) => {
        });
      }
    } catch (directError) {
    }
    
    // 폴더 내의 모든 파일들 먼저 검색해보기
    
    let allFiles;
    try {
      // 방법 1: 기본 쿼리로 검색
      const allFilesQuery = `'${folder.data.id}' in parents and trashed=false`;
      
      allFiles = Drive.Files.list({
        q: allFilesQuery,
        fields: 'files(id,name,mimeType,modifiedTime)',
        orderBy: 'name'
      });
      
      
      // 방법 2: 쿼리 없이 직접 검색 시도
      if (!allFiles.files || allFiles.files.length === 0) {
        try {
          const directFiles = Drive.Files.list({
            fields: 'files(id,name,mimeType,modifiedTime,parents)',
            orderBy: 'name'
          });
          
          
          // 해당 폴더의 파일들만 필터링
          const filteredFiles = (directFiles.files || []).filter(file => 
            file.parents && file.parents.includes(folder.data.id)
          );
          
          allFiles = { files: filteredFiles };
        } catch (directSearchError) {
        }
      }
      
      // 각 파일의 상세 정보 로깅
      if (allFiles.files && allFiles.files.length > 0) {
        allFiles.files.forEach((file, index) => {
        });
      } else {
      }
      
    } catch (allFilesError) {
      return {
        success: false,
        message: '파일 검색 실패: ' + allFilesError.message,
      };
    }
    
    // Google Docs 파일만 필터링
    const googleDocsFiles = allFiles.files ? allFiles.files.filter(file =>
      file.mimeType === 'application/vnd.google-apps.document' ||
      file.mimeType === 'application/vnd.google-apps.spreadsheet'
    ) : [];
    
    googleDocsFiles.forEach((file, index) => {
    });
    
    const files = { files: googleDocsFiles };
    
    if (!files.files || files.files.length === 0) {
      return {
        success: true,
        data: [],
        message: '템플릿 폴더에 문서가 없습니다',
      };
    }
    
    // 템플릿 정보 파싱 (기본 템플릿은 파일명 방식 유지)
    const templates = files.files.map(file => {
      const p = file.properties || {};
      return {
        id: file.id,
        type: file.id,
        title: file.name,
        mimeType: file.mimeType,
        description: p.description || file.description || '템플릿 파일',
        tag: p.tag || '기본',
        fullTitle: file.name,
        modifiedDate: file.modifiedTime,
        owner: file.owners && file.owners.length > 0 ? file.owners[0].displayName : 'Unknown'
      };
    });
    
    
    return {
      success: true,
      data: templates,
      message: `${templates.length}개의 템플릿을 찾았습니다`,
    };
    
  } catch (error) {
    return {
      success: false,
      message: '템플릿 목록을 가져오는 중 오류가 발생했습니다: ' + error.message,
    };
  }
}

/**
 * 공유 템플릿 업로드(파일 업로드 + properties 저장 + 폴더 이동)
 * req: { fileName, fileMimeType, fileContentBase64, meta: { title, description, tag, creatorEmail } }
 */
function uploadSharedTemplate(req) {
  try {
    if (!req || !req.fileName || !req.fileContentBase64) {
      return { success: false, message: 'fileName과 fileContentBase64가 필요합니다.' };
    }
    // 권한 검증: 관리자만 허용
    var creatorEmail = (req.meta && req.meta.creatorEmail) || '';
    var status = checkUserStatus(creatorEmail);
    if (!status.success || !status.data || !status.data.user || status.data.user.is_admin !== 'O') {
      return { success: false, message: '관리자만 템플릿을 업로드할 수 있습니다.' };
    }

    // 입력 검증/정규화
    var sanitize = function(s){
      if (!s) return '';
      s = String(s);
      s = s.replace(/[<>"'\\]/g, '');
      return s.substring(0, 200);
    };

    var safeTitle = sanitize((req.meta && req.meta.title) || req.fileName);
    var safeDesc = sanitize((req.meta && req.meta.description) || '');
    var safeTag = sanitize((req.meta && req.meta.tag) || '기본');
    var mime = req.fileMimeType || '';
    var allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-excel'];
    if (mime && allowed.indexOf(mime) === -1) {
      return { success: false, message: '지원되지 않는 파일 형식입니다.' };
    }
    if (req.fileContentBase64.length > 12 * 1024 * 1024) { // ~12MB base64 길이 보호
      return { success: false, message: '파일이 너무 큽니다.' };
    }

    if (typeof Drive === 'undefined') {
      return { success: false, message: 'Drive API가 활성화되지 않았습니다.' };
    }

    var bytes = Utilities.base64Decode(req.fileContentBase64);
    var blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', req.fileName);

    // 대상 폴더 준비(사전 조회) 후 부모 설정과 함께 업로드
    var folderPath = getTemplateFolderPath();
    var folderRes = findOrCreateFolder(folderPath);
    if (!folderRes || !folderRes.success || !folderRes.data || !folderRes.data.id) {
      return { success: false, message: '양식 폴더를 찾을 수 없습니다.' };
    }

    // 업로드: 부모(folder)와 이름을 메타데이터로 설정해 바로 해당 폴더에 저장 (Drive v3 스타일)
    // Word/Excel 업로드 시 Google 형식으로 변환하여 저장
    var targetGoogleMime = 'application/vnd.google-apps.document';
    var lower = (mime || '').toLowerCase();
    if (lower.indexOf('sheet') !== -1 || lower.indexOf('excel') !== -1 || lower.indexOf('spreadsheetml') !== -1) {
      targetGoogleMime = 'application/vnd.google-apps.spreadsheet';
    }
    var created = Drive.Files.create({
      name: safeTitle,
      mimeType: targetGoogleMime,
      parents: [folderRes.data.id]
    }, blob);

    // 스프레드시트인 경우 컬럼 너비 및 시트 보호 보존
    if (targetGoogleMime === 'application/vnd.google-apps.spreadsheet') {
      try {
        // Excel 파일 변환 완료 대기 (변환 시간 확보)
        Utilities.sleep(2000); // 2초 대기
        
        var spreadsheet = SpreadsheetApp.openById(created.id);
        var sheets = spreadsheet.getSheets();
        
        // 각 시트의 컬럼 너비 및 시트 보호 보존
        for (var i = 0; i < sheets.length; i++) {
          var sheet = sheets[i];
          var lastColumn = sheet.getLastColumn();
          
          // 컬럼 너비는 Google Sheets가 Excel 변환 시 자동으로 보존
          // 시트 보호 정보 확인 및 복원
          try {
            // 시트 보호 정보 확인
            var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
            
            // 시트 보호가 없는 경우, 원본 Excel 파일의 보호 정보가 자동으로 보존되지 않았을 수 있음
            // Google Sheets는 Excel 파일 변환 시 시트 보호를 자동으로 보존해야 하지만,
            // Drive API를 통한 변환 시 보호가 해제될 수 있음
            // 이 경우 원본 Excel 파일의 보호 정보를 직접 읽을 수 없으므로,
            // 업로드 후 시트 보호를 복원할 수 없음
            // 하지만 Google Sheets가 자동으로 보존한 보호 정보를 확인
            if (protections.length === 0) {
              logWarn_('DocumentTemplates', '시트 보호가 없는 것으로 확인됨:', sheet.getName());
              logWarn_('DocumentTemplates', 'Excel 파일 변환 시 시트 보호가 자동으로 보존되지 않았을 수 있습니다.');
              // 원본 Excel 파일의 보호 정보를 직접 읽을 수 없으므로,
              // 사용자가 수동으로 보호를 설정해야 할 수 있음
            } else {
              logDebug_('DocumentTemplates', '시트 보호 확인됨:', sheet.getName(), protections.length, '개');
              // 기존 보호 정보 확인 및 유지
              for (var j = 0; j < protections.length; j++) {
                var protection = protections[j];
                logDebug_('DocumentTemplates', '- 보호 범위:', protection.getRange() ? protection.getRange().getA1Notation() : '전체 시트');
                logDebug_('DocumentTemplates', '- 설명:', protection.getDescription());
                logDebug_('DocumentTemplates', '- 편집자 수:', protection.getEditors().length);
                
                // 시트 보호가 있는 경우, 보호 설정 유지
                // 보호가 자동으로 해제되지 않도록 확인
                try {
                  // 보호가 해제되었는지 확인하고, 필요시 재설정
                  if (!protection.canEdit()) {
                    logDebug_('DocumentTemplates', '- 시트 보호가 활성화되어 있습니다.');
                  }
                } catch (checkError) {
                  logWarn_('DocumentTemplates', '- 시트 보호 상태 확인 중 오류:', checkError);
                }
              }
            }
          } catch (protectError) {
            logWarn_('DocumentTemplates', '시트 보호 확인 중 오류 발생 (계속 진행):', protectError);
          }
        }
      } catch (e) {
        // 컬럼 너비 및 시트 보호 설정 실패해도 계속 진행
        logWarn_('DocumentTemplates', '스프레드시트 설정 중 오류 발생 (계속 진행):', e);
      }
    }

    // properties 설정
    var props = {
      description: safeDesc,
      tag: safeTag,
      creatorEmail: creatorEmail,
      createdDate: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
    };
    Drive.Files.update({ properties: props }, created.id);

    return { success: true, data: { id: created.id } };
  } catch (e) {
    return { success: false, message: '업로드 실패: ' + e.message };
  }
}

/**
 * 공유 템플릿 메타데이터 수정(properties만)
 */
function updateSharedTemplateMeta(req) {
  try {
    if (!req || !req.fileId) {
      return { success: false, message: 'fileId가 필요합니다.' };
    }
    // 관리자 검증 (요청에서 이메일 가져오기, 없으면 Session 사용)
    var editorEmail = req.editorEmail || (req.meta && req.meta.creatorEmail) || Session.getActiveUser().getEmail();
    var status = checkUserStatus(editorEmail);
    if (!status.success || !status.data || !status.data.user || status.data.user.is_admin !== 'O') {
      return { success: false, message: '관리자만 메타데이터를 수정할 수 있습니다.' };
    }
    
    var sanitize = function(s){ if(!s) return ''; s=String(s); s=s.replace(/[<>"'\\]/g,''); return s.substring(0,200); };
    
    // 파일명 업데이트를 위한 객체
    var fileUpdate = {};
    
    // 제목(title)이 변경되면 파일명도 함께 업데이트
    if (req.meta && req.meta.title !== undefined) {
      var newFileName = sanitize(req.meta.title);
      fileUpdate.name = newFileName;
      logDebug_('DocumentTemplates', '파일명 업데이트:', newFileName);
    }
    
    // 메타데이터 업데이트
    var updateProps = {};
    if (req.meta) {
      if (req.meta.title !== undefined) updateProps.title = sanitize(req.meta.title);
      if (req.meta.description !== undefined) updateProps.description = sanitize(req.meta.description);
      if (req.meta.tag !== undefined) updateProps.tag = sanitize(req.meta.tag);
      if (req.meta.creatorEmail !== undefined) updateProps.creatorEmail = sanitize(req.meta.creatorEmail);
    }
    
    // 파일명과 메타데이터를 함께 업데이트
    if (Object.keys(updateProps).length > 0) {
      fileUpdate.properties = updateProps;
    }
    
    // 파일 업데이트 실행
    if (Object.keys(fileUpdate).length > 0) {
      Drive.Files.update(fileUpdate, req.fileId);
    }
    
    return { success: true };
  } catch (e) {
    logError_('DocumentTemplates', '기본 템플릿 업데이트 오류:', e);
    return { success: false, message: '메타데이터 업데이트 실패: ' + e.message };
  }
}

/**
 * 공유 템플릿 삭제 (관리자 전용)
 */
function deleteSharedTemplate(req) {
  try {
    if (!req || !req.fileId) {
      return { success: false, message: 'fileId가 필요합니다.' };
    }
    
    // 관리자 검증 (요청에서 이메일 가져오기, 없으면 Session 사용)
    var userEmail = req.userEmail || Session.getActiveUser().getEmail();
    var status = checkUserStatus(userEmail);
    if (!status.success || !status.data || !status.data.user || status.data.user.is_admin !== 'O') {
      return { success: false, message: '관리자만 템플릿을 삭제할 수 있습니다.' };
    }
    
    // 파일 존재 확인
    try {
      var file = Drive.Files.get(req.fileId);
      if (!file) {
        return { success: false, message: '템플릿을 찾을 수 없습니다.' };
      }
      logDebug_('DocumentTemplates', '삭제할 템플릿:', file.name);
      
      // "빈 문서" 템플릿은 삭제 불가
      if (file.name === '빈 문서' || file.name.trim() === '빈 문서') {
        return { success: false, message: '빈 문서 템플릿은 삭제할 수 없습니다.' };
      }
    } catch (getError) {
      return { success: false, message: '템플릿을 찾을 수 없습니다: ' + getError.message };
    }
    
    // 파일 삭제
    Drive.Files.remove(req.fileId);
    
    return { success: true, message: '기본 템플릿이 삭제되었습니다.' };
  } catch (e) {
    logError_('DocumentTemplates', '기본 템플릿 삭제 오류:', e);
    return { success: false, message: '템플릿 삭제 실패: ' + e.message };
  }
}

/**
 * 공유 템플릿 목록(메타데이터 우선) 반환
 */
function getSharedTemplates() {
  try {
    // CONFIG에서 기본 경로 가져오기
    var basePath = getTemplateFolderPath();
    var rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    var documentFolderName = PropertiesService.getScriptProperties().getProperty('DOCUMENT_FOLDER_NAME') || 'document';
    var templateFolderName = PropertiesService.getScriptProperties().getProperty('TEMPLATE_FOLDER_NAME') || 'shared_forms';

    // 여러 가능한 경로를 시도 (getTemplatesFromFolder와 동일한 전략)
    var possiblePaths = [
      basePath,
      rootFolderName + '/' + documentFolderName + '/' + templateFolderName,
      rootFolderName.replace(' ', '_') + '/' + documentFolderName + '/' + templateFolderName,
      documentFolderName + '/' + templateFolderName,
      templateFolderName
    ];

    var folderRes = null;
    var usedPath = null;
    for (var i = 0; i < possiblePaths.length; i++) {
      var path = possiblePaths[i];
      if (!path) continue;
      logDebug_('DocumentTemplates', 'getSharedTemplates - try path:', path);
      var res = findOrCreateFolder(path);
      if (res && res.success && res.data && res.data.id) {
        folderRes = res;
        usedPath = path;
        break;
      }
    }

    if (!folderRes || !folderRes.success || !folderRes.data || !folderRes.data.id) {
      logWarn_('DocumentTemplates', 'getSharedTemplates - 모든 경로에서 양식 폴더를 찾을 수 없습니다.');
      return { success: false, message: '양식 폴더를 찾을 수 없습니다.' };
    }
    
    // 메타데이터(properties) 포함하여 API 호출 (Drive API v2 호환)
    var fileList = [];
    var maxRetries = 3;
    var retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        fileList = [];
        var pageToken = null;
        do {
          var files = Drive.Files.list({
            q: '\'' + folderRes.data.id + '\' in parents and trashed=false',
            pageSize: 1000,
            pageToken: pageToken || undefined,
            fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,owners(displayName,emailAddress),description,properties)'
          });
          fileList = fileList.concat(files.files || []);
          pageToken = files.nextPageToken;
        } while (pageToken);
        
        break; // 성공하면 루프 종료
      } catch (listError) {
        retryCount++;
        logWarn_('DocumentTemplates', '공유 템플릿 목록 조회 재시도 ' + retryCount + '/' + maxRetries + ':', listError.message);
        
        // 사용량 제한 오류인지 확인
        if (listError.message && (listError.message.indexOf('429') !== -1 || 
            listError.message.indexOf('quota') !== -1 || 
            listError.message.indexOf('rate limit') !== -1)) {
          logWarn_('DocumentTemplates', 'API 사용량 제한 감지. 잠시 대기 후 재시도합니다.');
          Utilities.sleep(Math.pow(2, retryCount) * 2000); // 지수적 백오프 (2초, 4초, 8초)
          continue;
        }
        
        if (retryCount >= maxRetries) {
          return { success: false, message: '공유 템플릿 조회 실패: ' + listError.message };
        }
        
        // 재시도 전 대기
        Utilities.sleep(Math.pow(2, retryCount) * 1000);
      }
    }
    
    var items = fileList.filter(function(f){ 
      return f.mimeType === 'application/vnd.google-apps.document' || 
             f.mimeType === 'application/vnd.google-apps.spreadsheet'; 
    }).map(function(file){
      // properties에서 메타데이터 추출
      var p = file.properties || [];
      var description = '';
      var tag = '기본';
      var creatorEmail = '';
      var createdDate = '';
      var modifiedDate = '';
      
      if (Array.isArray(p)) {
        // properties 배열을 순회하며 key로 value 찾기
        for (var j = 0; j < p.length; j++) {
          var prop = p[j];
          if (prop && prop.key && prop.value !== undefined) {
            switch(prop.key) {
              case 'description':
                description = prop.value || '';
                break;
              case 'tag':
                tag = prop.value || '기본';
                break;
              case 'creatorEmail':
                creatorEmail = prop.value || '';
                break;
              case 'createdDate':
                createdDate = prop.value || '';
                break;
              case 'modifiedDate':
                modifiedDate = prop.value || '';
                break;
            }
          }
        }
      } else if (p && typeof p === 'object') {
        // 혹시 객체 형태로 반환되는 경우 대비 (v3 등)
        description = p.description || p['description'] || '';
        tag = p.tag || p['tag'] || '기본';
        creatorEmail = p.creatorEmail || p['creatorEmail'] || '';
        createdDate = p.createdDate || p['createdDate'] || '';
        modifiedDate = p.modifiedDate || p['modifiedDate'] || '';
      }
      
      // v2에서는 owners가 배열이 아닐 수 있으므로 처리
      var ownerName = 'Unknown';
      if (file.owners && Array.isArray(file.owners) && file.owners.length > 0) {
        ownerName = file.owners[0].displayName || file.owners[0].emailAddress || 'Unknown';
      } else if (file.ownerNames && file.ownerNames.length > 0) {
        ownerName = file.ownerNames[0];
      }
      
      // 응답에 포함할 템플릿 정보 (메타데이터 포함)
      return {
        id: file.id,
        title: file.title || file.name,
        description: description || '템플릿 파일',
        tag: tag || '기본',
        creatorEmail: creatorEmail,
        createdDate: createdDate,
        fullTitle: file.title || file.name,
        modifiedDate: modifiedDate || file.modifiedDate || '',
        mimeType: file.mimeType || 'application/vnd.google-apps.document',
        owner: ownerName
      };
    });
    
    // 응답에 모든 메타데이터가 포함된 템플릿 목록 리턴
    return { 
      success: true, 
      data: items 
    };
  } catch (e) {
    logError_('DocumentTemplates', '공유 템플릿 조회 오류:', e);
    return { success: false, message: '공유 템플릿 조회 실패: ' + e.message };
  }
}

/**
 * 특정 폴더 ID로 직접 테스트
 */
function testSpecificFolder() {
  
  try {
    // Drive API 확인
    if (typeof Drive === 'undefined') {
      return {
        success: false,
        message: 'Drive API가 활성화되지 않았습니다.'
      };
    }
    
    // 스크립트 속성에서 폴더 이름 가져오기
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const documentFolderName = PropertiesService.getScriptProperties().getProperty('DOCUMENT_FOLDER_NAME') || 'document';
    const templateFolderName = PropertiesService.getScriptProperties().getProperty('TEMPLATE_FOLDER_NAME') || 'shared_forms';
    
    // 실제 폴더 구조를 단계별로 찾기
    // 1단계: 루트에서 루트 폴더 찾기 (하위 호환성을 위해 underscore 버전도 확인)
    // hp_member 기준으로 감지한 프로젝트 루트
    const hotPotatoFolderId = getProjectRootFolderId_();
    
    if (!hotPotatoFolderId) {
      return {
        success: false,
        message: rootFolderName + ' 폴더를 찾을 수 없습니다',
        debugInfo: ['루트 폴더에서 ' + rootFolderName + ' 폴더를 찾을 수 없음']
      };
    }

    // 2단계: 루트 폴더에서 문서 폴더 찾기
    let documentFolderId = null;
    const hotPotatoFolders = Drive.Files.list({
      q: `'${hotPotatoFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)'
    });
    
    for (const folder of hotPotatoFolders.files || []) {
      if (folder.name === documentFolderName) {
        documentFolderId = folder.id;
        break;
      }
    }
    
    if (!documentFolderId) {
      return {
        success: false,
        message: documentFolderName + ' 폴더를 찾을 수 없습니다',
        debugInfo: [rootFolderName + ' 폴더에서 ' + documentFolderName + ' 폴더를 찾을 수 없음']
      };
    }

    // 3단계: 문서 폴더에서 양식 폴더 찾기
    let templateFolderId = null;
    const documentFolders = Drive.Files.list({
      q: `'${documentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)'
    });
    
    for (const folder of documentFolders.files || []) {
      if (folder.name === templateFolderName) {
        templateFolderId = folder.id;
        break;
      }
    }
    
    if (!templateFolderId) {
      return {
        success: false,
        message: templateFolderName + ' 폴더를 찾을 수 없습니다',
        debugInfo: [documentFolderName + ' 폴더에서 ' + templateFolderName + ' 폴더를 찾을 수 없음']
      };
    }
    
    const testFolderId = templateFolderId;
    
    logDebug_('DocumentTemplates', '테스트 폴더 ID:', testFolderId);
    
    // 폴더 정보 가져오기 (권한 정보 포함)
    const folder = Drive.Files.get(testFolderId, {
      fields: 'id,name,parents,owners,permissions'
    });
    
    // 폴더 소유자 정보 확인
    if (folder.owners && folder.owners.length > 0) {
    }
    
    // 폴더 내 파일 검색 (여러 방법 시도)
    let files;
    try {
      // 방법 1: 기본 쿼리
      files = Drive.Files.list({
        q: `'${testFolderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType)'
      });
      
      logDebug_('DocumentTemplates', '방법 1 - 폴더 내 파일들:', files);
      
      // 방법 2: 쿼리 없이 전체 검색 후 필터링
      if (!files.files || files.files.length === 0) {
        logDebug_('DocumentTemplates', '방법 2 - 전체 파일 검색 시도');
        const allFiles = Drive.Files.list({
          fields: 'files(id,name,mimeType,parents)'
        });
        
        const filteredFiles = (allFiles.files || []).filter(file => 
          file.parents && file.parents.includes(testFolderId)
        );
        
        files = { files: filteredFiles };
      }
    } catch (fileSearchError) {
      logError_('DocumentTemplates', '파일 검색 오류:', fileSearchError);
      files = { files: [] };
    }
    
    return {
      success: true,
      message: '특정 폴더 테스트 완료',
      folder: folder,
      files: files.files || [],
      debugInfo: [
        `1단계 - hot potato 폴더 ID: ${hotPotatoFolderId}`,
        `2단계 - 문서 폴더 ID: ${documentFolderId}`,
        `3단계 - 양식 폴더 ID: ${testFolderId}`,
        `최종 폴더 이름: ${folder.name}`,
        `파일 수: ${files.files ? files.files.length : 0}`,
        ...(files.files || []).map(f => `- ${f.name} (${f.mimeType})`)
      ]
    };
    
  } catch (error) {
    logError_('DocumentTemplates', '특정 폴더 테스트 오류:', error);
    return {
      success: false,
      message: '특정 폴더 테스트 실패: ' + error.message
    };
  }
}

/**
 * 템플릿 폴더 디버깅 테스트
 */
function testTemplateFolderDebug() {
  
  try {
    // Drive API 확인
    if (typeof Drive === 'undefined') {
      return {
        success: false,
        message: 'Drive API가 활성화되지 않았습니다.'
      };
    }
    
    // 루트 폴더에서 모든 폴더 검색
    logDebug_('DocumentTemplates', '루트 폴더에서 모든 폴더 검색');
    const rootFolders = Drive.Files.list({
      q: "'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id,name)'
    });
    
    const result = {
      success: true,
      message: '디버깅 테스트 완료',
      rootFolders: rootFolders.files || [],
      debugInfo: [
        '루트 폴더에서 찾은 폴더들:',
        ...(rootFolders.files || []).map(f => `- ${f.name} (${f.id})`)
      ]
    };
    return result;
    
  } catch (error) {
    logError_('DocumentTemplates', '디버깅 테스트 오류:', error);
    return {
      success: false,
      message: '디버깅 테스트 실패: ' + error.message
    };
  }
}

/**
 * 공유 템플릿 조회 함수 테스트
 */
function testGetSharedTemplates() {
  
  try {
    // Drive API 확인
    if (typeof Drive === 'undefined') {
      return {
        success: false,
        message: 'Drive API가 활성화되지 않았습니다.'
      };
    }
    
    logDebug_('DocumentTemplates', 'Drive API 사용 가능');
    
    // getSharedTemplates 함수 실행
    const result = getSharedTemplates();
    
    if (result.data && result.data.length > 0) {
      const firstTemplate = result.data[0];
      logDebug_('DocumentTemplates', '- ID:', firstTemplate.id);
      logDebug_('DocumentTemplates', '- 제목:', firstTemplate.title);
      logDebug_('DocumentTemplates', '- 설명:', firstTemplate.description);
      logDebug_('DocumentTemplates', '- 태그:', firstTemplate.tag);
      logDebug_('DocumentTemplates', '- MIME 타입:', firstTemplate.mimeType);
      logDebug_('DocumentTemplates', '- 소유자:', firstTemplate.owner);
    }
    
    return {
      success: result.success,
      message: result.message,
      templateCount: result.data ? result.data.length : 0,
      templates: result.data || [],
      testResult: result.success ? '✅ 성공' : '❌ 실패'
    };
    
  } catch (error) {
    logError_('DocumentTemplates', '공유 템플릿 조회 테스트 오류:', error);
    return {
      success: false,
      message: '테스트 실패: ' + error.message,
      error: error.toString()
    };
  }
}

// ===== 배포 정보 =====
function getDocumentTemplatesInfo() {
  return {
    version: '1.0.0',
    description: '문서 템플릿 관리 관련 기능',
    functions: [
      'getTemplatesFromFolder',
      'getSharedTemplates',
      'testSpecificFolder',
      'testTemplateFolderDebug',
      'testGetSharedTemplates'
    ],
    dependencies: ['CONFIG.gs']
  };
}

// 내보내기 형식: Google 문서 → docx, Google 스프레드시트 → xlsx
const TEMPLATE_EXPORT_TYPES_ = {
  'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function getTemplateFolderId_() {
  const folderResult = findOrCreateFolder(getTemplateFolderPath());
  return folderResult && folderResult.success && folderResult.data && folderResult.data.id
    ? folderResult.data.id
    : null;
}

function isDirectlyInTemplateFolder_(file, templateFolderId) {
  templateFolderId = templateFolderId || getTemplateFolderId_();
  if (!templateFolderId) return false;
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === templateFolderId) return true;
  }
  return false;
}

/**
 * 공유 양식(문서·스프레드시트)을 Office 형식(base64)으로 내보낸다.
 * 사용자 드라이브 권한(drive.file)으로는 배포자 소유 양식을 복사할 수 없어서,
 * 프론트가 이 내용을 받아 사용자 개인 폴더에 Google 파일로 변환해 올린다.
 * 공유 양식 폴더 바로 아래 파일만 허용한다.
 * @param {Object} req - { templateId }
 */
function exportTemplateFile(req) {
  try {
    const templateId = req && req.templateId;
    if (!templateId) return { success: false, message: '양식 ID가 필요합니다.' };

    const file = DriveApp.getFileById(templateId);
    if (!isDirectlyInTemplateFolder_(file)) {
      return { success: false, message: '내보낼 수 없는 파일입니다.' };
    }
    const exportType = TEMPLATE_EXPORT_TYPES_[file.getMimeType()];
    if (!exportType) {
      return { success: false, message: 'Google 문서나 스프레드시트 양식만 내보낼 수 있습니다.' };
    }

    const response = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(templateId) +
        '/export?mimeType=' + encodeURIComponent(exportType),
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
    );
    if (response.getResponseCode() !== 200) {
      return { success: false, message: '양식 내보내기 실패 (' + response.getResponseCode() + ')' };
    }
    return {
      success: true,
      data: {
        name: file.getName(),
        sourceMimeType: file.getMimeType(),
        exportMimeType: exportType,
        fileData: Utilities.base64Encode(response.getBlob().getBytes())
      }
    };
  } catch (error) {
    logError_('DocumentTemplates', '양식 내보내기 오류:', error);
    return { success: false, message: '양식 내보내기 중 오류가 발생했습니다: ' + error.message };
  }
}

/** Return preview data only for spreadsheets stored directly in shared_forms. */
function getTemplateSheetPreview(req) {
  try {
    const templateId = req && req.templateId;
    if (!templateId) return { success: false, message: '템플릿 ID가 필요합니다.' };

    const templateFolderId = getTemplateFolderId_();
    if (!templateFolderId) {
      return { success: false, message: '공유 양식 폴더를 찾을 수 없습니다.' };
    }

    const file = DriveApp.getFileById(templateId);
    if (!isDirectlyInTemplateFolder_(file, templateFolderId) ||
        file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
      return { success: false, message: '공유 양식 폴더의 스프레드시트만 미리 볼 수 있습니다.' };
    }

    const spreadsheet = SpreadsheetApp.openById(templateId);
    const sheets = spreadsheet.getSheets();
    const result = { success: true, data: { sheets: sheets.map(sheet => ({ properties: { title: sheet.getName(), sheetId: sheet.getSheetId() } })) } };
    if (!req.sheetName) return result;

    const sheet = sheets.find(item => item.getName() === req.sheetName);
    if (!sheet) return { success: false, message: '지정한 시트를 찾을 수 없습니다.' };
    const range = sheet.getRange(1, 1, Math.max(1, Math.min(1000, sheet.getLastRow())), Math.max(1, Math.min(702, sheet.getLastColumn())));
    const values = range.getValues();
    const displayValues = range.getDisplayValues();
    const rowData = values.map((row, rowIndex) => ({ values: row.map((value, columnIndex) => {
      const effectiveValue = {};
      if (value instanceof Date) {
        effectiveValue.numberValue = value.getTime() / 86400000 + 25569;
      } else if (typeof value === 'number') {
        effectiveValue.numberValue = value;
      } else if (typeof value === 'boolean') {
        effectiveValue.boolValue = value;
      } else if (value !== '' && value != null) {
        effectiveValue.stringValue = String(value);
      }
      return { effectiveValue: effectiveValue, formattedValue: displayValues[rowIndex][columnIndex] };
    }) }));
    const merges = range.getMergedRanges().map(merged => ({
      sheetId: sheet.getSheetId(),
      startRowIndex: merged.getRow() - 1,
      endRowIndex: merged.getLastRow(),
      startColumnIndex: merged.getColumn() - 1,
      endColumnIndex: merged.getLastColumn()
    }));
    result.data.sheets = [{
      properties: { title: sheet.getName(), sheetId: sheet.getSheetId() },
      merges: merges,
      data: [{ rowData: rowData }]
    }];
    return result;
  } catch (error) {
    logError_('DocumentTemplates', '공유 양식 미리보기 오류:', error);
    return { success: false, message: '공유 양식 미리보기를 불러오지 못했습니다: ' + error.message };
  }
}
