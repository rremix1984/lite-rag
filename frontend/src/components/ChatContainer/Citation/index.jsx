import { useState } from "react";
import { FileText, CaretDown, CaretUp } from "@phosphor-icons/react";

/**
 * 将多个相同文件名的 source 合并
 */
function combineSources(sources) {
  const map = {};
  (sources || []).forEach((s) => {
    if (!map[s.filename]) {
      map[s.filename] = { filename: s.filename, chunks: [], score: s.score };
    }
    map[s.filename].chunks.push(s.content || "");
    map[s.filename].score = Math.max(map[s.filename].score, s.score || 0);
  });
  return Object.values(map);
}

function SourceItem({ source }) {
  const [open, setOpen] = useState(false);
  const preview = source.chunks[0]?.slice(0, 200) || "";
  return (
    <div className="text-xs border border-white/10 rounded-lg overflow-hidden bg-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <FileText size={13} className="text-theme-button-primary flex-shrink-0" />
        <span className="flex-1 text-left text-white/80 truncate">{source.filename}</span>
        {source.score > 0 && (
          <span className="text-white/30 flex-shrink-0">
            {(source.score * 100).toFixed(0)}%
          </span>
        )}
        {open ? <CaretUp size={12} className="text-white/30 flex-shrink-0" />
               : <CaretDown size={12} className="text-white/30 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-2 text-white/50 border-t border-white/10 pt-2 leading-relaxed max-h-40 overflow-y-auto show-scrollbar">
          {preview}{preview.length >= 200 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

export default function Citations({ sources = [] }) {
  if (!sources.length) return null;
  const combined = combineSources(sources);
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] text-white/30 uppercase tracking-wide">引用来源</p>
      {combined.map((s) => <SourceItem key={s.filename} source={s} />)}
    </div>
  );
}
