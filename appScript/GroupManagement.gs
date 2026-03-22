/**
 * @file GroupManagement.gs
 * @brief 그룹스 관리 모듈
 * @details Google Groups 권한 관리 및 알림 기능을 담당합니다.
 * 워크스페이스 환경에서는 Admin SDK로 자동 멤버 추가, 아닌 경우 관리자 알림 이메일 전송.
 * @author Hot Potato Team
 * @date 2024
 */

/**
 * Admin SDK로 그룹에 멤버 추가 (워크스페이스 전용)
 * @param {string} userEmail - 추가할 사용자 이메일
 * @param {string} groupEmail - 그룹 이메일
 * @returns {{ success: boolean, error?: string }}
 */
function addMemberToGroupViaAdminApi(userEmail, groupEmail) {
  try {
    if (typeof AdminDirectory === 'undefined' || !AdminDirectory.Members) {
      return { success: false, error: 'Admin SDK를 사용할 수 없습니다.' };
    }
    const member = { email: userEmail, role: 'MEMBER' };
    AdminDirectory.Members.insert(member, groupEmail);
    console.log('✅ Admin API로 그룹 멤버 추가 완료:', userEmail, '->', groupEmail);
    return { success: true };
  } catch (e) {
    if (e.message && (e.message.indexOf('Member already exists') >= 0 || e.message.indexOf('memberAlreadyExists') >= 0)) {
      console.log('✅ 이미 그룹 멤버임, 성공으로 간주:', userEmail);
      return { success: true };
    }
    console.warn('⚠️ Admin API 그룹 멤버 추가 실패:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 그룹스 권한과 함께 사용자 승인
 * @param {string} studentId - 학생 ID
 * @param {string} groupRole - 그룹스 역할
 * @returns {Object} 승인 결과
 */
function approveUserWithGroup(studentId, groupRole) {
    try {
      console.log('✅ 사용자 승인 및 그룹스 권한 설정 시작:', studentId, groupRole);
      
      if (!studentId) {
        return {
          success: false,
          message: '학생 ID가 필요합니다.'
        };
      }
      
      if (!groupRole) {
        return {
          success: false,
          message: '그룹스 역할이 필요합니다.'
        };
      }
      
      // 1. 사용자 승인 (UserApproval.gs의 approveUser 함수 호출)
      const approvalResult = approveUser(studentId);
      if (!approvalResult.success) {
        return approvalResult;
      }
      
      // 2. 그룹스 권한에 따른 그룹스 이메일 매핑
      const groupEmail = getGroupEmailByRole(groupRole);
      const groupName = getGroupNameByRole(groupRole);
      
      if (!groupEmail) {
        return {
          success: false,
          message: '유효하지 않은 그룹스 권한입니다.'
        };
      }
      
      // 3. 사용자 이메일 복호화
      const userEmail = decryptEmailMain(approvalResult.user.google_member);
      
      // 4. 워크스페이스 환경: Admin API로 자동 멤버 추가 시도
      const addResult = addMemberToGroupViaAdminApi(userEmail, groupEmail);
      let status = 'NOTIFICATION_SENT';
      let resultMessage = '사용자가 승인되었습니다. 그룹스 관리자에게 알림이 전송되었습니다.';
      
      if (addResult.success) {
        status = 'MEMBER_ADDED';
        resultMessage = '사용자가 승인되었습니다. 그룹스에 자동으로 추가되었습니다.';
      } else {
        // 비워크스페이스 또는 Admin API 미사용: 그룹스 관리자에게 수동 추가 알림 전송
        sendGroupNotificationEmail({
          groupEmail: groupEmail,
          groupName: groupName,
          userEmail: userEmail,
          userName: approvalResult.user.name_member,
          studentId: studentId,
          groupRole: groupRole
        });
      }
      
      // 5. 그룹스 관리 로그 기록
      logGroupManagement({
        studentId: studentId,
        userEmail: userEmail,
        userName: approvalResult.user.name_member,
        groupEmail: groupEmail,
        groupName: groupName,
        groupRole: groupRole,
        status: status,
        approvalDate: new Date().toISOString().split('T')[0]
      });
      
      console.log('✅ 사용자 승인 및 그룹스 권한 설정 완료:', studentId, status);
      
      return {
        success: true,
        message: resultMessage,
        user: approvalResult.user,
        groupInfo: {
          groupEmail: groupEmail,
          groupName: groupName,
          groupRole: groupRole
        }
      };
      
    } catch (error) {
      console.error('✅ 사용자 승인 및 그룹스 권한 설정 오류:', error);
      return {
        success: false,
        message: '사용자 승인 중 오류가 발생했습니다: ' + error.message
      };
    }
  }
  
  /**
   * 그룹스 관리자에게 알림 이메일 전송
   * @param {Object} data - 이메일 데이터
   * @returns {Object} 전송 결과
   */
  function sendGroupNotificationEmail(data) {
    try {
      const emailSubject = `[Hot Potato] 새로운 사용자 그룹스 추가 요청 - ${data.userName}`;
      
      const emailBody = `안녕하세요, ${data.groupName} 그룹스 관리자님.

Hot Potato 시스템에서 새로운 사용자가 승인되어 그룹스에 추가 요청드립니다.

[사용자 정보]
- 이름: ${data.userName}
- 이메일: ${data.userEmail}
- 학번: ${data.studentId}
- 권한: ${data.groupRole}
- 승인일: ${new Date().toLocaleDateString('ko-KR')}

[추가 요청 그룹스]
- 그룹스명: ${data.groupName}
- 그룹스 이메일: ${data.groupEmail}

[추가 방법]
1. Google Groups (${data.groupEmail})에 접속
2. "멤버 추가" 클릭
3. 이메일 주소 "${data.userEmail}" 입력
4. 역할을 "멤버" 또는 "관리자"로 설정
5. "초대" 클릭

[주의사항]
- 이 사용자는 이미 Hot Potato 시스템에서 승인되었습니다.
- 그룹스에 추가하지 않으면 시스템 접근이 제한될 수 있습니다.

감사합니다.
Hot Potato 시스템 자동 알림`;
      
      // Gmail API로 이메일 전송
      GmailApp.sendEmail(data.groupEmail, emailSubject, emailBody);
      
      console.log('📧 그룹스 알림 이메일 전송 완료:', data.groupEmail);
      
      return { success: true };
      
    } catch (error) {
      console.error('📧 그룹스 알림 이메일 전송 실패:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 사용자에게 승인 완료 알림 이메일 전송
   * @param {Object} data - 이메일 데이터
   * @returns {Object} 전송 결과
   */
  function sendUserApprovalNotification(data) {
    try {
      const emailSubject = `[Hot Potato] 회원가입 승인 완료 - ${data.userName}`;
      
      const emailBody = `안녕하세요, ${data.userName}님!

Hot Potato 시스템 회원가입이 승인되었습니다.

[승인 완료]
- 이름: ${data.userName}
- 이메일: ${data.userEmail}
- 승인일: ${new Date().toLocaleDateString('ko-KR')}

[그룹스 추가 안내]
관리자가 곧 다음 그룹스에 귀하를 추가할 예정입니다:
- 그룹스명: ${data.groupName}
- 그룹스 이메일: ${data.groupEmail}

그룹스 초대 이메일을 받으시면 반드시 수락해주세요.

문의사항이 있으시면 관리자에게 연락해주세요.

감사합니다.
Hot Potato 시스템`;
      
      GmailApp.sendEmail(data.userEmail, emailSubject, emailBody);
      
      console.log('📧 사용자 승인 알림 이메일 전송 완료:', data.userEmail);
      
      return { success: true };
      
    } catch (error) {
      console.error('📧 사용자 승인 알림 이메일 전송 실패:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 그룹스 관리 로그 기록
   * @param {Object} data - 로그 데이터
   * @returns {Object} 기록 결과
   */
  function logGroupManagement(data) {
    try {
      const spreadsheet = getHpMemberSpreadsheet();
      const sheetName = 'group_management_log';
      
      // 그룹스 관리 로그 시트가 없으면 생성
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        // 헤더 추가
        sheet.getRange(1, 1, 1, 8).setValues([[
          '학번', '사용자 이메일', '사용자 이름', '그룹스 이메일', 
          '그룹스 이름', '그룹스 역할', '상태', '승인일'
        ]]);
      }
      
      // 로그 데이터 추가
      const logData = [
        data.studentId,
        data.userEmail,
        data.userName || '',
        data.groupEmail,
        data.groupName || '',
        data.groupRole || '',
        data.status,
        data.approvalDate
      ];
      
      sheet.appendRow(logData);
      
      console.log('📊 그룹스 관리 로그 기록 완료:', data.studentId);
      
      return { success: true };
      
    } catch (error) {
      console.error('📊 그룹스 관리 로그 기록 실패:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 대기 중인 그룹스 멤버 확인 (리마인더)
   * @returns {Object} 확인 결과
   */
  function checkPendingGroupMembers() {
    try {
      console.log('📧 대기 중인 그룹스 멤버 확인 시작');
      
      const spreadsheet = getHpMemberSpreadsheet();
      const sheet = spreadsheet.getSheetByName('group_management_log');
      
      if (!sheet) {
        console.log('📊 그룹스 관리 로그 시트가 없습니다.');
        return { success: true, message: '그룹스 관리 로그 시트가 없습니다.' };
      }
      
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        console.log('📊 그룹스 관리 로그 데이터가 없습니다.');
        return { success: true, message: '그룹스 관리 로그 데이터가 없습니다.' };
      }
      
      const header = data[0];
      const rows = data.slice(1);
      
      // 3일 이상 대기 중인 사용자 찾기
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const pendingUsers = rows.filter(row => {
        const status = row[header.indexOf('상태')];
        const approvalDate = new Date(row[header.indexOf('승인일')]);
        return status === 'NOTIFICATION_SENT' && approvalDate < threeDaysAgo;
      });
      
      console.log('📧 대기 중인 사용자 수:', pendingUsers.length);
      
      // 대기 중인 사용자에게 리마인더 이메일 전송
      let reminderCount = 0;
      for (const user of pendingUsers) {
        try {
          const reminderResult = sendReminderEmail(user);
          if (reminderResult.success) {
            reminderCount++;
          }
        } catch (error) {
          console.error('📧 리마인더 이메일 전송 실패:', error);
        }
      }
      
      console.log('📧 리마인더 이메일 전송 완료:', reminderCount);
      
      return {
        success: true,
        message: `${reminderCount}명에게 리마인더 이메일을 전송했습니다.`,
        reminderCount: reminderCount
      };
      
    } catch (error) {
      console.error('📧 대기 중인 그룹스 멤버 확인 오류:', error);
      return {
        success: false,
        message: '대기 중인 그룹스 멤버 확인 중 오류가 발생했습니다: ' + error.message
      };
    }
  }
  
  /**
   * 리마인더 이메일 전송
   * @param {Array} userData - 사용자 데이터 배열
   * @returns {Object} 전송 결과
   */
  function sendReminderEmail(userData) {
    try {
      const emailSubject = `[Hot Potato] 그룹스 추가 리마인더 - ${userData[2]}`;
      
      const emailBody = `
  안녕하세요, ${userData[3]} 그룹스 관리자님.
  
  Hot Potato 시스템에서 승인된 사용자가 아직 그룹스에 추가되지 않았습니다.
  
  📋 사용자 정보:
  • 이름: ${userData[2]}
  • 이메일: ${userData[1]}
  • 학번: ${userData[0]}
  • 승인일: ${userData[7]}
  
  📧 추가 요청 그룹스:
  • 그룹스명: ${userData[4]}
  • 그룹스 이메일: ${userData[3]}
  
  🔗 추가 방법:
  1. Google Groups (${userData[3]})에 접속
  2. "멤버 추가" 클릭
  3. 이메일 주소 "${userData[1]}" 입력
  4. 역할을 "멤버" 또는 "관리자"로 설정
  5. "초대" 클릭
  
  ⚠️ 주의사항:
  - 이 사용자는 3일 이상 전에 승인되었습니다.
  - 그룹스에 추가하지 않으면 시스템 접근이 제한될 수 있습니다.
  
  감사합니다.
  Hot Potato 시스템 자동 알림
      `;
      
      GmailApp.sendEmail(userData[3], emailSubject, emailBody);
      
      console.log('📧 리마인더 이메일 전송 완료:', userData[3]);
      
      return { success: true };
      
    } catch (error) {
      console.error('📧 리마인더 이메일 전송 실패:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 그룹스 관리 로그 조회
   * @param {Object} filters - 필터 조건
   * @returns {Object} 조회 결과
   */
  function getGroupManagementLog(filters = {}) {
    try {
      console.log('📊 그룹스 관리 로그 조회 시작:', filters);
      
      const spreadsheet = getHpMemberSpreadsheet();
      const sheet = spreadsheet.getSheetByName('group_management_log');
      
      if (!sheet) {
        return {
          success: false,
          message: '그룹스 관리 로그 시트가 없습니다.'
        };
      }
      
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return {
          success: true,
          data: [],
          message: '그룹스 관리 로그 데이터가 없습니다.'
        };
      }
      
      const header = data[0];
      const rows = data.slice(1);
      
      // 필터 적용
      let filteredRows = rows;
      
      if (filters.status) {
        filteredRows = filteredRows.filter(row => row[header.indexOf('상태')] === filters.status);
      }
      
      if (filters.groupRole) {
        filteredRows = filteredRows.filter(row => row[header.indexOf('그룹스 역할')] === filters.groupRole);
      }
      
      if (filters.startDate && filters.endDate) {
        filteredRows = filteredRows.filter(row => {
          const approvalDate = new Date(row[header.indexOf('승인일')]);
          return approvalDate >= new Date(filters.startDate) && approvalDate <= new Date(filters.endDate);
        });
      }
      
      // 데이터 변환
      const logs = filteredRows.map(row => {
        const log = {};
        header.forEach((key, index) => {
          log[key] = row[index];
        });
        return log;
      });
      
      console.log('📊 그룹스 관리 로그 조회 완료:', logs.length);
      
      return {
        success: true,
        data: logs,
        total: logs.length
      };
      
    } catch (error) {
      console.error('📊 그룹스 관리 로그 조회 오류:', error);
      return {
        success: false,
        message: '그룹스 관리 로그 조회 중 오류가 발생했습니다: ' + error.message
      };
    }
  }
  
  /**
   * 그룹스 관리 통계 조회
   * @returns {Object} 통계 결과
   */
  function getGroupManagementStats() {
    try {
      console.log('📊 그룹스 관리 통계 조회 시작');
      
      const logResult = getGroupManagementLog();
      if (!logResult.success) {
        return logResult;
      }
      
      const logs = logResult.data;
      
      // 역할별 통계
      const roleStats = {};
      const statusStats = {};
      
      logs.forEach(log => {
        const role = log['그룹스 역할'] || 'unknown';
        const status = log['상태'] || 'unknown';
        
        roleStats[role] = (roleStats[role] || 0) + 1;
        statusStats[status] = (statusStats[status] || 0) + 1;
      });
      
      console.log('📊 그룹스 관리 통계 조회 완료');
      
      return {
        success: true,
        data: {
          total: logs.length,
          roleStats: roleStats,
          statusStats: statusStats,
          lastUpdated: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('📊 그룹스 관리 통계 조회 오류:', error);
      return {
        success: false,
        message: '그룹스 관리 통계 조회 중 오류가 발생했습니다: ' + error.message
      };
    }
  }
  