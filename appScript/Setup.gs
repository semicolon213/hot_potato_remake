const DEFAULT_GROUP_EMAILS_ = {
  STUDENT: 'student_hp@googlegroups.com',
  COUNCIL: 'std_council_hp@googlegroups.com',
  ASSISTANT: 'assistant_hp@googlegroups.com',
  PROFESSOR: 'professor_hp@googlegroups.com',
  ADJ_PROFESSOR: 'adj_professor_hp@googlegroups.com'
};

function installSystem(config) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    if (properties.getProperty('SETUP_DONE') === 'true') {
      throw new Error('이미 설치가 완료되었습니다.');
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
      ROOT_FOLDER_NAME: String(config.rootFolderName || 'hot_potato_remake').trim(),
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

function getSetupDefaults() {
  return {
    installed: PropertiesService.getScriptProperties().getProperty('SETUP_DONE') === 'true',
    groupEmails: DEFAULT_GROUP_EMAILS_
  };
}
