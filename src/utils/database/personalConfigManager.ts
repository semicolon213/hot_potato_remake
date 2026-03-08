/**
 * @file personalConfigManager.ts
 * @brief 개인 설정 파일 관리 유틸리티
 * @details 개인 드라이브의 user_setting 파일을 관리하는 유틸리티 모듈입니다.
 * @author Hot Potato Team
 * @date 2024
 */

import { getSheetData, append, update } from 'papyrus-db';
import { deleteRow } from 'papyrus-db/dist/sheets/delete';
import { ENV_CONFIG } from '../../config/environment';
import { tokenManager } from '../auth/tokenManager';
import type { GoogleClient, GoogleSheetsCreateParams, GoogleSheetsCreateResponse, GoogleSheetsGetParams, GoogleSheetsGetResponse, GoogleSheetsValuesUpdateParams, GoogleSheetsBatchUpdateParams, GoogleDriveFilesListParams, GoogleDriveFilesUpdateParams, PapyrusAuth } from '../../types/google';

// papyrus-db에 Google API 인증 설정
const setupPapyrusAuth = (): void => {
  if (window.gapi && window.gapi.client) {
    // tokenManager를 사용하여 올바른 토큰 가져오기 (만료 체크 포함)
    const token = tokenManager.get();
    
    if (token) {
      try {
        window.gapi.client.setToken({ access_token: token });
        console.log('✅ 토큰이 gapi client에 설정되었습니다.');
      } catch (tokenError) {
        console.warn('토큰 설정 실패:', tokenError);
      }
    } else {
      console.warn('⚠️ Google API 인증 토큰이 없거나 만료되었습니다.');
    }
    
    // papyrus-db가 gapi.client를 사용하도록 설정
    window.papyrusAuth = {
      client: window.gapi.client
    };
  } else {
    console.warn('⚠️ Google API가 초기화되지 않았습니다.');
  }
};

// 개인 설정 파일 ID 저장
let personalConfigSpreadsheetId: string | null = null;

/**
 * @brief 개인 설정 파일 ID 초기화
 * @details 로그아웃 또는 계정 전환 시 개인 설정 파일 ID를 초기화합니다.
 */
export const clearPersonalConfigSpreadsheetId = (): void => {
    personalConfigSpreadsheetId = null;
    console.log('🧹 개인 설정 파일 ID 초기화 완료');
};

/**
 * @brief 개인 설정 파일 찾기
 * @details 개인 드라이브에서 user_setting 파일을 찾습니다.
 * @returns {Promise<string | null>} 스프레드시트 ID 또는 null
 */
