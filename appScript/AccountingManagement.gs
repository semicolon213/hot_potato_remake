/**
 * AccountingManagement.gs
 * 회계 기능 관련 서버 함수
 * Hot Potato Accounting Management System
 */

// ===== 증빙 하위 폴더 이름 (.env VITE_FOLER_NAME.ACCOUNT_EVIDENCE 와 동기화) =====

/**
 * 웹앱 요청 필드 → 스크립트 속성 EVIDENCE_FOLDER_NAME → 기본 evidence
 * (요청에 camelCase/snake_case/별칭 accountEvidence 모두 허용. 예전 속성값이 '증빙'이면 요청 없을 때만 그 이름이 쓰임.)
 * @param {Object} params - createLedger 요청 본문
 * @returns {string}
 */
function getEvidenceFolderNameFromParams_(params) {
  var p = params || {};
  var candidates = [
    p.evidenceFolderName,
    p.evidence_folder_name,
    p.accountEvidence,
    p.account_evidence,
    p.ACCOUNT_EVIDENCE
  ];
  if (p.data != null && typeof p.data === 'object') {
    candidates.push(p.data.evidenceFolderName);
    candidates.push(p.data.evidence_folder_name);
    candidates.push(p.data.accountEvidence);
    candidates.push(p.data.account_evidence);
    candidates.push(p.data.ACCOUNT_EVIDENCE);
  }
  var i;
  for (i = 0; i < candidates.length; i++) {
    if (candidates[i] != null && String(candidates[i]).trim() !== '') {
      return String(candidates[i]).trim();
    }
  }
  var prop = PropertiesService.getScriptProperties().getProperty('EVIDENCE_FOLDER_NAME');
  if (prop && String(prop).trim()) {
    return String(prop).trim();
  }
  return 'evidence';
}

/**
 * 장부 폴더 하위에서 증빙 폴더 탐색 (현재 설정명 → 레거시 '증빙' → 'evidence')
 * @param {GoogleAppsScript.Drive.Folder} ledgerFolder
 * @param {Object} params - getLedgerList 는 {};
 * @returns {GoogleAppsScript.Drive.Folder|null}
 */
function findEvidenceSubFolderInLedger_(ledgerFolder, params) {
  var primary = getEvidenceFolderNameFromParams_(params || {});
  var tryNames = [primary];
  if (tryNames.indexOf('증빙') === -1) tryNames.push('증빙');
  if (tryNames.indexOf('evidence') === -1) tryNames.push('evidence');
  var subs = [];
  var it = ledgerFolder.getFolders();
  while (it.hasNext()) {
    subs.push(it.next());
  }
  for (var i = 0; i < tryNames.length; i++) {
    var want = tryNames[i];
    for (var j = 0; j < subs.length; j++) {
      if (subs[j].getName() === want) return subs[j];
    }
  }
  return null;
}

/**
 * 회계 최상위에 잘못 올라간 증빙 전용 폴더처럼 보이는 이름인지 (목록에서 제외)
 * @param {string} folderName
 * @returns {boolean}
 */
function isLikelyMisplacedEvidenceRootFolder_(folderName) {
  if (folderName === '증빙' || folderName === 'evidence') return true;
  var p = PropertiesService.getScriptProperties().getProperty('EVIDENCE_FOLDER_NAME');
  return !!(p && String(p).trim() === folderName);
}

// ===== 회계 폴더 초기화 =====

/**
 * 회계 폴더 초기화 (없으면 생성)
 * @returns {string} 회계 폴더 ID
 */
