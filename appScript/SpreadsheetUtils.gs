/**
 * SpreadsheetUtils.gs
 * 스프레드시트 유틸리티 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 스프레드시트 유틸리티 함수들 =====

/**
 * 스프레드시트 이름으로 ID 찾기
 * - 검색 범위: "프로젝트 루트 폴더" 하위만 검색 (드라이브 전체 검색 X)
 * - 루트 폴더 결정: 1) ROOT_FOLDER_ID(환경변수) 있으면 우선, 2) 없으면 hp_member 부모 폴더
 *   (웹앱/트리거 등에서는 hp_member를 못 쓸 수 있으므로 ROOT_FOLDER_ID 설정 권장)
 *
 * @param {string} sheetName - 찾을 스프레드시트 파일 이름 (예: 'static_tag', '워크플로우_관리')
 * @returns {string|null} 스프레드시트 ID, 없으면 null
 */
function getSheetIdByName(sheetName) {
  try {
    console.log('📊 스프레드시트 ID 찾기 시작:', sheetName);

    var rootFolder = null;
    var props = PropertiesService.getScriptProperties();

    // ----- 1) 스크립트 속성 ROOT_FOLDER_ID (명시적으로 지정한 경우만 우선) -----
    var rootFolderId = props && props.getProperty('ROOT_FOLDER_ID');
    if (rootFolderId) {
      try {
        rootFolder = DriveApp.getFolderById(rootFolderId);
        console.log('📁 루트 폴더 (ROOT_FOLDER_ID):', rootFolder.getId());
      } catch (e) {
        console.warn('📁 ROOT_FOLDER_ID 사용 불가:', e.message);
      }
    }

    // ----- 2) hp_member 스프레드시트의 부모 폴더 (실제 프로젝트 폴더) -----
    if (!rootFolder) {
      try {
        var hpSpreadsheet = getHpMemberSpreadsheet();
        if (hpSpreadsheet) {
          var file = DriveApp.getFileById(hpSpreadsheet.getId());
          var parents = file.getParents();
          if (parents.hasNext()) {
            rootFolder = parents.next();
            console.log('📁 루트 폴더 (hp_member 부모):', rootFolder.getId());
          }
        }
      } catch (e) {
        console.warn('📁 hp_member 부모 폴더 사용 불가:', e.message);
      }
    }

    if (!rootFolder) {
      console.warn('📁 루트 폴더를 찾을 수 없습니다. 스크립트 속성 ROOT_FOLDER_ID 또는 hp_member 연결을 확인하세요.');
      return null;
    }

    // ----- 루트 폴더 + 모든 하위 폴더에서 sheetName과 같은 이름의 구글 시트만 검색 -----
    var foundFiles = findSpreadsheetInFolderTreeByName_(rootFolder, sheetName);

    if (!foundFiles || foundFiles.length === 0) {
      console.warn('📊 루트 폴더 하위에서 스프레드시트를 찾을 수 없습니다:', sheetName);
      return null;
    }

    if (foundFiles.length > 1) {
      console.warn('⚠️ 루트 폴더 하위에 같은 이름의 스프레드시트가 여러 개 있습니다. 첫 번째 파일만 사용합니다. 개수:', foundFiles.length);
    }

    const spreadsheetId = foundFiles[0].getId();
    console.log('📊 스프레드시트 ID 찾기 성공 (루트 폴더 하위 검색):', spreadsheetId);
    return spreadsheetId;

  } catch (error) {
    console.error('📊 스프레드시트 ID 찾기 오류:', error);
    return null;
  }
}

/**
 * 폴더 트리(현재 폴더 + 모든 하위 폴더)에서 이름이 일치하는 구글 스프레드시트만 찾기
 * - getSheetIdByName에서 "프로젝트 루트 하위만 검색"할 때 사용
 * - 루트 직하위뿐 아니라 하위 폴더(예: 문서/static_tag)까지 재귀 검색
 *
 * @param {Folder} folder - 검색 시작 폴더 (루트 또는 하위 폴더)
 * @param {string} sheetName - 찾을 스프레드시트 파일 이름
 * @returns {Array<File>} 발견된 구글 시트 파일 목록 (MimeType.GOOGLE_SHEETS만 포함)
 */
