
/**
 * Netlify Function: Google Apps Script Proxy
 * ESM 방식
 */

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // 지원하는 HTTP 메서드 확인
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: '지원하지 않는 요청 방식입니다.'
      })
    };
  }

  // 서버 전용 환경변수 사용
  const APP_SCRIPT_URL = process.env.APP_SCRIPT_URL;

  if (!APP_SCRIPT_URL) {
    console.error('APP_SCRIPT_URL 환경변수 누락');

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Apps Script URL이 설정되지 않았습니다.'
      })
    };
  }

  try {
    // 요청 본문 검사
    let requestBody = null;

    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: '잘못된 JSON 요청입니다.'
          })
        };
      }
    }

    console.log('프록시 요청:', {
      method: event.httpMethod,
      url: APP_SCRIPT_URL,
      action: requestBody?.action ?? null
    });

    const response = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: event.body ?? JSON.stringify({}),
      redirect: 'follow'
    });

    const responseText = await response.text();

    console.log('프록시 응답:', {
      status: response.status,
      statusText: response.statusText,
      bodyLength: responseText.length
    });

    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error(
        'Apps Script 비JSON 응답:',
        responseText.substring(0, 300)
      );

      responseData = {
        success: false,
        error: response.ok
          ? 'Apps Script가 JSON이 아닌 응답을 반환했습니다.'
          : `Apps Script 요청 실패: HTTP ${response.status}`
      };
    }

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('프록시 실행 오류:', error);

    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Apps Script 연결 중 오류가 발생했습니다.'
      })
    };
  }
};
