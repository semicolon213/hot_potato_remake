/**
 * StudentManagement.gs
 * 학생 관리 관련 함수들
 * Hot Potato ERP System
 */

/**
 * 학생 유급 여부 조회
 * @param {string} studentId - 학번
 * @param {string} spreadsheetId - 학생 스프레드시트 ID
 * @returns {Object} 유급 여부 정보
 */
function getStudentRetainedStatus(studentId, spreadsheetId) {
  try {
    console.log('📚 학생 유급 여부 조회 시작:', { studentId, spreadsheetId });
    
    if (!studentId || !spreadsheetId) {
      return {
        success: false,
        message: '학번과 스프레드시트 ID가 필요합니다.'
      };
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = 'info'; // 학생 정보 시트 이름
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return {
        success: false,
        message: '학생 정보 시트를 찾을 수 없습니다.'
      };
    }
    
    // 헤더 행 찾기
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const studentIdColIndex = headerRow.findIndex(h => 
      h && (h.toString().includes('학번') || h.toString().includes('no_student') || h.toString().toLowerCase().includes('no'))
    );
    const retainedColIndex = headerRow.findIndex(h => 
      h && (h.toString().toLowerCase().includes('flunk') || h.toString().includes('유급') || h.toString().includes('retained') || h.toString().includes('is_retained'))
    );
    
    if (studentIdColIndex === -1) {
      return {
        success: false,
        message: '학번 컬럼을 찾을 수 없습니다.'
      };
    }
    
    // 유급 컬럼이 없으면 생성 (H열)
    let finalRetainedColIndex;
    if (retainedColIndex === -1) {
      const newColIndex = 8; // H열
      sheet.getRange(1, newColIndex).setValue('flunk');
      console.log('✅ 유급 컬럼 추가됨 (H열)');
      finalRetainedColIndex = 8; // 1-based index
    } else {
      finalRetainedColIndex = retainedColIndex + 1; // 1-based index
    }
    
    // 학생 찾기
    const data = sheet.getDataRange().getValues();
    let studentRowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][studentIdColIndex] && String(data[i][studentIdColIndex]).trim() === String(studentId).trim()) {
        studentRowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (studentRowIndex === -1) {
      return {
        success: false,
        message: '해당 학번의 학생을 찾을 수 없습니다.'
      };
    }
    
    // 유급 여부 읽기 (O 또는 숫자 값이면 유급으로 간주)
    const retainedValue = sheet.getRange(studentRowIndex, finalRetainedColIndex).getValue();
    const retainedStr = String(retainedValue || '').trim();
    const isRetained = retainedStr === 'O' || retainedStr === 'TRUE' || retainedStr !== '';
    
    console.log('✅ 유급 여부 조회 완료:', { studentId, isRetained, retainedValue: retainedStr });
    
    return {
      success: true,
      data: {
        isRetained: isRetained ? 'O' : '',
        studentId: studentId
      }
    };
    
  } catch (error) {
    console.error('❌ 학생 유급 여부 조회 실패:', error);
    return {
      success: false,
      message: '유급 여부 조회 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 학생 유급 여부 업데이트
 * @param {string} studentId - 학번
 * @param {string} spreadsheetId - 학생 스프레드시트 ID
 * @param {boolean} isRetained - 유급 여부
 * @returns {Object} 업데이트 결과
 */
function updateStudentRetained(studentId, spreadsheetId, isRetained) {
  try {
    console.log('📚 학생 유급 여부 업데이트 시작:', { studentId, spreadsheetId, isRetained });
    
    if (!studentId || !spreadsheetId) {
      return {
        success: false,
        message: '학번과 스프레드시트 ID가 필요합니다.'
      };
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = 'info'; // 학생 정보 시트 이름
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return {
        success: false,
        message: '학생 정보 시트를 찾을 수 없습니다.'
      };
    }
    
    // 헤더 행 찾기
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const studentIdColIndex = headerRow.findIndex(h => 
      h && (h.toString().includes('학번') || h.toString().includes('no_student') || h.toString().toLowerCase().includes('no'))
    );
    let retainedColIndex = headerRow.findIndex(h => 
      h && (h.toString().toLowerCase().includes('flunk') || h.toString().includes('유급') || h.toString().includes('retained') || h.toString().includes('is_retained'))
    );
    
    if (studentIdColIndex === -1) {
      return {
        success: false,
        message: '학번 컬럼을 찾을 수 없습니다.'
      };
    }
    
    // 유급 컬럼이 없으면 생성 (H열)
    let finalRetainedColIndex;
    if (retainedColIndex === -1) {
      const newColIndex = 8; // H열
      sheet.getRange(1, newColIndex).setValue('flunk');
      retainedColIndex = newColIndex - 1; // 0-based index
      console.log('✅ 유급 컬럼 추가됨 (H열)');
    }
    finalRetainedColIndex = retainedColIndex + 1; // 1-based index
    
    // 학생 찾기
    const data = sheet.getDataRange().getValues();
    let studentRowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][studentIdColIndex] && String(data[i][studentIdColIndex]).trim() === String(studentId).trim()) {
        studentRowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (studentRowIndex === -1) {
      return {
        success: false,
        message: '해당 학번의 학생을 찾을 수 없습니다.'
      };
    }
    
    // 유급 여부 업데이트
    const retainedValue = isRetained ? 'O' : '';
    sheet.getRange(studentRowIndex, finalRetainedColIndex).setValue(retainedValue);
    
    console.log('✅ 유급 여부 업데이트 완료:', { studentId, isRetained, row: studentRowIndex, col: finalRetainedColIndex });
    
    return {
      success: true,
      message: isRetained ? '유급으로 표시되었습니다.' : '유급 표시가 해제되었습니다.',
      data: {
        studentId: studentId,
        isRetained: retainedValue
      }
    };
    
  } catch (error) {
    console.error('❌ 학생 유급 여부 업데이트 실패:', error);
    return {
      success: false,
      message: '유급 여부 업데이트 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 졸업 학년 조회 (스크립트 속성에 저장, 기본값 3)
 * @param {string} spreadsheetId - 학생 스프레드시트 ID
 * @returns {Object} { success, data: number }
 */
function getGraduationGrade(spreadsheetId) {
  try {
    if (!spreadsheetId) return { success: false, message: '스프레드시트 ID가 필요합니다.' };
    var key = 'GRADUATION_GRADE_' + spreadsheetId;
    var val = PropertiesService.getScriptProperties().getProperty(key);
    var grade = val ? parseInt(val, 10) : 3;
    if (isNaN(grade) || grade < 1 || grade > 10) grade = 3;
    return { success: true, data: grade };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * 졸업 학년 설정 (조교만 가능)
 * @param {string} spreadsheetId - 학생 스프레드시트 ID
 * @param {number} grade - 졸업 학년 (예: 2, 3, 4)
 * @param {string} userEmail - 요청자 이메일 (조교 여부 확인용)
 */
function setGraduationGrade(spreadsheetId, grade, userEmail) {
  try {
    if (!spreadsheetId || !userEmail) return { success: false, message: '스프레드시트 ID와 사용자 이메일이 필요합니다.' };
    if (!isSuppByEmail(userEmail)) return { success: false, message: '조교 권한이 필요합니다.' };
    var g = parseInt(grade, 10);
    if (isNaN(g) || g < 1 || g > 10) return { success: false, message: '졸업 학년은 1~10 사이 숫자여야 합니다.' };
    var key = 'GRADUATION_GRADE_' + spreadsheetId;
    PropertiesService.getScriptProperties().setProperty(key, String(g));
    return { success: true, message: '졸업 학년이 저장되었습니다.', data: g };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * 학생 학년 업데이트 (학년 관리에서 조교가 수동 실행)
 * - 유급 대상(flunk=O)은 학년 변경 없음
 * - 휴학·자퇴·졸업은 제외
 * - 재학 중 유급이 아닌 학생만 학년+1, 졸업학년 초과 시 졸업 처리
 * @param {string} spreadsheetId - 학생 스프레드시트 ID
 * @param {number} [graduationGrade] - 졸업 학년 (미전달 시 스크립트 속성 값 사용)
 * @returns {Object} 업데이트 결과
 */
function updateStudentGrades(spreadsheetId, graduationGrade, graduationYear, graduationTerm) {
  try {
    console.log('📚 학생 학년 업데이트 시작:', { spreadsheetId, graduationGrade: graduationGrade });
    
    if (!spreadsheetId) {
      return { success: false, message: '스프레드시트 ID가 필요합니다.' };
    }
    
    var gradGrade = graduationGrade;
    if (gradGrade == null || isNaN(parseInt(gradGrade, 10))) {
      var res = getGraduationGrade(spreadsheetId);
      gradGrade = res.success ? res.data : 3;
    } else {
      gradGrade = parseInt(gradGrade, 10);
      if (isNaN(gradGrade) || gradGrade < 1) gradGrade = 3;
    }
    
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheetName = 'info';
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, message: '학생 정보 시트를 찾을 수 없습니다.' };
    }
    
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var studentIdColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('학번') || h.toString().includes('no_student') || h.toString().toLowerCase().includes('no'));
    });
    var gradeColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('학년') || h.toString().includes('grade'));
    });
    var stateColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('상태') || h.toString().includes('state'));
    });
    var retainedColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('flunk') || h.toString().includes('유급') || h.toString().includes('retained') || h.toString().includes('is_retained'));
    });
    var gradYearColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('grad_year') || h.toString().includes('졸업연도') || h.toString().includes('졸업년도'));
    });
    var gradTermColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('grad_term') || h.toString().includes('졸업구분') || h.toString().includes('전기/후기'));
    });
    var advancedColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('advanced') || h.toString().includes('진학'));
    });
    
    if (studentIdColIndex === -1 || gradeColIndex === -1 || stateColIndex === -1) {
      return { success: false, message: '필수 컬럼(학번, 학년, 상태)을 찾을 수 없습니다.' };
    }
    
    if (retainedColIndex === -1) {
      var newColIndex = 8;
      sheet.getRange(1, newColIndex).setValue('flunk');
      retainedColIndex = newColIndex - 1;
    }
    // 졸업 연도/구분/진학 컬럼이 없으면 뒤에 추가
    var lastCol = sheet.getLastColumn();
    if (gradYearColIndex === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('grad_year');
      gradYearColIndex = lastCol - 1;
    }
    if (gradTermColIndex === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('grad_term');
      gradTermColIndex = lastCol - 1;
    }
    if (advancedColIndex === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('advanced');
      advancedColIndex = lastCol - 1;
    }
    
    var data = sheet.getDataRange().getValues();
    var updatedCount = 0;
    var graduatedCount = 0;
    var skippedCount = 0;
    var graduatedStudents = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var studentId = row[studentIdColIndex];
      var currentGrade = String(row[gradeColIndex] || '').trim();
      var currentState = String(row[stateColIndex] || '').trim();
      var retainedValue = String(row[retainedColIndex] || '').trim();
      var existingGradYear = String(row[gradYearColIndex] || '').trim();
      var existingGradTerm = String(row[gradTermColIndex] || '').trim();
      
      if (!studentId || String(studentId).trim() === '') continue;
      
      if (currentState === '휴학' || currentState === '자퇴') {
        skippedCount++;
        continue;
      }
      if (currentState === '졸업') continue;
      
      if (retainedValue === 'O' || retainedValue === 'TRUE' || retainedValue === '1') {
        // 이번 학년도에 유급 처리된 학생: 학년은 그대로 두고, 유급 표시는 초기화
        sheet.getRange(i + 1, retainedColIndex + 1).setValue('');
        skippedCount++;
        continue;
      }
      
      var gradeNum = parseInt(currentGrade, 10);
      if (isNaN(gradeNum)) {
        skippedCount++;
        continue;
      }
      
      if (gradeNum >= gradGrade) {
        // 이번 실행에서 새로 졸업 처리되는 경우에만 졸업 연도/구분 설정
        sheet.getRange(i + 1, gradeColIndex + 1).setValue('-');
        sheet.getRange(i + 1, stateColIndex + 1).setValue('졸업');
        if (!existingGradYear && graduationYear) {
          sheet.getRange(i + 1, gradYearColIndex + 1).setValue(String(graduationYear));
        }
        if (!existingGradTerm && graduationTerm) {
          sheet.getRange(i + 1, gradTermColIndex + 1).setValue(String(graduationTerm));
        }
        graduatedStudents.push({
          no_student: String(studentId),
          name: String(row[1] || ''),
          grade: String(currentGrade || '')
        });
        graduatedCount++;
      } else {
        sheet.getRange(i + 1, gradeColIndex + 1).setValue(String(gradeNum + 1));
        updatedCount++;
      }
    }
    
    return {
      success: true,
      message: '학년 갱신 완료. ' + updatedCount + '명 학년 증가, ' + graduatedCount + '명 졸업, ' + skippedCount + '명 제외(휴학/자퇴/유급 등).',
      data: {
        updatedCount: updatedCount,
        graduatedCount: graduatedCount,
        skippedCount: skippedCount,
        graduationGrade: gradGrade,
        graduatedStudents: graduatedStudents
      }
    };
  } catch (error) {
    console.error('❌ 학생 학년 업데이트 실패:', error);
    return { success: false, message: '학년 업데이트 중 오류가 발생했습니다: ' + error.message };
  }
}