function findSpreadsheetInFolderTreeByName_(folder, sheetName) {
  const result = [];

  try {
    // 현재 폴더에서 이름이 sheetName인 파일만 검색 (동명 폴더/문서는 제외)
    const files = folder.getFilesByName(sheetName);
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        result.push(file);
      }
    }

    // 하위 폴더를 재귀적으로 탐색 (예: hot_potato_remake → document → static_tag)
    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      const subFolder = subFolders.next();
      const subResults = findSpreadsheetInFolderTreeByName_(subFolder, sheetName);
      if (subResults && subResults.length > 0) {
        result.push.apply(result, subResults);
      }
    }
  } catch (error) {
    console.error('📁 폴더 트리에서 스프레드시트 검색 오류:', error);
  }

  return result;
}

/**
 * 여러 스프레드시트 이름으로 ID 찾기
 * @param {Object} req - 요청 데이터 { spreadsheetNames: Array<string> }
 * @returns {Object} 응답 결과 { success: boolean, data: Object<string, string|null> }
 */
function getSpreadsheetIds(req) {
  try {
    console.log('📊 스프레드시트 ID 목록 조회 시작:', req);
    
    const spreadsheetNames = req.spreadsheetNames || [];
    if (!Array.isArray(spreadsheetNames) || spreadsheetNames.length === 0) {
      return {
        success: false,
        message: '스프레드시트 이름 배열이 필요합니다.',
        data: {}
      };
    }

    const result = {};
    const notFound = [];
    
    // 각 스프레드시트 이름으로 ID 찾기
    spreadsheetNames.forEach(name => {
      if (!name || typeof name !== 'string') {
        console.warn('📊 유효하지 않은 스프레드시트 이름:', name);
        result[name] = null;
        return;
      }
      
      const id = getSheetIdByName(name);
      result[name] = id;
      
      if (!id) {
        notFound.push(name);
      }
    });
    
    console.log('📊 스프레드시트 ID 목록 조회 완료:', {
      total: spreadsheetNames.length,
      found: spreadsheetNames.length - notFound.length,
      notFound: notFound.length > 0 ? notFound : '없음'
    });

    return {
      success: true,
      data: result,
      notFound: notFound.length > 0 ? notFound : undefined
    };
    
  } catch (error) {
    console.error('📊 스프레드시트 ID 목록 조회 오류:', error);
    return {
      success: false,
      message: '스프레드시트 ID 조회 중 오류가 발생했습니다: ' + error.message,
      data: {}
    };
  }
}

/**
 * 문서 ID로 행 삭제
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {Array} documentIds - 삭제할 문서 ID 배열
 * @returns {Object} 삭제 결과
 */
