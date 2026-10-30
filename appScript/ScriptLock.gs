/**
 * 공유 시트 쓰기 경합 보호
 * 번호 산정 후 행 추가, 학년 일괄 갱신, 결재 상태 변경이 동시에 실행되면
 * 같은 번호가 두 번 쓰이거나 상태가 덮어써질 수 있어 스크립트 잠금으로 직렬화한다.
 */
var SCRIPT_LOCK_TIMEOUT_MS_ = 10000;
var scriptLockDepth_ = 0;

function withScriptLock_(fn) {
  // 같은 실행 안에서 잠금 함수가 다른 잠금 함수를 부르면 이미 잡은 잠금을 그대로 쓴다.
  if (scriptLockDepth_ > 0) return fn();

  var lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_TIMEOUT_MS_);
  scriptLockDepth_++;
  try {
    return fn();
  } finally {
    scriptLockDepth_--;
    lock.releaseLock();
  }
}

function createAnnouncement(req) {
  return withScriptLock_(function() { return createAnnouncementUnlocked_(req); });
}

function requestWorkflow(req) {
  return withScriptLock_(function() { return requestWorkflowUnlocked_(req); });
}

function resubmitWorkflow(req) {
  return withScriptLock_(function() { return resubmitWorkflowUnlocked_(req); });
}

function processReviewAction(req, actionType) {
  return withScriptLock_(function() { return processReviewActionUnlocked_(req, actionType); });
}

function processPaymentAction(req, actionType) {
  return withScriptLock_(function() { return processPaymentActionUnlocked_(req, actionType); });
}

function updateStudentGrades(spreadsheetId, graduationGrade, graduationYear, graduationTerm) {
  return withScriptLock_(function() {
    return updateStudentGradesUnlocked_(spreadsheetId, graduationGrade, graduationYear, graduationTerm);
  });
}

function updateStudentGradesSelected(spreadsheetId, studentIds, graduationGrade, graduationYear, graduationTerm) {
  return withScriptLock_(function() {
    return updateStudentGradesSelectedUnlocked_(spreadsheetId, studentIds, graduationGrade, graduationYear, graduationTerm);
  });
}

function updateStudentRetained(studentId, spreadsheetId, isRetained) {
  return withScriptLock_(function() {
    return updateStudentRetainedUnlocked_(studentId, spreadsheetId, isRetained);
  });
}
