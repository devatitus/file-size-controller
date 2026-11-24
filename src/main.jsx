import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  Archive, ArrowDownToLine, ArrowLeftRight, CheckCircle2, File,
  FilePlus2, FileUp, Gauge, HardDrive, Image as ImageIcon,
  Info, LoaderCircle, LockKeyhole, RefreshCw, Settings2, ShieldCheck,
  UploadCloud, X
} from "lucide-react";
import "./style.css";

const MAX_PAD_BYTES = 100 * 1024 * 1024;
const units = [
  { label: "Bytes", value: 1 },
  { label: "KB", value: 1024 },
  { label: "MB", value: 1024 ** 2 },
  { label: "GB", value: 1024 ** 3 }
];
const formatBytes = (n) => {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4);
  return `${(n / 1024 ** i).toFixed(2)} ${["B","KB","MB","GB","TB"][i]}`;
};
const safeName = (name) => name.replace(/[^\w.-]+/g, "_");

async function imageCompress(file, quality, outputType) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: outputType !== "image/jpeg" });
    if (!ctx) throw new Error("Could not create image processing context.");
    if (outputType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Image conversion failed.")), outputType, quality)
    );
    const ext = outputType === "image/webp" ? "webp" : outputType === "image/jpeg" ? "jpg" : "png";
    const base = file.name.replace(/\.[^.]+$/, "");
    return { blob, name: `${safeName(base)}-compressed.${ext}`, note: `${bitmap.width} × ${bitmap.height} pixels` };
  } finally {
    bitmap.close?.();
  }
}

async function gzipCompress(file) {
  if (!("CompressionStream" in window)) {
    throw new Error("GZIP compression is not supported by this browser. Try an up-to-date Chrome or Edge browser.");
  }
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
  const blob = await new Response(stream).blob();
  return { blob, name: `${safeName(file.name)}.gz`, note: "GZIP archive; decompress it to recover the original file." };
}

async function makePaddedCopy(file, targetBytes) {
  if (targetBytes <= file.size) throw new Error("The target size must be larger than the original file.");
  const extra = targetBytes - file.size;
  if (extra > MAX_PAD_BYTES) throw new Error("This demo limits added padding to 100 MB to protect device memory.");
  const padding = new Uint8Array(extra);
  const blob = new Blob([file, padding], { type: "application/octet-stream" });
  const base = file.name.replace(/\.[^.]+$/, "");
  return {
    blob,
    name: `${safeName(base)}-${formatBytes(targetBytes).replace(/\s/g, "")}.padded.bin`,
    note: `${formatBytes(extra)} of zero-byte padding appended. This is a binary padded copy, not a format-aware edit.`
  };
}

async function saveOutput(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    // Native Android: save in the app cache and open the system share sheet.
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not prepare the file for saving."));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const base64 = String(dataUrl).split(",")[1];
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true
    });
    await Share.share({
      title: "Your processed file",
      text: "Save or share your processed file.",
      url: saved.uri,
      dialogTitle: "Save processed file"
    });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

