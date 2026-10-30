/**
 * TestUserManagement.gs
 * 사용자 관리 관련 테스트 함수들
 * Hot Potato Admin Key Management System
 */

// ===== 사용자 관리 테스트 함수들 =====

/**
 * 사용자 등록 요청 테스트
 * @returns {Object} 테스트 결과
 */
function testUserRegistration() {
  
  try {
    const testUser = {
      email: 'test@example.com',
      name: 'Test User',
      phone: '010-1234-5678',
      department: 'Test Department',
      position: 'Test Position',
      reason: 'Test registration reason'
    };
    
    const result = UserRegistration.handleSubmitRegistrationRequest(testUser);
    
    if (!result.success) {
      throw new Error('사용자 등록 요청 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '사용자 등록 요청 테스트 성공',
      testUser: testUser
    };
    
  } catch (error) {
    logError_('TestUserManagement', '사용자 등록 요청 테스트 실패:', error);
    return {
      success: false,
      message: '사용자 등록 요청 테스트 실패: ' + error.message
    };
  }
}

/**
 * 사용자 승인 상태 확인 테스트
 * @returns {Object} 테스트 결과
 */
function testUserApprovalStatus() {
  
  try {
    const testEmail = 'test@example.com';
    
    const result = UserRegistration.handleCheckApprovalStatus(testEmail);
    
    if (!result.success) {
      throw new Error('승인 상태 확인 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '사용자 승인 상태 확인 테스트 성공',
      testEmail: testEmail,
      status: result.data?.status || 'Unknown'
    };
    
  } catch (error) {
    logError_('TestUserManagement', '사용자 승인 상태 확인 테스트 실패:', error);
    return {
      success: false,
      message: '사용자 승인 상태 확인 테스트 실패: ' + error.message
    };
  }
}

/**
 * 대기 중인 사용자 목록 테스트
 * @returns {Object} 테스트 결과
 */
function testPendingUsers() {
  
  try {
    const result = UserApproval.handleGetPendingUsers();
    
    if (!result.success) {
      throw new Error('대기 중인 사용자 목록 조회 실패: ' + result.message);
    }
    
    const pendingUsers = result.data || [];
    logDebug_('TestUserManagement', '대기 중인 사용자 수:', pendingUsers.length);
    
    if (pendingUsers.length > 0) {
    }
    
    return {
      success: true,
      message: '대기 중인 사용자 목록 테스트 성공',
      pendingCount: pendingUsers.length,
      sampleUser: pendingUsers[0] || null
    };
    
  } catch (error) {
    logError_('TestUserManagement', '대기 중인 사용자 목록 테스트 실패:', error);
    return {
      success: false,
      message: '대기 중인 사용자 목록 테스트 실패: ' + error.message
    };
  }
}

/**
 * 사용자 승인 테스트
 * @returns {Object} 테스트 결과
 */
function testUserApproval() {
  
  try {
    const testEmail = 'test@example.com';
    
    const result = UserApproval.handleApproveUser(testEmail);
    
    if (!result.success) {
      throw new Error('사용자 승인 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '사용자 승인 테스트 성공',
      testEmail: testEmail
    };
    
  } catch (error) {
    logError_('TestUserManagement', '사용자 승인 테스트 실패:', error);
    return {
      success: false,
      message: '사용자 승인 테스트 실패: ' + error.message
    };
  }
}

/**
 * 사용자 거부 테스트
 * @returns {Object} 테스트 결과
 */
function testUserRejection() {
  
  try {
    const testEmail = 'test@example.com';
    
    const result = UserApproval.handleRejectUser(testEmail);
    
    if (!result.success) {
      throw new Error('사용자 거부 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '사용자 거부 테스트 성공',
      testEmail: testEmail
    };
    
  } catch (error) {
    logError_('TestUserManagement', '사용자 거부 테스트 실패:', error);
    return {
      success: false,
      message: '사용자 거부 테스트 실패: ' + error.message
    };
  }
}

/**
 * 사용자 상태 확인 테스트
 * @returns {Object} 테스트 결과
 */
function testUserStatus() {
  
  try {
    const testEmail = 'test@example.com';
    
    const result = UserAuth.handleCheckUserStatus(testEmail);
    
    if (!result.success) {
      throw new Error('사용자 상태 확인 실패: ' + result.message);
    }
    
    return {
      success: true,
      message: '사용자 상태 확인 테스트 성공',
      testEmail: testEmail,
      status: result.data?.status || 'Unknown'
    };
    
  } catch (error) {
    logError_('TestUserManagement', '사용자 상태 확인 테스트 실패:', error);
    return {
      success: false,
      message: '사용자 상태 확인 테스트 실패: ' + error.message
    };
  }
}

/**
 * 전체 사용자 관리 테스트 실행
 * @returns {Object} 전체 테스트 결과
 */
function runAllUserManagementTests() {
  
  try {
    const results = {
      registration: testUserRegistration(),
      approvalStatus: testUserApprovalStatus(),
      pendingUsers: testPendingUsers(),
      approval: testUserApproval(),
      rejection: testUserRejection(),
      userStatus: testUserStatus()
    };
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    Object.keys(results).forEach(testName => {
      const result = results[testName];
    });
    
    return {
      success: successCount === totalCount,
      message: `사용자 관리 테스트 결과: ${successCount}/${totalCount} 성공`,
      results: results
    };
    
  } catch (error) {
    logError_('TestUserManagement', '전체 사용자 관리 테스트 실패:', error);
    return {
      success: false,
      message: '전체 사용자 관리 테스트 실패: ' + error.message
    };
  }
}

// ===== 배포 정보 =====
function getTestUserManagementInfo() {
  return {
    version: '1.0.0',
    description: '사용자 관리 관련 테스트 함수들',
    functions: [
      'testUserRegistration',
      'testUserApprovalStatus',
      'testPendingUsers',
      'testUserApproval',
      'testUserRejection',
      'testUserStatus',
      'runAllUserManagementTests'
    ],
    dependencies: [
      'UserRegistration.gs',
      'UserApproval.gs',
      'UserAuth.gs'
    ]
  };
}
