/**
 * @file personalTagManager.ts
 * @brief 개인 양식 태그 관리 유틸리티
 * @details 개인 설정 파일의 tag 시트를 관리하는 유틸리티 모듈입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { getSheetData, append, update } from 'papyrus-db';
import { deleteRow } from 'papyrus-db/dist/sheets/delete';
import { getCacheManager } from '../cache/cacheManager';
import { generateCacheKey, getCacheTTL, getActionCategory } from '../cache/cacheUtils';
import { ENV_CONFIG } from '../../config/environment';
import { 
  initializePersonalConfigFile, 
  getPersonalConfigSpreadsheetId,
  findPersonalTemplateFolder
} from './personalConfigManager';

/**
 * @brief 시트 ID 가져오기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @returns {Promise<number | null>} 시트 ID 또는 null
 */
const getSheetId = async (spreadsheetId: string, sheetName: string): Promise<number | null> => {
  try {
    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
      fields: 'sheets.properties'
    });
    
    const sheet = response.result.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId || null;
  } catch (error) {
    console.error('❌ 시트 ID 가져오기 오류:', error);
    return null;
  }
};

// papyrus-db에 Google API 인증 설정
const setupPapyrusAuth = () => {
  if (window.gapi && window.gapi.client) {
    window.papyrusAuth = {
      client: window.gapi.client
    };
  }
};

/**
 * @brief 태그 목록 가져오기
 * @returns {Promise<string[]>} 태그 목록
 */
export const fetchTags = async (): Promise<string[]> => {
  const cacheManager = getCacheManager();
  const action = 'fetchPersonalTags';
  const category = 'personalTags';
  const cacheKey = generateCacheKey(category, action, {});
  
  // 캐시에서 먼저 확인
  const cachedData = await cacheManager.get<string[]>(cacheKey);
  if (cachedData) {
    console.log('🏷️ 캐시에서 개인 태그 로드:', cachedData.length, '개');
    return cachedData;
  }

  try {
    setupPapyrusAuth();
    
    let spreadsheetId = getPersonalConfigSpreadsheetId();
    if (!spreadsheetId) {
      console.warn('개인 설정 파일 ID를 찾을 수 없습니다. 초기화를 시도합니다.');
      spreadsheetId = await initializePersonalConfigFile();
      if (!spreadsheetId) {
        console.error('개인 설정 파일 초기화 실패');
        return [];
      }
    }

    console.log('🏷️ 개인 태그 로드 시작 (캐시 미스)...');
    const data = await getSheetData(spreadsheetId, ENV_CONFIG.CONFIG_TAG_SHEET_NAME);
    
    if (!data || !data.values || data.values.length <= 1) {
      console.log('태그 데이터가 없습니다.');
      return [];
    }

    const tags = data.values.slice(1)
      .map((row: string[]) => row[0])
      .filter(tag => tag && tag.trim() !== '');

    console.log(`🏷️ 개인 태그 로드 완료: ${tags.length}개`);
    
    // 캐시에 저장 (개인 데이터는 30분)
    const ttl = 30 * 60 * 1000;
    await cacheManager.set(cacheKey, tags, ttl);
    console.log('🏷️ 개인 태그 캐시 저장 완료 (TTL: 30분)');
    
    return tags;
  } catch (error) {
    console.error('❌ 태그 가져오기 오류:', error);
    return [];
  }
};

/**
 * @brief 태그 추가
 * @param {string} tag - 추가할 태그
 * @returns {Promise<boolean>} 성공 여부
 */
export const addTag = async (tag: string): Promise<boolean> => {
  try {
    setupPapyrusAuth();
    
    const spreadsheetId = getPersonalConfigSpreadsheetId();
    if (!spreadsheetId) {
      console.warn('개인 설정 파일 ID를 찾을 수 없습니다. 초기화를 시도합니다.');
      const newId = await initializePersonalConfigFile();
      if (!newId) {
        console.error('개인 설정 파일 초기화 실패');
        return false;
      }
    }

    // 중복 확인
    const existingTags = await fetchTags();
    if (existingTags.includes(tag)) {
      console.log('이미 존재하는 태그입니다.');
      return true;
    }

    await append(spreadsheetId || '', ENV_CONFIG.CONFIG_TAG_SHEET_NAME, [[tag]]);
    console.log('✅ 태그 추가 완료:', tag);
    return true;
  } catch (error) {
    console.error('❌ 태그 추가 오류:', error);
    return false;
  }
};

/**
 * @brief 태그 삭제
 * @param {string} tag - 삭제할 태그
 * @returns {Promise<boolean>} 성공 여부
 */
