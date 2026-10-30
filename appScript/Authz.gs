var PUBLIC_ACTIONS_ = [
  'getSetupStatus',
  'login',
  'checkUserStatus',
  'checkApprovalStatus',
  'registerUser',
  'verifyAdminKey',
  'encryptEmail',
  'decryptEmail',
  'decryptEmailBatch',
  'validateStudentForEmployment',
  'getEmploymentByStdNum',
  'saveEmployment',
  'getFieldList'
];

var ADMIN_ACTIONS_ = [
  'getAllUsers',
  'getPendingUsers',
  'approveUser',
  'approveUserWithGroup',
  'rejectUser',
  'addUsersToSpreadsheet',
  'clearUserCache',
  'sendAdminKeyEmail',
  'migrateEmails',
  'uploadSharedTemplate',
  'updateSharedTemplateMeta',
  'deleteSharedTemplate',
  'uploadSharedDocument',
  'addStaticTag',
  'updateStaticTag',
  'deleteStaticTag',
  'approvePinnedAnnouncement',
  'getPinnedAnnouncementRequests',
  'createWorkflowTemplate',
  'updateWorkflowTemplate',
  'deleteWorkflowTemplate',
  'testDriveApi',
  'testTemplateFolderDebug',
  'testSpecificFolder',
  'testEmailEncryption',
  'testAllAppScript'
];

function getActionAccess_(action) {
  var normalized = String(action || '').trim();
  if (PUBLIC_ACTIONS_.indexOf(normalized) !== -1) return 'public';
  if (ADMIN_ACTIONS_.indexOf(normalized) !== -1) return 'admin';
  return 'member';
}

function isTrustedTokenInfo_(tokenInfo, clientId, nowSeconds) {
  if (!tokenInfo || !clientId || !tokenInfo.email) return false;
  var audienceMatches = tokenInfo.aud === clientId || tokenInfo.azp === clientId;
  var emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === 'true';
  var expiresIn = Number(tokenInfo.expires_in);
  if (!audienceMatches || !emailVerified || !isFinite(expiresIn) || expiresIn <= 0) return false;
  if (tokenInfo.exp != null && (!isFinite(Number(tokenInfo.exp)) || Number(tokenInfo.exp) <= Number(nowSeconds))) return false;
  return true;
}

function requesterTokenCacheKey_(accessToken, clientId) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clientId + ':' + accessToken,
    Utilities.Charset.UTF_8
  );
  return 'requester:' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function verifyRequester_(req) {
  var accessToken = String((req && req.accessToken) || '').trim();
  if (!accessToken) return '';

  var clientId = String(PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || '').trim();
  if (!clientId) {
    logWarn_('Authz', 'GOOGLE_CLIENT_ID 스크립트 속성이 없어 요청자 토큰을 검증할 수 없습니다.');
    return '';
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = requesterTokenCacheKey_(accessToken, clientId);
  var cachedEmail = cache.get(cacheKey);
  if (cachedEmail) return String(cachedEmail).trim().toLowerCase();

  try {
    var response = UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + encodeURIComponent(accessToken),
      { muteHttpExceptions: true }
    );
    if (response.getResponseCode() !== 200) return '';
    var tokenInfo = JSON.parse(response.getContentText());
    if (!isTrustedTokenInfo_(tokenInfo, clientId, Math.floor(Date.now() / 1000))) return '';

    var email = String(tokenInfo.email).trim().toLowerCase();
    cache.put(cacheKey, email, Math.min(300, Math.max(1, Math.floor(Number(tokenInfo.expires_in)))));
    return email;
  } catch (error) {
    logWarn_('Authz', 'Google 액세스 토큰 검증에 실패했습니다.');
    return '';
  }
}

function authorizeRequest_(req) {
  var access = getActionAccess_(req && req.action);
  if (access === 'public') return { success: true };

  var verifiedEmail = String((req && req.verifiedEmail) || '').trim().toLowerCase();
  if (!verifiedEmail) {
    if (!PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID')) {
      logWarn_('Authz', 'GOOGLE_CLIENT_ID를 설정해야 회원 및 관리자 요청을 처리할 수 있습니다.');
    }
    return { success: false, message: '로그인 확인이 필요한 요청입니다.', code: 'AUTH_REQUIRED' };
  }

  var status = checkUserStatus(verifiedEmail);
  if (!status.success || !status.data || status.data.status !== 'approved' || !status.data.user) {
    return { success: false, message: '승인된 회원만 사용할 수 있습니다.', code: 'MEMBER_REQUIRED' };
  }

  var member = status.data.user;
  req.userEmail = verifiedEmail;
  req.userType = String(member.user_type || '').trim();
  req.isAdmin = member.is_admin === 'O';
  req.is_admin = req.isAdmin ? 'O' : 'X';

  if (access === 'admin' && !req.isAdmin) {
    return { success: false, message: '관리자만 사용할 수 있습니다.', code: 'ADMIN_REQUIRED' };
  }
  return { success: true };
}
