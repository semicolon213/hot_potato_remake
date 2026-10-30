const DEFAULT_GROUP_EMAILS_ = {
  STUDENT: 'student_hp@googlegroups.com',
  COUNCIL: 'std_council_hp@googlegroups.com',
  ASSISTANT: 'assistant_hp@googlegroups.com',
  PROFESSOR: 'professor_hp@googlegroups.com',
  ADJ_PROFESSOR: 'adj_professor_hp@googlegroups.com'
};

function installSystem(config) {
  config = config || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    if (isSetupDone_(properties)) {
      throw new Error('이미 설치가 완료되었습니다.');
    }
    // 웹앱은 누구나 열 수 있으므로 배포 계정 본인만 설치를 실행한다 (다른 사람이 관리자로 등록하는 것 방지)
    const caller = Session.getActiveUser().getEmail();
    if (!caller || caller !== Session.getEffectiveUser().getEmail()) {
      throw new Error('설치는 이 백엔드를 배포한 계정으로 로그인한 상태에서만 할 수 있습니다.');
    }

    const adminEmail = String(config.adminEmail || '').trim();
    if (!isValidEmail(adminEmail)) throw new Error('올바른 관리자 이메일을 입력하세요.');

    const groupEmails = {};
    Object.keys(DEFAULT_GROUP_EMAILS_).forEach(function(role) {
      const email = String((config.groupEmails || {})[role] || '').trim();
      if (!isValidEmail(email)) throw new Error(role + ' 그룹 이메일을 확인하세요.');
      groupEmails[role] = email;
    });

    properties.setProperties({
      ROOT_FOLDER_NAME: String(config.rootFolderName || '').trim() || 'hot_potato_remake',
      GROUP_EMAIL_JSON: JSON.stringify(groupEmails)
    });

    const result = initializeSystem();
    if (!result.success) throw new Error(result.message || '초기화에 실패했습니다.');
    registerInitialAdmin_(adminEmail);
    properties.setProperty('SETUP_DONE', 'true');
    return result;
  } finally {
    lock.releaseLock();
  }
}

function registerInitialAdmin_(email) {
  const sheet = getHpMemberSpreadsheet().getSheetByName('user');
  const encryptedEmail = encryptEmailMain(email);
  const values = sheet.getDataRange().getValues();
  const exists = values.slice(1).some(function(row) {
    try { return decryptEmailMain(row[3]) === email; } catch (error) { return false; }
  });
  if (!exists) {
    sheet.appendRow(['ADMIN', 'professor', '관리자', encryptedEmail, 'O', 'O', new Date().toISOString().slice(0, 10)]);
  }
}

// SETUP_DONE 이전부터 운영 중인 설치는 SPREADSHEET_ID가 있으면 설치된 것으로 본다
function isSetupDone_(properties) {
  return properties.getProperty('SETUP_DONE') === 'true' || Boolean(properties.getProperty('SPREADSHEET_ID'));
}

function getSetupDefaults() {
  return {
    installed: isSetupDone_(PropertiesService.getScriptProperties()),
    groupEmails: DEFAULT_GROUP_EMAILS_
  };
}

function getSetupStatus() {
  const properties = PropertiesService.getScriptProperties();
  return {
    success: true,
    installed: isSetupDone_(properties),
    spreadsheetReady: Boolean(properties.getProperty('SPREADSHEET_ID')),
    version: getDeploymentInfo().version
  };
}
