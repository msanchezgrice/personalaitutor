import "server-only";

import { CAREER_MAP_INPUT_MAX_CHARS } from "@aitutor/shared";

/**
 * Résumé file -> plain text for the career map. Supports PDF (unpdf, a
 * serverless build of pdf.js), DOCX (mammoth) and plain text. Nothing is
 * stored: the text goes back to the visitor for review before they submit.
 *
 * Errors carry a stable `code` the extract route maps to HTTP statuses:
 * RESUME_FILE_TOO_LARGE (413), RESUME_FILE_UNSUPPORTED (415),
 * RESUME_TEXT_NOT_FOUND (422: scans, empty, encrypted or corrupt files).
 */

/** Under the hosting platform's 4.4 MB request body limit, so an over-size file gets our message, not a bare 413. */
export const RESUME_MAX_BYTES = 4 * 1024 * 1024;
/** Pages read from a PDF before we stop (the text is capped anyway). */
const PDF_MAX_PAGES = 40;
/** Fewer letters than this means there is no usable text (e.g. a scanned PDF). */
const MIN_LETTERS = 10;

export type ResumeExtractErrorCode = "RESUME_FILE_TOO_LARGE" | "RESUME_FILE_UNSUPPORTED" | "RESUME_TEXT_NOT_FOUND";

export class ResumeExtractError extends Error {
  readonly code: ResumeExtractErrorCode;

  constructor(code: ResumeExtractErrorCode, message: string) {
    super(message);
    this.name = "ResumeExtractError";
    this.code = code;
  }
}

export type ResumeFileKind = "pdf" | "docx" | "txt";

export type ResumeExtractResult = {
  text: string;
  chars: number;
  truncated: boolean;
  kind: ResumeFileKind;
};

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK..
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .doc / .xls
const TEXT_MIME = new Set(["text/plain", "text/markdown", "text/x-markdown"]);

/** Decides the file kind from its bytes first, then its name and type. Throws RESUME_FILE_UNSUPPORTED. */
export function detectResumeFileKind(input: { fileName: string; mimeType: string; bytes: Uint8Array }): ResumeFileKind {
  const ext = extensionOf(input.fileName);
  const mime = input.mimeType.toLowerCase().split(";")[0].trim();

  if (startsWith(input.bytes, PDF_MAGIC)) return "pdf";
  if (ext === "doc" || mime === "application/msword" || startsWith(input.bytes, OLE_MAGIC)) {
    throw new ResumeExtractError(
      "RESUME_FILE_UNSUPPORTED",
      "Old Word files (.doc) are not supported. Save it as .docx or PDF in Word, or paste the text.",
    );
  }
  if (startsWith(input.bytes, ZIP_MAGIC)) {
    if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return "docx";
    }
    throw new ResumeExtractError("RESUME_FILE_UNSUPPORTED", "Upload a PDF, a Word file (.docx) or a .txt file.");
  }
  if (ext === "pdf" || ext === "docx") {
    // The name says PDF/DOCX but the bytes do not: damaged or renamed file.
    throw new ResumeExtractError(
      "RESUME_TEXT_NOT_FOUND",
      "We could not read this file. It may be damaged. Try saving it again, or paste the text.",
    );
  }
  if (ext === "txt" || ext === "md" || TEXT_MIME.has(mime)) {
    if (looksBinary(input.bytes)) {
      throw new ResumeExtractError("RESUME_FILE_UNSUPPORTED", "This does not look like a text file. Upload a PDF, .docx or .txt file.");
    }
    return "txt";
  }
  throw new ResumeExtractError("RESUME_FILE_UNSUPPORTED", "Upload a PDF, a Word file (.docx) or a .txt file.");
}

function looksBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4096);
  let nul = 0;
  for (const byte of sample) if (byte === 0) nul += 1;
  return nul > 0 && !isUtf16(bytes);
}

function isUtf16(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff]);
}

function decodeText(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

/** Line endings, control characters, trailing spaces and runs of blank lines. */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js may detach the buffer it is given, so hand it a copy.
    doc = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw new ResumeExtractError(
      "RESUME_TEXT_NOT_FOUND",
      name === "PasswordException"
        ? "This PDF is password-protected. Remove the password, or paste the text."
        : "We could not read this PDF. Try saving it again, or paste the text.",
    );
  }

  try {
    const pages: string[] = [];
    let total = 0;
    const pageCount = Math.min(doc.numPages, PDF_MAX_PAGES);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        pageText += item.str;
        if (item.hasEOL) pageText += "\n";
      }
      pages.push(pageText);
      total += pageText.length;
      if (total > CAREER_MAP_INPUT_MAX_CHARS * 1.5) break;
    }
    return pages.join("\n\n");
  } catch {
    throw new ResumeExtractError("RESUME_TEXT_NOT_FOUND", "We could not read the text in this PDF. Paste the text instead.");
  } finally {
    await doc.loadingTask.destroy().catch(() => undefined);
  }
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as unknown as { default?: typeof mammothModule }).default ?? mammothModule;
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  } catch {
    throw new ResumeExtractError(
      "RESUME_TEXT_NOT_FOUND",
      "We could not read this Word file. Try saving it again as .docx or PDF, or paste the text.",
    );
  }
}

export async function extractResumeText(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ResumeExtractResult> {
  if (input.bytes.byteLength > RESUME_MAX_BYTES) {
    throw new ResumeExtractError("RESUME_FILE_TOO_LARGE", "That file is over 4 MB. Upload a smaller file, or paste the text.");
  }
  if (input.bytes.byteLength === 0) {
    throw new ResumeExtractError("RESUME_TEXT_NOT_FOUND", "That file is empty. Upload another file, or paste the text.");
  }

  const kind = detectResumeFileKind(input);
  const raw =
    kind === "pdf" ? await extractPdfText(input.bytes) : kind === "docx" ? await extractDocxText(input.bytes) : decodeText(input.bytes);

  const normalized = normalizeExtractedText(raw);
  const letters = normalized.match(/\p{L}/gu)?.length ?? 0;
  if (letters < MIN_LETTERS) {
    throw new ResumeExtractError(
      "RESUME_TEXT_NOT_FOUND",
      kind === "pdf"
        ? "We could not find any text in this PDF. It may be a scan or an image. Paste the text instead."
        : "We could not find any text in this file. Paste the text instead.",
    );
  }

  const truncated = normalized.length > CAREER_MAP_INPUT_MAX_CHARS;
  const text = truncated ? normalized.slice(0, CAREER_MAP_INPUT_MAX_CHARS).trimEnd() : normalized;
  return { text, chars: text.length, truncated, kind };
}