export const findPersonalConfigFile = async (): Promise<string | null> => {
  try {
    setupPapyrusAuth();
    
    console.log('🔍 개인 설정 파일 찾기 시작');
    
    const rootFolderName = ENV_CONFIG.ROOT_FOLDER_NAME;             // ENV v2: FOLER.ROOT 기반 루트 폴더명
    const configFileName = ENV_CONFIG.PERSONAL_CONFIG_FILE_NAME;    // ENV v2: SPREADSHEET.CONFIG 기반 개인 설정 파일명

    // 1단계: 루트에서 루트 폴더 찾기
    const hotPotatoResponse = await window.gapi.client.drive.files.list({
      q: `'root' in parents and name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!hotPotatoResponse.result.files || hotPotatoResponse.result.files.length === 0) {
      console.log(`❌ ${rootFolderName} 폴더를 찾을 수 없습니다`);
      return null;
    }

    const hotPotatoFolder = hotPotatoResponse.result.files[0];
    console.log(`✅ ${rootFolderName} 폴더 찾음:`, hotPotatoFolder.id);

    // 2단계: 루트 폴더에서 개인 설정 파일 찾기
    const configFileResponse = await window.gapi.client.drive.files.list({
      q: `'${hotPotatoFolder.id}' in parents and name='${configFileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!configFileResponse.result.files || configFileResponse.result.files.length === 0) {
      console.log(`❌ ${ENV_CONFIG.PERSONAL_CONFIG_FILE_NAME} 파일을 찾을 수 없습니다`);
      return null;
    }

    const configFile = configFileResponse.result.files[0];
    console.log(`✅ ${ENV_CONFIG.PERSONAL_CONFIG_FILE_NAME} 파일 찾음:`, configFile.id);
    
    personalConfigSpreadsheetId = configFile.id;
    return configFile.id;
  } catch (error) {
    console.error('❌ 개인 설정 파일 찾기 오류:', error);
    return null;
  }
};

/**
 * @brief 개인 템플릿 폴더 ID 찾기
 * @details hot potato/문서/개인 양식 폴더의 ID를 반환합니다.
 * @returns {Promise<string | null>} 개인 템플릿 폴더 ID 또는 null
 */
export const findPersonalTemplateFolder = async (): Promise<string | null> => {
  try {
    console.log('🔍 개인 템플릿 폴더 찾기/생성 시작');
    
    const rootFolderName = ENV_CONFIG.ROOT_FOLDER_NAME;
    const documentFolderName = ENV_CONFIG.DOCUMENT_FOLDER_NAME;
    const personalTemplateFolderName = ENV_CONFIG.PERSONAL_TEMPLATE_FOLDER_NAME;

    // 1단계: 루트에서 루트 폴더 찾기 또는 생성
    let hotPotatoResponse = await window.gapi.client.drive.files.list({
      q: `'root' in parents and name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    let hotPotatoFolder;
    if (!hotPotatoResponse.result.files || hotPotatoResponse.result.files.length === 0) {
      console.log(`📁 ${rootFolderName} 폴더를 찾을 수 없습니다. 생성합니다.`);
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: rootFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['root']
        },
        fields: 'id,name'
      });
      hotPotatoFolder = { id: createResponse.result.id, name: createResponse.result.name };
      console.log(`✅ ${rootFolderName} 폴더 생성 완료:`, hotPotatoFolder.id);
    } else {
      hotPotatoFolder = hotPotatoResponse.result.files[0];
      console.log(`✅ ${rootFolderName} 폴더 찾음:`, hotPotatoFolder.id);
    }

    // 2단계: 루트 폴더에서 문서 폴더 찾기 또는 생성
    let documentResponse = await window.gapi.client.drive.files.list({
      q: `'${hotPotatoFolder.id}' in parents and name='${documentFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    let documentFolder;
    if (!documentResponse.result.files || documentResponse.result.files.length === 0) {
      console.log(`📁 ${documentFolderName} 폴더를 찾을 수 없습니다. 생성합니다.`);
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: documentFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [hotPotatoFolder.id]
        },
        fields: 'id,name'
      });
      documentFolder = { id: createResponse.result.id, name: createResponse.result.name };
      console.log(`✅ ${documentFolderName} 폴더 생성 완료:`, documentFolder.id);
    } else {
      documentFolder = documentResponse.result.files[0];
      console.log(`✅ ${documentFolderName} 폴더 찾음:`, documentFolder.id);
    }

    // 3단계: 문서 폴더에서 개인 양식 폴더 찾기 또는 생성
    let personalTemplateResponse = await window.gapi.client.drive.files.list({
      q: `'${documentFolder.id}' in parents and name='${personalTemplateFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    let personalTemplateFolder;
    if (!personalTemplateResponse.result.files || personalTemplateResponse.result.files.length === 0) {
      console.log(`📁 ${personalTemplateFolderName} 폴더를 찾을 수 없습니다. 생성합니다.`);
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: personalTemplateFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [documentFolder.id]
        },
        fields: 'id,name'
      });
      personalTemplateFolder = { id: createResponse.result.id, name: createResponse.result.name };
      console.log(`✅ ${personalTemplateFolderName} 폴더 생성 완료:`, personalTemplateFolder.id);
    } else {
      personalTemplateFolder = personalTemplateResponse.result.files[0];
      console.log(`✅ ${personalTemplateFolderName} 폴더 찾음:`, personalTemplateFolder.id);
    }

    return personalTemplateFolder.id;
  } catch (error) {
    console.error('❌ 개인 템플릿 폴더 찾기/생성 오류:', error);
    return null;
  }
};

/**
 * @brief 개인 설정 파일 생성
 * @details 루트 폴더에 user_setting 파일을 생성합니다.
 * @returns {Promise<string | null>} 생성된 스프레드시트 ID 또는 null
 */
export const createPersonalConfigFile = async (): Promise<string | null> => {
  try {
    setupPapyrusAuth();
    
    console.log('📄 개인 설정 파일 생성 시작');
    
    // 1단계: 루트 폴더 찾기
    const hotPotatoResponse = await window.gapi.client.drive.files.list({
      q: `'root' in parents and name='${ENV_CONFIG.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
      orderBy: 'name'
    });

    if (!hotPotatoResponse.result.files || hotPotatoResponse.result.files.length === 0) {
      console.log(`❌ ${ENV_CONFIG.ROOT_FOLDER_NAME} 폴더를 찾을 수 없습니다. 폴더를 먼저 생성해주세요.`);
      return null;
    }

    const hotPotatoFolder = hotPotatoResponse.result.files[0];
    console.log(`✅ ${ENV_CONFIG.ROOT_FOLDER_NAME} 폴더 찾음:`, hotPotatoFolder.id);

    // 2단계: hp_potato_DB 스프레드시트 생성
    const sheetsClient = window.gapi.client.sheets;
    const spreadsheet = await sheetsClient.spreadsheets.create({
      resource: {
        properties: {
          title: ENV_CONFIG.PERSONAL_CONFIG_FILE_NAME
        },
        sheets: [
          {
            properties: {
              title: ENV_CONFIG.CONFIG_FAVORITE_SHEET_NAME,
              gridProperties: {
                rowCount: 1000,
                columnCount: 2
              }
            }
          },
          {
            properties: {
              title: ENV_CONFIG.CONFIG_TAG_SHEET_NAME,
              gridProperties: {
                rowCount: 1000,
                columnCount: 1
              }
            }
          },
          {
            properties: {
              title: ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME,
              gridProperties: {
                rowCount: 1000,
                columnCount: 7
              }
            }
          },
          {
            properties: {
              title: ENV_CONFIG.DASHBOARD_SHEET_NAME,
              gridProperties: {
                rowCount: 1000,
                columnCount: 4
              }
            }
          }
        ]
      }
    });

    const spreadsheetId = spreadsheet.result.spreadsheetId;
    console.log('✅ user_setting 파일 생성 완료:', spreadsheetId);

    // 3단계: hot potato 폴더로 이동
    const driveClient = window.gapi.client.drive;
    await driveClient.files.update({
      fileId: spreadsheetId,
      addParents: hotPotatoFolder.id,
      removeParents: 'root'
    });

    // 4단계: 헤더 설정
    await setupPersonalConfigHeaders(spreadsheetId);

    personalConfigSpreadsheetId = spreadsheetId;
    return spreadsheetId;
  } catch (error) {
    console.error('❌ 개인 설정 파일 생성 오류:', error);
    return null;
  }
};

