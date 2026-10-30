/**
 * DocumentFolder.gs
 * 문서 폴더 관리 관련 기능
 * Hot Potato Document Management System
 */

// ===== 폴더 관리 관련 함수들 =====

/**
 * 문서를 적절한 폴더로 이동 (문서 타입에 따라)
 * @param {string} documentId - 문서 ID
 * @param {string} documentType - 문서 타입 ('template' 또는 'document')
 * @returns {Object} 이동 결과
 */
function moveDocumentToFolder(documentId, documentType = 'document') {
  // CONFIG.gs에서 폴더 경로 가져오기
  const folderPath = documentType === 'template' 
    ? getTemplateFolderPath()  // hot_potato_remake/document/shared_forms
    : getSharedDocumentFolderPath();  // hot_potato_remake/document/shared_documents
  
  const debug = {
    step: 'moveDocumentToFolder_start',
    documentId: documentId,
    documentType: documentType,
    folderPath: folderPath,
    configBased: true
  };
  
  try {
    
    // 적절한 폴더 찾기 또는 생성
    const folder = findOrCreateFolder(folderPath);
    debug.step = 'folder_find_result';
    debug.folderResult = folder;
    
    if (!folder.success) {
      debug.step = 'folder_find_failed';
      debug.error = folder.message;
      return {
        success: false,
        message: '폴더 찾기/생성 실패: ' + folder.message,
        debug: debug
      };
    }
    
    debug.step = 'folder_found';
    debug.targetFolderId = folder.data.id;
    
    // 문서의 현재 부모 폴더들 확인
    const currentFile = Drive.Files.get(documentId, {fields: 'parents'});
    const currentParents = currentFile.parents ? currentFile.parents.map(p => p.id) : [];
    
    debug.currentParents = currentParents;
    debug.targetFolderId = folder.data.id;
    
    // 문서를 폴더로 이동 (모든 기존 부모에서 제거하고 새 폴더에 추가)
    const moveResult = Drive.Files.update(
      {
        addParents: folder.data.id,
        removeParents: currentParents.join(',')
      },
      documentId
    );
    
    debug.step = 'move_completed';
    debug.moveResult = moveResult;
    
    return { 
      success: true,
      message: '문서가 성공적으로 폴더로 이동되었습니다.',
      folderId: folder.data.id,
      debug: debug
    };
    
  } catch (error) {
    debug.step = 'move_error';
    debug.error = error.message;
    logError_('DocumentFolder', '문서 폴더 이동 오류:', error);
    return {
      success: false,
      message: '문서 폴더 이동 실패: ' + error.message,
      debug: debug
    };
  }
}

/**
 * 폴더 찾기 또는 생성
 * @param {string} folderPath - 폴더 경로
 * @returns {Object} 폴더 정보
 */
