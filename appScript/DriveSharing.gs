/**
 * Drive 권한 공용 함수 (고급 서비스 Drive v3)
 * v2의 Permissions.insert / items / value 대신 v3의 create / permissions / emailAddress를 쓴다.
 */
function listPermissions_(fileId) {
  const response = Drive.Permissions.list(fileId, {
    fields: 'permissions(id,type,role,emailAddress)',
    supportsAllDrives: true
  });
  return response.permissions || [];
}

function grantPermission_(fileId, type, emailAddress, role) {
  return Drive.Permissions.create(
    { type: type, role: role, emailAddress: emailAddress },
    fileId,
    { sendNotificationEmail: false, supportsAllDrives: true }
  );
}

/**
 * 빈 Google 문서 생성 (Drive 고급 서비스 사용 — DocumentApp은 문서 권한이 추가로 필요해서 쓰지 않음)
 * @returns {DriveApp.File}
 */
function createBlankGoogleDoc_(title) {
  const created = Drive.Files.create({ name: title, mimeType: MimeType.GOOGLE_DOCS });
  return DriveApp.getFileById(created.id);
}
