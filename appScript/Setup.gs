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
    const setupToken = properties.getProperty('SETUP_TOKEN');
    if (!setupToken || String(config.setupToken || '') !== setupToken) {
      throw new Error('설치 토큰이 없거나 올바르지 않습니다. 배포자가 편집기에서 토큰을 생성했는지 확인하세요.');
    }

    const adminEmail = String(config.adminEmail || '').trim();
    if (!isValidEmail(adminEmail)) throw new Error('올바른 관리자 이메일을 입력하세요.');
    const googleClientId = String(config.googleClientId || '').trim();
    if (!googleClientId || !/\.apps\.googleusercontent\.com$/.test(googleClientId)) {
      throw new Error('올바른 Google OAuth 클라이언트 ID를 입력하세요.');
    }

    const groupEmails = {};
    Object.keys(DEFAULT_GROUP_EMAILS_).forEach(function(role) {
      const email = String((config.groupEmails || {})[role] || '').trim();
      if (!isValidEmail(email)) throw new Error(role + ' 그룹 이메일을 확인하세요.');
      if (isDefaultGroupEmail_(email)) throw new Error('다른 기관의 그룹 이메일입니다. 기관에서 만든 Google 그룹 주소를 입력하세요.');
      groupEmails[role] = email;
    });

    properties.setProperties({
      ROOT_FOLDER_NAME: String(config.rootFolderName || '').trim() || 'hot_potato_remake',
      GROUP_EMAIL_JSON: JSON.stringify(groupEmails),
      GOOGLE_CLIENT_ID: googleClientId
    });

    const result = initializeSystem({ googleClientId: googleClientId });
    if (!result.success) throw new Error(result.message || '초기화에 실패했습니다.');
    registerInitialAdmin_(adminEmail);
    properties.setProperty('SETUP_DONE', 'true');
    properties.deleteProperty('SETUP_TOKEN');
    return result;
  } finally {
    lock.releaseLock();
  }
}

function createSetupToken() {
  const properties = PropertiesService.getScriptProperties();
  if (isSetupDone_(properties) || properties.getProperty('SPREADSHEET_ID')) {
    throw new Error('이미 초기화가 시작되었거나 완료된 프로젝트입니다.');
  }
  if (properties.getProperty('SETUP_TOKEN')) {
    throw new Error('설치 토큰이 이미 있습니다. 기존 토큰으로 설치를 진행하세요.');
  }
  const activeEmail = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!activeEmail || activeEmail !== effectiveEmail) {
    throw new Error('토큰은 배포 계정으로 Apps Script 편집기에서 생성해야 합니다.');
  }
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  properties.setProperty('SETUP_TOKEN', token);
  Logger.log('설치 화면에 입력할 SETUP_TOKEN: ' + token);
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

function isSetupDone_(properties) {
  if (properties.getProperty('SETUP_DONE') === 'true') return true;
  return Boolean(properties.getProperty('SPREADSHEET_ID')) && !properties.getProperty('SETUP_TOKEN');
}

function getSetupDefaults() {
  return {
    installed: isSetupDone_(PropertiesService.getScriptProperties())
  };
}

function isDefaultGroupEmail_(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return Object.keys(DEFAULT_GROUP_EMAILS_).some(function(role) {
    return DEFAULT_GROUP_EMAILS_[role].toLowerCase() === normalized;
  });
}

function getSetupStatus(req) {
  const properties = PropertiesService.getScriptProperties();
  const serverClientId = String(properties.getProperty('GOOGLE_CLIENT_ID') || '').trim();
  const siteClientId = String((req || {}).clientId || '').trim();
  return {
    success: true,
    installed: isSetupDone_(properties),
    spreadsheetReady: Boolean(properties.getProperty('SPREADSHEET_ID')),
    serverClientIdConfigured: Boolean(serverClientId),
    clientIdMatches: Boolean(serverClientId) && siteClientId === serverClientId,
    version: getDeploymentInfo().version
  };
}
