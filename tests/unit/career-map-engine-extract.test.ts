import { crc32 } from "node:zlib";
import { describe, expect, test, vi } from "vitest";
import { CAREER_MAP_INPUT_MAX_CHARS } from "@aitutor/shared";

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), { virtual: true });

import {
  RESUME_MAX_BYTES,
  ResumeExtractError,
  detectResumeFileKind,
  extractResumeText,
  normalizeExtractedText,
} from "../../apps/web/lib/career-map/resume-extract";
import { POST as extractPost } from "../../apps/web/app/api/career-map/extract/route";

const encoder = new TextEncoder();

/** A one-page PDF (Helvetica, one text line per entry) with a correct xref table. */
function buildPdf(lines: string[]): Uint8Array {
  const escape = (value: string) => value.replace(/[\\()]/g, (char) => `\\${char}`);
  const content = `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((line) => `(${escape(line)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(out);
}

/** A stored (uncompressed) zip archive. */
function buildZip(files: Array<{ name: string; data: string }>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.data, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(0, 12);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, ...central, end]));
}

function buildDocx(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join("");
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    },
  ]);
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function expectExtractError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ResumeExtractError);
  expect((error as ResumeExtractError).code).toBe(code);
  return error as ResumeExtractError;
}

describe("resume text extraction", () => {
  test("plain text, with BOM, CRLF and blank-line runs cleaned up", async () => {
    const bytes = encoder.encode("﻿Senior QA Tester\r\n\r\n\r\n\r\nWrote test plans   \r\nFiled bugs\u0007");
    const result = await extractResumeText({ fileName: "resume.txt", mimeType: "text/plain", bytes });
    const text = "Senior QA Tester\n\nWrote test plans\nFiled bugs";
    expect(result).toEqual({ text, chars: text.length, truncated: false, kind: "txt" });
  });

  test("PDF text via unpdf", async () => {
    const bytes = buildPdf(["Senior QA Tester", "Wrote 400 test cases (manual and automated)", "Filed bugs in Jira"]);
    const result = await extractResumeText({ fileName: "resume.pdf", mimeType: "application/pdf", bytes });
    expect(result.kind).toBe("pdf");
    expect(result.text).toContain("Senior QA Tester");
    expect(result.text).toContain("Wrote 400 test cases (manual and automated)");
    expect(result.text).toContain("Filed bugs in Jira");
  });

  test("PDF is detected by its bytes even with a wrong name", async () => {
    const bytes = buildPdf(["Producer at a small studio, shipped two games"]);
    const result = await extractResumeText({ fileName: "upload", mimeType: "application/octet-stream", bytes });
    expect(result.kind).toBe("pdf");
  });

  test("a PDF with no text (a scan) is RESUME_TEXT_NOT_FOUND", async () => {
    const error = await expectExtractError(
      extractResumeText({ fileName: "scan.pdf", mimeType: "application/pdf", bytes: buildPdf([]) }),
      "RESUME_TEXT_NOT_FOUND",
    );
    expect(error.message).toMatch(/scan/);
  });

  test("a damaged PDF is RESUME_TEXT_NOT_FOUND", async () => {
    await expectExtractError(
      extractResumeText({ fileName: "broken.pdf", mimeType: "application/pdf", bytes: encoder.encode("%PDF-1.4\ngarbage") }),
      "RESUME_TEXT_NOT_FOUND",
    );
    await expectExtractError(
      extractResumeText({ fileName: "renamed.pdf", mimeType: "application/pdf", bytes: encoder.encode("just some text, not a pdf") }),
      "RESUME_TEXT_NOT_FOUND",
    );
  });

  test("DOCX text via mammoth", async () => {
    const bytes = buildDocx(["Community Manager", "Grew a 90k-member Discord community", "Wrote weekly patch notes"]);
    const result = await extractResumeText({ fileName: "resume.docx", mimeType: DOCX_MIME, bytes });
    expect(result.kind).toBe("docx");
    expect(result.text).toBe("Community Manager\n\nGrew a 90k-member Discord community\n\nWrote weekly patch notes");
  });

  test("a damaged DOCX is RESUME_TEXT_NOT_FOUND", async () => {
    const bytes = buildZip([{ name: "hello.txt", data: "not a word document" }]);
    await expectExtractError(extractResumeText({ fileName: "resume.docx", mimeType: DOCX_MIME, bytes }), "RESUME_TEXT_NOT_FOUND");
  });

  test("legacy .doc is rejected with a clear message", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const error = await expectExtractError(
      extractResumeText({ fileName: "resume.doc", mimeType: "application/msword", bytes: ole }),
      "RESUME_FILE_UNSUPPORTED",
    );
    expect(error.message).toContain(".docx");
  });

  test("other types are RESUME_FILE_UNSUPPORTED", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    await expectExtractError(extractResumeText({ fileName: "photo.png", mimeType: "image/png", bytes: png }), "RESUME_FILE_UNSUPPORTED");
    const zip = buildZip([{ name: "a.txt", data: "hello" }]);
    await expectExtractError(extractResumeText({ fileName: "stuff.zip", mimeType: "application/zip", bytes: zip }), "RESUME_FILE_UNSUPPORTED");
    const binary = new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x43]);
    expect(() => detectResumeFileKind({ fileName: "a.txt", mimeType: "text/plain", bytes: binary })).toThrow(ResumeExtractError);
  });

  test("files over 5 MB are RESUME_FILE_TOO_LARGE; empty files have no text", async () => {
    const big = new Uint8Array(RESUME_MAX_BYTES + 1).fill(0x61);
    await expectExtractError(extractResumeText({ fileName: "big.txt", mimeType: "text/plain", bytes: big }), "RESUME_FILE_TOO_LARGE");
    await expectExtractError(
      extractResumeText({ fileName: "empty.txt", mimeType: "text/plain", bytes: new Uint8Array() }),
      "RESUME_TEXT_NOT_FOUND",
    );
  });

  test("long text is truncated to the input limit", async () => {
    const bytes = encoder.encode("Wrote launch emails. ".repeat(2000));
    const result = await extractResumeText({ fileName: "long.txt", mimeType: "text/plain", bytes });
    expect(result.truncated).toBe(true);
    expect(result.chars).toBeLessThanOrEqual(CAREER_MAP_INPUT_MAX_CHARS);
    expect(result.chars).toBe(result.text.length);
  });

  test("normalisation keeps paragraphs", () => {
    expect(normalizeExtractedText("a b\t\tc  \n\n\n\nd")).toBe("a b c\n\nd");
  });
});

