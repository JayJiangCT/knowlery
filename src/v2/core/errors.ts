export type ErrorCode =
  | 'invalid_invocation'
  | 'not_found'
  | 'path_denied'
  | 'stale_version'
  | 'invalid_config'
  | 'unsupported_schema'
  | 'internal'
  | 'invalid_selector'
  | 'raw_disabled'
  | 'extraction_unavailable'
  | 'limit_reached'
  | 'deadline';

export class KnowleryError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly recovery: string,
  ) {
    super(message);
    this.name = 'KnowleryError';
  }
}

export function exitCode(code: ErrorCode): 1 | 2 {
  switch (code) {
    case 'invalid_invocation': return 2;
    case 'not_found':
    case 'path_denied':
    case 'stale_version':
    case 'invalid_config':
    case 'unsupported_schema':
    case 'internal':
    case 'invalid_selector':
    case 'raw_disabled':
    case 'extraction_unavailable':
    case 'limit_reached':
    case 'deadline': return 1;
    default: {
      const unreachable: never = code;
      return unreachable;
    }
  }
}

export function invalidInvocation(message: string): never {
  throw new KnowleryError('invalid_invocation', message, 'Run knowlery --help for usage.');
}