/**
 * @brief 개인 설정 파일 헤더 설정
 * @details 각 시트에 헤더를 설정합니다.
 * @param {string} spreadsheetId - 스프레드시트 ID
 */
export const setupPersonalConfigHeaders = async (spreadsheetId: string): Promise<void> => {
  try {
    setupPapyrusAuth();
    
    const sheetsClient = window.gapi.client.sheets;
    
    // favorite 시트 헤더 설정
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${ENV_CONFIG.CONFIG_FAVORITE_SHEET_NAME}!A1:B1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['type', 'favorite']]
      }
    });

    // tag 시트 헤더 설정
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${ENV_CONFIG.CONFIG_TAG_SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['tag']]
      }
    });

    // schedule 시트 헤더 설정
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME}!A1:G1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['no', 'title', 'date', 'start_time', 'end_time', 'description', 'color']]
      }
    });

    // dashboard 시트 헤더 설정 (ENV v2: CONFIG_DASHBOARD_SHEET_NAME 기반)
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${ENV_CONFIG.DASHBOARD_SHEET_NAME}!A1:D1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['widget_id', 'widget_type', 'widget_order', 'widget_config']]
      }
    });

    console.log('✅ 개인 설정 파일 헤더 설정 완료');
  } catch (error) {
    console.error('❌ 헤더 설정 오류:', error);
    throw error;
  }
};

