import { logger } from './utils/logger';
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";
import { ENV_CONFIG, validateEnvironmentVariables } from "./config/environment";
const log = logger.scope('main');
if (!validateEnvironmentVariables()) {
  log.warn("일부 환경 변수가 설정되지 않았습니다. 앱이 제한적으로 작동할 수 있습니다.");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider 
      clientId={ENV_CONFIG.GOOGLE_CLIENT_ID}
    >
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
