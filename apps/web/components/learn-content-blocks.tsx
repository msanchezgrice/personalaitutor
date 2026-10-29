import React from "react";
import type { LearnContentBlock } from "@/lib/learn-content";

export function LearnInline({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
    const [, label, href] = match;
    if (!/^(https?:\/\/|\/(?!\/)|#)/i.test(href)) return <React.Fragment key={index}>{label}</React.Fragment>;
    const external = /^https?:\/\//i.test(href);
    return <a key={index} href={href} className="text-emerald-600 underline decoration-emerald-500/40 underline-offset-4 transition hover:text-emerald-700" target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{label}</a>;
  });
}

export function LearnContentBlocks({ blocks, label }: { blocks: LearnContentBlock[]; label: string }) {
  return <div className="space-y-5 break-words text-base leading-8 text-gray-300">
    {blocks.map((block, index) => {
      if (block.type === "paragraph") return <p key={index}><LearnInline text={block.text} /></p>;
      if (block.type === "quote") return <blockquote key={index} className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-500/5 px-5 py-4"><LearnInline text={block.text} /></blockquote>;
      if (block.type === "list") {
        const Tag = block.ordered ? "ol" : "ul";
        return <Tag key={index} className={`space-y-2 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}><LearnInline text={item} /></li>)}</Tag>;
      }
      if (block.type === "table") return <div key={index} role="region" aria-label={`${label} table`} tabIndex={0} className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500">
        <table className="w-full min-w-[600px] border-collapse text-left text-sm leading-6 text-slate-700">
          <caption className="sr-only">{label}</caption>
          <thead className="bg-emerald-50 text-slate-900"><tr>{block.columns.map((column, columnIndex) => <th scope="col" key={columnIndex} className="border-b border-slate-200 px-4 py-3 font-semibold">{column}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100 last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top"><LearnInline text={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>;
      return null;
    })}
  </div>;
}
