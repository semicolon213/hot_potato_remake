type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMethod = (...args: unknown[]) => void;

export interface ScopedLogger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const getConfiguredLevel = (): LogLevel => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return 'debug';

  let isDev = false;
  let configured = '';
  if (typeof window !== 'undefined' && import.meta?.env) {
    isDev = import.meta.env.DEV === true;
    configured = String(import.meta.env.VITE_LOG_LEVEL || '').toLowerCase();
  }

  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('HP_DEBUG') === '1') {
      return 'debug';
    }
  } catch {
    // localStorage 접근이 차단된 환경에서는 빌드 설정을 사용한다.
  }

  if (configured in LEVEL_WEIGHT) return configured as LogLevel;
  return isDev ? 'debug' : 'warn';
};

const emit = (level: LogLevel, scope: string, args: unknown[]): void => {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[getConfiguredLevel()]) return;
  const method = level === 'debug' ? console.debug : console[level];
  method(`[${scope}]`, ...args);
};

const createScopedLogger = (scope: string): ScopedLogger => ({
  debug: (...args) => emit('debug', scope, args),
  info: (...args) => emit('info', scope, args),
  warn: (...args) => emit('warn', scope, args),
  error: (...args) => emit('error', scope, args)
});

export const logger: ScopedLogger & { scope: (scope: string) => ScopedLogger } = {
  ...createScopedLogger('app'),
  scope: createScopedLogger
};
