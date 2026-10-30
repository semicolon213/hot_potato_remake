/**
 * Apps Script 공용 로거
 * 스크립트 속성 LOG_LEVEL: debug | info | warn | error (기본 warn)
 */
var LOG_LEVEL_WEIGHT_ = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
var logLevelMemo_ = null;

function getLogLevel_() {
  if (logLevelMemo_) return logLevelMemo_;

  var configured = PropertiesService.getScriptProperties().getProperty('LOG_LEVEL');
  configured = String(configured || 'warn').toLowerCase();
  logLevelMemo_ = Object.prototype.hasOwnProperty.call(LOG_LEVEL_WEIGHT_, configured)
    ? configured
    : 'warn';
  return logLevelMemo_;
}

function log_(level, scope, args) {
  if (LOG_LEVEL_WEIGHT_[level] < LOG_LEVEL_WEIGHT_[getLogLevel_()]) return;

  var output = ['[' + scope + ']'].concat(args);
  var method = level === 'debug' ? 'log' : level;
  console[method].apply(console, output);
}

function logDebug_(scope) {
  log_('debug', scope, Array.prototype.slice.call(arguments, 1));
}

function logInfo_(scope) {
  log_('info', scope, Array.prototype.slice.call(arguments, 1));
}

function logWarn_(scope) {
  log_('warn', scope, Array.prototype.slice.call(arguments, 1));
}

function logError_(scope) {
  log_('error', scope, Array.prototype.slice.call(arguments, 1));
}
