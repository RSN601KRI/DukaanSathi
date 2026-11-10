import { AsyncLocalStorage } from "node:async_hooks";
import { describe, expect, it } from "vitest";
import {
  getTtsErrorMessage,
  gnaniConfigurationStatus,
  gnaniTtsRequest,
  gnaniTtsVoice,
  sanitizeUrl,
} from "./gnani.functions";
import { installServerBindingsStorage, withServerBindings } from "./server-env.server";

installServerBindingsStorage(new AsyncLocalStorage<Record<string, unknown>>());

// Rule: endpoint URLs pasted from docs pages with a stray copy-button token
// (e.g. "https://api.vachana.ai/stt/v3 Copy") must still work — this was the
// root cause of the real "Gnani STT error (404)" report.
describe("sanitizeUrl", () => {
  it("strips a trailing Copy token pasted from a docs page", () => {
    expect(sanitizeUrl("https://api.vachana.ai/stt/v3 Copy")).toBe("https://api.vachana.ai/stt/v3");
  });

  it("strips trailing Copy case-insensitively and surrounding whitespace", () => {
    expect(sanitizeUrl("  https://api.vachana.ai/api/v1/tts/inference copy \n")).toBe(
      "https://api.vachana.ai/api/v1/tts/inference",
    );
  });

  it("leaves a clean URL untouched", () => {
    expect(sanitizeUrl("https://api.vachana.ai/stt/v3")).toBe("https://api.vachana.ai/stt/v3");
  });

  it("removes embedded whitespace but preserves the path", () => {
    expect(sanitizeUrl("https://api.vachana.ai/stt /v3")).toBe("https://api.vachana.ai/stt/v3");
  });
});

describe("Gnani TTS configuration", () => {
  it("uses the documented voice for each selected language", () => {
    expect(gnaniTtsVoice("hi-IN")).toBe("Nalini");
    expect(gnaniTtsVoice("en-IN")).toBe("Kaveri");
    expect(gnaniTtsVoice("hi-en")).toBe("Poorvi");
  });

  it("respects an explicitly configured voice", () => {
    expect(gnaniTtsVoice("en-IN", "  Nalini ")).toBe("Nalini");
  });

  it("builds the documented Timbre v2.5 WAV request", () => {
    expect(gnaniTtsRequest("नमस्ते", "hi-IN")).toEqual({
      text: "नमस्ते",
      voice: "Nalini",
      model: "timbre-v2.5",
      language: "hi-IN",
      speed: 1,
      audio_config: {
        sample_rate: 48000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    });
  });

  it("extracts Gnani's documented flat TTS error message", () => {
    expect(
      getTtsErrorMessage(
        '{"success":false,"message":"Invalid request: unknown voice","status_code":400}',
        400,
      ),
    ).toBe("Gnani TTS error (400): Invalid request: unknown voice");
  });

  it("extracts Gnani authentication error detail", () => {
    expect(getTtsErrorMessage('{"detail":{"message":"Unauthorized"}}', 401)).toBe(
      "Gnani TTS error (401): Unauthorized",
    );
  });

  it("reads Lovable runtime bindings without exposing secret values in status", async () => {
    const status = withServerBindings(
      {
        GNANI_API_KEY: "test-key",
        GNANI_STT_URL: "https://api.vachana.ai/stt/v3",
        GNANI_TTS_URL: "https://api.vachana.ai/api/v1/tts/inference",
      },
      () => gnaniConfigurationStatus(),
    );

    await expect(status).resolves.toEqual({
      apiKeyConfigured: true,
      sttUrlConfigured: true,
      ttsUrlConfigured: true,
      stt: true,
      tts: true,
    });
    await expect(gnaniConfigurationStatus()).resolves.toMatchObject({ apiKeyConfigured: false });
  });
});