function uploadRequest(file: File | null, extraHeaders: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new MockNextRequest("http://localhost/api/career-map/extract", { method: "POST", body: form, headers: extraHeaders });
}

describe("POST /api/career-map/extract", () => {
  test("returns text, chars and truncated for a .txt upload", async () => {
    const file = new File(["Senior Marketing Manager\nPlanned 4 global game launches"], "resume.txt", { type: "text/plain" });
    const res = await extractPost(uploadRequest(file) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      text: "Senior Marketing Manager\nPlanned 4 global game launches",
      chars: 55,
      truncated: false,
    });
  });

  test("PDF and DOCX uploads", async () => {
    const pdf = new File([buildPdf(["Wrote player emails to 12M players"])], "cv.pdf", { type: "application/pdf" });
    const pdfJson = (await (await extractPost(uploadRequest(pdf) as never)).json()) as Record<string, any>;
    expect(pdfJson.text).toContain("Wrote player emails to 12M players");

    const docx = new File([buildDocx(["Ran paid campaigns on 6 ad networks"])], "cv.docx", { type: DOCX_MIME });
    const docxJson = (await (await extractPost(uploadRequest(docx) as never)).json()) as Record<string, any>;
    expect(docxJson.text).toBe("Ran paid campaigns on 6 ad networks");
  });

  test("413 RESUME_FILE_TOO_LARGE", async () => {
    const file = new File([new Uint8Array(RESUME_MAX_BYTES + 10).fill(0x61)], "big.txt", { type: "text/plain" });
    const res = await extractPost(uploadRequest(file) as never);
    expect(res.status).toBe(413);
    const json = (await res.json()) as Record<string, any>;
    expect(json.error.code).toBe("RESUME_FILE_TOO_LARGE");
    expect(json.error.maxBytes).toBe(RESUME_MAX_BYTES);

    const declared = await extractPost(
      uploadRequest(new File(["x"], "a.txt", { type: "text/plain" }), { "content-length": String(RESUME_MAX_BYTES * 3) }) as never,
    );
    expect(declared.status).toBe(413);
  });

  test("415 RESUME_FILE_UNSUPPORTED for .doc and images", async () => {
    const doc = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3])], "old.doc", { type: "application/msword" });
    const docRes = await extractPost(uploadRequest(doc) as never);
    expect(docRes.status).toBe(415);
    const docJson = (await docRes.json()) as Record<string, any>;
    expect(docJson.error.code).toBe("RESUME_FILE_UNSUPPORTED");
    expect(docJson.error.message).toContain(".docx");

    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "me.png", { type: "image/png" });
    expect((await extractPost(uploadRequest(png) as never)).status).toBe(415);
  });

  test("422 RESUME_TEXT_NOT_FOUND for a scanned PDF", async () => {
    const pdf = new File([buildPdf([])], "scan.pdf", { type: "application/pdf" });
    const res = await extractPost(uploadRequest(pdf) as never);
    expect(res.status).toBe(422);
    expect(((await res.json()) as Record<string, any>).error.code).toBe("RESUME_TEXT_NOT_FOUND");
  });

  test("400 INVALID_BODY without a file", async () => {
    const res = await extractPost(uploadRequest(null) as never);
    expect(res.status).toBe(400);
    expect(((await res.json()) as Record<string, any>).error.code).toBe("INVALID_BODY");
  });
});
