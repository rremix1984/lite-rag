import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadSimple, Trash, FilePdf, FileDoc, FileXls,
  FileText, X, CircleNotch, CheckCircle, WarningCircle,
} from "@phosphor-icons/react";
import { getDocuments, uploadDocument, deleteDocument } from "@/api/documents";
import { toast } from "react-toastify";

const ACCEPTED = ".pdf,.docx,.doc,.xlsx,.xls,.txt,.md,.csv";

function FileIcon({ filename }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const cls = "flex-shrink-0 text-lg";
  if (ext === "pdf")                     return <FilePdf  className={cls} />;
  if (["doc","docx"].includes(ext))      return <FileDoc  className={cls} />;
  if (["xls","xlsx"].includes(ext))      return <FileXls  className={cls} />;
  return <FileText className={cls} />;
}

export default function DocumentManager({ slug, onClose }) {
  const [docs, setDocs]           = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    getDocuments(slug)
      .then(({ documents }) => setDocs(documents))
      .catch(() => {});
  }, [slug]);

  async function handleFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const res = await uploadDocument(slug, file);
        if (res.skipped) {
          toast.info(`「${file.name}」已存在，跳过`);
        } else {
          toast.success(`「${res.filename}」上传成功，共 ${res.chunk_count} 个分块`);
          // 刷新文档列表
          const { documents } = await getDocuments(slug);
          setDocs(documents);
        }
      } catch (err) {
        toast.error(`「${file.name}」上传失败：${err.message}`);
      }
    }
    setUploading(false);
  }

  async function handleDelete(doc) {
    if (deleteTarget === doc.filename) {
      try {
        await deleteDocument(slug, doc.filename);
        setDocs((prev) => prev.filter((d) => d.filename !== doc.filename));
        toast.success(`已删除「${doc.filename}」`);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setDeleteTarget(null);
      }
    } else {
      setDeleteTarget(doc.filename);
      setTimeout(() => setDeleteTarget((t) => t === doc.filename ? null : t), 3000);
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full w-80 bg-theme-bg-secondary border-l border-white/10 flex-shrink-0">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <h3 className="text-white font-medium text-sm">知识库文档</h3>
        <button
          onClick={onClose}
          className="text-theme-text-secondary hover:text-white transition-colors p-1 rounded hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      {/* 拖拽上传区域 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`mx-3 mt-3 mb-2 border-2 border-dashed rounded-xl p-4 text-center
                    cursor-pointer transition-all select-none flex-shrink-0
                    ${isDragging
                      ? "border-theme-button-primary/60 bg-theme-button-primary/10"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                    }
                    ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <CircleNotch size={24} className="text-theme-button-primary animate-spin" />
            <p className="text-theme-text-secondary text-xs">处理中，请稍候...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <UploadSimple size={22} className="text-white/40" />
            <p className="text-theme-text-secondary text-xs">
              {isDragging ? "松开鼠标上传" : "点击或拖拽文件上传"}
            </p>
            <p className="text-white/20 text-[11px]">PDF · Word · Excel · TXT · Markdown</p>
          </div>
        )}
      </div>

      {/* 文档列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 show-scrollbar">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <p className="text-theme-text-secondary text-xs text-center">
              还没有上传文档
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map((doc) => {
              const isDeleting = deleteTarget === doc.filename;
              return (
                <div
                  key={doc.filename}
                  className="group flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
                >
                  <FileIcon filename={doc.filename} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <p className="text-white/30 text-[11px] mt-0.5">
                      {doc.chunk_count} 个分块
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    className={`flex-shrink-0 p-1 rounded transition-all mt-0.5
                                ${isDeleting
                                  ? "text-red-400 bg-red-500/20"
                                  : "opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400"
                                }`}
                    title={isDeleting ? "再次点击确认删除" : "删除文档"}
                  >
                    {isDeleting ? <WarningCircle size={14} /> : <Trash size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