/**
 * 선택한 학생만 학년 갱신/졸업 처리
 * @param {string} spreadsheetId
 * @param {Array<string>} studentIds
 * @param {number} graduationGrade
 * @param {number|string} graduationYear
 * @param {string} graduationTerm
 */
function updateStudentGradesSelected(spreadsheetId, studentIds, graduationGrade, graduationYear, graduationTerm) {
  try {
    if (!spreadsheetId) return { success: false, message: '스프레드시트 ID가 필요합니다.' };
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: false, message: '갱신할 학생을 선택해주세요.' };
    }

    var selectedSet = {};
    studentIds.forEach(function(id) { selectedSet[String(id).trim()] = true; });

    var gradGrade = graduationGrade;
    if (gradGrade == null || isNaN(parseInt(gradGrade, 10))) {
      var res = getGraduationGrade(spreadsheetId);
      gradGrade = res.success ? res.data : 3;
    } else {
      gradGrade = parseInt(gradGrade, 10);
      if (isNaN(gradGrade) || gradGrade < 1) gradGrade = 3;
    }

    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheetName = 'info';
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: '학생 정보 시트를 찾을 수 없습니다.' };

    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var studentIdColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('학번') || h.toString().includes('no_student') || h.toString().toLowerCase().includes('no'));
    });
    var gradeColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('학년') || h.toString().includes('grade'));
    });
    var stateColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('상태') || h.toString().includes('state'));
    });
    var retainedColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('flunk') || h.toString().includes('유급') || h.toString().includes('retained') || h.toString().includes('is_retained'));
    });
    var gradYearColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('grad_year') || h.toString().includes('졸업연도') || h.toString().includes('졸업년도'));
    });
    var gradTermColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('grad_term') || h.toString().includes('졸업구분') || h.toString().includes('전기/후기'));
    });
    var advancedColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('advanced') || h.toString().includes('진학'));
    });

    if (studentIdColIndex === -1 || gradeColIndex === -1 || stateColIndex === -1) {
      return { success: false, message: '필수 컬럼(학번, 학년, 상태)을 찾을 수 없습니다.' };
    }

    if (retainedColIndex === -1) {
      var newColIndex = 8;
      sheet.getRange(1, newColIndex).setValue('flunk');
      retainedColIndex = newColIndex - 1;
    }
    var lastCol = sheet.getLastColumn();
    if (gradYearColIndex === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('grad_year');
      gradYearColIndex = lastCol - 1;
    }
    if (gradTermColIndex === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('grad_term');
      gradTermColIndex = lastCol - 1;
    }
    if (advancedColIndex === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('advanced');
      advancedColIndex = lastCol - 1;
    }

    var data = sheet.getDataRange().getValues();
    var updatedCount = 0;
    var graduatedCount = 0;
    var skippedCount = 0;
    var graduatedStudents = [];
    var touchedCount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var studentId = String(row[studentIdColIndex] || '').trim();
      if (!studentId || !selectedSet[studentId]) continue;

      touchedCount++;
      var currentGrade = String(row[gradeColIndex] || '').trim();
      var currentState = String(row[stateColIndex] || '').trim();
      var retainedValue = String(row[retainedColIndex] || '').trim();
      var existingGradYear = String(row[gradYearColIndex] || '').trim();
      var existingGradTerm = String(row[gradTermColIndex] || '').trim();

      if (currentState === '휴학' || currentState === '자퇴' || currentState === '졸업') {
        skippedCount++;
        continue;
      }
      if (retainedValue === 'O' || retainedValue === 'TRUE' || retainedValue === '1') {
        sheet.getRange(i + 1, retainedColIndex + 1).setValue('');
        skippedCount++;
        continue;
      }

      var gradeNum = parseInt(currentGrade, 10);
      if (isNaN(gradeNum)) {
        skippedCount++;
        continue;
      }

      if (gradeNum >= gradGrade) {
        sheet.getRange(i + 1, gradeColIndex + 1).setValue('-');
        sheet.getRange(i + 1, stateColIndex + 1).setValue('졸업');
        if (!existingGradYear && graduationYear) {
          sheet.getRange(i + 1, gradYearColIndex + 1).setValue(String(graduationYear));
        }
        if (!existingGradTerm && graduationTerm) {
          sheet.getRange(i + 1, gradTermColIndex + 1).setValue(String(graduationTerm));
        }
        graduatedStudents.push({
          no_student: String(studentId),
          name: String(row[1] || ''),
          grade: String(currentGrade || '')
        });
        graduatedCount++;
      } else {
        sheet.getRange(i + 1, gradeColIndex + 1).setValue(String(gradeNum + 1));
        updatedCount++;
      }
    }

    return {
      success: true,
      message: '선택 갱신 완료. 대상 ' + touchedCount + '명 중 ' + updatedCount + '명 학년 증가, ' + graduatedCount + '명 졸업, ' + skippedCount + '명 제외.',
      data: {
        touchedCount: touchedCount,
        updatedCount: updatedCount,
        graduatedCount: graduatedCount,
        skippedCount: skippedCount,
        graduationGrade: gradGrade,
        graduatedStudents: graduatedStudents
      }
    };
  } catch (error) {
    console.error('❌ 선택 학생 학년 업데이트 실패:', error);
    return { success: false, message: '선택 학생 학년 업데이트 중 오류가 발생했습니다: ' + error.message };
  }
}

