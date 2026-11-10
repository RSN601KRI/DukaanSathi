import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Gnani AI integration (docs.gnani.ai). Endpoint URLs and the API key come from
// env vars/secrets — nothing is hard-coded. Required: GNANI_API_KEY.
// Optional endpoint overrides default to Gnani's documented URLs.
// GNANI_AUTH_HEADER defaults to "X-API-Key-ID"; GNANI_AUTH_PREFIX defaults to
// empty. GNANI_TTS_VOICE defaults by language (Hindi: Nalini, Hinglish: Poorvi,
// English: Kaveri).
// sanitizeUrl strips whitespace and stray "Copy" text that creeps in when the
// endpoint URL is pasted from a docs page copy button (e.g. ".../stt/v3 Copy").
export function sanitizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\s*Copy\s*$/i, "")
    .replace(/\s+/g, "")
    .replace(/\/+$/, "");
}

export function gnaniTtsVoice(language: string, configuredVoice = ""): string {
  if (configuredVoice.trim()) return configuredVoice.trim();
  if (language === "en-IN") return "Kaveri";
  if (language === "hi-en") return "Poorvi";
  return "Nalini";
}

export function gnaniTtsRequest(text: string, language: string, configuredVoice = "") {
  return {
    text,
    voice: gnaniTtsVoice(language, configuredVoice),
    model: "timbre-v2.5",
    language,
    speed: 1.0,
    audio_config: {
      sample_rate: 48000,
      num_channels: 1,
      sample_width: 2,
      encoding: "linear_pcm",
      container: "wav",
    },
  };
}

export function getTtsErrorMessage(body: string, status: number): string {
  let detail = body;
  try {
    const response = JSON.parse(body) as { message?: unknown; detail?: unknown };
    const nestedDetail =
      response.detail && typeof response.detail === "object"
        ? (response.detail as { message?: unknown }).message
        : response.detail;
    const message = response.message ?? nestedDetail;
    if (typeof message === "string") detail = message;
  } catch {
    // Keep a plain-text error response useful to the caller.
  }
  detail = detail.replace(/\s+/g, " ").trim().slice(0, 240);
  return detail ? `Gnani TTS error (${status}): ${detail}` : `Gnani TTS error (${status})`;
}

async function cfg() {
  const { getServerEnv } = await import("@/lib/server-env.server");
  const key = getServerEnv("GNANI_API_KEY")?.trim() ?? "";
  const sttRaw = getServerEnv("GNANI_STT_URL") || "https://api.vachana.ai/stt/v3";
  const ttsRaw = getServerEnv("GNANI_TTS_URL") || "https://api.vachana.ai/api/v1/tts/inference";
  const stt = sttRaw ? sanitizeUrl(sttRaw) : "";
  const tts = ttsRaw ? sanitizeUrl(ttsRaw) : "";
  return {
    key,
    stt,
    tts,
    apiKeyConfigured: Boolean(key),
    sttUrlConfigured: Boolean(getServerEnv("GNANI_STT_URL")),
    ttsUrlConfigured: Boolean(getServerEnv("GNANI_TTS_URL")),
    header: getServerEnv("GNANI_AUTH_HEADER") || "X-API-Key-ID",
    prefix: getServerEnv("GNANI_AUTH_PREFIX") ?? "",
    voice: getServerEnv("GNANI_TTS_VOICE") ?? "",
  };
}

export async function gnaniConfigurationStatus() {
  const c = await cfg();
  return {
    apiKeyConfigured: c.apiKeyConfigured,
    sttUrlConfigured: c.sttUrlConfigured,
    ttsUrlConfigured: c.ttsUrlConfigured,
    stt: Boolean(c.key && c.stt),
    tts: Boolean(c.key && c.tts),
  };
}

export const gnaniStatus = createServerFn({ method: "GET" }).handler(async () => {
  return await gnaniConfigurationStatus();
});

