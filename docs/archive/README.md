# 보관 문서

2026-10-27 문서 재정리 전에 쓰던 문서입니다. **현재 코드와 다른 내용이 있으니** 새 작업은 [docs/README.md](../README.md)의 문서를 기준으로 하세요.
"왜 이렇게 바뀌었는지" 추적할 때 참고용으로 남겼습니다.

## 어디로 옮겨졌나

| 보관 문서 | 현재 문서 |
|---|---|
| `INSTALLATION_GUIDE`, `ENVIRONMENT_VARIABLES_SETUP`, `ENV_CONFIG_V2_전환_가이드`, `ENV_ALIGNMENT_REVIEW` | [GETTING_STARTED.md](../GETTING_STARTED.md) |
| `INITIAL_SETUP_GUIDE`, `DEPLOYMENT_GUIDE`, `NETLIFY_DEPLOYMENT_CHECKLIST`, `CLASP_GUIDE`, `CI_CD_UPDATE_GUIDE`, `CI_CD_VALIDATION_CRITERIA`, `APPSCRIPT_DEPLOYMENT_CHECKLIST` | [DEPLOYMENT.md](../DEPLOYMENT.md) |
| `PROJECT_DOCUMENTATION`, `FRONTEND_STRUCTURE`, `DATA_CACHING_STRATEGY`, `REFACTORING_DOCUMENTATION`, `DESIGN_ANALYSIS` | [ARCHITECTURE.md](../ARCHITECTURE.md), [ADR.md](../ADR.md) |
| `DRIVE_FOLDER_STRUCTURE` | [DATA_MODEL.md](../DATA_MODEL.md) |
| `API_DOCUMENTATION`, `APPSCRIPT_README_LEGACY` | [API_SPEC.md](../API_SPEC.md) |
| `USER_APPROVAL_GROUPS_REVIEW`, `EMAIL_ENCRYPTION_GUIDE` | [SECURITY.md](../SECURITY.md), [OPERATOR_MANUAL.md](../OPERATOR_MANUAL.md) |
| `초기_로딩_분석`, `BUG_FIXES_personalFavoriteManager`, `TYPE_ERROR_FIXES` | 당시 분석·수정 기록 (루트 README 트러블슈팅의 근거) |

## 알려진 차이

- GitHub Actions CI는 2026-02-26에 삭제되었습니다. CI를 전제로 한 문서는 현재 상황과 다릅니다.
- Netlify Function은 `APP_SCRIPT_URL`만 읽습니다. `VITE_APP_SCRIPT_URL`로도 된다고 적은 문서는 틀렸습니다.
- Netlify Node 버전은 18입니다(22로 적힌 문서가 있음).
- 캐시는 메모리 + localStorage만 씁니다(IndexedDB 없음).
