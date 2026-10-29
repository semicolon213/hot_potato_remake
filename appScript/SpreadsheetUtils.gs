/**
 * SpreadsheetUtils.gs
 * 스프레드시트 유틸리티 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 스프레드시트 유틸리티 함수들 =====

// 스프레드시트 ID는 거의 바뀌지 않으므로 6시간 보관한다.
var SHEET_ID_CACHE_TTL_SEC_ = 6 * 60 * 60;
var SHEET_ID_CACHE_PREFIX_ = 'sheetId:';
var ROOT_FOLDER_CACHE_KEY_ = 'rootFolderId';
var SHEET_ID_CACHE_VERSION_PROP_ = 'SHEET_ID_CACHE_VERSION';

// 한 번의 Apps Script 실행 안에서 재사용한다.
var rootFolderIdMemo_ = null;
var sheetIdMemo_ = {};

function sheetIdCacheKey_(rootId, name) {
  var version = PropertiesService.getScriptProperties().getProperty(SHEET_ID_CACHE_VERSION_PROP_) || '0';
  return SHEET_ID_CACHE_PREFIX_ + version + ':' + rootId + ':' + name;
}

/**
 * 프로젝트 루트 폴더 ID
 * @returns {string|null}
 */
function getProjectRootFolderId_() {
  if (rootFolderIdMemo_) return rootFolderIdMemo_;

  var cache = CacheService.getScriptCache();
  var cached = cache.get(ROOT_FOLDER_CACHE_KEY_);
  if (cached) {
    rootFolderIdMemo_ = cached;
    return rootFolderIdMemo_;
  }

  var props = PropertiesService.getScriptProperties();
  var fromProps = props && props.getProperty('ROOT_FOLDER_ID');
  if (fromProps) {
    try {
      var configuredFolder = DriveApp.getFolderById(fromProps);
      configuredFolder.getName();
      rootFolderIdMemo_ = configuredFolder.getId();
      cache.put(ROOT_FOLDER_CACHE_KEY_, rootFolderIdMemo_, SHEET_ID_CACHE_TTL_SEC_);
      return rootFolderIdMemo_;
    } catch (error) {
      logWarn_('SpreadsheetUtils', 'ROOT_FOLDER_ID 사용 불가, hp_member 부모 폴더를 사용합니다:', error.message);
    }
  }

  try {
    var hpSpreadsheet = getHpMemberSpreadsheet();
    var parents = DriveApp.getFileById(hpSpreadsheet.getId()).getParents();
    if (parents.hasNext()) {
      rootFolderIdMemo_ = parents.next().getId();
      cache.put(ROOT_FOLDER_CACHE_KEY_, rootFolderIdMemo_, SHEET_ID_CACHE_TTL_SEC_);
      return rootFolderIdMemo_;
    }
  } catch (error) {
    logWarn_('SpreadsheetUtils', 'hp_member 부모 폴더 사용 불가:', error.message);
  }

  logWarn_('SpreadsheetUtils', '루트 폴더를 찾을 수 없습니다. ROOT_FOLDER_ID 또는 hp_member 연결을 확인하세요.');
  return null;
}

function isUnderRootFolder_(file, rootId, folderMemo) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (isFolderUnderRoot_(parents.next(), rootId, folderMemo, 0)) return true;
  }
  return false;
}

function isFolderUnderRoot_(folder, rootId, folderMemo, depth) {
  var id = folder.getId();
  if (id === rootId) return true;
  if (Object.prototype.hasOwnProperty.call(folderMemo, id)) return folderMemo[id];
  if (depth > 10) return false;

  var result = false;
  var parents = folder.getParents();
  while (parents.hasNext() && !result) {
    result = isFolderUnderRoot_(parents.next(), rootId, folderMemo, depth + 1);
  }
  folderMemo[id] = result;
  return result;
}

/**
 * 이름 목록에 해당하는 스프레드시트 ID를 한 번에 찾는다.
 * @param {Array<string>} names
 * @returns {Object<string, string|null>}
 */
function findSpreadsheetIdsByNames_(names) {
  var result = {};
  var cache = CacheService.getScriptCache();
  var rootId = getProjectRootFolderId_();
  if (!rootId) {
    names.forEach(function(name) { result[name] = null; });
    return result;
  }

  var pending = [];
  names.forEach(function(name) {
    if (Object.prototype.hasOwnProperty.call(sheetIdMemo_, name)) {
      result[name] = sheetIdMemo_[name];
    } else {
      pending.push(name);
    }
  });
  if (pending.length === 0) return result;

  var cacheKeys = pending.map(function(name) { return sheetIdCacheKey_(rootId, name); });
  var cachedValues = cache.getAll(cacheKeys);
  var missing = [];
  pending.forEach(function(name, index) {
    var cachedId = cachedValues[cacheKeys[index]];
    if (cachedId) {
      result[name] = cachedId;
      sheetIdMemo_[name] = cachedId;
    } else {
      missing.push(name);
    }
  });
  if (missing.length === 0) return result;

  var found = {};
  try {
    var titleQuery = missing.map(function(name) {
      return "title = '" + String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    }).join(' or ');
    var files = DriveApp.searchFiles(
      "mimeType = '" + MimeType.GOOGLE_SHEETS + "' and trashed = false and (" + titleQuery + ')'
    );
    var folderMemo = {};
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (found[name] || missing.indexOf(name) === -1) continue;
      if (isUnderRootFolder_(file, rootId, folderMemo)) {
        found[name] = file.getId();
      }
    }
  } catch (error) {
    logWarn_('SpreadsheetUtils', 'Drive 검색 실패, 폴더 탐색으로 대체:', error.message);
  }

  var unresolved = missing.filter(function(name) { return !found[name]; });
  if (unresolved.length > 0) {
    try {
      var rootFolder = DriveApp.getFolderById(rootId);
      unresolved.forEach(function(name) {
        var matchingFiles = findSpreadsheetInFolderTreeByName_(rootFolder, name);
        if (matchingFiles.length > 0) found[name] = matchingFiles[0].getId();
      });
    } catch (error) {
      logWarn_('SpreadsheetUtils', '폴더 탐색 대체 경로 실패:', error.message);
    }
  }

  var toCache = {};
  missing.forEach(function(name) {
    var id = found[name] || null;
    result[name] = id;
    sheetIdMemo_[name] = id;
    if (id) toCache[sheetIdCacheKey_(rootId, name)] = id;
  });
  if (Object.keys(toCache).length > 0) {
    cache.putAll(toCache, SHEET_ID_CACHE_TTL_SEC_);
  }
  return result;
}

