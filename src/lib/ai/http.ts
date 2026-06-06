import { NextResponse } from "next/server";
import {
  AiConfigurationError,
  AiFeatureDisabledError,
  AiRequestFailedError,
  AiSchemaValidationError,
  type AiError,
} from "./errors";

function isAiError(value: unknown): value is AiError {
  return value instanceof Error && "code" in value;
}

export function buildAiFailureResponse(
  error: unknown,
  fallbackMessage: string
): NextResponse {
  if (error instanceof AiFeatureDisabledError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error: error.message,
        message: error.message,
        retryable: false,
      },
      { status: 503 }
    );
  }

  if (error instanceof AiConfigurationError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error: error.message,
        message: error.message,
        retryable: false,
      },
      { status: 503 }
    );
  }

  if (error instanceof AiSchemaValidationError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error: error.message,
        message: "The AI response could not be validated. Please review manually and retry if needed.",
        retryable: false,
      },
      { status: 502 }
    );
  }

  if (error instanceof AiRequestFailedError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error: error.message,
        message: error.message,
        retryable: true,
      },
      { status: 502 }
    );
  }

  if (isAiError(error)) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error: error.message,
        message: error.message,
        retryable: false,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
      message: fallbackMessage,
      retryable: false,
    },
    { status: 500 }
  );
}
