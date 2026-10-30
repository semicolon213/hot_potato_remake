const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const configPath = () => path.join(app.getPath('userData'), 'site.json');

function validSiteUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function savedSiteUrl() {
  const buildUrl = process.env.HP_ERP_SITE_URL;
  if (validSiteUrl(buildUrl)) return buildUrl;
  try {
    const value = JSON.parse(fs.readFileSync(configPath(), 'utf8')).siteUrl;
    return validSiteUrl(value) ? value : '';
  } catch { return ''; }
}

function createMainWindow(siteUrl) {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://accounts.google.com/')) {
      return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  window.loadURL(siteUrl);
  return window;
}

function createSitePrompt() {
  const window = new BrowserWindow({
    width: 520,
    height: 300,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'setup-preload.cjs')
    }
  });
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>HP ERP 연결</title><style>body{font:16px system-ui;padding:32px}input,button{box-sizing:border-box;width:100%;padding:10px;margin-top:12px;font:inherit}p{color:#b42318}</style><h1>기관 사이트 연결</h1><form><label>Netlify 사이트 주소<input type="url" placeholder="https://example.netlify.app" required></label><button>연결</button><p role="alert"></p></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=document.querySelector('input');const result=await window.siteSetup.save(input.value);if(!result.ok)document.querySelector('p').textContent=result.message}</script></html>`;
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

ipcMain.handle('save-site-url', (event, value) => {
  if (!validSiteUrl(value)) return { ok: false, message: 'http 또는 https 주소를 입력하세요.' };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ siteUrl: value }));
  createMainWindow(value);
  BrowserWindow.fromWebContents(event.sender)?.close();
  return { ok: true };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (isDev) createMainWindow(devUrl);
  else {
    const siteUrl = savedSiteUrl();
    if (siteUrl) createMainWindow(siteUrl);
    else createSitePrompt();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const siteUrl = isDev ? devUrl : savedSiteUrl();
      if (siteUrl) createMainWindow(siteUrl); else createSitePrompt();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
