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