function findOrCreateFolder(folderPath) {
  const debug = {
    step: 'findOrCreateFolder_start',
    folderPath: folderPath,
    pathType: typeof folderPath
  };
  logDebug_('DocumentFolder', '입력 폴더 경로:', folderPath);
  logDebug_('DocumentFolder', '폴더 경로 타입:', typeof folderPath);
  
  try {
    debug.step = 'validation_start';
    
    // Drive API 확인
    if (typeof Drive === 'undefined') {
      logError_('DocumentFolder', 'Drive API가 정의되지 않았습니다');
      return {
        success: false,
        message: 'Drive API가 활성화되지 않았습니다. Google Apps Script에서 Drive API를 활성화해주세요.'
      };
    }
    
    if (!folderPath || typeof folderPath !== 'string') {
      logError_('DocumentFolder', 'Invalid folder path:', folderPath);
      return {
        success: false,
        message: 'Invalid folder path'
      };
    }
    
    const pathParts = folderPath.split('/');
    let currentFolderId = 'root';
    // 경로가 프로젝트 루트 이름으로 시작하면 내 드라이브에서 이름으로 찾지 않고 hp_member 기준으로 감지한 루트에서 시작한다.
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const projectRootId = pathParts[0] === rootFolderName ? getProjectRootFolderId_() : null;
    if (projectRootId) {
      currentFolderId = projectRootId;
      pathParts.shift();
    }
    debug.step = 'path_parsing_complete';
    debug.pathParts = pathParts;
    debug.currentFolderId = currentFolderId;
    
    for (const part of pathParts) {
      if (!part) continue;
      
      logDebug_('DocumentFolder', '폴더 검색:', part, 'in', currentFolderId);
      
      // 더 안전한 폴더 검색 방법 사용
      let foundFolder = null;
      
      try {
        // 단순한 쿼리로 모든 폴더 가져오기
        const folders = Drive.Files.list({
          q: '\'' + currentFolderId + '\' in parents and mimeType=\'application/vnd.google-apps.folder\' and trashed=false',
          fields: 'files(id,name)'
        });
        
        if (folders.files && folders.files.length > 0) {
          logDebug_('DocumentFolder', '찾은 폴더 수:', folders.files.length);
          // 정확한 이름을 가진 폴더 찾기
          for (const folder of folders.files) {
            logDebug_('DocumentFolder', '검색 중인 폴더:', folder.name, 'vs', part);
            if (folder.name === part) {
              foundFolder = folder;
              logDebug_('DocumentFolder', '일치하는 폴더 발견:', folder.name, folder.id);
              break;
            }
          }
        } else {
          logDebug_('DocumentFolder', '검색된 폴더가 없습니다');
        }
      } catch (searchError) {
        logError_('DocumentFolder', '폴더 검색 오류:', searchError);
        // 검색 실패 시 바로 폴더 생성
        foundFolder = null;
      }
      
      if (foundFolder) {
        currentFolderId = foundFolder.id;
        debug[`folder_${part}_found`] = { id: foundFolder.id, name: foundFolder.name };
        logDebug_('DocumentFolder', '기존 폴더 사용:', part, currentFolderId);
      } else {
        debug[`folder_${part}_not_found`] = true;
        logDebug_('DocumentFolder', '폴더 없음, 새 폴더 생성:', part);
        try {
          const newFolder = Drive.Files.create({
            name: part,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentFolderId]
          });
          currentFolderId = newFolder.id;
          debug[`folder_${part}_created`] = { id: newFolder.id, name: newFolder.name };
        } catch (createError) {
          debug[`folder_${part}_create_error`] = createError.message;
          logError_('DocumentFolder', '폴더 생성 오류:', createError);
          return {
            success: false,
            message: '폴더 생성 실패: ' + createError.message,
            debug: debug
          };
        }
      }
    }
    
    debug.step = 'folder_creation_complete';
    debug.finalFolderId = currentFolderId;
    
    const result = {
      success: true,
      data: {
        id: currentFolderId,
        path: folderPath
      },
      debug: debug
    };
    
    return result;
    
  } catch (error) {
    debug.step = 'folder_creation_error';
    debug.error = error.message;
    logError_('DocumentFolder', '폴더 찾기/생성 오류:', error);
    const errorResult = {
      success: false,
      message: '폴더 찾기/생성 실패: ' + error.message,
      debug: debug
    };
    return errorResult;
  }
}

/**
 * 폴더 내 파일 목록 조회
 * @param {string} folderId - 폴더 ID
 * @returns {Object} 파일 목록
 */
function getFolderFiles(folderId) {
  try {
    logDebug_('DocumentFolder', 'Getting folder files:', folderId);
    
    const files = Drive.Files.list({
      q: '\'' + folderId + '\' in parents and trashed=false',
      fields: 'files(id,name,mimeType,modifiedTime)',
      orderBy: 'name'
    });
    
    return {
      success: true,
      data: files.files || [],
      message: 'Folder files retrieved successfully.'
    };
    
  } catch (error) {
    logError_('DocumentFolder', 'Folder files retrieval error:', error);
    return {
      success: false,
      message: 'Folder files retrieval failed: ' + error.message
    };
  }
}

/**
 * 폴더 정보 조회
 * @param {string} folderId - 폴더 ID
 * @returns {Object} 폴더 정보
 */
function getFolderInfo(folderId) {
  try {
    logDebug_('DocumentFolder', 'Getting folder info:', folderId);
    
    const folder = Drive.Files.get(folderId, {
      fields: 'id,name,parents,owners,permissions,createdTime,modifiedTime'
    });
    
    return {
      success: true,
      data: folder,
      message: 'Folder info retrieved successfully.'
    };
    
  } catch (error) {
    logError_('DocumentFolder', 'Folder info retrieval error:', error);
    return {
      success: false,
      message: 'Folder info retrieval failed: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getDocumentFolderInfo() {
  return {
    version: '1.0.0',
    description: 'Document folder management',
    functions: [
      'moveDocumentToFolder',
      'findOrCreateFolder',
      'getFolderFiles',
      'getFolderInfo'
    ],
    dependencies: ['CONFIG.gs']
  };
}
