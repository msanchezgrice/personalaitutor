import { crc32, deflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, test, vi } from "vitest";

class MockNextRequest extends Request {
  nextUrl: URL;
  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), { virtual: true });

import {
  DOCX_MAX_ENTRIES,
  DOCX_MAX_UNCOMPRESSED_BYTES,
  ResumeExtractError,
  extractResumeText,
  inspectZip,
} from "../../apps/web/lib/career-map/resume-extract";
import {
  RESUME_EXTRACT_LIMIT,
  RESUME_EXTRACT_MAX_KEYS,
  RESUME_EXTRACT_WINDOW_MS,
  checkResumeExtractRateLimit,
  resetResumeExtractRateLimitForTests,
  resumeExtractRateLimitKeyCount,
} from "../../apps/web/lib/career-map/extract-rate-limit";
import { POST as extractPost } from "../../apps/web/app/api/career-map/extract/route";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ZipFile = {
  name: string;
  data: Buffer | string;
  deflate?: boolean;
  /** Lie about the uncompressed size in the central directory and local header. */
  declaredSize?: number;
};

/** Hand-assembled zip (stored or deflated entries), with optional forged sizes. */
function buildZip(files: ZipFile[], options: { totalEntries?: number } = {}): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const raw = typeof file.data === "string" ? Buffer.from(file.data, "utf8") : file.data;
    const body = file.deflate ? deflateRawSync(raw) : raw;
    const method = file.deflate ? 8 : 0;
    const size = file.declaredSize ?? raw.length;
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(size, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(size, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + body.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const count = options.totalEntries ?? files.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, ...central, end]));
}

function docxFiles(text: string, deflate = false): ZipFile[] {
  return [
    {
      name: "[Content_Types].xml",
      deflate,
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      deflate,
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: "word/document.xml",
      deflate,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
    },
  ];
}

async function extractCode(bytes: Uint8Array): Promise<string> {
  const error = await extractResumeText({ fileName: "resume.docx", mimeType: DOCX_MIME, bytes }).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ResumeExtractError);
  return (error as ResumeExtractError).code;
}

describe("inspectZip", () => {
  test("reads entries and declared sizes of a real zip (stored and deflated)", () => {
    const zip = buildZip([
      { name: "a.txt", data: "hello" },
      { name: "b.txt", data: "x".repeat(5000), deflate: true },
    ]);
    const inspection = inspectZip(zip);
    expect(inspection).not.toBeNull();
    expect(inspection!.entries).toBe(2);
    expect(inspection!.uncompressedBytes).toBe(5005);
    expect(inspection!.records.map((record) => record.method)).toEqual([0, 8]);
  });

  test("a forged central directory that declares a huge size is reported as such", () => {
    const zip = buildZip([{ name: "word/document.xml", data: "<w:document/>", declaredSize: 3_000_000_000 }]);
    expect(inspectZip(zip)?.uncompressedBytes).toBe(3_000_000_000);
  });

  test("null for zip64 sentinels, a missing or inconsistent directory, and non-zips", () => {
    expect(inspectZip(buildZip([{ name: "a.txt", data: "hi", declaredSize: 0xffffffff }]))).toBeNull();
    expect(inspectZip(buildZip([{ name: "a.txt", data: "hi" }], { totalEntries: 0xffff }))).toBeNull();
    // EOCD says 1 entry but the directory holds 2: a reader walking signatures would see more.
    expect(inspectZip(buildZip([{ name: "a.txt", data: "hi" }, { name: "b.txt", data: "yo" }], { totalEntries: 1 }))).toBeNull();
    const zip = buildZip([{ name: "a.txt", data: "hi" }]);
    expect(inspectZip(zip.subarray(0, zip.length - 22))).toBeNull();
    const corrupt = new Uint8Array(zip);
    corrupt[zip.length - 22 + 16] = 0xee; // directory offset now points past the file
    expect(inspectZip(corrupt)).toBeNull();
    expect(inspectZip(new TextEncoder().encode("plain text, not a zip at all"))).toBeNull();
    expect(inspectZip(new Uint8Array())).toBeNull();
  });
});

