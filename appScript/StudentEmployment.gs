/**
 * StudentEmployment.gs
 * 학생 취업관리 (employment, field 시트)
 * - 로그인 없이 학번/이름/전화번호로 본인 확인 후 취업 정보 입력
 * - 학생관리에서 취업관리 탭으로 조회/취업 후 수정
 * - 관리자: field(직종 분야) 시트 관리
 */

var STUDENT_INFO_SHEET = 'info';
var EMPLOYMENT_SHEET = 'employment';
var FIELD_SHEET = 'field';

/**
 * student 스프레드시트 ID 반환 (미전달 시 루트 폴더에서 'student' 이름으로 조회)
 */
function getStudentSpreadsheetIdForEmployment(spreadsheetId) {
  if (spreadsheetId) return spreadsheetId;
  try {
    return getSheetIdByName('student');
  } catch (e) {
    return null;
  }
}

/**
 * 학번·이름·전화번호로 본인 확인 (info 시트 기준, 로그인 없이 사용)
 * @param {string} spreadsheetId - student 스프레드시트 ID (없으면 getSheetIdByName('student') 사용)
 * @param {string} std_num - 학번
 * @param {string} name - 이름
 * @param {string} phone - 전화번호
 */
function validateStudentForEmployment(spreadsheetId, std_num, name, phone) {
  try {
    var sid = getStudentSpreadsheetIdForEmployment(spreadsheetId);
    if (!sid || !std_num || !name || !phone) {
      return { success: false, message: '학번, 이름, 전화번호를 모두 입력해주세요.' };
    }
    var data = getSheetData(sid, STUDENT_INFO_SHEET, 'A:H');
    if (!data || data.length <= 1) {
      return { success: false, message: '학생 정보를 찾을 수 없습니다.' };
    }
    var header = data[0];
    var noIndex = 0;
    var nameIndex = 1;
    var phoneIndex = 3;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowNo = row[noIndex] ? String(row[noIndex]).trim() : '';
      if (rowNo !== String(std_num).trim()) continue;
      var rowName = row[nameIndex] ? String(row[nameIndex]).trim() : '';
      var rowPhoneRaw = row[phoneIndex];
      var rowPhone = '';
      try {
        if (rowPhoneRaw && typeof rowPhoneRaw === 'string' && rowPhoneRaw.length > 0) {
          if (/^010-\d{4}-\d{4}$/.test(rowPhoneRaw)) {
            rowPhone = rowPhoneRaw;
          } else {
            rowPhone = decryptEmailMain(rowPhoneRaw);
          }
        }
      } catch (e) {
        rowPhone = String(rowPhoneRaw || '');
      }
      var nameMatch = rowName === String(name).trim();
      var phoneMatch = rowPhone.replace(/\s/g, '') === String(phone).replace(/\s/g, '');
      if (nameMatch && phoneMatch) {
        return { success: true, name: rowName, std_num: rowNo };
      }
      return { success: false, message: '이름 또는 전화번호가 일치하지 않습니다.' };
    }
    return { success: false, message: '해당 학번의 학생을 찾을 수 없습니다.' };
  } catch (error) {
    console.error('validateStudentForEmployment 오류:', error);
    return { success: false, message: '확인 중 오류가 발생했습니다: ' + error.message };
  }
}

/**
 * 학번으로 취업 정보 한 건 조회
 */
function getEmploymentByStdNum(spreadsheetId, std_num) {
  try {
    if (!spreadsheetId || !std_num) {
      return { success: false, data: null };
    }
    var data = getSheetData(spreadsheetId, EMPLOYMENT_SHEET, 'A:F');
    if (!data || data.length <= 1) return { success: true, data: null };
    var header = data[0];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[0] || '').trim() !== String(std_num).trim()) continue;
      return {
        success: true,
        data: {
          std_num: String(row[0] || '').trim(),
          is_major: row[1] === true || row[1] === 'TRUE' || row[1] === 'O' || row[1] === '1',
          field_num: String(row[2] || '').trim(),
          com_name: String(row[3] || '').trim(),
          occ_category: String(row[4] || '').trim(),
          question: String(row[5] || '').trim()
        }
      };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('getEmploymentByStdNum 오류:', error);
    return { success: false, data: null, message: error.message };
  }
}

/**
 * 취업 정보 저장 (신규 추가 또는 전체 덮어쓰기)
 */
function saveEmployment(spreadsheetId, payload) {
  try {
    if (!spreadsheetId || !payload || !payload.std_num) {
      return { success: false, message: '스프레드시트 ID와 학번이 필요합니다.' };
    }
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName(EMPLOYMENT_SHEET);
    if (!sheet) return { success: false, message: 'employment 시트를 찾을 수 없습니다.' };
    var data = sheet.getDataRange().getValues();
    var std_num = String(payload.std_num).trim();
    var isMajor = payload.is_major === true || payload.is_major === 'O' || payload.is_major === '1';
    var fieldNum = String(payload.field_num || '').trim();
    var comName = String(payload.com_name || '').trim();
    var occCategory = String(payload.occ_category || '').trim();
    var question = String(payload.question || '').trim();
    var rowIndex = -1;
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0] || '').trim() === std_num) {
          rowIndex = i + 1;
          break;
        }
      }
    }
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, rowIndex, 6).setValues([[std_num, isMajor, fieldNum, comName, occCategory, question]]);
      return { success: true, message: '취업 정보가 수정되었습니다.' };
    }
    sheet.appendRow([std_num, isMajor, fieldNum, comName, occCategory, question]);
    return { success: true, message: '취업 정보가 등록되었습니다.' };
  } catch (error) {
    console.error('saveEmployment 오류:', error);
    return { success: false, message: '저장 중 오류: ' + error.message };
  }
}