export const removeTag = async (tag: string): Promise<boolean> => {
  try {
    setupPapyrusAuth();
    
    const spreadsheetId = getPersonalConfigSpreadsheetId();
    if (!spreadsheetId) {
      console.error('개인 설정 파일 ID를 찾을 수 없습니다.');
      return false;
    }

    const data = await getSheetData(spreadsheetId, ENV_CONFIG.CONFIG_TAG_SHEET_NAME);
    
    if (!data || !data.values || data.values.length <= 1) {
      console.log('삭제할 태그가 없습니다.');
      return true;
    }

    // 해당 태그 찾기
    const rowIndex = data.values.findIndex(
      (row: string[], index: number) => 
        index > 0 && row[0] === tag
    );

    if (rowIndex === -1) {
      console.log('삭제할 태그를 찾을 수 없습니다.');
      return true;
    }

    // 실제 시트 ID 가져오기
    const sheetId = await getSheetId(spreadsheetId, ENV_CONFIG.CONFIG_TAG_SHEET_NAME);
    if (!sheetId) {
      console.error(`${ENV_CONFIG.CONFIG_TAG_SHEET_NAME} 시트 ID를 찾을 수 없습니다.`);
      return false;
    }

    await deleteRow(spreadsheetId, sheetId, rowIndex);
    console.log('✅ 태그 삭제 완료:', tag);
    return true;
  } catch (error) {
    console.error('❌ 태그 삭제 오류:', error);
    return false;
  }
};

/**
 * @brief 태그 업데이트
 * @param {string} oldTag - 기존 태그
 * @param {string} newTag - 새 태그
 * @returns {Promise<boolean>} 성공 여부
 */
export const updateTag = async (oldTag: string, newTag: string): Promise<boolean> => {
  try {
    setupPapyrusAuth();
    
    const spreadsheetId = getPersonalConfigSpreadsheetId();
    if (!spreadsheetId) {
      console.error('개인 설정 파일 ID를 찾을 수 없습니다.');
      return false;
    }

    const data = await getSheetData(spreadsheetId, ENV_CONFIG.CONFIG_TAG_SHEET_NAME);
    
    if (!data || !data.values || data.values.length <= 1) {
      console.log('업데이트할 태그가 없습니다.');
      return false;
    }

    // 해당 태그 찾기
    const rowIndex = data.values.findIndex(
      (row: string[], index: number) => 
        index > 0 && row[0] === oldTag
    );

    if (rowIndex === -1) {
      console.log('업데이트할 태그를 찾을 수 없습니다.');
      return false;
    }

    await update(spreadsheetId, ENV_CONFIG.CONFIG_TAG_SHEET_NAME, `A${rowIndex + 1}`, [[newTag]]);
    console.log('✅ 태그 업데이트 완료:', oldTag, '->', newTag);
    return true;
  } catch (error) {
    console.error('❌ 태그 업데이트 오류:', error);
    return false;
  }
};

/**
 * @brief 태그를 사용하는 개인 양식들 찾기
 * @param {string} tag - 검색할 태그
 * @returns {Promise<string[]>} 해당 태그를 사용하는 개인 양식 파일명 목록
 */