/**
 * 이번에 졸업 처리된 학생들 중 진학자 표시 반영
 * @param {string} spreadsheetId
 * @param {Array<string>} graduatedStudentIds - 이번 졸업 대상 전체
 * @param {Array<string>} advancedStudentIds - 진학 처리할 학생
 */
function setGraduatedAdvanced(spreadsheetId, graduatedStudentIds, advancedStudentIds) {
  try {
    if (!spreadsheetId) return { success: false, message: '스프레드시트 ID가 필요합니다.' };
    if (!graduatedStudentIds || !Array.isArray(graduatedStudentIds) || graduatedStudentIds.length === 0) {
      return { success: false, message: '졸업 대상 학생 목록이 필요합니다.' };
    }

    var gradSet = {};
    graduatedStudentIds.forEach(function(id) { gradSet[String(id).trim()] = true; });
    var advSet = {};
    (advancedStudentIds || []).forEach(function(id) { advSet[String(id).trim()] = true; });

    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName('info');
    if (!sheet) return { success: false, message: '학생 정보 시트를 찾을 수 없습니다.' };

    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var studentIdColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().includes('학번') || h.toString().includes('no_student') || h.toString().toLowerCase().includes('no'));
    });
    var advancedColIndex = headerRow.findIndex(function(h) {
      return h && (h.toString().toLowerCase().includes('advanced') || h.toString().includes('진학'));
    });
    if (studentIdColIndex === -1) return { success: false, message: '학번 컬럼을 찾을 수 없습니다.' };
    if (advancedColIndex === -1) {
      var newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue('advanced');
      advancedColIndex = newCol - 1;
    }

    var data = sheet.getDataRange().getValues();
    var updatedCount = 0;
    for (var i = 1; i < data.length; i++) {
      var sid = String(data[i][studentIdColIndex] || '').trim();
      if (!sid || !gradSet[sid]) continue;
      sheet.getRange(i + 1, advancedColIndex + 1).setValue(advSet[sid] ? 'O' : '');
      updatedCount++;
    }

    return {
      success: true,
      message: '진학 여부가 반영되었습니다.',
      data: {
        updatedCount: updatedCount,
        advancedCount: (advancedStudentIds || []).length
      }
    };
  } catch (error) {
    console.error('❌ 진학 여부 반영 실패:', error);
    return { success: false, message: '진학 여부 반영 중 오류가 발생했습니다: ' + error.message };
  }
}

