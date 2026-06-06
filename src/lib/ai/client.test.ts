import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiFeatureDisabledError, AiSchemaValidationError } from "./errors";
import { runStructuredAiTask } from "./client";

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  setEnv({
    OPENAI_ENABLED: undefined,
    OPENAI_MODERATION_ASSISTANT_ENABLED: undefined,
    OPENAI_AUDIT_LOGGING_ENABLED: undefined,
    OPENAI_API_KEY: undefined,
    OPENAI_PROJECT_ID: undefined,
  });
});

describe("runStructuredAiTask", () => {
  it("blocks execution when the feature is disabled", async () => {
    await expect(
      runStructuredAiTask(
        {
          feature: "moderation_assistant",
          operation: "review_media_package",
          schema: z.object({ ok: z.boolean() }),
          instructions: "Return JSON only.",
          input: "test input",
          promptVersion: "v1",
        },
        {
          responses: {
            parse: async () => ({
              id: "resp_1",
              model: "gpt-5.4-mini",
              output_parsed: { ok: true },
            }),
          },
        }
      )
    ).rejects.toBeInstanceOf(AiFeatureDisabledError);
  });

  it("returns parsed structured output when the feature is enabled", async () => {
    setEnv({
      OPENAI_ENABLED: "true",
      OPENAI_MODERATION_ASSISTANT_ENABLED: "true",
      OPENAI_AUDIT_LOGGING_ENABLED: "false",
      OPENAI_API_KEY: "sk-test",
      OPENAI_PROJECT_ID: "proj_test",
    });

    const result = await runStructuredAiTask(
      {
        feature: "moderation_assistant",
        operation: "review_media_package",
        schema: z.object({ ok: z.boolean() }),
        instructions: "Return JSON only.",
        input: "test input",
        promptVersion: "v1",
      },
      {
        responses: {
          parse: async () => ({
            id: "resp_1",
            model: "gpt-5.4-mini",
            output_parsed: { ok: true },
            usage: {
              input_tokens: 12,
              output_tokens: 8,
              total_tokens: 20,
            },
            _request_id: "req_1",
          }),
        },
      }
    );

    expect(result.data).toEqual({ ok: true });
    expect(result.usage?.totalTokens).toBe(20);
    expect(result.requestId).toBe("req_1");
  });

  it("dedupes identical in-flight requests", async () => {
    setEnv({
      OPENAI_ENABLED: "true",
      OPENAI_MODERATION_ASSISTANT_ENABLED: "true",
      OPENAI_AUDIT_LOGGING_ENABLED: "false",
      OPENAI_API_KEY: "sk-test",
      OPENAI_PROJECT_ID: "proj_test",
    });

    let completeParse!: (value: {
      id: string;
      model: string;
      output_parsed: unknown;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      } | null;
      _request_id?: string | null;
    }) => void;
    const parse = vi.fn<
      (body: Record<string, unknown>) => Promise<{
        id: string;
        model: string;
        output_parsed: unknown;
        usage?: {
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
        } | null;
        _request_id?: string | null;
      }>
    >(() =>
      new Promise((resolve) => {
        completeParse = resolve;
      })
    );

    const task = {
      feature: "moderation_assistant" as const,
      operation: "review_media_package",
      schema: z.object({ ok: z.boolean() }),
      instructions: "Return JSON only.",
      input: "test input",
      promptVersion: "v1",
      entityId: "booking-1",
    };

    const p1 = runStructuredAiTask(task, {
      responses: {
        parse,
      },
    });
    const p2 = runStructuredAiTask(task, {
      responses: {
        parse,
      },
    });

    await Promise.resolve();
    expect(parse).toHaveBeenCalledTimes(1);

    completeParse({
      id: "resp_1",
      model: "gpt-5.4-mini",
      output_parsed: { ok: true },
      usage: {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14,
      },
      _request_id: "req_1",
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data).toEqual({ ok: true });
    expect(r2.data).toEqual({ ok: true });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("rejects parsed output when post-parse validation fails", async () => {
    setEnv({
      OPENAI_ENABLED: "true",
      OPENAI_MODERATION_ASSISTANT_ENABLED: "true",
      OPENAI_AUDIT_LOGGING_ENABLED: "false",
      OPENAI_API_KEY: "sk-test",
      OPENAI_PROJECT_ID: "proj_test",
    });

    await expect(
      runStructuredAiTask(
        {
          feature: "moderation_assistant",
          operation: "review_media_package",
          schema: z.object({ ok: z.boolean() }),
          instructions: "Return JSON only.",
          input: "test input",
          promptVersion: "v1",
          validateData: () => {
            throw new AiSchemaValidationError("Unsupported evidence claim");
          },
        },
        {
          responses: {
            parse: async () => ({
              id: "resp_1",
              model: "gpt-5.4-mini",
              output_parsed: { ok: true },
            }),
          },
        }
      )
    ).rejects.toBeInstanceOf(AiSchemaValidationError);
  });
});
