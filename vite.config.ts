import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env는 프로젝트 루트에서 로드 (config에서 process.env 사용 전에 필요)
  const env = loadEnv(mode, process.cwd(), '')
  const appScriptUrl = env.VITE_APP_SCRIPT_URL || process.env.VITE_APP_SCRIPT_URL

  const proxyConfig = (pathRewrite: (path: string) => string) => ({
    target: appScriptUrl,
    changeOrigin: true,
    secure: false,
    followRedirects: true,
    rewrite: pathRewrite,
    configure: (proxy: { on: (e: string, fn: (...a: unknown[]) => void) => void }) => {
      proxy.on('error', (err: unknown) => {
        console.log('🚨 프록시 에러:', err);
      });
      proxy.on('proxyReq', (...args: unknown[]) => {
        const [proxyReq, req] = args as [{ path?: string }, { method?: string; url?: string }];
        console.log('📤 프록시 요청:', req?.method, req?.url, '→', proxyReq?.path);
      });
      proxy.on('proxyRes', (...args: unknown[]) => {
        const [proxyRes, req] = args as [{ statusCode?: number }, { url?: string }];
        console.log('📥 프록시 응답:', proxyRes?.statusCode, req?.url);
      });
    },
  });

  const proxy = appScriptUrl
    ? {
        '/api': proxyConfig((path) => path.replace(/^\/api/, '')),
        // netlify 배포 경로도 로컬에서 동작하도록 동일 프록시 적용
        '/.netlify/functions/proxy': proxyConfig(() => ''),
      }
    : undefined

  if (!appScriptUrl) {
    console.warn('⚠️ VITE_APP_SCRIPT_URL이 .env에 없습니다. /api 요청은 프록시되지 않습니다.');
  }

  return {
  plugins: [react()],
  server: {
    fs: {
      strict: false
    },
    middlewareMode: false,
    hmr: {
      overlay: true
    },
    headers: {
      'Content-Security-Policy':
          "connect-src 'self' https://accounts.google.com https://apis.google.com https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://clients6.google.com https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com https://sheets.googleapis.com https://docs.googleapis.com https://drive.googleapis.com https://*.googleapis.com https://*.gstatic.com https://www.gstatic.com https://ssl.gstatic.com;"
    },
    proxy,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 라이브러리
          'react-vendor': ['react', 'react-dom'],
          // Google API 관련
          'google-vendor': ['gapi-script'],
          // Papyrus DB
          'papyrus-vendor': ['papyrus-db'],
          // 그래프 라이브러리 (네트리파이 배포 호환성)
          'chart-vendor': ['recharts'],
          // 기타 유틸리티
          'utils-vendor': ['rrule']
        }
      }
    },
    // 청크 크기 경고 임계값 조정 (선택사항)
    chunkSizeWarningLimit: 1000
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
  };
})