describe("docx zip bomb guard", () => {
  test("a normal deflated .docx still extracts", async () => {
    const result = await extractResumeText({ fileName: "cv.docx", mimeType: DOCX_MIME, bytes: buildZip(docxFiles("Shipped 3 live games", true)) });
    expect(result.text).toBe("Shipped 3 live games");
  });

  test(`over ${DOCX_MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB declared is RESUME_FILE_UNSUPPORTED, before mammoth runs`, async () => {
    const files = docxFiles("Shipped 3 live games");
    files.push({ name: "word/media/huge.bin", data: "tiny", declaredSize: DOCX_MAX_UNCOMPRESSED_BYTES + 1 });
    expect(await extractCode(buildZip(files))).toBe("RESUME_FILE_UNSUPPORTED");
  });

  test(`more than ${DOCX_MAX_ENTRIES} entries is RESUME_FILE_UNSUPPORTED`, async () => {
    const files = docxFiles("Shipped 3 live games");
    for (let index = 0; files.length <= DOCX_MAX_ENTRIES; index += 1) files.push({ name: `customXml/item${index}.xml`, data: "<a/>" });
    expect(files.length).toBe(DOCX_MAX_ENTRIES + 1);
    expect(await extractCode(buildZip(files))).toBe("RESUME_FILE_UNSUPPORTED");
  });

  test("zip64 sentinels and an unreadable directory are RESUME_FILE_UNSUPPORTED", async () => {
    const zip64 = docxFiles("Shipped 3 live games");
    zip64[2]!.declaredSize = 0xffffffff;
    expect(await extractCode(buildZip(zip64))).toBe("RESUME_FILE_UNSUPPORTED");
    const truncated = buildZip(docxFiles("Shipped 3 live games"));
    expect(await extractCode(truncated.subarray(0, truncated.length - 10))).toBe("RESUME_FILE_UNSUPPORTED");
  });

  test("a directory that under-declares a deflated entry is caught by the capped inflate", async () => {
    const files = docxFiles("Shipped 3 live games", true);
    // ~30 KB compressed, 30 MB inflated, declared as 1 KB.
    files.push({ name: "word/media/bomb.bin", data: Buffer.alloc(30 * 1024 * 1024), deflate: true, declaredSize: 1024 });
    const bytes = buildZip(files);
    expect(bytes.length).toBeLessThan(200 * 1024);
    expect(inspectZip(bytes)!.uncompressedBytes).toBeLessThan(DOCX_MAX_UNCOMPRESSED_BYTES);
    const error = await extractResumeText({ fileName: "cv.docx", mimeType: DOCX_MIME, bytes }).catch((caught: unknown) => caught);
    expect((error as ResumeExtractError).code).toBe("RESUME_FILE_UNSUPPORTED");
    expect((error as ResumeExtractError).message).toMatch(/unpacks to far more/);
  });

  test("the route answers 415 with a human message", async () => {
    const files = docxFiles("Shipped 3 live games");
    files.push({ name: "word/media/huge.bin", data: "tiny", declaredSize: 50 * 1024 * 1024 });
    const form = new FormData();
    form.append("file", new File([buildZip(files)], "cv.docx", { type: DOCX_MIME }));
    const res = await extractPost(
      new MockNextRequest("http://localhost/api/career-map/extract", { method: "POST", body: form, headers: { "x-forwarded-for": "198.51.100.200" } }) as never,
    );
    expect(res.status).toBe(415);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("RESUME_FILE_UNSUPPORTED");
    expect(json.error.message).toContain("PDF");
  });
});

describe("résumé extract rate limit", () => {
  beforeEach(() => {
    resetResumeExtractRateLimitForTests();
  });

  test(`${RESUME_EXTRACT_LIMIT} extracts per 10 minutes per IP hash, sliding`, () => {
    const start = Date.parse("2026-11-25T12:00:00.000Z");
    for (let index = 0; index < RESUME_EXTRACT_LIMIT; index += 1) {
      expect(checkResumeExtractRateLimit("ip-a", start + index * 1000)).toEqual({ ok: true });
    }
    const limited = checkResumeExtractRateLimit("ip-a", start + 30_000);
    expect(limited).toEqual({ ok: false, limit: RESUME_EXTRACT_LIMIT, retryAfterSeconds: 570 });
    expect(checkResumeExtractRateLimit("ip-b", start + 30_000)).toEqual({ ok: true });
    // The first attempt leaves the window; one slot frees up.
    expect(checkResumeExtractRateLimit("ip-a", start + RESUME_EXTRACT_WINDOW_MS + 1).ok).toBe(true);
    expect(checkResumeExtractRateLimit("ip-a", start + RESUME_EXTRACT_WINDOW_MS + 2).ok).toBe(false);
  });

  test("the key map is bounded and expired keys are pruned", () => {
    const start = Date.parse("2026-11-25T12:00:00.000Z");
    for (let index = 0; index < RESUME_EXTRACT_MAX_KEYS + 50; index += 1) checkResumeExtractRateLimit(`ip-${index}`, start);
    expect(resumeExtractRateLimitKeyCount()).toBeLessThanOrEqual(RESUME_EXTRACT_MAX_KEYS);

    checkResumeExtractRateLimit("late-visitor", start + RESUME_EXTRACT_WINDOW_MS + 1);
    expect(resumeExtractRateLimitKeyCount()).toBe(1);
  });

  test("the route answers 429 RESUME_EXTRACT_RATE_LIMITED with retry-after and a human message", async () => {
    const upload = (ip: string) => {
      const form = new FormData();
      form.append("file", new File(["Senior Marketing Manager\nPlanned 4 global game launches"], "resume.txt", { type: "text/plain" }));
      return extractPost(new MockNextRequest("http://localhost/api/career-map/extract", { method: "POST", body: form, headers: { "x-forwarded-for": ip } }) as never);
    };
    for (let index = 0; index < RESUME_EXTRACT_LIMIT; index += 1) expect((await upload("203.0.113.9")).status).toBe(200);
    const limited = await upload("203.0.113.9");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    const json = (await limited.json()) as { error: { code: string; message: string; retryAfterSeconds: number } };
    expect(json.error.code).toBe("RESUME_EXTRACT_RATE_LIMITED");
    expect(json.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(json.error.message).toMatch(/Wait about \d+ minutes? and try again, or paste the text instead\./);
    expect((await upload("203.0.113.10")).status).toBe(200);
  });
});
