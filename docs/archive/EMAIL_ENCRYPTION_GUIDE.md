# 📧 이메일 암호화 설정 가이드

## 개요
Hot Potato Admin Key Management System에서 이메일 암호화 방식을 CONFIG.gs에서 설정할 수 있도록 개선되었습니다.

**중요**: 이메일 암호화는 전체 이메일 주소(사용자명@도메인.확장자)를 통으로 암호화합니다.

## 설정 방법

### 1. 기본 설정 (CONFIG.gs)
```javascript
// 이메일 암호화 설정 (Base64보다 안전한 다중 레이어 기본값)
const EMAIL_ENCRYPTION_CONFIG = {
  // 단일 레이어일 때 사용할 방법
  METHOD: 'Substitution',
  
  // 암호화 레이어 수 (3 = BitShift → Substitution → Base64)
  LAYERS: 3,
  
  // 다중 레이어: BitShift → Substitution → Base64
  LAYER_METHODS: ['BitShift', 'Substitution', 'Base64'],
  
  // 암호화된 이메일 식별 패턴 (전체 이메일 주소 기준)
  IDENTIFICATION_PATTERNS: {
    ROT13: ['.pbz', '.bet', '.net', '.org', '.gov', '.edu', 'grfg', 'hfref', 'nqzva', 'fghqrag'],
    Base64: ['==', '=', 'dGVzdA', 'dXNlcg', 'YWRtaW4', 'c3R1ZGVudA', 'Z3JmZ0BleGFtcGxlLmNvbQ'],
    Caesar: ['@'],
    BitShift: ['{', '}', '|', '~', '^', '`'],
    Substitution: ['@']
  }
};
```

### 2. 동적 설정 변경
```javascript
// 암호화 방법 변경
setEmailEncryptionMethod('Base64');

// 레이어 수 변경 (1-5)
setEmailEncryptionLayers(2);

// 레이어 방법들 변경
setEmailEncryptionLayerMethods(['ROT13', 'Base64', 'Caesar']);

// 현재 설정 확인
const config = getCurrentEmailEncryptionConfig();
console.log(config);

// 설정 검증
const validation = validateEmailEncryptionConfig();
console.log(validation);

// 설정 초기화
resetEmailEncryptionConfig();
```

## 지원하는 암호화 방법 (23가지)

### 1. 단일 암호화 방법
- **ROT13**: 기본값, 간단한 문자 치환
- **Base64**: Base64 인코딩
- **Caesar**: 시저 암호 (13자리 이동)
- **BitShift**: 비트 시프트
- **Substitution**: 치환 암호
- **Padding**: 패딩 기반 암호화
- **MultiEncode**: 다중 인코딩
- **RandomInsert**: 랜덤 삽입
- **Transposition**: 전치 암호
- **Reverse**: 역순 암호
- **Atbash**: 아트바시 암호
- **Vigenere**: 비제네르 암호
- **RailFence**: 레일펜스 암호
- **Columnar**: 컬럼 암호
- **Affine**: 아핀 암호
- **Permutation**: 순열 암호
- **Pattern**: 패턴 암호
- **Mirror**: 미러 암호
- **Zigzag**: 지그재그 암호
- **Wave**: 웨이브 암호
- **Snake**: 스네이크 암호

### 2. 다중 레이어 암호화 (5-15단계)
- **최소 레이어**: 5개
- **최대 레이어**: 15개
- 여러 암호화 방법을 순차적으로 적용하여 보안성 향상

```javascript
// 5단계 암호화 설정 (최소)
setEmailEncryptionLayers(5);
setEmailEncryptionLayerMethods(['ROT13', 'Base64', 'Caesar', 'BitShift', 'Substitution']);

// 15단계 암호화 설정 (최대)
setEmailEncryptionLayers(15);
setEmailEncryptionLayerMethods(['ROT13', 'Base64', 'Caesar', 'BitShift', 'Substitution', 'Padding', 'MultiEncode', 'RandomInsert', 'Transposition', 'Reverse', 'Atbash', 'Vigenere', 'RailFence', 'Columnar', 'Affine']);

// 암호화 순서: 설정된 순서대로 적용
// 복호화 순서: 역순으로 적용
```

## 사용 예시

### 1. 기본 사용법 (전체 이메일 주소 암호화)
```javascript
// 이메일 전체 암호화
const email = 'user@example.com';
const encrypted = encryptEmail(email);
console.log(encrypted); // 설정된 방법으로 전체 이메일 주소 암호화

// 이메일 전체 복호화
const decrypted = decryptEmail(encrypted);
console.log(decrypted); // 'user@example.com'

// 암호화 여부 확인 (전체 이메일 주소 기준)
const isEncrypted = isEncryptedEmail(encrypted);
console.log(isEncrypted); // true
```

### 2. 다양한 암호화 방법 테스트 (전체 이메일 주소)
```javascript
// ROT13 테스트 (전체 이메일 주소)
setEmailEncryptionMethod('ROT13');
const rot13Encrypted = encryptEmail('test@example.com');
console.log(rot13Encrypted); // grfg@rknzcyr.pbz

// Base64 테스트 (전체 이메일 주소)
setEmailEncryptionMethod('Base64');
const base64Encrypted = encryptEmail('test@example.com');
console.log(base64Encrypted); // dGVzdEBleGFtcGxlLmNvbQ==