export const findPersonalTemplatesByTag = async (tag: string): Promise<string[]> => {
  try {
    // 개인 템플릿 폴더에서 파일들 가져오기
    const hotPotatoResponse = await gapi.client.drive.files.list({
      q: `'root' in parents and name='${ENV_CONFIG.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!hotPotatoResponse.result.files || hotPotatoResponse.result.files.length === 0) {
      return [];
    }

    const hotPotatoFolder = hotPotatoResponse.result.files[0];

    // 문서 폴더 찾기
    const documentResponse = await gapi.client.drive.files.list({
      q: `'${hotPotatoFolder.id}' in parents and name='${ENV_CONFIG.DOCUMENT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!documentResponse.result.files || documentResponse.result.files.length === 0) {
      return [];
    }

    const documentFolder = documentResponse.result.files[0];

    // 개인 양식 폴더 찾기
    const personalTemplateResponse = await gapi.client.drive.files.list({
      q: `'${documentFolder.id}' in parents and name='${ENV_CONFIG.PERSONAL_TEMPLATE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!personalTemplateResponse.result.files || personalTemplateResponse.result.files.length === 0) {
      return [];
    }

    const personalTemplateFolder = personalTemplateResponse.result.files[0];

    // 개인 양식 파일들 가져오기
    const templatesResponse = await gapi.client.drive.files.list({
      q: `'${personalTemplateFolder.id}' in parents and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!templatesResponse.result.files) {
      return [];
    }

    // 해당 태그를 사용하는 파일들 찾기
    const matchingFiles: string[] = [];
    
    for (const file of templatesResponse.result.files) {
      const fileName = file.name;
      const titleParts = fileName.split(' / ');
      
      if (titleParts.length >= 1) {
        const fileTag = titleParts[0]; // 태그는 첫 번째 부분 (유형)
        if (fileTag === tag) {
          matchingFiles.push(fileName);
        }
      }
    }

    console.log(`✅ 태그 '${tag}'를 사용하는 개인 양식 ${matchingFiles.length}개 찾음`);
    return matchingFiles;
  } catch (error) {
    console.error('❌ 태그별 개인 양식 찾기 오류:', error);
    return [];
  }
};

/**
 * @brief 태그 수정 시 영향받는 개인 양식들 확인
 * @param {string} oldTag - 기존 태그
 * @param {string} newTag - 새 태그
 * @returns {Promise<{canUpdate: boolean, affectedFiles: string[]}>} 수정 가능 여부와 영향받는 파일들
 */
export const checkTagUpdateImpact = async (oldTag: string, newTag: string): Promise<{canUpdate: boolean, affectedFiles: string[]}> => {
  try {
    const affectedFiles = await findPersonalTemplatesByTag(oldTag);
    
    // 해당 태그를 사용하는 파일들 찾기
    const filesWithThisTag: string[] = [];
    
    for (const fileName of affectedFiles) {
      const titleParts = fileName.split(' / ');
      if (titleParts.length >= 1) {
        const fileTag = titleParts[0]; // 파일명의 첫 번째 부분이 태그(유형)
        if (fileTag === oldTag) {
          filesWithThisTag.push(fileName);
        }
      }
    }

    return {
      canUpdate: true, // 태그 수정은 항상 가능 (파일명만 변경)
      affectedFiles: filesWithThisTag
    };
  } catch (error) {
    console.error('❌ 태그 수정 영향 확인 오류:', error);
    return {
      canUpdate: false,
      affectedFiles: []
    };
  }
};

/**
 * @brief 태그 수정 시 개인 템플릿 메타데이터 업데이트
 * @param {string} oldTag - 기존 태그
 * @param {string} newTag - 새 태그
 * @returns {Promise<boolean>} 성공 여부
 */
export const updatePersonalTemplateMetadata = async (oldTag: string, newTag: string): Promise<boolean> => {
  try {
    console.log('📝 태그 수정으로 인한 개인 템플릿 메타데이터 업데이트:', oldTag, '->', newTag);
    
    // 해당 태그를 사용하는 개인 템플릿들 찾기
    const affectedFiles = await findPersonalTemplatesByTag(oldTag);
    
    if (affectedFiles.length === 0) {
      console.log('업데이트할 파일이 없습니다.');
      return true;
    }

    // 각 파일의 메타데이터 업데이트
    for (const fileName of affectedFiles) {
      // Google Drive에서 파일 ID 찾기
      const filesResponse = await gapi.client.drive.files.list({
        q: `name='${fileName}' and parents in '${await findPersonalTemplateFolder()}'`,
        fields: 'files(id,name)',
        spaces: 'drive'
      });

      if (filesResponse.result.files && filesResponse.result.files.length > 0) {
        const fileId = filesResponse.result.files[0].id;
        
        // 메타데이터 업데이트 (태그만 변경)
        await gapi.client.drive.files.update({
          fileId: fileId,
          resource: {
            properties: {
              tag: newTag
            }
          }
        });
        
        console.log(`✅ 메타데이터 업데이트 완료: ${fileName} (태그: ${oldTag} -> ${newTag})`);
      }
    }

    console.log('✅ 모든 개인 템플릿 메타데이터 업데이트 완료');
    return true;
  } catch (error) {
    console.error('❌ 개인 템플릿 메타데이터 업데이트 오류:', error);
    return false;
  }
};

/**
 * @brief 태그 삭제 시 영향받는 개인 양식들 확인
 * @param {string} tag - 삭제할 태그
 * @returns {Promise<{canDelete: boolean, affectedFiles: string[]}>} 삭제 가능 여부와 영향받는 파일들
 */
export const checkTagDeletionImpact = async (tag: string): Promise<{canDelete: boolean, affectedFiles: string[]}> => {
  try {
    const affectedFiles = await findPersonalTemplatesByTag(tag);
    
    // 해당 태그만 있는 파일들 찾기 (다른 태그가 없는 파일들)
    const filesWithOnlyThisTag: string[] = [];
    
    for (const fileName of affectedFiles) {
      const titleParts = fileName.split(' / ');
      if (titleParts.length >= 1) {
        const fileTag = titleParts[0]; // 파일명의 첫 번째 부분이 태그(유형)
        // 해당 태그만 있는지 확인 (간단한 검증)
        if (fileTag === tag) {
          filesWithOnlyThisTag.push(fileName);
        }
      }
    }

    return {
      canDelete: filesWithOnlyThisTag.length === 0,
      affectedFiles: filesWithOnlyThisTag
    };
  } catch (error) {
    console.error('❌ 태그 삭제 영향 확인 오류:', error);
    return {
      canDelete: false,
      affectedFiles: []
    };
  }
};

// deleteTag alias for compatibility
export const deleteTag = removeTag;