/**
 * 파일을 새로 만들거나 옮긴 뒤 스프레드시트 ID 캐시를 비운다.
 */
function clearSpreadsheetIdCache() {
  var props = PropertiesService.getScriptProperties();
  var version = parseInt(props.getProperty(SHEET_ID_CACHE_VERSION_PROP_) || '0', 10);
  props.setProperty(SHEET_ID_CACHE_VERSION_PROP_, String(version + 1));
  var cache = CacheService.getScriptCache();
  var rootId = rootFolderIdMemo_ || cache.get(ROOT_FOLDER_CACHE_KEY_);
  if (rootId) {
    cache.removeAll([
      workflowSpreadsheetCacheKey_(rootId),
      accountingFolderCacheKey_(rootId)
    ]);
  }
  cache.remove(ROOT_FOLDER_CACHE_KEY_);
  rootFolderIdMemo_ = null;
  sheetIdMemo_ = {};
  workflowSpreadsheetMemo_ = null;
  accountingFolderIdMemo_ = null;
  logDebug_('SpreadsheetUtils', '스프레드시트 ID 캐시를 비웠습니다.');
}

/**
 * 스프레드시트 이름으로 ID 찾기
 * @param {string} sheetName
 * @returns {string|null}
 */
function getSheetIdByName(sheetName) {
  try {
    if (!sheetName) return null;
    return findSpreadsheetIdsByNames_([sheetName])[sheetName] || null;
  } catch (error) {
    logError_('SpreadsheetUtils', '스프레드시트 ID 찾기 오류:', sheetName, error);
    return null;
  }
}

/**
 * Drive 검색 실패 시 사용하는 폴더 트리 대체 탐색
 */
function findSpreadsheetInFolderTreeByName_(folder, sheetName) {
  const result = [];

  try {
    const files = folder.getFilesByName(sheetName);
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        result.push(file);
      }
    }

    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      const subResults = findSpreadsheetInFolderTreeByName_(subFolders.next(), sheetName);
      if (subResults.length > 0) result.push.apply(result, subResults);
    }
  } catch (error) {
    logError_('SpreadsheetUtils', '폴더 트리에서 스프레드시트 검색 오류:', error);
  }

  return result;
}

/**
 * 여러 스프레드시트 이름으로 ID 찾기
 */
function getSpreadsheetIds(req) {
  try {
    const spreadsheetNames = (req.spreadsheetNames || []).filter(function(name) {
      return name && typeof name === 'string';
    });
    if (spreadsheetNames.length === 0) {
      return {
        success: false,
        message: '스프레드시트 이름 배열이 필요합니다.',
        data: {}
      };
    }

    const result = findSpreadsheetIdsByNames_(spreadsheetNames);
    const notFound = spreadsheetNames.filter(function(name) { return !result[name]; });
    logDebug_('SpreadsheetUtils', '스프레드시트 ID 조회:', spreadsheetNames.length, '개 중', spreadsheetNames.length - notFound.length, '개 찾음');

    return {
      success: true,
      data: result,
      notFound: notFound.length > 0 ? notFound : undefined
    };
  } catch (error) {
    logError_('SpreadsheetUtils', '스프레드시트 ID 목록 조회 오류:', error);
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

    return {
      success: true,
      message: `${rowsToDelete.length}개의 문서가 삭제되었습니다.`
    };

  } catch (error) {
    logError_('SpreadsheetUtils', '문서 ID로 행 삭제 오류:', error);
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
        logWarn_('SpreadsheetUtils', '검색할 컬럼을 찾을 수 없습니다:', column);
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
    return results;

  } catch (error) {
    logError_('SpreadsheetUtils', '스프레드시트 데이터 검색 오류:', error);
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

    const data = getSheetData(spreadsheetId, sheetName, 'A:Z');
    if (!data || data.length <= 1) {
      return false;
    }

    const header = data[0];
    const columnIndex = header.indexOf(column);

    if (columnIndex === -1) {
      logWarn_('SpreadsheetUtils', '정렬할 컬럼을 찾을 수 없습니다:', column);
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
    logError_('SpreadsheetUtils', '스프레드시트 데이터 정렬 오류:', error);
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
    return results;

  } catch (error) {
    logError_('SpreadsheetUtils', '스프레드시트 데이터 필터링 오류:', error);
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
      logWarn_('SpreadsheetUtils', '통계할 컬럼을 찾을 수 없습니다:', column);
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
    return stats;

  } catch (error) {
    logError_('SpreadsheetUtils', '스프레드시트 데이터 통계 오류:', error);
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

    return {
      success: true,
      message: '백업이 생성되었습니다.',
      backupId: backupSpreadsheet.getId(),
      backupUrl: backupSpreadsheet.getUrl()
    };

  } catch (error) {
    logError_('SpreadsheetUtils', '스프레드시트 백업 생성 오류:', error);
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
