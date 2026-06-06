export class AiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | null;

  constructor(code: string, message: string, details?: Record<string, unknown> | null) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details ?? null;
  }
}

export class AiConfigurationError extends AiError {
  constructor(message: string, details?: Record<string, unknown> | null) {
    super("AI_CONFIGURATION_ERROR", message, details);
  }
}

export class AiFeatureDisabledError extends AiError {
  constructor(message: string, details?: Record<string, unknown> | null) {
    super("AI_FEATURE_DISABLED", message, details);
  }
}

export class AiSchemaValidationError extends AiError {
  constructor(message: string, details?: Record<string, unknown> | null) {
    super("AI_SCHEMA_VALIDATION_ERROR", message, details);
  }
}

export class AiRequestFailedError extends AiError {
  constructor(message: string, details?: Record<string, unknown> | null) {
    super("AI_REQUEST_FAILED", message, details);
  }
}

export function getAiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
