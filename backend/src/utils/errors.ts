export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_AUTHENTICATION_FAILED'
  | 'AI_PROVIDER_RATE_LIMITED'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_INVALID_RESPONSE'
  | 'AI_ALL_PROVIDERS_FAILED'
  | 'AI_COACH_UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_DOWNLOAD_ERROR'
  | 'MODEL_AUTHENTICATION_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_COMPATIBILITY_ERROR'
  | 'MODEL_INITIALIZATION_ERROR'
  | 'MODEL_INFERENCE_ERROR'
  | 'MODEL_OOM_ERROR'
  | 'MODEL_TIMEOUT'
  | 'MODEL_SECURITY_ERROR'
  | 'INVALID_MODEL_OUTPUT'
  | 'DATABASE_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'RESUME_NOT_FOUND'
  | 'RESUME_NOT_PROCESSED'
  | 'RESUME_TEXT_EMPTY'
  | 'INVALID_JOB_DESCRIPTION'
  | 'RESUME_PARSE_FAILED'
  | 'DETERMINISTIC_ANALYSIS_FAILED'
  | 'RAG_FAILED'
  | 'EMBEDDING_FAILED'
  | 'AI_PROVIDER_FAILED'
  | 'AI_SCHEMA_VALIDATION_FAILED'
  | 'REPORT_BUILD_FAILED'
  | 'RATE_LIMITED';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
