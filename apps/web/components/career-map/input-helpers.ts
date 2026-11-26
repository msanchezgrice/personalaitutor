import { CAREER_MAP_INPUT_MAX_CHARS, CAREER_MAP_INPUT_MIN_CHARS, CAREER_MAP_TITLES, type CareerMapSource } from "@aitutor/shared";

/**
 * Pure helpers for the /map input flow and the map result page: input
 * validation, the hero draft hand-off, honest progress copy and the mapping
 * from API error codes to sentences a person can act on. No React, no browser
 * globals, so they are unit-tested directly.
 */

/** Same cap the extract route enforces. */
export const CAREER_MAP_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const CAREER_MAP_UPLOAD_ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

export type InputCheck =
  | { ok: true; chars: number }
  | { ok: false; chars: number; reason: "empty" | "short" | "long"; message: string };

/** Counts trimmed characters, the same way the API does. */
export function checkCareerMapInput(text: string): InputCheck {
  const chars = text.trim().length;
  if (chars === 0) {
    return { ok: false, chars, reason: "empty", message: "Paste your résumé or describe your last job to start." };
  }
  if (chars < CAREER_MAP_INPUT_MIN_CHARS) {
    const missing = CAREER_MAP_INPUT_MIN_CHARS - chars;
    return {
      ok: false,
      chars,
      reason: "short",
      message: `Add at least ${missing} more character${missing === 1 ? "" : "s"}. A title, what you did and one result is enough.`,
    };
  }
  if (chars > CAREER_MAP_INPUT_MAX_CHARS) {
    const extra = chars - CAREER_MAP_INPUT_MAX_CHARS;
    return {
      ok: false,
      chars,
      reason: "long",
      message: `That is ${formatCount(extra)} characters over the limit. Cut older roles or long skill lists first.`,
    };
  }
  return { ok: true, chars };
}

/** "1,204 / 20,000 characters" */
export function formatCharacterCount(chars: number): string {
  return `${formatCount(chars)} / ${formatCount(CAREER_MAP_INPUT_MAX_CHARS)} characters`;
}

export type CareerMapDraft = { text: string; source: Extract<CareerMapSource, "paste" | "describe"> };

/** Parses the hero hand-off stored in sessionStorage. Returns null for anything malformed. */
export function parseCareerMapDraft(raw: string | null | undefined): CareerMapDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const text = (value as { text?: unknown }).text;
    const source = (value as { source?: unknown }).source;
    if (typeof text !== "string" || !text.trim()) return null;
    return { text: text.slice(0, CAREER_MAP_INPUT_MAX_CHARS + 2000), source: source === "describe" ? "describe" : "paste" };
  } catch {
    return null;
  }
}

/** Should the input page start generating as soon as it mounts? */
export function shouldAutoStart(draft: CareerMapDraft | null, from: string | null | undefined): boolean {
  return from === "home" && draft !== null && checkCareerMapInput(draft.text).ok;
}

export type UploadCheck = { ok: true } | { ok: false; code: "RESUME_FILE_TOO_LARGE" | "RESUME_FILE_UNSUPPORTED" };

/** Client-side pre-check so an obviously wrong file never leaves the browser. The server checks again. */
export function checkUploadFile(file: { name: string; size: number }): UploadCheck {
  const name = file.name.toLowerCase();
  if (!/\.(pdf|docx|txt)$/.test(name)) return { ok: false, code: "RESUME_FILE_UNSUPPORTED" };
  if (file.size > CAREER_MAP_UPLOAD_MAX_BYTES) return { ok: false, code: "RESUME_FILE_TOO_LARGE" };
  return { ok: true };
}

/**
 * Progress copy for the 10-30 second wait. The map is drawn in one model call,
 * so these are not checkpoints: each line says what is usually happening by
 * that point, and the page shows the real elapsed time next to it.
 */
