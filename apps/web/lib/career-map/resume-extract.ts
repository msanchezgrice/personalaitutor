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

/**
 * A PDF stores where each visual line ends, not where a sentence does, so a
 * long bullet arrives split in two. Join a line to the one before it when it
 * plainly continues the sentence: the earlier line is long, does not end a
 * sentence, and the next starts with a lowercase letter. Short lines (titles,
 * one-word skills) and bullets are left alone.
 */
export function unwrapSoftLineBreaks(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const previous = out.length ? out[out.length - 1] : "";
    const continues =
      previous.length >= 40 &&
      line.length > 0 &&
      !/[.!?:;]$/.test(previous) &&
      /^\p{Ll}/u.test(line);
    if (continues) {
      out[out.length - 1] = previous.endsWith("-") && !previous.endsWith(" -") ? `${previous}${line}` : `${previous} ${line}`;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
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
    return pages.map(unwrapSoftLineBreaks).join("\n\n");
  } catch {
    throw new ResumeExtractError("RESUME_TEXT_NOT_FOUND", "We could not read the text in this PDF. Paste the text instead.");
  } finally {
    await doc.loadingTask.destroy().catch(() => undefined);
  }
}

// --- zip bomb guard -----------------------------------------------------------
// A .docx is a zip. mammoth (JSZip) inflates every part it reads in memory and
// only checks the declared size after inflating, so a 4 MB upload could
// unpack to gigabytes. Before mammoth sees the file we read the zip's own
// directory and refuse anything that declares too much, and we inflate each
// deflated entry with a hard output cap so a directory that lies about sizes
// is caught too.

/** Total declared uncompressed size we accept for a .docx. Real résumés are well under 1 MB. */
export const DOCX_MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
/** Entries we accept in a .docx. A résumé has a few dozen at most. */
export const DOCX_MAX_ENTRIES = 300;

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_EOCD_SIZE = 22;
const ZIP_CENTRAL_FILE_SIZE = 46;
const ZIP_LOCAL_FILE_SIZE = 30;
const ZIP_MAX_COMMENT = 0xffff;

export type ZipEntryRecord = {
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export type ZipInspection = {
  entries: number;
  uncompressedBytes: number;
  records: ZipEntryRecord[];
};

/**
 * Reads the End Of Central Directory record and every central directory file
 * header. Returns null when the directory cannot be read: no EOCD, offsets
 * outside the file, a header count that does not match the directory, a
 * multi-disk archive, or zip64 (0xFFFF / 0xFFFFFFFF sentinels or a zip64
 * locator), which no résumé needs. Pure: no inflating, no allocation beyond
 * the record list.
 */
export function inspectZip(bytes: Uint8Array): ZipInspection | null {
  if (bytes.byteLength < ZIP_EOCD_SIZE) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The EOCD sits at the end, followed only by an optional comment of up to 64 KB.
  let eocd = -1;
  const searchFloor = Math.max(0, bytes.byteLength - ZIP_EOCD_SIZE - ZIP_MAX_COMMENT);
  for (let index = bytes.byteLength - ZIP_EOCD_SIZE; index >= searchFloor; index -= 1) {
    if (view.getUint32(index, true) !== ZIP_EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(index + 20, true);
    if (index + ZIP_EOCD_SIZE + commentLength <= bytes.byteLength) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) return null;
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === ZIP64_EOCD_LOCATOR_SIGNATURE) return null;

  const diskNumber = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (
    diskNumber === 0xffff ||
    directoryDisk === 0xffff ||
    entriesOnDisk === 0xffff ||
    totalEntries === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    return null;
  }
  if (diskNumber !== 0 || directoryDisk !== 0 || entriesOnDisk !== totalEntries) return null;
  const directoryEnd = directoryOffset + directorySize;
  if (directoryEnd > eocd) return null;

  const records: ZipEntryRecord[] = [];
  let uncompressedBytes = 0;
  let position = directoryOffset;
  for (let entry = 0; entry < totalEntries; entry += 1) {
    if (position + ZIP_CENTRAL_FILE_SIZE > directoryEnd) return null;
    if (view.getUint32(position, true) !== ZIP_CENTRAL_FILE_SIGNATURE) return null;
    const method = view.getUint16(position + 10, true);
    const compressedSize = view.getUint32(position + 20, true);
    const uncompressedSize = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localHeaderOffset = view.getUint32(position + 42, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) return null;
    records.push({ method, compressedSize, uncompressedSize, localHeaderOffset });
    uncompressedBytes += uncompressedSize;
    position += ZIP_CENTRAL_FILE_SIZE + nameLength + extraLength + commentLength;
  }
  // The headers must fill the directory exactly: a reader that walks
  // signatures (JSZip does) must not find entries we did not count.
  if (position !== directoryEnd) return null;

  return { entries: totalEntries, uncompressedBytes, records };
}

async function assertDocxWithinLimits(bytes: Uint8Array): Promise<void> {
  const tooBig = () =>
    new ResumeExtractError(
      "RESUME_FILE_UNSUPPORTED",
      "This Word file unpacks to far more than a résumé needs, so we did not open it. Save it as PDF, or paste the text.",
    );
  const unreadable = () =>
    new ResumeExtractError(
      "RESUME_FILE_UNSUPPORTED",
      "We could not read the structure of this Word file. Save it again as .docx or PDF, or paste the text.",
    );

  const inspection = inspectZip(bytes);
  if (!inspection) throw unreadable();
  if (inspection.entries > DOCX_MAX_ENTRIES || inspection.uncompressedBytes > DOCX_MAX_UNCOMPRESSED_BYTES) throw tooBig();

  // The directory could under-declare sizes. Inflate each deflated entry with
  // its declared size as a hard cap; going past it throws before any large
  // buffer exists. Stored entries cannot grow, and JSZip rejects other methods.
  const { inflateRawSync } = await import("node:zlib");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const record of inspection.records) {
    if (record.method !== 8) continue;
    const local = record.localHeaderOffset;
    if (local + ZIP_LOCAL_FILE_SIZE > bytes.byteLength || view.getUint32(local, true) !== ZIP_LOCAL_FILE_SIGNATURE) throw unreadable();
    const dataStart = local + ZIP_LOCAL_FILE_SIZE + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const dataEnd = dataStart + record.compressedSize;
    if (dataEnd > bytes.byteLength) throw unreadable();
    try {
      inflateRawSync(bytes.subarray(dataStart, dataEnd), { maxOutputLength: Math.max(1, record.uncompressedSize) });
    } catch (error) {
      if (error instanceof RangeError || (error as { code?: string } | null)?.code === "ERR_BUFFER_TOO_LARGE") throw tooBig();
      // Corrupt deflate data: the same answer mammoth would give.
      throw new ResumeExtractError(
        "RESUME_TEXT_NOT_FOUND",
        "We could not read this Word file. Try saving it again as .docx or PDF, or paste the text.",
      );
    }
  }
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  await assertDocxWithinLimits(bytes);
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