/**
 * @brief 개인 설정 파일 초기화
 * @details 개인 설정 파일을 찾거나 생성합니다.
 * @returns {Promise<string | null>} 스프레드시트 ID 또는 null
 */
export const initializePersonalConfigFile = async (): Promise<string | null> => {
  try {
    // 먼저 기존 파일 찾기
    let spreadsheetId = await findPersonalConfigFile();
    
    if (spreadsheetId) {
      console.log('✅ 기존 개인 설정 파일 사용:', spreadsheetId);
      personalConfigSpreadsheetId = spreadsheetId;
      
      // 기존 파일의 시트 확인 및 누락된 시트 생성
      try {
        const sheetsClient = window.gapi.client.sheets;
        const spreadsheet = await sheetsClient.spreadsheets.get({
          spreadsheetId: spreadsheetId,
          fields: 'sheets.properties'
        });
        
        const existingSheets = spreadsheet.result.sheets?.map(sheet => sheet.properties?.title) || [];
        console.log('📄 기존 시트 목록:', existingSheets);
        
        const requiredSheets = [ENV_CONFIG.CONFIG_FAVORITE_SHEET_NAME, ENV_CONFIG.CONFIG_TAG_SHEET_NAME, ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME, ENV_CONFIG.DASHBOARD_SHEET_NAME];
        const missingSheets = requiredSheets.filter(sheetName => !existingSheets.includes(sheetName));
        
        if (missingSheets.length > 0) {
          console.log('📄 누락된 시트 생성:', missingSheets);
          
          for (const sheetName of missingSheets) {
            let columnCount = 1;
            if (sheetName === ENV_CONFIG.CONFIG_FAVORITE_SHEET_NAME) {
              columnCount = 2;
            } else if (sheetName === ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME) {
              columnCount = 7;
            } else if (sheetName === ENV_CONFIG.DASHBOARD_SHEET_NAME) {
              columnCount = 4;
            }
            
            await sheetsClient.spreadsheets.batchUpdate({
              spreadsheetId: spreadsheetId,
              resource: {
                requests: [{
                  addSheet: {
                    properties: {
                      title: sheetName,
                      gridProperties: {
                        rowCount: 1000,
                        columnCount: columnCount
                      }
                    }
                  }
                }]
              }
            });
            console.log(`✅ ${sheetName} 시트 생성 완료`);

            // 생성된 시트에 바로 헤더 설정
            let range = '';
            let values: string[][] = [];
            if (sheetName === ENV_CONFIG.CONFIG_FAVORITE_SHEET_NAME) {
              range = `${ENV_CONFIG.CONFIG_FAVORITE_SHEET_NAME}!A1:B1`;
              values = [['type', 'favorite']];
            } else if (sheetName === ENV_CONFIG.CONFIG_TAG_SHEET_NAME) {
              range = `${ENV_CONFIG.CONFIG_TAG_SHEET_NAME}!A1`;
              values = [['tag']];
            } else if (sheetName === ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME) {
              range = `${ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME}!A1:G1`;
              values = [['no', 'title', 'date', 'start_time', 'end_time', 'description', 'color']];
            } else if (sheetName === ENV_CONFIG.DASHBOARD_SHEET_NAME) {
              range = `${ENV_CONFIG.DASHBOARD_SHEET_NAME}!A1:D1`;
              values = [['widget_id', 'widget_type', 'widget_order', 'widget_config']];
            }

            if (range && values.length > 0) {
              await sheetsClient.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                  values: values
                }
              });
              console.log(`✅ ${sheetName} 시트 헤더 설정 완료`);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ 시트 확인 중 오류 발생, 계속 진행:', error);
      }
      
      return spreadsheetId;
    }

    // 파일이 없으면 생성
    console.log('📄 개인 설정 파일이 없어서 새로 생성합니다.');
    spreadsheetId = await createPersonalConfigFile();
    
    if (spreadsheetId) {
      console.log('✅ 개인 설정 파일 생성 완료:', spreadsheetId);
      return spreadsheetId;
    }

    console.error('❌ 개인 설정 파일 초기화 실패');
    return null;
  } catch (error) {
    console.error('❌ 개인 설정 파일 초기화 오류:', error);
    return null;
  }
};