export const CAREER_MAP_PROGRESS_STAGES: ReadonlyArray<{ afterSeconds: number; message: string }> = [
  { afterSeconds: 0, message: "Sending your text" },
  { afterSeconds: 2, message: "Reading what you did, line by line" },
  { afterSeconds: 8, message: `Matching your work to ${CAREER_MAP_TITLES.length} AI-era titles` },
  { afterSeconds: 16, message: "Checking every translation against your own words" },
  { afterSeconds: 26, message: "Drawing your route and proof plan" },
  { afterSeconds: 40, message: "Still working. A translation that did not match your text gets redone, which adds time." },
  { afterSeconds: 75, message: "This is taking longer than usual. You can keep waiting; we stop after two minutes." },
];

export function careerMapProgressMessage(elapsedSeconds: number): string {
  let message = CAREER_MAP_PROGRESS_STAGES[0].message;
  for (const stage of CAREER_MAP_PROGRESS_STAGES) {
    if (elapsedSeconds >= stage.afterSeconds) message = stage.message;
  }
  return message;
}

/** "in about 40 minutes" / "in about 2 hours" / "in a minute" */
export function formatRetryAfter(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe <= 90) return "in a minute";
  const minutes = Math.round(safe / 60);
  if (minutes < 60) return `in about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
  return "tomorrow";
}

export type CareerMapErrorAction = "retry" | "edit" | "upload" | "paste" | "wait" | "start-over";

export type CareerMapErrorCopy = {
  code: string;
  title: string;
  message: string;
  action: CareerMapErrorAction;
  actionLabel: string;
  retryAfterSeconds?: number;
};

export type ApiErrorInput = {
  code?: string | null;
  status?: number | null;
  reason?: string | null;
  retryAfterSeconds?: number | null;
};

/** Every error code the career-map routes return, plus the two transport failures. */
export const CAREER_MAP_ERROR_CODES = [
  "INVALID_BODY",
  "CAREER_MAP_INPUT_TOO_SHORT",
  "CAREER_MAP_RATE_LIMITED",
  "OPENAI_CONFIG_MISSING",
  "CAREER_MAP_FAILED",
  "RESUME_FILE_TOO_LARGE",
  "RESUME_FILE_UNSUPPORTED",
  "RESUME_TEXT_NOT_FOUND",
  "CAREER_MAP_NOT_FOUND",
  "NETWORK_ERROR",
  "TIMEOUT",
] as const;

/** Maps an API error (or a transport failure) on the /map flow to a human sentence and a next step. */
export function describeCareerMapError(input: ApiErrorInput): CareerMapErrorCopy {
  const code = input.code?.trim() || (input.status === 504 ? "TIMEOUT" : "UNKNOWN");
  const reason = input.reason ?? "";

  switch (code) {
    case "INVALID_BODY":
      return {
        code,
        title: "We could not read that request",
        message: `Check that your text is between ${CAREER_MAP_INPUT_MIN_CHARS} and ${formatCount(CAREER_MAP_INPUT_MAX_CHARS)} characters, then try again.`,
        action: "edit",
        actionLabel: "Edit my text",
      };
    case "CAREER_MAP_INPUT_TOO_SHORT":
      return {
        code,
        title: "There is not enough here to map yet",
        message: "Add your title, what you did most weeks and one thing you are proud of. A few lines is enough.",
        action: "edit",
        actionLabel: "Add more detail",
      };
    case "CAREER_MAP_RATE_LIMITED": {
      const seconds = typeof input.retryAfterSeconds === "number" && input.retryAfterSeconds > 0 ? input.retryAfterSeconds : 3600;
      return {
        code,
        title: "You have drawn several maps in a short time",
        message: `To keep the map free, each person gets a few per hour. You can draw another ${formatRetryAfter(seconds)}. Your text stays here.`,
        action: "wait",
        actionLabel: "Try again",
        retryAfterSeconds: seconds,
      };
    }
    case "OPENAI_CONFIG_MISSING":
      return {
        code,
        title: "The map engine is offline",
        message: "This is a problem on our side, not with your text. Try again in a few minutes.",
        action: "retry",
        actionLabel: "Try again",
      };
    case "CAREER_MAP_FAILED":
      if (/UNGROUNDED/i.test(reason)) {
        return {
          code,
          title: "We could not draw a map we trust",
          message:
            "Every skill on a map has to quote a line from your text, and this time too few did, so we threw the result away instead of showing you a guess. Add more detail about what you did, or try again.",
          action: "edit",
          actionLabel: "Add more detail",
        };
      }
      return {
        code,
        title: "We could not draw your map",
        message: "The model behind the map did not give us a usable answer. Nothing is wrong with your text. Try again in a minute.",
        action: "retry",
        actionLabel: "Try again",
      };
    case "RESUME_FILE_TOO_LARGE":
      return {
        code,
        title: "That file is too large",
        message: "We can read files up to 5 MB. Export a copy without images, or paste the text instead.",
        action: "upload",
        actionLabel: "Choose another file",
      };
    case "RESUME_FILE_UNSUPPORTED":
      return {
        code,
        title: "We cannot read that kind of file",
        message: "Upload a PDF, a Word file (.docx) or plain text. Older .doc files need to be saved as .docx or PDF first.",
        action: "upload",
        actionLabel: "Choose another file",
      };
    case "RESUME_TEXT_NOT_FOUND":
      return {
        code,
        title: "We found no text in that file",
        message: "Scanned PDFs are pictures of a page, so there is nothing for us to read. Paste your résumé text instead.",
        action: "paste",
        actionLabel: "Paste my résumé",
      };
    case "CAREER_MAP_NOT_FOUND":
      return {
        code,
        title: "We could not find that map",
        message: "The link may be incomplete. You can draw a new map in about a minute.",
        action: "start-over",
        actionLabel: "Draw a new map",
      };
    case "NETWORK_ERROR":
      return {
        code,
        title: "We could not reach the server",
        message: "Check your connection and try again. Your text is still here.",
        action: "retry",
        actionLabel: "Try again",
      };
    case "TIMEOUT":
      return {
        code,
        title: "That took longer than we allow",
        message: "Nothing is wrong with your text. Try again; a shorter résumé is usually faster.",
        action: "retry",
        actionLabel: "Try again",
      };
    default:
      return {
        code,
        title: "Something went wrong on our side",
        message: "Your text is still here. Try again in a minute.",
        action: "retry",
        actionLabel: "Try again",
      };
  }
}

/** Email form on the result page. */
export function describeCareerMapEmailError(input: ApiErrorInput): string {
  switch (input.code) {
    case "INVALID_BODY":
      return "That email address does not look right. Check it and try again.";
    case "CAREER_MAP_NOT_FOUND":
      return "We could not find this map to save it. Reload the page and try again.";
    case "NETWORK_ERROR":
      return "We could not reach the server. Check your connection and try again.";
    default:
      return "We could not save your email just now. Try again in a minute.";
  }
}

export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Human sentence for a map stored with status "failed". `failureReason` is an
 * internal code (e.g. CAREER_MAP_INVALID_OUTPUT:UNGROUNDED) and is never shown raw.
 */
export function describeStoredFailure(failureReason: string | null | undefined): string {
  const reason = failureReason ?? "";
  if (/UNGROUNDED/i.test(reason)) {
    return "Every skill on a map has to quote a line from your text, and too few did. We threw the result away instead of showing you a guess.";
  }
  if (/OPENAI_CONFIG_MISSING|OPENAI_API_KEY_MISSING/i.test(reason)) {
    return "The map engine was offline when you tried. That was a problem on our side, not with your text.";
  }
  if (/INVALID_OUTPUT/i.test(reason)) {
    return "The model gave us an answer we could not check, so we did not keep it.";
  }
  return "The model behind the map did not answer in time or returned an error. Nothing was wrong with your text.";
}
