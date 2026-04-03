import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadSimple, Trash, FilePdf, FileDoc, FileXls,
  FileText, X, CircleNotch, CheckCircle, WarningCircle,
} from "@phosphor-icons/react";
import { getDocuments, uploadDocument, deleteDocument, getDocumentPreview } from "@/api/documents";
import { toast } from "react-toastify";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

const ACCEPTED = ".pdf,.docx,.doc,.xlsx,.xls,.txt,.md,.csv";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
const LEFT_PANEL_WIDTH_KEY = "lite-rag-doc-left-panel-width";

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
  const [selectedFilename, setSelectedFilename] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const n = Number(localStorage.getItem(LEFT_PANEL_WIDTH_KEY));
    return Number.isFinite(n) && n >= 280 && n <= 520 ? n : 320;
  });
  const [resizing, setResizing] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfError, setPdfError] = useState("");
  const md = useMemo(() => new MarkdownIt({ html: false, linkify: true, breaks: true }), []);
  const previewPaneWidth = 620;
  const minLeftWidth = 280;
  const maxLeftWidth = 520;
  const [pdfScale, setPdfScale] = useState(1.2);
  const minScale = 0.6;
  const maxScale = 2.0;

  useEffect(() => {
    if (!slug) return;
    getDocuments(slug)
      .then(({ documents }) => {
        setDocs(documents);
        if (!documents.length) {
          setSelectedFilename("");
          setPreviewVisible(false);
          setPreview(null);
          return;
        }
        if (!selectedFilename) {
          setSelectedFilename(documents[0].filename);
        }
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!slug || !selectedFilename) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    getDocumentPreview(slug, selectedFilename)
      .then((data) => {
        setPreview(data);
        setPreviewPage(1);
      })
      .catch((err) => {
        setPreview(null);
        toast.error(`文档预览失败：${err.message}`);
      })
      .finally(() => setPreviewLoading(false));
  }, [slug, selectedFilename]);

  useEffect(() => {
    if ((preview?.ext || "").toLowerCase() !== "pdf" || !preview?.raw_url) {
      setPdfPages(0);
      setPdfError("");
      return;
    }
    let canceled = false;
    (async () => {
      try {
        const token = localStorage.getItem("lite-rag-token");
        const task = pdfjsLib.getDocument({
          url: preview.raw_url,
          withCredentials: false,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const pdf = await task.promise;
        if (canceled) return;
        setPdfPages(pdf.numPages);
        const pageNo = Math.min(Math.max(previewPage, 1), pdf.numPages);
        if (pageNo !== previewPage) setPreviewPage(pageNo);
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: pdfScale });
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        setPdfError("");
      } catch (err) {
        setPdfError(err?.message || "PDF 渲染失败");
      }
    })();
    return () => {
      canceled = true;
    };
  }, [preview?.ext, preview?.raw_url, previewPage, pdfScale]);

  useEffect(() => {
    if (!resizing) return undefined;
    function onMouseMove(e) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = Math.min(Math.max(e.clientX - rect.left, minLeftWidth), maxLeftWidth);
      setLeftPanelWidth(next);
    }
    function onMouseUp() {
      setResizing(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing]);

  const isMarkdown = ["md", "markdown"].includes((preview?.ext || "").toLowerCase());
  const isPdf = (preview?.ext || "").toLowerCase() === "pdf";
  const isPagePreview = ["doc", "docx"].includes((preview?.ext || "").toLowerCase());
  const previewChunks = Array.isArray(preview?.chunks) ? preview.chunks : [];
  const totalPages = isPdf ? Math.max(pdfPages, 1) : Math.max(previewChunks.length, 1);
  const currentPage = Math.min(Math.max(previewPage, 1), totalPages);
  const currentChunkText = previewChunks[currentPage - 1]?.content || preview?.preview || "";
  const markdownHtml = useMemo(() => {
    if (!isMarkdown || !preview?.preview) return "";
    return DOMPurify.sanitize(md.render(preview.preview));
  }, [isMarkdown, preview?.preview, md]);

  useEffect(() => {
    if (!previewVisible) return;
    function onKey(e) {
      const k = e.key;
      if (k === "Escape") {
        setPreviewVisible(false);
        return;
      }
      const paged = (isPdf && pdfPages > 0) || (isPagePreview && previewChunks.length > 0);
      if (paged && (k === "ArrowLeft" || k === "ArrowRight")) {
        e.preventDefault();
        setPreviewPage((p) => {
          if (k === "ArrowLeft") return Math.max(1, p - 1);
          return Math.min(totalPages, p + 1);
        });
      }
      if (isPdf) {
        if (k === "+" || k === "=") {
          e.preventDefault();
          setPdfScale((s) => Math.min(maxScale, +(s + 0.1).toFixed(2)));
        } else if (k === "-") {
          e.preventDefault();
          setPdfScale((s) => Math.max(minScale, +(s - 0.1).toFixed(2)));
        } else if (k === "0") {
          e.preventDefault();
          setPdfScale(1.2);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewVisible, isPdf, isPagePreview, pdfPages, previewChunks.length, totalPages]);

  useEffect(() => {
    localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(leftPanelWidth));
  }, [leftPanelWidth]);

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
          setSelectedFilename(res.filename);
          setPreviewVisible(true);
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
        setDocs((prev) => {
          const next = prev.filter((d) => d.filename !== doc.filename);
          if (selectedFilename === doc.filename) {
            setSelectedFilename(next[0]?.filename || "");
            setPreviewVisible(false);
          }
          return next;
        });
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

  function handleSelectDoc(filename) {
    if (selectedFilename === filename && previewVisible) {
      setPreviewVisible(false);
      return;
    }
    setSelectedFilename(filename);
    setPreviewVisible(true);
  }

  return (
    <div
      ref={containerRef}
      className="h-full bg-theme-bg-secondary border-l border-white/10 flex-shrink-0 transition-all duration-300 ease-out"
      style={{ width: previewVisible ? leftPanelWidth + previewPaneWidth : leftPanelWidth }}
    >
      <div className="h-full flex">
        <div className="flex flex-col border-r border-white/10" style={{ width: leftPanelWidth }}>
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
            ) : null}
            <div className="space-y-1.5">
              {docs.map((doc) => {
                const isDeleting = deleteTarget === doc.filename;
                return (
                  <div
                    key={doc.filename}
                    onClick={() => handleSelectDoc(doc.filename)}
                    className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer
                              ${selectedFilename === doc.filename && previewVisible ? "bg-theme-button-primary/15 ring-1 ring-theme-button-primary/40" : "bg-white/5 hover:bg-white/8"}`}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc);
                      }}
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
          </div>
        </div>

        {previewVisible && (
          <button
            onMouseDown={() => setResizing(true)}
            onDoubleClick={() => setLeftPanelWidth(320)}
            className={`w-1.5 hover:bg-theme-button-primary/30 transition-colors ${resizing ? "bg-theme-button-primary/40" : "bg-transparent"}`}
            aria-label="调整文档列表宽度"
          />
        )}

        {previewVisible && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
              <p className="text-white/90 text-sm font-medium truncate max-w-[360px]">
                {selectedFilename || "文档预览"}
              </p>
              <div className="flex items-center gap-2">
                {(isPdf ? pdfPages > 1 : (isPagePreview && previewChunks.length > 1)) ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-2 py-1 text-[11px] rounded border border-white/15 text-white/60 disabled:opacity-30"
                    >
                      上一页
                    </button>
                    <span className="text-[11px] text-white/40">{currentPage}/{totalPages}</span>
                    <button
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-2 py-1 text-[11px] rounded border border-white/15 text-white/60 disabled:opacity-30"
                    >
                      下一页
                    </button>
                  </div>
                ) : null}
                {isPdf ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPdfScale((s) => Math.max(minScale, +(s - 0.1).toFixed(2)))}
                      className="px-2 py-1 text-[11px] rounded border border-white/15 text-white/60"
                    >
                      -
                    </button>
                    <span className="text-[11px] text-white/40 w-10 text-center">
                      {Math.round(pdfScale * 100)}%
                    </span>
                    <button
                      onClick={() => setPdfScale((s) => Math.min(maxScale, +(s + 0.1).toFixed(2)))}
                      className="px-2 py-1 text-[11px] rounded border border-white/15 text-white/60"
                    >
                      +
                    </button>
                  </div>
                ) : null}
                {preview?.ext ? (
                  <span className="text-[10px] text-white/40 uppercase">{preview.ext}</span>
                ) : null}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto show-scrollbar p-4">
              {previewLoading ? (
                <div className="h-full flex items-center justify-center">
                  <CircleNotch size={24} className="text-theme-button-primary animate-spin" />
                </div>
              ) : isPdf && preview?.raw_url ? (
                pdfError ? (
                  <p className="text-sm text-red-300 leading-6">{pdfError}</p>
                ) : (
                  <div className="w-full overflow-auto rounded-lg border border-white/10 bg-black/20 p-2">
                    <canvas ref={pdfCanvasRef} className="mx-auto max-w-full h-auto rounded bg-white" />
                  </div>
                )
              ) : isMarkdown && preview?.preview ? (
                <div
                  className="text-sm leading-6 text-white/85 prose prose-invert prose-p:my-2 prose-pre:my-2 max-w-none"
                  dangerouslySetInnerHTML={{ __html: markdownHtml }}
                />
              ) : preview?.preview ? (
                <pre className="text-sm leading-6 text-white/75 whitespace-pre-wrap break-words">
                  {isPagePreview ? currentChunkText : preview.preview}
                  {preview.truncated ? "\n\n……(预览已截断)" : ""}
                </pre>
              ) : (
                <p className="text-sm text-white/40 leading-6">
                  选中文档后将在此处显示预览。再次点击同一文档可折叠隐藏预览窗口。
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