export const transcribe = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        audioBase64: z.string().max(15_000_000),
        mime: z.string().max(100),
        language: z.string().max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const c = await cfg();
    if (!c.key || !c.stt)
      return { ok: false as const, error: "Gnani STT configure nahi hai (demo mode)." };
    try {
      const bin = Uint8Array.from(atob(data.audioBase64), (ch) => ch.charCodeAt(0));
      const form = new FormData();
      const mime = data.mime.toLowerCase().split(";").at(0) ?? "";
      const filename = ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(mime)
        ? "recording.wav"
        : "audio";
      form.append("audio_file", new Blob([bin], { type: data.mime }), filename);
      form.append("language_code", data.language);
      const r = await fetch(c.stt, {
        method: "POST",
        headers: { [c.header]: c.prefix + c.key },
        body: form,
      });
      const body = await r.text();
      if (!r.ok) {
        console.error("Gnani STT", r.status, body);
        let detail = "";
        try {
          const j = JSON.parse(body) as {
            error?: { type?: string; message?: string } | string;
            detail?: string;
            message?: string;
            code?: string;
          };
          detail =
            typeof j.error === "string"
              ? j.error
              : (j.error?.message ?? j.error?.type ?? j.detail ?? j.message ?? j.code ?? "");
        } catch {
          /* non-JSON error body */
        }
        if (body.toUpperCase().includes("UNSUPPORTED_AUDIO_FORMAT")) {
          return {
            ok: false as const,
            error:
              "Gnani ne audio format reject kiya. Mic ke liye WAV conversion karke dobara try karein; file ke liye WAV, MP3, M4A, FLAC, AAC ya OGG use karein.",
          };
        }
        return {
          ok: false as const,
          error: detail
            ? `Gnani STT error (${r.status}): ${detail}`
            : `Gnani STT error (${r.status})`,
        };
      }
      let text = body;
      try {
        const j = JSON.parse(body) as Record<string, unknown>;
        const nested =
          j["result"] && typeof j["result"] === "object"
            ? (j["result"] as Record<string, unknown>)
            : undefined;
        const nestedData =
          j["data"] && typeof j["data"] === "object"
            ? (j["data"] as Record<string, unknown>)
            : undefined;
        const raw =
          j["transcript"] ?? j["text"] ?? nested?.["transcript"] ?? nestedData?.["transcript"];
        if (raw != null) text = String(raw);
      } catch {
        /* plain text */
      }
      return { ok: true as const, text: String(text), httpStatus: r.status };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Gnani STT tak pahunch nahi paaye." };
    }
  });

export const speak = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(1000), language: z.string().max(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const c = await cfg();
    if (!c.key || !c.tts) return { ok: false as const, error: "Gnani TTS configure nahi hai." };
    try {
      const r = await fetch(c.tts, {
        method: "POST",
        headers: { [c.header]: c.prefix + c.key, "Content-Type": "application/json" },
        body: JSON.stringify(gnaniTtsRequest(data.text, data.language, c.voice)),
      });
      if (!r.ok) {
        const error = getTtsErrorMessage(await r.text(), r.status);
        console.error(error);
        return { ok: false as const, error, httpStatus: r.status };
      }
      const buf = new Uint8Array(await r.arrayBuffer());
      const mime =
        r.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "audio/wav";
      if (buf.length === 0 || (!mime.startsWith("audio/") && mime !== "application/octet-stream")) {
        console.error("Gnani TTS returned an invalid audio response", { mime, bytes: buf.length });
        return {
          ok: false as const,
          error: "Gnani TTS se audio nahi mila. Endpoint aur model settings check kijiye.",
        };
      }
      let s = "";
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]!);
      return {
        ok: true as const,
        audioBase64: btoa(s),
        mime,
        bytes: buf.length,
        httpStatus: r.status,
      };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Gnani TTS tak pahunch nahi paaye." };
    }
  });
