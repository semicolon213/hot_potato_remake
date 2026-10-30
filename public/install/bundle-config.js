// 호출 근거: DriveApp/Drive, SpreadsheetApp, DocumentApp, MailApp, UrlFetchApp, Session.
const COMMON_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/script.send_mail',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/userinfo.email'
];

const WORKSPACE_SCOPES = [
  // GroupManagement.gs의 AdminDirectory.Members.insert에만 필요하다.
  'https://www.googleapis.com/auth/admin.directory.group.member'
];

export function bundleForAccount(bundle, isWorkspace) {
  return { files: bundle.files.map(file => {
    if (file.name !== 'appsscript') return file;
    const manifest = JSON.parse(file.source);
    const services = manifest.dependencies?.enabledAdvancedServices || [];
    const allowedServices = isWorkspace ? ['drive', 'admin'] : ['drive'];
    manifest.dependencies = manifest.dependencies || {};
    manifest.dependencies.enabledAdvancedServices = services.filter(service => allowedServices.includes(service.serviceId));
    manifest.oauthScopes = isWorkspace ? [...COMMON_SCOPES, ...WORKSPACE_SCOPES] : COMMON_SCOPES;
    return { ...file, source: JSON.stringify(manifest, null, 2) };
  }) };
}