/**
 * 취업 후 필드만 수정 (학생관리에서 수정)
 */
function updateEmploymentAfter(spreadsheetId, std_num, payload) {
  try {
    if (!spreadsheetId || !std_num || !payload) {
      return { success: false, message: '필수 값이 없습니다.' };
    }
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(EMPLOYMENT_SHEET);
    if (!sheet) return { success: false, message: 'employment 시트를 찾을 수 없습니다.' };
    var data = sheet.getDataRange().getValues();
    var std_numStr = String(std_num).trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() !== std_numStr) continue;
      var row = i + 1;
      if (payload.com_name !== undefined) sheet.getRange(row, 4).setValue(String(payload.com_name));
      if (payload.occ_category !== undefined) sheet.getRange(row, 5).setValue(String(payload.occ_category));
      if (payload.question !== undefined) sheet.getRange(row, 6).setValue(String(payload.question));
      return { success: true, message: '취업 후 정보가 수정되었습니다.' };
    }
    return { success: false, message: '해당 학번의 취업 정보를 찾을 수 없습니다.' };
  } catch (error) {
    console.error('updateEmploymentAfter 오류:', error);
    return { success: false, message: '수정 중 오류: ' + error.message };
  }
}

/**
 * 직종 분야 목록 (field 시트)
 */
function getFieldList(spreadsheetId) {
  try {
    if (!spreadsheetId) return { success: false, data: [] };
    var data = getSheetData(spreadsheetId, FIELD_SHEET, 'A:B');
    if (!data || data.length <= 1) return { success: true, data: [] };
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var num = String(row[0] || '').trim();
      var name = String(row[1] || '').trim();
      if (!num && !name) continue;
      list.push({ field_num: num, field_name: name });
    }
    return { success: true, data: list };
  } catch (error) {
    console.error('getFieldList 오류:', error);
    return { success: false, data: [], message: error.message };
  }
}

/**
 * 관리자 여부 확인 (hp_member user 시트)
 */
function isAdminByEmail(userEmail) {
  try {
    var spreadsheet = getHpMemberSpreadsheet();
    var spreadsheetId = spreadsheet.getId();
    var data = getSheetData(spreadsheetId, 'user', 'A:G');
    if (!data || data.length <= 1) return false;
    var header = data[0];
    var colGoogle = header.indexOf('google_member');
    if (colGoogle === -1) return false;
    var colAdmin = header.indexOf('is_admin');
    if (colAdmin === -1) return false;
    var encryptedVariants = getEncryptedEmailsForLookup(userEmail);
    for (var i = 1; i < data.length; i++) {
      var gm = data[i][colGoogle];
      if (!encryptedVariants.includes(gm)) continue;
      var admin = data[i][colAdmin];
      return admin === 'O' || admin === true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 조교(supp) 여부 확인 (hp_member user 시트의 user_type)
 */
function isSuppByEmail(userEmail) {
  try {
    var spreadsheet = getHpMemberSpreadsheet();
    var spreadsheetId = spreadsheet.getId();
    var data = getSheetData(spreadsheetId, 'user', 'A:G');
    if (!data || data.length <= 1) return false;
    var header = data[0];
    var colGoogle = header.indexOf('google_member');
    var colUserType = header.indexOf('user_type');
    if (colGoogle === -1 || colUserType === -1) return false;
    var encryptedVariants = getEncryptedEmailsForLookup(userEmail);
    for (var i = 1; i < data.length; i++) {
      var gm = data[i][colGoogle];
      if (!encryptedVariants.includes(gm)) continue;
      var ut = String(data[i][colUserType] || '').trim().toLowerCase();
      return ut === 'supp';
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 직종 분야 추가 (관리자만)
 */
function createField(spreadsheetId, field_num, field_name, userEmail) {
  if (!userEmail || !isAdminByEmail(userEmail)) {
    return { success: false, message: '관리자 권한이 필요합니다.' };
  }
  try {
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(FIELD_SHEET);
    if (!sheet) return { success: false, message: 'field 시트를 찾을 수 없습니다.' };
    sheet.appendRow([String(field_num || '').trim(), String(field_name || '').trim()]);
    return { success: true, message: '직종 분야가 추가되었습니다.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * 직종 분야 수정 (관리자만)
 */
function updateField(spreadsheetId, field_num, field_name, userEmail) {
  if (!userEmail || !isAdminByEmail(userEmail)) {
    return { success: false, message: '관리자 권한이 필요합니다.' };
  }
  try {
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(FIELD_SHEET);
    if (!sheet) return { success: false, message: 'field 시트를 찾을 수 없습니다.' };
    var data = sheet.getDataRange().getValues();
    var target = String(field_num).trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() !== target) continue;
      sheet.getRange(i + 1, 2).setValue(String(field_name || '').trim());
      return { success: true, message: '직종 분야가 수정되었습니다.' };
    }
    return { success: false, message: '해당 분야 번호를 찾을 수 없습니다.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * 직종 분야 삭제 (관리자만)
 */
function deleteField(spreadsheetId, field_num, userEmail) {
  if (!userEmail || !isAdminByEmail(userEmail)) {
    return { success: false, message: '관리자 권한이 필요합니다.' };
  }
  try {
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(FIELD_SHEET);
    if (!sheet) return { success: false, message: 'field 시트를 찾을 수 없습니다.' };
    var data = sheet.getDataRange().getValues();
    var target = String(field_num).trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() !== target) continue;
      sheet.deleteRow(i + 1);
      return { success: true, message: '직종 분야가 삭제되었습니다.' };
    }
    return { success: false, message: '해당 분야 번호를 찾을 수 없습니다.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