// Caesar 테스트 (전체 이메일 주소)
setEmailEncryptionMethod('Caesar');
const caesarEncrypted = encryptEmail('test@example.com');
console.log(caesarEncrypted); // grfg@rknzcyr.pbz (ROT13과 동일)
```

### 3. 다중 레이어 테스트 (전체 이메일 주소)
```javascript
// 5단계 암호화 설정 (최소)
setEmailEncryptionLayers(5);
setEmailEncryptionLayerMethods(['ROT13', 'Base64', 'Caesar', 'BitShift', 'Substitution']);

const email = 'admin@hotpotato.org';
const encrypted = encryptEmail(email); // 전체 이메일 주소 암호화
console.log('암호화:', encrypted);

const decrypted = decryptEmail(encrypted); // 전체 이메일 주소 복호화
console.log('복호화:', decrypted);
console.log('일치:', email === decrypted); // true
```

## API 엔드포인트

### 1. 이메일 암호화 테스트
```javascript
// POST 요청
{
  "action": "testEmailEncryption"
}

// 응답
{
  "success": true,
  "testResults": [...],
  "config": {...},
  "message": "이메일 암호화 테스트가 모두 성공했습니다"
}
```

### 2. ROT13 테스트 (하위 호환성)
```javascript
// POST 요청
{
  "action": "testRot13Encryption"
}

// 응답
{
  "success": true,
  "testResults": [...],
  "allTestsPassed": true
}
```

## 테스트 함수

### 1. 전체 이메일 암호화 테스트
```javascript
// Apps Script 에디터에서 실행
runEmailEncryptionConfigTest();
```

### 2. 특정 테스트 실행
```javascript
// 이메일 암호화 설정 테스트
runSpecificTest('emailEncryption');

// ROT13 테스트
runSpecificTest('rot13');
```

### 3. 모든 테스트 실행
```javascript
runAllTests();
```

## 설정 검증

### 1. 설정 유효성 검사
```javascript
const validation = validateEmailEncryptionConfig();
if (validation.isValid) {
  console.log('설정이 유효합니다');
} else {
  console.error('설정 오류:', validation.errors);
}
```

### 2. 현재 설정 확인
```javascript
const config = getCurrentEmailEncryptionConfig();
console.log('현재 설정:', config);
```

## 마이그레이션 가이드

### 1. 기존 ROT13에서 다른 방법으로 변경
```javascript
// 1. 현재 설정 확인
const currentConfig = getCurrentEmailEncryptionConfig();
console.log('현재 설정:', currentConfig);

// 2. 새로운 방법 설정
setEmailEncryptionMethod('Base64');

// 3. 테스트 실행
const testResult = testEmailEncryption();
console.log('테스트 결과:', testResult);

// 4. 기존 데이터 마이그레이션 (필요시)
// migrateExistingEmails();
```

### 2. 다중 레이어로 업그레이드
```javascript
// 1. 레이어 수 설정 (5-15개)
setEmailEncryptionLayers(5);

// 2. 레이어 방법들 설정
setEmailEncryptionLayerMethods(['ROT13', 'Base64', 'Caesar', 'BitShift', 'Substitution']);

// 3. 설정 검증
const validation = validateEmailEncryptionConfig();
if (validation.isValid) {
  console.log('다중 레이어 설정이 완료되었습니다');
} else {
  console.error('설정 오류:', validation.errors);
}
```

## 주의사항

### 1. 설정 변경 시
- 기존 암호화된 데이터와 호환성 확인 필요
- 새로운 설정으로 암호화된 데이터는 기존 설정으로 복호화 불가
- 마이그레이션 전 백업 권장

### 2. 성능 고려사항
- 다중 레이어 사용 시 암호화/복호화 시간 증가
- 레이어 수는 5-15개 범위 내에서 설정
- 대량 데이터 처리 시 성능 테스트 권장
- 최대 15개 레이어까지 지원하지만 성능을 고려하여 적절히 설정

### 3. 보안 고려사항
- 암호화 방법은 정기적으로 변경 권장
- 설정 변경 시 로그 확인
- 민감한 데이터는 추가 보안 조치 권장

## 문제 해결

### 1. 암호화/복호화 실패
```javascript
// 설정 검증
const validation = validateEmailEncryptionConfig();
if (!validation.isValid) {
  console.error('설정 오류:', validation.errors);
  return;
}

// 테스트 실행
const testResult = testEmailEncryption();
if (!testResult.success) {
  console.error('테스트 실패:', testResult);
}
```

### 2. 기존 데이터 복호화 실패
```javascript
// ROT13으로 복호화 시도
const decrypted = rot13Decrypt(encryptedEmail);

// 설정 기반 복호화 시도
const decrypted2 = decryptEmail(encryptedEmail);
```

### 3. 설정 초기화
```javascript
// 모든 이메일 암호화 설정 초기화
resetEmailEncryptionConfig();

// 기본 설정으로 복원
const defaultConfig = getConfig('email_encryption_config');
console.log('기본 설정:', defaultConfig);
```

---

**업데이트 일자**: 2025년 10월 1일  
**버전**: 1.1.0  
**개발팀**: 감자도리    
**작성자**: 김형균