/**
 * @brief 개인 설정 파일 ID 가져오기
 * @returns {string | null} 개인 설정 파일 ID
 */
export const getPersonalConfigSpreadsheetId = (): string | null => {
  return personalConfigSpreadsheetId;
};

/**
 * @brief 개인 설정 파일 ID 설정
 * @param {string} id - 스프레드시트 ID
 */
export const setPersonalConfigSpreadsheetId = (id: string): void => {
  personalConfigSpreadsheetId = id;
};

/**
 * @brief 시간표 일정 가져오기
 * @returns {Promise<any[]>} 시간표 일정 목록
 */
export const getScheduleEvents = async (): Promise<any[]> => {
  try {
    if (!personalConfigSpreadsheetId) {
      console.warn('⚠️ 개인 설정 파일 ID가 없습니다. 초기화를 먼저 시도합니다.');
      await initializePersonalConfigFile();
      if (!personalConfigSpreadsheetId) {
        throw new Error('개인 설정 파일을 찾거나 생성할 수 없습니다.');
      }
    }
    
    setupPapyrusAuth();
    
    // papyrus-db 함수 시그니처에 맞게 수정: getSheetData(spreadsheetId, sheetName)
    const response = await getSheetData(personalConfigSpreadsheetId, ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME);

    // getSheetData가 { values: [...] } 형태의 객체를 반환한다고 가정
    const data = response.values;

    if (!data || data.length === 0) {
      return [];
    }

    // 헤더를 기반으로 객체 생성
    const header = data[0];
    const events = data.slice(1).map(row => {
      const event: any = {};
      header.forEach((key, index) => {
        event[key] = row[index];
      });
      // snake_case -> camelCase 매핑 (프론트엔드 호환)
      if (event.start_time !== undefined) event.startTime = event.start_time;
      if (event.end_time !== undefined) event.endTime = event.end_time;
      return event;
    });

    return events;

  } catch (error) {
    console.error('❌ 시간표 일정 가져오기 오류:', error);
    return [];
  }
};

/**
 * @brief 시간표 일정 추가
 * @param {any} event - 추가할 시간표 일정 데이터
 */
export const addScheduleEvent = async (event: any): Promise<void> => {
  try {
    if (!personalConfigSpreadsheetId) {
      console.warn('⚠️ 개인 설정 파일 ID가 없습니다. 초기화를 먼저 시도합니다.');
      await initializePersonalConfigFile();
      if (!personalConfigSpreadsheetId) {
        throw new Error('개인 설정 파일을 찾거나 생성할 수 없습니다.');
      }
    }
    
    setupPapyrusAuth();

    // 새 'no'를 결정하기 위해 기존 데이터 가져오기
    const existingEvents = await getScheduleEvents();
    const nextNo = existingEvents.length > 0 
      ? Math.max(...existingEvents.map(e => parseInt(e.no, 10) || 0)) + 1 
      : 1;

    const newRow = [
      nextNo.toString(),
      event.title,
      event.day,
      event.startTime ?? event.start_time ?? '',
      event.endTime ?? event.end_time ?? '',
      event.description,
      event.color
    ];
    
    // papyrus-db 함수 시그니처에 맞게 수정: append(spreadsheetId, sheetName, rows)
    await append(personalConfigSpreadsheetId, ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME, [newRow]);

    console.log('✅ 시간표 일정 추가 완료');

  } catch (error) {
    console.error('❌ 시간표 일정 추가 오류:', error);
    throw error;
  }
};

/**
 * @brief 시트 이름으로 시트 ID 조회
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @returns {Promise<number | null>} 시트 ID 또는 null
 */
