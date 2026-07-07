import { runtimeFindProjectBySlug } from "@/lib/runtime";
import { getArtifactContentByUrl } from "@/lib/artifact-content-store";
import type {
  ArtifactContentRecord,
  BriefContent,
  DeckContent,
  ResumeContent,
  WebsiteContent,
} from "@aitutor/shared";

type ArtifactDescriptor = {
  projectSlug: string;
  title: string;
  description: string;
  kindLabel: string;
  generatedAtIso: string;
};

type PptxSlide = {
  title: string;
  bullets: string[];
  notes?: string | null;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(input: Date) {
  const year = Math.max(1980, input.getUTCFullYear());
  const month = input.getUTCMonth() + 1;
  const day = input.getUTCDate();
  const hour = input.getUTCHours();
  const minute = input.getUTCMinutes();
  const second = Math.floor(input.getUTCSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hour << 11) | (minute << 5) | second;

  return {
    dosDate: dosDate & 0xffff,
    dosTime: dosTime & 0xffff,
  };
}

function buildZip(entries: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let cursor = 0;
  const now = dosDateTime(new Date());

  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, "/");
    const nameBuffer = Buffer.from(name, "utf8");
    const data = entry.data;
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(cursor, 42);

    centralParts.push(centralHeader, nameBuffer);
    cursor += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectorySize = centralParts.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(cursor, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function sanitizePart(part: string) {
  const trimmed = part.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return null;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

function extFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase()?.trim();
  return ext || null;
}

function kindLabelFromName(fileName: string) {
  const raw = fileName.split(".")[0]?.split("-")[0]?.toLowerCase().trim();
  switch (raw) {
    case "website":
      return "Website";
    case "pptx":
      return "Presentation Outline";
    case "pdf":
      return "Project Brief";
    case "resume_docx":
      return "Resume (DOCX)";
    case "resume_pdf":
      return "Resume (PDF)";
    default:
      return "Artifact";
  }
}

async function resolveDescriptor(parts: string[], fileName: string): Promise<ArtifactDescriptor | null> {
  const projectSlug = parts[0];
  const generatedAtIso = new Date().toISOString();

  if (projectSlug === "demo") {
    return {
      projectSlug,
      title: "Demo Artifact",
      description: "Demo artifact rendered by the generated artifact route.",
      kindLabel: kindLabelFromName(fileName),
      generatedAtIso,
    };
  }

  const project = await runtimeFindProjectBySlug(projectSlug).catch(() => null);
  if (!project) return null;

  return {
    projectSlug: project.slug,
    title: project.title,
    description: project.description || "Generated project artifact.",
    kindLabel: kindLabelFromName(fileName),
    generatedAtIso,
  };
}

function descriptorLines(descriptor: ArtifactDescriptor) {
  return [
    descriptor.title,
    `Project: ${descriptor.projectSlug}`,
    `Artifact Type: ${descriptor.kindLabel}`,
    `Generated: ${descriptor.generatedAtIso}`,
    "",
    descriptor.description,
  ];
}

function buildPdfBuffer(lines: string[]) {
  const safeLines = lines.slice(0, 36).map((line) => escapePdf(line.slice(0, 110)));
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    "14 TL",
    ...safeLines.map((line) => `(${line}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "utf8");
}

function buildDocxBuffer(lines: string[]) {
  const paragraphs = lines
    .slice(0, 80)
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join("");

  const contentTypes = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    "</Types>",
  ].join("");

  const rootRels = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    "</Relationships>",
  ].join("");

  const documentXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    "<w:body>",
    paragraphs,
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
    "</w:body>",
    "</w:document>",
  ].join("");

  return buildZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
  ]);
}

function buildSlideXml(slide: PptxSlide) {
  const titleParagraph = [
    "<a:p>",
    '<a:r><a:rPr lang="en-US" sz="3600" b="1"/><a:t>',
    escapeXml(slide.title || "Generated Artifact"),
    "</a:t></a:r>",
    '<a:endParaRPr lang="en-US" sz="3600"/>',
    "</a:p>",
  ].join("");

  const bulletLines = slide.bullets.map((line) => line.trim()).filter(Boolean);
  const bulletParagraphs = bulletLines.length
    ? bulletLines
      .map((line) => [
        '<a:p><a:pPr marL="342900" indent="-171450"><a:buChar char="-"/></a:pPr>',
        '<a:r><a:rPr lang="en-US" sz="2000"/><a:t>',
        escapeXml(line),
        "</a:t></a:r>",
        '<a:endParaRPr lang="en-US" sz="2000"/></a:p>',
      ].join(""))
      .join("")
    : '<a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>Generated presentation content.</a:t></a:r><a:endParaRPr lang="en-US" sz="2000"/></a:p>';

  const notesParagraph = slide.notes?.trim()
    ? [
        '<a:p><a:r><a:rPr lang="en-US" sz="1400" i="1"/><a:t>',
        escapeXml(`Speaker notes: ${slide.notes.trim()}`),
        "</a:t></a:r>",
        '<a:endParaRPr lang="en-US" sz="1400"/></a:p>',
      ].join("")
    : "";

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    "<p:cSld><p:spTree>",
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>',
    '<a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>',
    "</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>",
    titleParagraph,
    "</p:txBody></p:sp>",
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>',
    '<a:xfrm><a:off x="457200" y="1714500"/><a:ext cx="8229600" cy="4381500"/></a:xfrm>',
    "</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>",
    bulletParagraphs,
    notesParagraph,
    "</p:txBody></p:sp>",
    "</p:spTree></p:cSld>",
    "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>",
    "</p:sld>",
  ].join("");
}

function buildPptxBuffer(slides: PptxSlide[]) {
  const slideList = slides.length ? slides.slice(0, 12) : [{ title: "Generated Artifact", bullets: [] }];

  const contentTypes = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    ...slideList.map(
      (_slide, index) =>
        `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    ),
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    "</Types>",
  ].join("");

  const rootRels = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    "</Relationships>",
  ].join("");

  const presentationRels = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ...slideList.map(
      (_slide, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
    ),
    "</Relationships>",
  ].join("");

  const presentationXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    "<p:sldIdLst>",
    ...slideList.map((_slide, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`),
    "</p:sldIdLst>",
    '<p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>',
    '<p:notesSz cx="6858000" cy="9144000"/>',
    "</p:presentation>",
  ].join("");

  const now = new Date().toISOString();
  const coreXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    "<dc:title>Generated Artifact</dc:title>",
    "<dc:creator>My AI Skill Tutor</dc:creator>",
    `<dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(now)}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(now)}</dcterms:modified>`,
    "</cp:coreProperties>",
  ].join("");

  const appXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    "<Application>My AI Skill Tutor</Application>",
    `<Slides>${slideList.length}</Slides>`,
    "<Notes>0</Notes>",
    "<HiddenSlides>0</HiddenSlides>",
    "<MMClips>0</MMClips>",
    "<ScaleCrop>false</ScaleCrop>",
    "</Properties>",
  ].join("");

  return buildZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { name: "ppt/presentation.xml", data: Buffer.from(presentationXml, "utf8") },
    { name: "ppt/_rels/presentation.xml.rels", data: Buffer.from(presentationRels, "utf8") },
    ...slideList.map((slide, index) => ({
      name: `ppt/slides/slide${index + 1}.xml`,
      data: Buffer.from(buildSlideXml(slide), "utf8"),
    })),
    { name: "docProps/core.xml", data: Buffer.from(coreXml, "utf8") },
    { name: "docProps/app.xml", data: Buffer.from(appXml, "utf8") },
  ]);
}

function buildHtmlArtifact(descriptor: ArtifactDescriptor) {
  const title = escapeHtml(descriptor.title);
  const description = escapeHtml(descriptor.description);
  const kind = escapeHtml(descriptor.kindLabel);
  const projectSlug = escapeHtml(descriptor.projectSlug);
  const generatedAt = escapeHtml(descriptor.generatedAtIso);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title} | Artifact</title>`,
    "<style>body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px}main{max-width:820px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px}h1{margin:0 0 8px;font-size:28px}p{line-height:1.6}dt{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.08em}dd{margin:4px 0 14px}</style>",
    "</head>",
    "<body>",
    "<main>",
    `<h1>${title}</h1>`,
    `<p>${description}</p>`,
    "<dl>",
    "<dt>Project</dt>",
    `<dd>${projectSlug}</dd>`,
    "<dt>Artifact Type</dt>",
    `<dd>${kind}</dd>`,
    "<dt>Generated</dt>",
    `<dd>${generatedAt}</dd>`,
    "</dl>",
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

function mimeByExtension(ext: string) {
  switch (ext) {
    case "html":
      return "text/html; charset=utf-8";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function safeFilename(name: string, ext: string) {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artifact";
  return `${base}.${ext}`;
}

// --- real content renderers (Phase 2.1) --------------------------------------
// These feed the writers above with the persisted structured content instead
// of the legacy title+timestamp placeholder.

function websiteContentToHtml(content: WebsiteContent, descriptor: ArtifactDescriptor) {
  const sections = content.sections
    .map((section) => {
      const bullets = section.bullets?.length
        ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
        : "";
      return `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p>${bullets}</section>`;
    })
    .join("");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(content.title)}</title>`,
    "<style>body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px}main{max-width:860px;margin:0 auto}header{background:linear-gradient(135deg,#111827,#0b1220);border:1px solid #1f2937;border-radius:20px;padding:40px 32px;text-align:center}h1{margin:0 0 12px;font-size:34px;color:#f8fafc}.tagline{color:#94a3b8;font-size:18px;line-height:1.6;margin:0 auto;max-width:640px}.cta{display:inline-block;margin-top:24px;padding:12px 24px;border-radius:999px;background:#10b981;color:#052e22;font-weight:600;text-decoration:none}section{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;margin-top:20px}h2{margin:0 0 10px;font-size:20px;color:#a7f3d0}p{line-height:1.7;margin:0}ul{margin:12px 0 0;padding-left:20px;line-height:1.7}footer{margin-top:28px;text-align:center;color:#64748b;font-size:13px}</style>",
    "</head>",
    "<body>",
    "<main>",
    "<header>",
    `<h1>${escapeHtml(content.title)}</h1>`,
    `<p class="tagline">${escapeHtml(content.tagline)}</p>`,
    `<span class="cta">${escapeHtml(content.heroCta)}</span>`,
    "</header>",
    sections,
    `<footer>${escapeHtml(content.footerNote)} &middot; ${escapeHtml(descriptor.projectSlug)}</footer>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

function resumeContentToLines(content: ResumeContent) {
  return [
    content.fullName,
    content.headline,
    "",
    "SUMMARY",
    content.summary,
    "",
    "EXPERIENCE HIGHLIGHTS",
    ...content.experienceBullets.map((bullet) => `- ${bullet}`),
    "",
    "SKILLS",
    content.skills.join(", "),
    "",
    "AI PROOF-OF-WORK",
    ...content.aiProof.map((line) => `- ${line}`),
  ];
}

function briefContentToLines(content: BriefContent) {
  return [
    content.title,
    "",
    content.summary,
    "",
    ...content.sections.flatMap((section) => [
      section.heading.toUpperCase(),
      section.body,
      ...(section.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    "NEXT STEPS",
    ...content.nextSteps.map((step) => `- ${step}`),
  ];
}

function deckContentToSlides(content: DeckContent): PptxSlide[] {
  return [
    { title: content.title, bullets: [content.subtitle] },
    ...content.slides.map((slide) => ({
      title: slide.title,
      bullets: slide.bullets,
      notes: slide.speakerNotes,
    })),
  ];
}

function deckContentToLines(content: DeckContent) {
  return [
    content.title,
    content.subtitle,
    "",
    ...content.slides.flatMap((slide, index) => [
      `Slide ${index + 1}: ${slide.title}`,
      ...slide.bullets.map((bullet) => `- ${bullet}`),
      `Speaker notes: ${slide.speakerNotes}`,
      "",
    ]),
  ];
}

function renderStoredContent(record: ArtifactContentRecord, descriptor: ArtifactDescriptor, ext: string): Buffer | null {
  switch (record.contentKind) {
    case "website": {
      const content = record.content as WebsiteContent;
      if (ext === "html") return Buffer.from(websiteContentToHtml(content, descriptor), "utf8");
      return null;
    }
    case "resume": {
      const content = record.content as ResumeContent;
      const lines = resumeContentToLines(content);
      if (ext === "docx") return buildDocxBuffer(lines);
      if (ext === "pdf") return buildPdfBuffer(lines);
      if (ext === "txt") return Buffer.from(lines.join("\n"), "utf8");
      return null;
    }
    case "deck": {
      const content = record.content as DeckContent;
      if (ext === "pptx") return buildPptxBuffer(deckContentToSlides(content));
      if (ext === "pdf") return buildPdfBuffer(deckContentToLines(content));
      if (ext === "txt") return Buffer.from(deckContentToLines(content).join("\n"), "utf8");
      return null;
    }
    case "brief": {
      const content = record.content as BriefContent;
      const lines = briefContentToLines(content);
      if (ext === "pdf") return buildPdfBuffer(lines);
      if (ext === "docx") return buildDocxBuffer(lines);
      if (ext === "txt") return Buffer.from(lines.join("\n"), "utf8");
      return null;
    }
    default:
      return null;
  }
}

function artifactResponse(payload: Buffer, fileName: string, ext: string, renderer: string) {
  const filename = safeFilename(fileName, ext);
  const disposition = ext === "html" ? "inline" : "attachment";
  return new Response(new Uint8Array(payload), {
    status: 200,
    headers: {
      "content-type": mimeByExtension(ext),
      "content-length": String(payload.length),
      "content-disposition": `${disposition}; filename="${filename}"`,
      "cache-control": "public, max-age=60, s-maxage=60",
      "x-artifact-renderer": renderer,
    },
  });
}

export async function GET(_req: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  const parts = slug.map((part) => sanitizePart(part)).filter((part): part is string => Boolean(part));
  if (!parts.length) {
    return new Response("Artifact not found", { status: 404 });
  }

  const fileName = parts[parts.length - 1];
  const ext = extFromName(fileName);
  if (!ext || !["html", "pdf", "docx", "pptx", "txt"].includes(ext)) {
    return new Response("Unsupported artifact type", { status: 404 });
  }

  const descriptor = await resolveDescriptor(parts, fileName);
  if (!descriptor) {
    return new Response("Artifact not found", { status: 404 });
  }

  // Phase 2.1: artifacts render from persisted, LLM-generated content.
  const artifactUrl = `/generated/${parts.join("/")}`;
  const stored = await getArtifactContentByUrl(artifactUrl).catch(() => null);
  if (stored) {
    const payload = renderStoredContent(stored, descriptor, ext);
    if (payload) {
      return artifactResponse(payload, fileName, ext, "generated-route-v2");
    }
  }

  // No persisted content: only the demo slug may render the descriptor shell.
  // Real artifact URLs without content 404 — placeholders are never emitted.
  if (descriptor.projectSlug !== "demo") {
    return new Response("Artifact content not found", { status: 404 });
  }

  const lines = descriptorLines(descriptor);
  const payload = ext === "html"
    ? Buffer.from(buildHtmlArtifact(descriptor), "utf8")
    : ext === "pdf"
      ? buildPdfBuffer(lines)
      : ext === "pptx"
        ? buildPptxBuffer([{ title: lines[0] ?? "Demo Artifact", bullets: lines.slice(1, 8) }])
      : ext === "docx"
        ? buildDocxBuffer(lines)
        : Buffer.from(lines.join("\n"), "utf8");

  return artifactResponse(payload, fileName, ext, "generated-route-v1");
}