function deleteRowsByDocIds(spreadsheetId, sheetName, documentIds) {
  try {
    console.log('🗑️ 문서 ID로 행 삭제 시작:', { spreadsheetId, sheetName, documentIds });

    const data = getSheetData(spreadsheetId, sheetName, 'A:Z');
    if (!data || data.length <= 1) {
      return {
        success: true,
        message: '삭제할 데이터가 없습니다.'
      };
    }

    const header = data[0];
    const documentIdColumnIndex = header.indexOf('document_id');

    if (documentIdColumnIndex === -1) {
      return {
        success: false,
        message: 'document_id 컬럼을 찾을 수 없습니다.'
      };
    }

    const rowsToDelete = [];

    // 삭제할 행 찾기
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const docId = row[documentIdColumnIndex];

      if (documentIds.includes(docId)) {
        rowsToDelete.push(i + 1); // 스프레드시트 행 번호 (1부터 시작)
      }
    }

    if (rowsToDelete.length === 0) {
      return {
        success: true,
        message: '삭제할 문서를 찾을 수 없습니다.'
      };
    }

    // 행 삭제 (역순으로 삭제하여 인덱스 문제 방지)
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    rowsToDelete.sort((a, b) => b - a).forEach(rowIndex => {
      sheet.deleteRow(rowIndex);
    });

    console.log('🗑️ 문서 ID로 행 삭제 완료:', rowsToDelete.length, '행');

    return {
      success: true,
      message: `${rowsToDelete.length}개의 문서가 삭제되었습니다.`
    };

  } catch (error) {
    console.error('🗑️ 문서 ID로 행 삭제 오류:', error);
    return {
      success: false,
      message: '문서 삭제 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 스프레드시트 데이터 검색
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} searchTerm - 검색어
 * @param {string} column - 검색할 컬럼
 * @returns {Array} 검색 결과
 */
function searchSpreadsheetData(spreadsheetId, sheetName, searchTerm, column = null) {
  try {
    console.log('🔍 스프레드시트 데이터 검색 시작:', { spreadsheetId, sheetName, searchTerm, column });

    const data = getSheetData(spreadsheetId, sheetName, 'A:Z');
    if (!data || data.length <= 1) {
      return [];
    }

    const header = data[0];
    const results = [];

    // 검색할 컬럼 인덱스 찾기
    let searchColumnIndex = -1;
    if (column) {
      searchColumnIndex = header.indexOf(column);
      if (searchColumnIndex === -1) {
        console.warn('검색할 컬럼을 찾을 수 없습니다:', column);
        return [];
      }
    }

    // 데이터 검색
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (searchColumnIndex !== -1) {
        // 특정 컬럼에서 검색
        const cellValue = row[searchColumnIndex];
        if (cellValue && cellValue.toString().toLowerCase().includes(searchTerm.toLowerCase())) {
          const result = {};
          header.forEach((key, index) => {
            result[key] = row[index];
          });
          results.push(result);
        }
      } else {
        // 모든 컬럼에서 검색
        const found = row.some(cellValue =>
          cellValue && cellValue.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (found) {
          const result = {};
          header.forEach((key, index) => {
            result[key] = row[index];
          });
          results.push(result);
        }
      }
    }

    console.log('🔍 스프레드시트 데이터 검색 완료:', results.length, '개 결과');
    return results;

  } catch (error) {
    console.error('🔍 스프레드시트 데이터 검색 오류:', error);
    return [];
  }
}

/**
 * 스프레드시트 데이터 정렬
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} column - 정렬할 컬럼
 * @param {boolean} ascending - 오름차순 여부
 * @returns {boolean} 성공 여부
 */
function sortSpreadsheetData(spreadsheetId, sheetName, column, ascending = true) {
  try {
    console.log('📊 스프레드시트 데이터 정렬 시작:', { spreadsheetId, sheetName, column, ascending });

    const data = getSheetData(spreadsheetId, sheetName, 'A:Z');
    if (!data || data.length <= 1) {
      return false;
    }

    const header = data[0];
    const columnIndex = header.indexOf(column);

    if (columnIndex === -1) {
      console.warn('정렬할 컬럼을 찾을 수 없습니다:', column);
      return false;
    }

    // 데이터 정렬 (헤더 제외)
    const dataRows = data.slice(1);
    dataRows.sort((a, b) => {
      const aValue = a[columnIndex];
      const bValue = b[columnIndex];

      if (ascending) {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // 정렬된 데이터로 시트 업데이트
    const sortedData = [header, ...dataRows];
    const range = `A1:${String.fromCharCode(65 + header.length - 1)}${sortedData.length}`;

    return setSheetData(spreadsheetId, sheetName, range, sortedData);

  } catch (error) {
    console.error('📊 스프레드시트 데이터 정렬 오류:', error);
    return false;
  }
}

/**
 * 스프레드시트 데이터 필터링
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {Object} filters - 필터 조건
 * @returns {Array} 필터링된 데이터
 */
function filterSpreadsheetData(spreadsheetId, sheetName, filters) {
  try {
    console.log('🔍 스프레드시트 데이터 필터링 시작:', { spreadsheetId, sheetName, filters });

    const data = getSheetData(spreadsheetId, sheetName, 'A:Z');
    if (!data || data.length <= 1) {
      return [];
    }

    const header = data[0];
    const results = [];

    // 데이터 필터링
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let matches = true;

      // 각 필터 조건 확인
      Object.keys(filters).forEach(column => {
        const columnIndex = header.indexOf(column);
        if (columnIndex !== -1) {
          const cellValue = row[columnIndex];
          const filterValue = filters[column];

          if (cellValue !== filterValue) {
            matches = false;
          }
        }
      });

      if (matches) {
        const result = {};
        header.forEach((key, index) => {
          result[key] = row[index];
        });
        results.push(result);
      }
    }

    console.log('🔍 스프레드시트 데이터 필터링 완료:', results.length, '개 결과');
    return results;

  } catch (error) {
    console.error('🔍 스프레드시트 데이터 필터링 오류:', error);
    return [];
  }
}

/**
 * 스프레드시트 데이터 통계
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {string} column - 통계할 컬럼
 * @returns {Object} 통계 결과
 */
function getSpreadsheetStats(spreadsheetId, sheetName, column) {
  try {
    console.log('📊 스프레드시트 데이터 통계 시작:', { spreadsheetId, sheetName, column });

    const data = getSheetData(spreadsheetId, sheetName, 'A:Z');
    if (!data || data.length <= 1) {
      return {
        total: 0,
        unique: 0,
        mostCommon: null,
        leastCommon: null
      };
    }

    const header = data[0];
    const columnIndex = header.indexOf(column);

    if (columnIndex === -1) {
      console.warn('통계할 컬럼을 찾을 수 없습니다:', column);
      return null;
    }

    const values = data.slice(1).map(row => row[columnIndex]);
    const valueCounts = {};

    // 값 카운트
    values.forEach(value => {
      if (value) {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      }
    });

    // 통계 계산
    const total = values.length;
    const unique = Object.keys(valueCounts).length;

    let mostCommon = null;
    let leastCommon = null;
    let maxCount = 0;
    let minCount = Infinity;

    Object.keys(valueCounts).forEach(value => {
      const count = valueCounts[value];
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
      if (count < minCount) {
        minCount = count;
        leastCommon = value;
      }
    });

    const stats = {
      total: total,
      unique: unique,
      mostCommon: mostCommon,
      leastCommon: leastCommon,
      valueCounts: valueCounts
    };

    console.log('📊 스프레드시트 데이터 통계 완료');
    return stats;

  } catch (error) {
    console.error('📊 스프레드시트 데이터 통계 오류:', error);
    return null;
  }
}

/**
 * 스프레드시트 백업 생성
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Object} 백업 결과
 */
function createSpreadsheetBackup(spreadsheetId) {
  try {
    console.log('💾 스프레드시트 백업 생성 시작:', spreadsheetId);

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const backupName = `${spreadsheet.getName()}_backup_${new Date().toISOString().split('T')[0]}`;

    // 백업 스프레드시트 생성
    const backupSpreadsheet = SpreadsheetApp.create(backupName);

    // 모든 시트 복사
    const sheets = spreadsheet.getSheets();
    sheets.forEach(sheet => {
      const backupSheet = backupSpreadsheet.insertSheet(sheet.getName());
      const data = sheet.getDataRange().getValues();
      backupSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    });

    // 원본 시트 삭제
    backupSpreadsheet.deleteSheet(backupSpreadsheet.getSheets()[0]);

    console.log('💾 스프레드시트 백업 생성 완료:', backupSpreadsheet.getId());

    return {
      success: true,
      message: '백업이 생성되었습니다.',
      backupId: backupSpreadsheet.getId(),
      backupUrl: backupSpreadsheet.getUrl()
    };

  } catch (error) {
    console.error('💾 스프레드시트 백업 생성 오류:', error);
    return {
      success: false,
      message: '백업 생성 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getSpreadsheetUtilsInfo() {
  return {
    version: '1.0.0',
    description: '스프레드시트 유틸리티 함수들',
    functions: [
      'deleteRowsByDocIds',
      'searchSpreadsheetData',
      'sortSpreadsheetData',
      'filterSpreadsheetData',
      'getSpreadsheetStats',
      'createSpreadsheetBackup'
    ],
    dependencies: ['SpreadsheetCore.gs']
  };
}