const getSheetIdByName = async (spreadsheetId: string, sheetName: string): Promise<number | null> => {
  try {
    const sheetsClient = window.gapi.client.sheets;
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: spreadsheetId,
      fields: 'sheets.properties(title,sheetId)'
    });

    const sheet = response.result.sheets?.find(s => s.properties?.title === sheetName);
    
    if (sheet && sheet.properties && typeof sheet.properties.sheetId === 'number') {
      return sheet.properties.sheetId;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ 시트 ID를 가져오는 중 오류 발생 (시트 이름: ${sheetName}):`, error);
    return null;
  }
};

/**
 * @brief 시간표 일정 삭제
 * @param {number} eventNo - 삭제할 시간표 일정의 고유 번호 (no)
 */
export const deleteScheduleEvent = async (eventNo: number): Promise<void> => {
  try {
    if (!personalConfigSpreadsheetId) {
      console.warn('⚠️ 개인 설정 파일 ID가 없습니다. 초기화를 먼저 시도합니다.');
      await initializePersonalConfigFile();
      if (!personalConfigSpreadsheetId) {
        throw new Error('개인 설정 파일을 찾거나 생성할 수 없습니다.');
      }
    }
    
    setupPapyrusAuth();

    // 시트 이름으로 시트 ID 조회
    const sheetId = await getSheetIdByName(personalConfigSpreadsheetId, ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME);
    if (sheetId === null) {
      throw new Error(`'${ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME}' 시트의 ID를 찾을 수 없습니다.`);
    }

    const existingEvents = await getScheduleEvents();
    const rowIndexToDelete = existingEvents.findIndex(event => parseInt(event.no, 10) === eventNo);

    if (rowIndexToDelete !== -1) {
      // deleteRow 함수에 시트 이름 대신 시트 ID를 전달
      // Google Sheets API는 0-based 인덱스를 사용하므로, 데이터 행의 인덱스에 헤더 행 1개를 더해줌
      await deleteRow(personalConfigSpreadsheetId, sheetId, rowIndexToDelete + 1);
      console.log(`✅ 시간표 일정 (no: ${eventNo}) 삭제 완료`);
    } else {
      console.warn(`⚠️ 시간표 일정 (no: ${eventNo})을 찾을 수 없어 삭제하지 못했습니다.`);
    }

  } catch (error) {
    console.error('❌ 시간표 일정 삭제 오류:', error);
    throw error;
  }
};

/**
 * @brief 시간표 일정 업데이트
 * @param {TimetableEvent} event - 업데이트할 시간표 일정 데이터 (no 포함)
 */
export const updateScheduleEvent = async (event: TimetableEvent): Promise<void> => {
  try {
    if (!personalConfigSpreadsheetId) {
      console.warn('⚠️ 개인 설정 파일 ID가 없습니다. 초기화를 먼저 시도합니다.');
      await initializePersonalConfigFile();
      if (!personalConfigSpreadsheetId) {
        throw new Error('개인 설정 파일을 찾거나 생성할 수 없습니다.');
      }
    }
    
    setupPapyrusAuth();

    const existingEvents = await getScheduleEvents();
    // getScheduleEvents는 헤더를 제외한 데이터만 반환하므로, 실제 시트의 행 인덱스를 계산할 때 헤더를 고려해야 함
    const rowIndexToUpdate = existingEvents.findIndex(e => parseInt(e.no, 10) === parseInt(event.no!, 10));

    if (rowIndexToUpdate !== -1) {
      const updatedRow = [
        event.no!.toString(), // 'no'는 항상 문자열이어야 함
        event.title,
        event.day,
        event.startTime ?? event.start_time ?? '',
        event.endTime ?? event.end_time ?? '',
        event.description,
        event.color
      ];
      
      // papyrus-db의 update는 1-based 인덱스를 기대하며, 헤더 행(1행)을 고려하여 +2
      const range = `A${rowIndexToUpdate + 2}:G${rowIndexToUpdate + 2}`;
      await update(personalConfigSpreadsheetId, ENV_CONFIG.CONFIG_SCHEDULE_SHEET_NAME, range, [updatedRow]);
      console.log(`✅ 시간표 일정 (no: ${event.no}) 업데이트 완료`);
    } else {
      console.warn(`⚠️ 시간표 일정 (no: ${event.no})을 찾을 수 없어 업데이트하지 못했습니다.`);
    }

  } catch (error) {
    console.error('❌ 시간표 일정 업데이트 오류:', error);
    throw error;
  }
};


