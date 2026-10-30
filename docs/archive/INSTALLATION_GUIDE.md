# 설치 가이드

HP ERP 웹/Electron 개발 환경을 맞추는 절차입니다.

## 요구 사항

- **Node.js** 22.x 권장 (최소 18+)
- **npm** 9+
- Google Cloud OAuth·API 설정은 [환경 변수 가이드](./ENVIRONMENT_VARIABLES_SETUP.md) 참고

## 절차

### 1. 저장소 받기

```bash
git clone <저장소-URL>
cd hot_potato_remake
git pull   # 이미 클론한 경우 최신화
```

### 2. 의존성 문제 시 초기화 (선택)

```powershell
# Windows PowerShell
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
```

```bash
# macOS / Linux
rm -rf node_modules package-lock.json
```

### 3. 설치

```bash
npm install
```

### 4. 환경 변수

`.env.example`을 복사해 `.env`로 저장하고 값을 채웁니다.  
필수 예: `VITE_GOOGLE_CLIENT_ID`, `VITE_APP_SCRIPT_URL`, JSON 형식의 `VITE_FOLER_NAME` 등.

→ [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md), [ENV_CONFIG_V2_전환_가이드.md](./ENV_CONFIG_V2_전환_가이드.md)

### 5. 동작 확인

```bash
npm run build
npm run type-check
```

### 6. 개발 서버

```bash
# 브라우저만 (http://localhost:5173)
npm run dev:web

# Vite + Electron 동시
npm run dev
```

Electron만 별도로 띄울 때:

```bash
npm run electron:dev
```

## 자주 쓰는 명령

| 명령 | 설명 |
|------|------|
| `npm run dev:web` | Vite 개발 서버 |
| `npm run dev` | Vite + Electron |
| `npm run build` | 프로덕션 웹 빌드 (`dist/`) |
| `npm run preview` | 빌드 미리보기 |
| `npm run electron:build` | 웹 빌드 후 Electron 패키징 |
| `npm run test` | Jest |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |

## 문제 해결

```bash
npm cache clean --force
npm install
```

```bash
npm run type-check
npm ls react
```

포트 충돌 시:

```bash
npx vite --port 3000
```

배포·릴리즈: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)  
전체 문서 목차: [docs/README.md](./README.md)