/**
 * 학생 학년 업데이트 트리거 함수 (매년 1월 자동 실행용)
 * 트리거로 실행될 때 한국 시간을 확인하여 1월인 경우에만 실행합니다.
 * 월 단위 타이머로 매월 1일에 실행되도록 설정하면, 1월에만 실제로 학년이 업데이트됩니다.
 * @returns {Object} 업데이트 결과
 */
function handleAnnualGradeUpdate() {
  try {
    console.log('🔄 === 매년 학년 업데이트 트리거 시작 ===');
    
    // 한국 시간(KST, UTC+9) 가져오기
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000; // UTC+9를 밀리초로 변환
    const kstTime = new Date(now.getTime() + kstOffset);
    const currentMonth = kstTime.getUTCMonth() + 1; // getUTCMonth()는 0-11이므로 +1
    const currentDate = kstTime.getUTCDate();
    
    console.log('⏰ 한국 시간:', kstTime.toISOString());
    console.log('📅 현재 월:', currentMonth, '일:', currentDate);
    
    // 1월이 아니면 실행하지 않음
    if (currentMonth !== 1) {
      console.log('⏭️ 1월이 아니므로 학년 업데이트를 건너뜁니다. (현재 월: ' + currentMonth + '월)');
      return {
        success: true,
        message: `현재 ${currentMonth}월이므로 학년 업데이트를 건너뜁니다. (1월에만 실행됩니다.)`,
        skipped: true
      };
    }
    
    console.log('✅ 1월이므로 학년 업데이트를 실행합니다.');
    
    // 학생 스프레드시트 이름 (CONFIG에서 가져오거나 기본값 사용)
    const studentSpreadsheetName = 'student'; // 학생 스프레드시트 이름
    
    // 스프레드시트 ID 찾기
    let spreadsheetId = getSheetIdByName(studentSpreadsheetName);
    
    if (!spreadsheetId) {
      console.error('❌ 학생 스프레드시트를 찾을 수 없습니다:', studentSpreadsheetName);
      return {
        success: false,
        message: `학생 스프레드시트 '${studentSpreadsheetName}'를 찾을 수 없습니다.`
      };
    }
    
    console.log('✅ 학생 스프레드시트 ID 찾기 성공:', spreadsheetId);
    
    // 학년 업데이트 실행
    const result = updateStudentGrades(spreadsheetId);
    
    console.log('🎉 === 매년 학년 업데이트 트리거 완료 ===');
    console.log('📊 결과:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ 매년 학년 업데이트 트리거 실패:', error);
    return {
      success: false,
      message: '매년 학년 업데이트 중 오류가 발생했습니다: ' + error.message
    };
  }
}