function App() {
  const [mode, setMode] = useState("compress");
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(75);
  const [imageFormat, setImageFormat] = useState("image/webp");
  const [target, setTarget] = useState("2");
  const [unit, setUnit] = useState("MB");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const targetBytes = useMemo(() => {
    const u = units.find(x => x.label === unit);
    return Math.floor(Number(target) * (u?.value || 1));
  }, [target, unit]);

  const chooseFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
  };

  const process = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      let output;
      if (mode === "increase") {
        output = await makePaddedCopy(file, targetBytes);
      } else if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
        output = await imageCompress(file, quality / 100, imageFormat);
      } else {
        output = await gzipCompress(file);
      }
      setResult({ ...output, originalSize: file.size, outputSize: output.blob.size });
    } catch (e) {
      setError(e?.message || "Processing failed. Please try another file.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!result) return;
    try {
      await saveOutput(result.blob, result.name);
    } catch (e) {
      setError(e?.message || "Could not save the processed file.");
    }
  };

  const reset = () => {
    setFile(null); setResult(null); setError(""); setTarget("2"); setQuality(75);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-icon"><ArrowLeftRight size={21}/></div><div><strong>File Size Controller</strong><span>Local file tools</span></div></div>
        <div className="privacy"><LockKeyhole size={14}/> On-device</div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="live-dot"/> PRIVATE FILE PROCESSING</div>
        <h1>Control your<br/><em>file size.</em></h1>
        <p>Compress files or create larger padded copies. Your files are processed locally on this device.</p>
      </section>

      <section className="workspace">
        <div className="mode-switch" role="tablist" aria-label="Processing mode">
          <button className={mode === "compress" ? "mode active green" : "mode"} onClick={() => {setMode("compress");setResult(null);setError("");}}>
            <Archive size={18}/><span><b>Compress</b><small>Reduce file size</small></span>
          </button>
          <button className={mode === "increase" ? "mode active blue" : "mode"} onClick={() => {setMode("increase");setResult(null);setError("");}}>
            <FilePlus2 size={18}/><span><b>Increase</b><small>Add padding bytes</small></span>
          </button>
        </div>

        <div className="panel">
          <div className="section-heading"><div><span className="step">01</span><h2>Select a file</h2></div><span className="muted">Any file type</span></div>
          <label className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={e => {e.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault();setDragging(false);chooseFile(e.dataTransfer.files?.[0]);}}>
            <input type="file" onChange={e => chooseFile(e.target.files?.[0])}/>
            <div className="upload-icon"><UploadCloud size={26}/></div>
            <b>{file ? "Choose a different file" : "Choose a file or drag it here"}</b>
            <span>Files stay on your device · No account required</span>
            <span className="browse">Browse files</span>
          </label>

          {file && <div className="file-card">
            <div className="file-symbol"><File size={22}/></div>
            <div className="file-info"><b>{file.name}</b><span>{file.type || "Unknown type"} · {formatBytes(file.size)}</span></div>
            <button className="icon-button" aria-label="Remove file" onClick={reset}><X size={18}/></button>
          </div>}

          <div className="section-heading settings-title"><div><span className="step">02</span><h2>{mode === "compress" ? "Compression settings" : "Target file size"}</h2></div><Settings2 size={18} className="muted"/></div>

          {mode === "compress" ? (
            <>
              {file?.type.startsWith("image/") && file.type !== "image/svg+xml" ? <>
                <div className="setting-row"><label htmlFor="quality">Image quality</label><strong>{quality}%</strong></div>
                <input id="quality" className="range" type="range" min="10" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))}/>
                <div className="range-labels"><span>Smaller file</span><span>Higher quality</span></div>
                <label className="field-label" htmlFor="format">Output image format</label>
                <select id="format" value={imageFormat} onChange={e => setImageFormat(e.target.value)}>
                  <option value="image/webp">WebP (recommended)</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG (lossless; quality slider not used)</option>
                </select>
                <p className="hint"><Info size={15}/> Image compression re-encodes the image. PNG may not become smaller; check the result before using it.</p>
              </> : <>
                <div className="info-card"><Archive size={20}/><div><b>GZIP compression</b><span>Works with any file as a compressed .gz archive. It does not rewrite the original file format.</span></div></div>
                <p className="hint"><Info size={15}/> Some files (such as JPEG, MP4 and ZIP) are already compressed and may get little or no smaller.</p>
              </>}
            </>
          ) : (
            <>
              <label className="field-label" htmlFor="target">Desired output size</label>
              <div className="target-input"><input id="target" type="number" min="0" step="any" value={target} onChange={e => setTarget(e.target.value)}/><select value={unit} onChange={e => setUnit(e.target.value)}>{units.map(u => <option key={u.label}>{u.label}</option>)}</select></div>
              <div className="quick-sizes">{["100","500","1","5"].map((v,i) => <button key={v+i} onClick={() => {setTarget(v);setUnit(i < 2 ? "KB" : "MB");}}>{v} {i < 2 ? "KB" : "MB"}</button>)}</div>
              <p className="hint warning"><Info size={15}/> This app appends zero bytes and exports a .padded.bin file. It is not guaranteed to remain a valid image, PDF, video or other original-format file. Maximum added padding: 100 MB.</p>
            </>
          )}

          <button className="primary" disabled={!file || busy || (mode === "increase" && (!Number.isFinite(targetBytes) || targetBytes <= file.size || targetBytes - file.size > MAX_PAD_BYTES))} onClick={process}>
            {busy ? <><LoaderCircle className="spin" size={19}/> Processing locally…</> : <>{mode === "compress" ? <Archive size={18}/> : <FilePlus2 size={18}/>} {mode === "compress" ? "Compress file" : "Create larger copy"}</>}
          </button>
          {mode === "increase" && file && targetBytes <= file.size && <p className="validation">Choose a target larger than {formatBytes(file.size)}.</p>}
          {mode === "increase" && file && targetBytes - file.size > MAX_PAD_BYTES && <p className="validation">The selected increase exceeds this app's 100 MB safety limit.</p>}
          {error && <div className="error"><Info size={17}/>{error}</div>}
        </div>

        {result && <div className="result-panel">
          <div className="success-title"><CheckCircle2 size={21}/><div><b>Processing complete</b><span>Your original file has not been changed.</span></div></div>
          <div className="comparison">
            <div><span>Original</span><b>{formatBytes(result.originalSize)}</b></div>
            <div className="compare-arrow"><ArrowLeftRight size={18}/></div>
            <div><span>Output</span><b>{formatBytes(result.outputSize)}</b></div>
          </div>
          <div className="output-name"><File size={17}/><span>{result.name}</span></div>
          <p className="hint">{result.note}</p>
          {mode === "compress" && result.outputSize >= result.originalSize && <p className="hint warning">The output is not smaller than the original. Try a different image format or quality setting.</p>}
          <button className="primary download" onClick={download}><ArrowDownToLine size={19}/> Save processed file</button>
          <button className="secondary" onClick={reset}><RefreshCw size={16}/> Process another file</button>
        </div>}

        <div className="trust-row"><div><ShieldCheck size={17}/><span>Local processing</span></div><div><HardDrive size={17}/><span>Original preserved</span></div><div><Gauge size={17}/><span>Size comparison</span></div></div>
      </section>
      <footer>FILE SIZE CONTROLLER <span>·</span> Version 1.0</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