function initializeAccountingFolder() {
  try {
    console.log('📁 회계 폴더 초기화 시작');
    
    // 루트 폴더 찾기 (스크립트 속성 또는 기본값)
    const rootFolderName = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_NAME') || 'hot_potato_remake';
    const accountingFolderName = PropertiesService.getScriptProperties().getProperty('ACCOUNT_FOLDER_NAME') || 'account';
    
    const rootFolders = DriveApp.getFoldersByName(rootFolderName);
    if (!rootFolders.hasNext()) {
      throw new Error('루트 폴더를 찾을 수 없습니다: ' + rootFolderName);
    }
    const rootFolder = rootFolders.next();
    
    // 회계 폴더 찾기 또는 생성
    let accountingFolder;
    const folders = rootFolder.getFoldersByName(accountingFolderName);
    
    if (folders.hasNext()) {
      accountingFolder = folders.next();
      console.log('✅ 기존 회계 폴더 발견:', accountingFolder.getId());
    } else {
      accountingFolder = rootFolder.createFolder(accountingFolderName);
      console.log('✅ 새 회계 폴더 생성:', accountingFolder.getId());
    }
    
    return accountingFolder.getId();
    
  } catch (error) {
    console.error('❌ 회계 폴더 초기화 오류:', error);
    throw new Error('회계 폴더 초기화 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 역할 코드를 그룹 이메일로 변환
 * @param {Array<string>} roleCodes - 역할 코드 배열 (예: ['std_council', 'professor'])
 * @returns {Array<string>} 그룹 이메일 배열
 */
function convertRoleCodesToGroupEmails(roleCodes) {
  try {
    if (!roleCodes || !Array.isArray(roleCodes) || roleCodes.length === 0) {
      return [];
    }
    
    // CONFIG.gs의 getGroupEmailByRole 함수 사용
    return roleCodes
      .map(role => {
        if (typeof getGroupEmailByRole === 'function') {
          return getGroupEmailByRole(role);
        } else {
          // 직접 매핑 (CONFIG.gs 함수가 없는 경우)
          const roleToEmail = {
            'student': 'student_hp@googlegroups.com',
            'std_council': 'std_council_hp@googlegroups.com',
            'supp': 'hp_supp@googlegroups.com',
            'professor': 'professor_hp@googlegroups.com',
            'ad_professor': 'ad_professor_hp@googlegroups.com'
          };
          return roleToEmail[role] || null;
        }
      })
      .filter(email => email && email.trim() !== '');
      
  } catch (error) {
    console.error('❌ 역할 코드 변환 오류:', error);
    return [];
  }
}

// ===== 장부 폴더 권한 설정 =====

/**
 * 장부 폴더 권한 설정
 * @param {Object} params
 *   {
 *     folderId: string,           // 폴더 ID
 *     users: Array<string>,       // 사용자 이메일 목록
 *     groups: Array<string>       // 그룹 이메일 목록
 *   }
 * @returns {Object} 권한 설정 결과
 */
function setLedgerFolderPermissions(params) {
  try {
    const { folderId, users = [], groups = [] } = params;
    
    if (!folderId) {
      throw new Error('폴더 ID가 필요합니다');
    }
    
    let successCount = 0;
    let failCount = 0;
    const grantedUsers = [];
    const failedUsers = [];
    
    // 현재 권한 확인 (Drive API 사용)
    const permissions = Drive.Permissions.list(folderId);
    const beforePermissions = permissions.items || [];
    
    // 개인 사용자 권한 부여 (Drive API - 메일 알림 없음)
    for (const userEmail of users) {
      try {
        // 이미 권한이 있는지 확인
        const hasPermission = beforePermissions.some(p => p.emailAddress === userEmail && p.role === 'writer');
        if (hasPermission) {
          console.log('✅ 이미 권한이 있는 사용자:', userEmail);
          successCount++;
          grantedUsers.push(userEmail);
          continue;
        }
        
        // 편집 권한 부여 (메일 알림 없이)
        Drive.Permissions.insert({
          role: 'writer',
          type: 'user',
          value: userEmail,
          sendNotificationEmails: false
        }, folderId);
        console.log('✅ 폴더 편집 권한 부여 완료 (메일 알림 없음):', userEmail);
        successCount++;
        grantedUsers.push(userEmail);
        
        Utilities.sleep(100); // API 제한 방지
        
      } catch (error) {
        console.error('❌ 사용자 권한 부여 실패:', userEmail, error.message);
        failCount++;
        failedUsers.push(userEmail);
      }
    }
    
    // 그룹 권한 부여 (Google Groups) - Drive API 사용
    for (const groupEmail of groups) {
      try {
        // 그룹에 편집 권한 부여 (메일 알림 없이)
        Drive.Permissions.insert({
          role: 'writer',
          type: 'group',
          value: groupEmail,
          sendNotificationEmails: false
        }, folderId);
        console.log('✅ 폴더 그룹 권한 부여 완료 (메일 알림 없음):', groupEmail);
        successCount++;
        grantedUsers.push(groupEmail);
        
        Utilities.sleep(100);
        
      } catch (error) {
        console.error('❌ 그룹 권한 부여 실패:', groupEmail, error.message);
        failCount++;
        failedUsers.push(groupEmail);
      }
    }
    
    return {
      success: successCount > 0,
      successCount: successCount,
      failCount: failCount,
      grantedUsers: grantedUsers,
      failedUsers: failedUsers
    };
    
  } catch (error) {
    console.error('❌ 폴더 권한 설정 오류:', error);
    return {
      success: false,
      message: '폴더 권한 설정 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 스프레드시트 권한 설정
 * @param {Object} params
 *   {
 *     fileId: string,           // 파일 ID
 *     users: Array<string>,     // 사용자 이메일 목록
 *     groups: Array<string>     // 그룹 이메일 목록
 *   }
 * @returns {Object} 권한 설정 결과
 */
function setLedgerFilePermissions(params) {
  try {
    const { fileId, users = [], groups = [] } = params;
    
    if (!fileId) {
      throw new Error('파일 ID가 필요합니다');
    }
    
    let successCount = 0;
    let failCount = 0;
    const grantedUsers = [];
    const failedUsers = [];
    
    // 현재 권한 확인 (Drive API 사용)
    const permissions = Drive.Permissions.list(fileId);
    const beforePermissions = permissions.items || [];
    
    // 개인 사용자 권한 부여 (Drive API - 메일 알림 없음)
    for (const userEmail of users) {
      try {
        const hasPermission = beforePermissions.some(p => p.emailAddress === userEmail && p.role === 'writer');
        if (hasPermission) {
          console.log('✅ 이미 권한이 있는 사용자:', userEmail);
          successCount++;
          grantedUsers.push(userEmail);
          continue;
        }
        
        // 편집 권한 부여 (메일 알림 없이)
        Drive.Permissions.insert({
          role: 'writer',
          type: 'user',
          value: userEmail,
          sendNotificationEmails: false
        }, fileId);
        console.log('✅ 스프레드시트 편집 권한 부여 완료 (메일 알림 없음):', userEmail);
        successCount++;
        grantedUsers.push(userEmail);
        
        Utilities.sleep(100);
        
      } catch (error) {
        console.error('❌ 사용자 권한 부여 실패:', userEmail, error.message);
        failCount++;
        failedUsers.push(userEmail);
      }
    }
    
    // 그룹 권한 부여 (Drive API - 메일 알림 없음)
    for (const groupEmail of groups) {
      try {
        // 그룹에 편집 권한 부여 (메일 알림 없이)
        Drive.Permissions.insert({
          role: 'writer',
          type: 'group',
          value: groupEmail,
          sendNotificationEmails: false
        }, fileId);
        console.log('✅ 스프레드시트 그룹 권한 부여 완료 (메일 알림 없음):', groupEmail);
        successCount++;
        grantedUsers.push(groupEmail);
        
        Utilities.sleep(100);
        
      } catch (error) {
        console.error('❌ 그룹 권한 부여 실패:', groupEmail, error.message);
        failCount++;
        failedUsers.push(groupEmail);
      }
    }
    
    return {
      success: successCount > 0,
      successCount: successCount,
      failCount: failCount,
      grantedUsers: grantedUsers,
      failedUsers: failedUsers
    };
    
  } catch (error) {
    console.error('❌ 스프레드시트 권한 설정 오류:', error);
    return {
      success: false,
      message: '스프레드시트 권한 설정 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 증빙 폴더 권한 설정
 * @param {Object} params
 *   {
 *     folderId: string,           // 폴더 ID
 *     users: Array<string>,       // 사용자 이메일 목록
 *     groups: Array<string>       // 그룹 이메일 목록
 *   }
 * @returns {Object} 권한 설정 결과
 */
function setEvidenceFolderPermissions(params) {
  // setLedgerFolderPermissions와 동일한 로직
  return setLedgerFolderPermissions(params);
}

// ===== 회계 관련 시트 생성 =====

/**
 * 회계 관련 시트 생성
 * @param {SpreadsheetApp.Spreadsheet} spreadsheet - 스프레드시트 객체
 */
function createAccountingSheets(spreadsheet) {
  try {
    console.log('📊 회계 시트 생성 시작');
    
    // 기본 시트 삭제 (필요시)
    const sheets = spreadsheet.getSheets();
    const defaultSheet = sheets.length > 0 ? sheets[0] : null;
    
    // 통장 시트 생성
    const accountSheet = spreadsheet.insertSheet('통장');
    setSheetHeaders(accountSheet, [
      'account_id', 'account_name', 'initial_balance', 'current_balance',
      'main_manager_id', 'sub_manager_ids', 'access_group_emails', 'access_user_emails',
      'created_by', 'created_date', 'is_active'
    ]);
    
    // 장부 시트 생성
    const ledgerSheet = spreadsheet.insertSheet('장부');
    setSheetHeaders(ledgerSheet, [
      'entry_id', 'account_id', 'date', 'category', 'description',
      'amount', 'balance_after', 'source', 'transaction_type',
      'evidence_file_id', 'evidence_file_name',
      'created_by', 'created_date', 'is_budget_executed', 'budget_plan_id'
    ]);
    
    // 예산계획 시트 생성
    const budgetSheet = spreadsheet.insertSheet('예산계획');
    setSheetHeaders(budgetSheet, [
      'budget_id', 'account_id', 'title', 'total_amount',
      'requested_date', 'planned_execution_date', 'status',
      'sub_manager_reviewed', 'sub_manager_review_date',
      'main_manager_approved', 'main_manager_approval_date',
      'executed_date', 'created_by', 'rejection_reason', 'details'
    ]);
    
    // 카테고리 시트 생성
    const categorySheet = spreadsheet.insertSheet('카테고리');
    setSheetHeaders(categorySheet, [
      'category_id', 'category_name', 'description',
      'created_by', 'created_date', 'is_active', 'usage_count'
    ]);
    
    // 기본 시트 삭제
    if (defaultSheet && defaultSheet.getName() === '시트1') {
      spreadsheet.deleteSheet(defaultSheet);
    }
    
    console.log('✅ 시트 생성 완료');
    
  } catch (error) {
    console.error('❌ 시트 생성 오류:', error);
    throw error;
  }
}

/**
 * 시트 헤더 설정
 */
function setSheetHeaders(sheet, headers) {
  try {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
    console.log('✅ 헤더 설정 완료:', headers);
  } catch (error) {
    console.error('❌ 헤더 설정 오류:', error);
    throw error;
  }
}

// ===== 장부 구조 생성 =====

/**
 * 장부 구조 생성 (폴더 + 스프레드시트 + 증빙 폴더 + 권한 설정)
 * @param {Object} params - 생성 파라미터
 *   {
 *     ledgerName: string,              // 장부 이름
 *     accountName: string,             // 통장 이름 (장부마다 통장 하나)
 *     initialBalance: number,          // 최초 잔액
 *     creatorEmail: string,            // 생성자 이메일
 *     accessUsers: Array<string>,      // 접근 권한 사용자 이메일 목록
 *     accessGroups: Array<string>,     // 접근 권한 그룹 역할 코드 (예: ['std_council', 'professor'])
 *     mainManagerEmail: string,        // 주관리인 이메일
 *     subManagerEmails: Array<string>  // 별도 관리인 이메일 목록
 *   }
 * @returns {Object} 생성된 구조 정보 및 권한 설정 결과
 */
function createLedgerStructure(params) {
  try {
    console.log('📁 장부 구조 생성 시작:', params);
    
    const {
      ledgerName,
      accountName,
      initialBalance = 0,
      creatorEmail,
      accessUsers = [],
      accessGroups = [],
      mainManagerEmail,
      subManagerEmails = []
    } = params;
    
    // 1. 회계 폴더 초기화
    const accountingFolderId = initializeAccountingFolder();
    const accountingFolder = DriveApp.getFolderById(accountingFolderId);
    
    // 2. 장부 폴더 생성
    const ledgerFolder = accountingFolder.createFolder(ledgerName);
    const ledgerFolderId = ledgerFolder.getId();
    console.log('✅ 장부 폴더 생성:', ledgerFolderId);
    
    // 3. 스프레드시트 생성
    const spreadsheet = SpreadsheetApp.create(`${ledgerName}_장부`);
    const spreadsheetId = spreadsheet.getId();
    const spreadsheetFile = DriveApp.getFileById(spreadsheetId);
    
    // 스프레드시트를 장부 폴더로 이동
    ledgerFolder.addFile(spreadsheetFile);
    DriveApp.getRootFolder().removeFile(spreadsheetFile);
    
    // 시트 생성 (통장, 장부, 예산계획, 카테고리)
    createAccountingSheets(spreadsheet);
    
    // 통장 정보를 통장 시트에 추가 (장부마다 통장 하나)
    if (accountName) {
      const accountSheet = spreadsheet.getSheetByName('통장');
      if (accountSheet) {
        const accountId = 'acc_' + Date.now();
        const createdDate = new Date().toISOString();
        
        // 주관리인 ID는 이메일에서 추출 (또는 그대로 사용)
        const mainManagerId = mainManagerEmail;
        const subManagerIdsJson = JSON.stringify(subManagerEmails || []);
        const groupEmailsJson = JSON.stringify(convertRoleCodesToGroupEmails(accessGroups));
        const userEmailsJson = JSON.stringify(accessUsers || []);
        
        accountSheet.appendRow([
          accountId,
          accountName,
          initialBalance,
          initialBalance, // current_balance = initial_balance
          mainManagerId,
          subManagerIdsJson,
          groupEmailsJson,
          userEmailsJson,
          creatorEmail,
          createdDate,
          'TRUE' // is_active
        ]);
        
        console.log('✅ 통장 정보 추가:', accountId, accountName);
      }
    }
    
    console.log('✅ 스프레드시트 생성:', spreadsheetId);
    
    // 4. 증빙 폴더 생성 (프론트 evidenceFolderName / 스크립트 속성 EVIDENCE_FOLDER_NAME)
    const evidenceFolderLabel = getEvidenceFolderNameFromParams_(params);
    console.log('📌 증빙 폴더 적용 이름:', evidenceFolderLabel,
      '| 요청 evidenceFolderName:', params.evidenceFolderName,
      '| 스크립트속성 EVIDENCE_FOLDER_NAME:', PropertiesService.getScriptProperties().getProperty('EVIDENCE_FOLDER_NAME'));
    const evidenceFolder = ledgerFolder.createFolder(evidenceFolderLabel);
    const evidenceFolderId = evidenceFolder.getId();
    console.log('✅ 증빙 폴더 생성:', evidenceFolderLabel, evidenceFolderId);
    
    // 5. 권한 설정
    // 접근 권한 대상: 생성자 + 주관리인 + 별도 관리인 + 지정된 사용자
    const allAccessUsers = [
      creatorEmail,
      mainManagerEmail,
      ...subManagerEmails,
      ...accessUsers
    ].filter((email, index, arr) => 
      email && email.trim() !== '' && arr.indexOf(email) === index
    );
    
    // 역할 코드를 그룹 이메일로 변환
    const groupEmails = convertRoleCodesToGroupEmails(accessGroups);
    
    console.log('🔐 권한 설정 대상:', {
      users: allAccessUsers,
      groups: groupEmails,
      roleCodes: accessGroups
    });
    
    // 장부 폴더 권한 설정
    const folderPermissionResult = setLedgerFolderPermissions({
      folderId: ledgerFolderId,
      users: allAccessUsers,
      groups: groupEmails
    });
    
    // 스프레드시트 권한 설정
    const spreadsheetPermissionResult = setLedgerFilePermissions({
      fileId: spreadsheetId,
      users: allAccessUsers,
      groups: groupEmails
    });
    
    // 증빙 폴더 권한 설정
    const evidencePermissionResult = setEvidenceFolderPermissions({
      folderId: evidenceFolderId,
      users: allAccessUsers,
      groups: groupEmails
    });
    
    console.log('✅ 장부 생성 완료:', {
      ledgerFolderId,
      spreadsheetId,
      evidenceFolderId,
      permissions: {
        folder: folderPermissionResult,
        spreadsheet: spreadsheetPermissionResult,
        evidence: evidencePermissionResult
      }
    });
    
    return {
      success: true,
      message: '장부가 성공적으로 생성되었습니다.',
      data: {
        ledgerFolderId: ledgerFolderId,
        spreadsheetId: spreadsheetId,
        evidenceFolderId: evidenceFolderId,
        resolvedEvidenceFolderName: evidenceFolderLabel,
        permissionResult: {
          folder: folderPermissionResult,
          spreadsheet: spreadsheetPermissionResult,
          evidence: evidencePermissionResult
        }
      }
    };
    
  } catch (error) {
    console.error('❌ 장부 생성 오류:', error);
    return {
      success: false,
      message: '장부 생성 중 오류가 발생했습니다: ' + error.message
    };
  }
}

// ===== 장부 목록 조회 =====

/**
 * 장부 목록 조회
 * @returns {Array<Object>} 장부 목록
 */
function getLedgerList() {
  try {
    console.log('📋 장부 목록 조회 시작');
    
    const accountingFolderId = initializeAccountingFolder();
    const accountingFolder = DriveApp.getFolderById(accountingFolderId);
    
    const ledgers = [];
    const folders = accountingFolder.getFolders();
    
    while (folders.hasNext()) {
      const folder = folders.next();
      const folderName = folder.getName();
      
      // 증빙 전용 이름으로 잘못 만든 최상위 폴더는 제외
      if (isLikelyMisplacedEvidenceRootFolder_(folderName)) {
        continue;
      }
      
      // 스프레드시트 찾기 (파일명이 [장부이름]_장부 형식)
      const files = folder.getFiles();
      let spreadsheetId = null;
      
      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        // Google Sheets 파일인지 확인
        if (file.getMimeType() === 'application/vnd.google-apps.spreadsheet') {
          spreadsheetId = file.getId();
          break;
        }
      }
      
      // 증빙 폴더 찾기 (환경/레거시 이름 호환)
      const evidenceSub = findEvidenceSubFolderInLedger_(folder, {});
      const evidenceFolderId = evidenceSub ? evidenceSub.getId() : null;
      
      ledgers.push({
        folderId: folder.getId(),
        folderName: folderName,
        spreadsheetId: spreadsheetId || '',
        evidenceFolderId: evidenceFolderId || '',
        createdDate: folder.getDateCreated().toISOString()
      });
    }
    
    console.log('✅ 장부 목록 조회 완료:', ledgers.length, '개');
    return ledgers;
    
  } catch (error) {
    console.error('❌ 장부 목록 조회 오류:', error);
    return [];
  }
}

/**
 * 장부 스프레드시트 ID 조회
 * @param {string} folderId - 장부 폴더 ID
 * @returns {string} 스프레드시트 ID
 */
function getLedgerSpreadsheetId(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() === 'application/vnd.google-apps.spreadsheet') {
        return file.getId();
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ 스프레드시트 ID 조회 오류:', error);
    return null;
  }
}

/**
 * 통장 서브 관리자 목록 업데이트
 * @param {Object} req - 요청 데이터
 * @returns {Object} 업데이트 결과
 */
function updateAccountSubManagers(req) {
  try {
    const { spreadsheetId, accountId, subManagerEmails } = req;
    
    if (!spreadsheetId || !accountId) {
      return {
        success: false,
        message: '스프레드시트 ID와 통장 ID가 필요합니다.'
      };
    }
    
    console.log('👥 서브 관리자 목록 업데이트 시작:', { spreadsheetId, accountId, subManagerEmails });
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const accountSheet = spreadsheet.getSheetByName('통장');
    
    if (!accountSheet) {
      return {
        success: false,
        message: '통장 시트를 찾을 수 없습니다.'
      };
    }
    
    // 통장 데이터 찾기
    const data = accountSheet.getDataRange().getValues();
    const headers = data[0];
    const accountIdIndex = headers.indexOf('account_id');
    
    if (accountIdIndex === -1) {
      return {
        success: false,
        message: '통장 시트의 헤더를 찾을 수 없습니다.'
      };
    }
    
    // 해당 account_id를 가진 행 찾기
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][accountIdIndex] === accountId) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (rowIndex === -1) {
      return {
        success: false,
        message: '통장을 찾을 수 없습니다.'
      };
    }
    
    // 서브 관리자 목록 업데이트 (sub_manager_ids 컬럼, 6번째 컬럼, F열)
    const subManagerIdsIndex = headers.indexOf('sub_manager_ids');
    if (subManagerIdsIndex === -1) {
      return {
        success: false,
        message: '서브 관리자 컬럼을 찾을 수 없습니다.'
      };
    }
    
    const subManagerIdsJson = JSON.stringify(subManagerEmails || []);
    accountSheet.getRange(rowIndex, subManagerIdsIndex + 1).setValue(subManagerIdsJson);
    
    console.log('✅ 서브 관리자 목록 업데이트 완료:', accountId);
    
    return {
      success: true,
      message: '서브 관리자 목록이 성공적으로 업데이트되었습니다.',
      data: {
        accountId: accountId,
        subManagerEmails: subManagerEmails
      }
    };
    
  } catch (error) {
    console.error('❌ 서브 관리자 목록 업데이트 오류:', error);
    return {
      success: false,
      message: '서브 관리자 목록 업데이트 중 오류가 발생했습니다: ' + error.message
    };
  }
}

/**
 * 장부 스프레드시트에서 카테고리 목록 가져오기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @returns {Array<string>} 카테고리 목록
 */
function getAccountingCategories(spreadsheetId) {
  try {
    console.log('📊 장부 카테고리 조회 시작:', spreadsheetId);
    
    if (!spreadsheetId) {
      throw new Error('스프레드시트 ID가 필요합니다');
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheets = spreadsheet.getSheets();
    
    if (sheets.length === 0) {
      console.warn('시트가 없습니다.');
      return [];
    }
    
    // 첫 번째 시트 사용
    const sheet = sheets[0];
    const sheetName = sheet.getName();
    console.log('시트 이름:', sheetName);
    
    // 데이터 범위 가져오기 (A열에서 카테고리 찾기)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.warn('데이터가 없습니다.');
      return [];
    }
    
    // 헤더 행 확인 (일반적으로 1행)
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    const headers = headerRange.getValues()[0];
    
    // 카테고리 열 찾기 (일반적으로 "카테고리", "분류", "항목" 등)
    let categoryColumnIndex = -1;
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase().trim();
      if (header.includes('카테고리') || header.includes('분류') || header.includes('항목') || header.includes('category')) {
        categoryColumnIndex = i + 1; // 1-based index
        break;
      }
    }
    
    // 카테고리 열을 찾지 못한 경우 A열 사용
    if (categoryColumnIndex === -1) {
      categoryColumnIndex = 1;
      console.log('카테고리 열을 찾지 못했습니다. A열을 사용합니다.');
    }
    
    // 카테고리 데이터 가져오기 (2행부터, 헤더 제외)
    const categoryRange = sheet.getRange(2, categoryColumnIndex, lastRow - 1, 1);
    const categoryValues = categoryRange.getValues();
    
    // 중복 제거 및 빈 값 제거
    const categories = [];
    const seen = new Set();
    
    for (let i = 0; i < categoryValues.length; i++) {
      const category = String(categoryValues[i][0]).trim();
      if (category && category !== '' && !seen.has(category)) {
        seen.add(category);
        categories.push(category);
      }
    }
    
    console.log('✅ 장부 카테고리 조회 완료:', categories.length, '개');
    return categories;
    
  } catch (error) {
    console.error('❌ 장부 카테고리 조회 오류:', error);
    return [];
  }
}

