/**
 * TestBasic.gs
 * 기본 테스트 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 기본 테스트 함수들 =====

/**
 * 간단한 암호화/복호화 테스트
 * @returns {Object} 테스트 결과
 */
function runSimpleTest() {
  
  try {
    
    // 간단한 테스트
    const testString = 'Hello World!';
    
    const encrypted = applyEncryption(testString, 'Base64', '');
    
    const decrypted = applyDecryption(encrypted, 'Base64', '');
    const { key, layers, originalKey } = EncryptionKeyManagement.generateExtendedMultiLayerKey();
    logDebug_('TestBasic', '사용된 레이어 수:', layers.length);
    
    // 복호화 테스트
    let decryptedKey = key;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i].trim();
      decryptedKey = applyDecryption(decryptedKey, layer, '');
    }
    
    return {
      success: true,
      message: '간단한 테스트 완료',
      encryptionTest: decrypted === testString,
      keyGenerationTest: decryptedKey === originalKey
    };
    
  } catch (error) {
    logError_('TestBasic', '테스트 실패:', error);
    return {
      success: false,
      message: '테스트 실패: ' + error.message
    };
  }
}

/**
 * 암호화 알고리즘 테스트
 * @returns {Object} 테스트 결과
 */
function testEncryptionAlgorithms() {
  
  try {
    const testString = 'Test String for Encryption';
    const algorithms = ['Base64', 'Caesar', 'ROT13', 'BitShift', 'Substitution'];
    
    const results = {};
    
    for (const algorithm of algorithms) {
      try {
        logDebug_('TestBasic', `\n--- ${algorithm} 테스트 ---`);
        
        const encrypted = applyEncryption(testString, algorithm, '');
        
        const decrypted = applyDecryption(encrypted, algorithm, '');
        
        const isReversible = decrypted === testString;
        
        results[algorithm] = {
          success: isReversible,
          encrypted: encrypted,
          decrypted: decrypted
        };
        
      } catch (error) {
        logError_('TestBasic', `${algorithm} 테스트 실패:`, error);
        results[algorithm] = {
          success: false,
          error: error.message
        };
      }
    }
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    return {
      success: successCount === totalCount,
      message: `${successCount}/${totalCount} 알고리즘 테스트 성공`,
      results: results
    };
    
  } catch (error) {
    logError_('TestBasic', '암호화 알고리즘 테스트 실패:');
    return {
      success: false,
      message: '암호화 알고리즘 테스트 실패: ' + error.message
    };
  }
}

/**
 * 다중 레이어 암호화 테스트
 * @returns {Object} 테스트 결과
 */
function testMultiLayerEncryption() {
  
  try {
    const testString = 'Multi Layer Test String';
    const layers = ['Base64', 'Caesar', 'ROT13'];
    logDebug_('TestBasic', '사용할 레이어:', layers);
    
    // 암호화
    const encryptionResult = multiLayerEncrypt(testString, layers);
    
    if (!encryptionResult.success) {
      throw new Error('암호화 실패: ' + encryptionResult.error);
    }
    
    // 복호화
    const decryptionResult = multiLayerDecrypt(encryptionResult.encryptedText, layers);
    
    if (!decryptionResult.success) {
      throw new Error('복호화 실패: ' + decryptionResult.error);
    }
    
    const isReversible = decryptionResult.decryptedText === testString;
    
    return {
      success: isReversible,
      message: isReversible ? '다중 레이어 암호화 테스트 성공' : '다중 레이어 암호화 테스트 실패',
      original: testString,
      encrypted: encryptionResult.encryptedText,
      decrypted: decryptionResult.decryptedText,
      layers: layers
    };
    
  } catch (error) {
    logError_('TestBasic', '다중 레이어 암호화 테스트 실패:');
    return {
      success: false,
      message: '다중 레이어 암호화 테스트 실패: ' + error.message
    };
  }
}

/**
 * 이메일 암호화 테스트
 * @returns {Object} 테스트 결과
 */
function testEmailEncryption() {
  
  try {
    const testEmail = 'test@example.com';
    const testPhone = '010-1234-5678';
    
    // 이메일 암호화/복호화
    const encryptedEmail = EncryptionEmail.encryptEmailMain(testEmail);
    const decryptedEmail = EncryptionEmail.decryptEmailMain(encryptedEmail);
    
    // 전화번호 암호화/복호화
    const encryptedPhone = EncryptionEmail.encryptEmailMain(testPhone);
    const decryptedPhone = EncryptionEmail.decryptEmailMain(encryptedPhone);
    
    const emailTest = decryptedEmail === testEmail;
    const phoneTest = decryptedPhone === testPhone;
    
    return {
      success: emailTest && phoneTest,
      message: emailTest && phoneTest ? '이메일 암호화 테스트 성공' : '이메일 암호화 테스트 실패',
      emailTest: emailTest,
      phoneTest: phoneTest,
      results: {
        email: { original: testEmail, encrypted: encryptedEmail, decrypted: decryptedEmail },
        phone: { original: testPhone, encrypted: encryptedPhone, decrypted: decryptedPhone }
      }
    };
    
  } catch (error) {
    logError_('TestBasic', '이메일 암호화 테스트 실패:');
    return {
      success: false,
      message: '이메일 암호화 테스트 실패: ' + error.message
    };
  }
}

/**
 * 전체 기본 테스트 실행
 * @returns {Object} 전체 테스트 결과
 */
function runAllBasicTests() {
  
  try {
    const results = {
      simpleTest: runSimpleTest(),
      encryptionAlgorithms: testEncryptionAlgorithms(),
      multiLayerEncryption: testMultiLayerEncryption(),
      emailEncryption: testEmailEncryption()
    };
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    Object.keys(results).forEach(testName => {
      const result = results[testName];
    });
    
    return {
      success: successCount === totalCount,
      message: `전체 테스트 결과: ${successCount}/${totalCount} 성공`,
      results: results
    };
    
  } catch (error) {
    logError_('TestBasic', '전체 기본 테스트 실패:', error);
    return {
      success: false,
      message: '전체 기본 테스트 실패: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getTestBasicInfo() {
  return {
    version: '1.0.0',
    description: '기본 테스트 함수들',
    functions: [
      'runSimpleTest',
      'testEncryptionAlgorithms',
      'testMultiLayerEncryption',
      'testEmailEncryption',
      'runAllBasicTests'
    ],
    dependencies: [
      'EncryptionCore.gs',
      'EncryptionKeyManagement.gs',
      'EncryptionEmail.gs'
    ]
  };
}
