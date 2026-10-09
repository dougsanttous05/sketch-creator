import React, { useCallback, useEffect, useMemo, useRef, useState, ChangeEvent, type JSX } from "react";

/***************************\
|*  HELPERS                *|
\***************************/
// Normaliza entradas tipo "203 x 203 x 46" ou com símbolo × e remove espaços
// Ex.: " 203×203 x46 " -> "203x203x46"
const normalizeBBKey = (s: string) => normalizeKey(s);

/***************************\
|*  QUICK PREVIEW MODAL    *|
\***************************/

type QuickPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode; // Passe aqui seu <TechnicalDrawing />
  title?: string;
  fileNameBase?: string; // para salvar com nome do cliente + data
};

function QuickPreviewModal({ isOpen, onClose, children, title = "Quick View", fileNameBase = "technical-drawing" }: QuickPreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  const toolbarH = 56;
  const padding = 24;

  const computeFitScale = useCallback(() => {
    if (!overlayRef.current || !stageRef.current) return 1;
    const vw = overlayRef.current.clientWidth;
    const vh = overlayRef.current.clientHeight - toolbarH;
    const targetW = vw - padding * 2;
    const targetH = vh - padding * 2;

    const svg = svgRef.current;
    const w = svg?.viewBox?.baseVal?.width || svg?.width?.baseVal?.value || naturalSize.w || 794;
    const h = svg?.viewBox?.baseVal?.height || svg?.height?.baseVal?.value || naturalSize.h || 1123;
    const s = Math.min(targetW / w, targetH / h);
    return s > 0 && isFinite(s) ? s : 1;
  }, [naturalSize.w, naturalSize.h]);

  const updateFit = useCallback(() => {
    const s = computeFitScale();
    setFitScale(s);
    setZoom(s);
    setPan({ x: 0, y: 0 });
  }, [computeFitScale]);

  // Detecta o <svg> renderizado dentro do modal
  useEffect(() => {
    if (!isOpen) return;
    const el = stageRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (el) {
      svgRef.current = el;
      const w = el.width?.baseVal?.value || el.viewBox?.baseVal?.width || 794;
      const h = el.height?.baseVal?.value || el.viewBox?.baseVal?.height || 1123;
      setNaturalSize(prev => prev.w === w && prev.h === h ? prev : { w, h });
      requestAnimationFrame(updateFit);
    }
  }, [isOpen, children, updateFit]);

  // Acessibilidade: foco inicial + bloquear scroll do body
  useEffect(() => {
    if (!isOpen) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Recalcular fit ao redimensionar
  useEffect(() => {
    if (!isOpen) return;
    const ro = new ResizeObserver(() => updateFit());
    if (overlayRef.current) ro.observe(overlayRef.current);
    const onWindowResize = () => updateFit();
    window.addEventListener("resize", onWindowResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [isOpen, updateFit]);

  // Atalhos de teclado
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || (e.key === "=" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setZoom((z) => Math.min(z * 1.1, 8));
      }
      if (e.key === "-" || (e.key === "_" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setZoom((z) => Math.max(z / 1.1, 0.05));
      }
      if (e.key === "0" || e.key.toLowerCase() === "f") {
        e.preventDefault();
        updateFit();
      }
      if (e.key === "1") {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      if (e.key === "ArrowLeft") setPan((p) => ({ ...p, x: p.x + 20 }));
      if (e.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - 20 }));
      if (e.key === "ArrowUp") setPan((p) => ({ ...p, y: p.y + 20 }));
      if (e.key === "ArrowDown") setPan((p) => ({ ...p, y: p.y - 20 }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, updateFit]);

  // Zoom pelo scroll do mouse (sem precisar Ctrl/Cmd)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    setZoom((z) => Math.max(0.05, Math.min(8, z * dir)));
  }, []);

  // Pan com mouse
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan.x, pan.y]
  );
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStart) return;
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    },
    [isPanning, panStart]
  );
  const onMouseUp = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  const zoomPercent = useMemo(() => `${Math.round((zoom / (fitScale || 1)) * 100)}%`, [zoom, fitScale]);

  const readSvgSize = () => {
    const svg = svgRef.current;
    if (!svg) return { w: 794, h: 1123 };
    const w = svg.width?.baseVal?.value || svg.viewBox?.baseVal?.width || 794;
    const h = svg.height?.baseVal?.value || svg.viewBox?.baseVal?.height || 1123;
    return { w, h };
  };

  const exportPng = async (scale = window.devicePixelRatio || 1) => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    const { w, h } = readSvgSize();
    await new Promise<void>((res, reject) => {
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not export SVG")); };
      img.onload = () => res();
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileNameBase}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileNameBase}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copySvg = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    await navigator.clipboard.writeText(source);
    alert("SVG copiado para a área de transferência.");
  };

  const printSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print SVG</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            html, body { margin: 0; padding: 0; height: 100%; }
            .page { width: 210mm; height: 297mm; display: flex; align-items: center; justify-content: center; }
            svg { width: 100%; height: auto; }
            @media print { .page { break-after: avoid; } }
          </style>
        </head>
        <body>
          <div class="page">${source}</div>
          <script>window.onload = () => setTimeout(() => window.print(), 100);<\/script>
        </body>
      </html>
    `);
    w.document.close();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", flexDirection: "column" }}
    >
      {/* Toolbar */}
      <div
        style={{ height: toolbarH, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(20,20,20,0.9)", color: "white", userSelect: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <strong style={{ marginRight: "auto" }}>{title}</strong>
        <span style={{ opacity: 0.8 }}>Zoom: {zoomPercent}</span>
        <button onClick={() => setZoom((z) => Math.max(z / 1.1, 0.05))}>-</button>
        <button onClick={() => setZoom((z) => Math.min(z * 1.1, 8))}>+</button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          100%
        </button>
        <button onClick={updateFit}>Fit</button>
        <span style={{ width: 16 }} />
        <button onClick={() => exportPng().catch(err => alert(String(err)))}>PNG</button>
        <button onClick={downloadSvg}>SVG</button>
        <button onClick={copySvg}>Copiar SVG</button>
        <button onClick={printSvg}>Imprimir</button>
        <span style={{ width: 16 }} />
        <button ref={closeBtnRef} onClick={onClose} style={{ fontWeight: 700 }}>
          Fechar ×
        </button>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ position: "relative", flex: 1, overflow: "hidden", cursor: isPanning ? "grabbing" : "grab", userSelect: "none" }}
      >
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", willChange: "transform" }}>
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, willChange: "transform" }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", background: "white", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", borderRadius: 4 }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**********************\
|*  APP + DRAWING     *|
\**********************/

import { catalogue as BLUE_BOOK_DB, normalizeKey, parseCSV, sectionRects, validGrid } from './profiles.mjs';

// Tipos
interface HoleCfg {
  rows: number;
  cols: number;
  spacingX: number; // mm entre furos na horizontal
  spacingY: number; // mm entre furos na vertical
  edgeDistXLeft: number; // mm da borda esquerda ao 1º furo
  edgeDistXRight: number; // mm da borda direita ao último furo
  edgeDistYTop: number; // mm da borda superior ao 1º furo
  edgeDistYBottom: number; // mm da borda inferior ao último furo
}

interface StructuralParams {
  beamProfile: string;
  beamHeight: number; // altura da coluna (comprimento)
  sectionDepth: number;
  beamWidth: number; // largura total do perfil (b)
  flangeThickness: number; // espessura da flange (tf)
  webThickness: number; // espessura da alma (tw)
  customer: string;

  basePlateWidth: number;
  basePlateLength: number;
  basePlateThickness: number;

  topPlateWidth: number;
  topPlateLength: number;
  topPlateThickness: number;

  topHolesDiameter: number; // separado
  baseHolesDiameter: number; // separado

  topPlateHoles: HoleCfg;
  basePlateHoles: HoleCfg;

  paintType: string;
  generalNotes: string;
  cutNote: string;
}

// Formulário
const InputForm: React.FC<{ params: StructuralParams; onChange: (p: StructuralParams) => void }> = ({ params, onChange }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const keys = name.split(".");
    const newParams = JSON.parse(JSON.stringify(params)) as StructuralParams;
    let current: any = newParams;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = type === "number" ? Number(value) : value;

    if (name === "beamProfile") {
      const key = normalizeBBKey(String(value));
      const bb = BLUE_BOOK_DB[key];
      if (bb) {
        newParams.sectionDepth = bb.h;
        newParams.beamWidth = bb.b;
        newParams.flangeThickness = bb.tf;
        newParams.webThickness = bb.tw;
        console.log("[BlueBook] hit", key, bb);
      } else {
        newParams.sectionDepth = 0;
        newParams.beamWidth = 0;
        newParams.flangeThickness = 0;
        newParams.webThickness = 0;
      }
    }

    onChange(newParams);
  };

  const textInput: React.CSSProperties = { padding: 8, border: "1px solid #ced4da", borderRadius: 4, fontSize: 13 };

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        maxWidth: 420,
        background: "#fff",
        padding: 20,
        borderRadius: 8,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <h2 style={{ margin: "0 0 10px" }}>Structural Parameters</h2>
      <datalist id="profiles">{Object.keys(BLUE_BOOK_DB).map(k => <option key={k} value={k} />)}</datalist>
      <label>Section depth h (mm)<input type="number" step="any" name="sectionDepth" value={params.sectionDepth} onChange={handleChange} /></label>

      {/* Beam */}
      <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 6, border: "1px solid #e9ecef" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>BEAM</h3>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Customer</span>
          <input name="customer" value={params.customer} onChange={handleChange} style={textInput} />
        </label>
        <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span>Beam Size (e.g., 203x203x46)</span>
          <input list="profiles" name="beamProfile" value={params.beamProfile} onChange={handleChange} style={textInput} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Member length (mm)</span>
            <input type="number" step="any" name="beamHeight" value={params.beamHeight} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Overall Width b (mm)</span>
            <input type="number" step="any" name="beamWidth" value={params.beamWidth} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Web Thickness tw (mm)</span>
            <input type="number" step="any" name="webThickness" value={params.webThickness} onChange={handleChange} style={textInput} />
          </label>
        </div>
        <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span>Flange Thickness tf (mm)</span>
          <input type="number" step="any" name="flangeThickness" value={params.flangeThickness} onChange={handleChange} style={textInput} />
        </label>
        {BLUE_BOOK_DB[normalizeBBKey(String(params.beamProfile))] ? (
          <small style={{ color: "#198754" }}>Auto-preenchido a partir do Blue Book (parcial).</small>
        ) : (
          <small style={{ color: "#6c757d" }}>Dica: digite "203x203x46" (aceita espaços/×) para autopreencher.</small>
        )}
      </div>

      {/* Top Plate */}
      <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 6, border: "1px solid #e9ecef" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>TOP PLATE</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Width (mm)</span>
            <input type="number" step="any" name="topPlateWidth" value={params.topPlateWidth} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Length (mm)</span>
            <input type="number" step="any" name="topPlateLength" value={params.topPlateLength} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Thickness (mm)</span>
            <input type="number" step="any" name="topPlateThickness" value={params.topPlateThickness} onChange={handleChange} style={textInput} />
          </label>
        </div>
        <h4 style={{ margin: "8px 0 6px", fontSize: 13 }}>HOLES</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Holes Ø (mm)</span>
            <input type="number" step="any" name="topHolesDiameter" value={params.topHolesDiameter} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Rows</span>
            <input type="number" step="any" name="topPlateHoles.rows" value={params.topPlateHoles.rows} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Cols</span>
            <input type="number" step="any" name="topPlateHoles.cols" value={params.topPlateHoles.cols} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Spacing X (mm)</span>
            <input type="number" step="any" name="topPlateHoles.spacingX" value={params.topPlateHoles.spacingX} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Spacing Y (mm)</span>
            <input type="number" step="any" name="topPlateHoles.spacingY" value={params.topPlateHoles.spacingY} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. X Left (mm)</span>
            <input type="number" step="any" name="topPlateHoles.edgeDistXLeft" value={params.topPlateHoles.edgeDistXLeft} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. X Right (mm)</span>
            <input type="number" step="any" name="topPlateHoles.edgeDistXRight" value={params.topPlateHoles.edgeDistXRight} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. Y Top (mm)</span>
            <input type="number" step="any" name="topPlateHoles.edgeDistYTop" value={params.topPlateHoles.edgeDistYTop} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. Y Bottom (mm)</span>
            <input type="number" step="any" name="topPlateHoles.edgeDistYBottom" value={params.topPlateHoles.edgeDistYBottom} onChange={handleChange} style={textInput} />
          </label>
        </div>
      </div>

      {/* Base Plate */}
      <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 6, border: "1px solid #e9ecef" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>BASE PLATE</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Width (mm)</span>
            <input type="number" step="any" name="basePlateWidth" value={params.basePlateWidth} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Length (mm)</span>
            <input type="number" step="any" name="basePlateLength" value={params.basePlateLength} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Thickness (mm)</span>
            <input type="number" step="any" name="basePlateThickness" value={params.basePlateThickness} onChange={handleChange} style={textInput} />
          </label>
        </div>
        <h4 style={{ margin: "8px 0 6px", fontSize: 13 }}>HOLES</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Holes Ø (mm)</span>
            <input type="number" step="any" name="baseHolesDiameter" value={params.baseHolesDiameter} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Rows</span>
            <input type="number" step="any" name="basePlateHoles.rows" value={params.basePlateHoles.rows} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Cols</span>
            <input type="number" step="any" name="basePlateHoles.cols" value={params.basePlateHoles.cols} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Spacing X (mm)</span>
            <input type="number" step="any" name="basePlateHoles.spacingX" value={params.basePlateHoles.spacingX} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Spacing Y (mm)</span>
            <input type="number" step="any" name="basePlateHoles.spacingY" value={params.basePlateHoles.spacingY} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. X Left (mm)</span>
            <input type="number" step="any" name="basePlateHoles.edgeDistXLeft" value={params.basePlateHoles.edgeDistXLeft} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. X Right (mm)</span>
            <input type="number" step="any" name="basePlateHoles.edgeDistXRight" value={params.basePlateHoles.edgeDistXRight} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. Y Top (mm)</span>
            <input type="number" step="any" name="basePlateHoles.edgeDistYTop" value={params.basePlateHoles.edgeDistYTop} onChange={handleChange} style={textInput} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Edge Dist. Y Bottom (mm)</span>
            <input type="number" step="any" name="basePlateHoles.edgeDistYBottom" value={params.basePlateHoles.edgeDistYBottom} onChange={handleChange} style={textInput} />
          </label>
        </div>
      </div>

      {/* Specs */}
      <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 6, border: "1px solid #e9ecef" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>SPECIFICATIONS</h3>
        <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span>Paint Type</span>
          <input name="paintType" value={params.paintType} onChange={handleChange} style={textInput} />
        </label>
        <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span>General Notes</span>
          <textarea name="generalNotes" rows={3} value={params.generalNotes} onChange={handleChange} style={{ ...textInput, resize: "vertical" }} />
        </label>
        <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span>Cut Note</span>
          <input name="cutNote" value={params.cutNote} onChange={handleChange} style={textInput} />
        </label>
      </div>
    </div>
  );
};

// Desenho técnico (A4 retrato, side view, com flanges, furos e textos)
const TechnicalDrawing: React.FC<StructuralParams & { layoutOffsetX?: number }> = (p) => {
  const pageW = 794; // ~A4 @96dpi
  const pageH = 1123;
  const margin = 40;

  const scale = Math.min(0.55, 440 / Math.max(p.topPlateWidth, p.basePlateWidth, p.sectionDepth), 170 / Math.max(p.topPlateLength, p.basePlateLength)); // mm -> px
  const mm = (v: number) => v * scale;

  const layoutOffsetX = p.layoutOffsetX ?? 0; // deslocamento ajustável via UI
  const centerX = pageW / 2 - layoutOffsetX; // desloca levemente p/ esquerda

  const topPlateY = margin + 90;
  const elevationY = topPlateY + mm(p.topPlateLength) + 30;
  // Altura visual da coluna (limitada) para evitar sobreposição com CUT NOTE
  const beamHVis = Math.min(mm(p.beamHeight), 360);
  const basePlateY = elevationY + mm(p.topPlateThickness) + beamHVis + mm(p.basePlateThickness) + 30;

  const beamWpx = mm(p.sectionDepth);
  const flangeTpx = mm(p.flangeThickness);
  const webTpx = mm(p.webThickness);

  // Bloco vertical para CUT NOTE + PAINT no lado esquerdo
  const cutRectW = 360; // largura do cartucho
  const cutRectH = 84;  // altura do cartucho
  const cutX = 65; // posição horizontal do cartucho (à esquerda, centralizado verticalmente)

  // Flanges laterais na elevação
  const SideFlanges = ({ x, y, height }: { x: number; y: number; height: number }) => {
    const leftX = x - beamWpx / 2;
    const rightX = x + beamWpx / 2 - flangeTpx;
    return (
      <g>
        <rect x={leftX} y={y} width={flangeTpx} height={height} fill="none" stroke="#000" strokeWidth={1.5} />
        <rect x={rightX} y={y} width={flangeTpx} height={height} fill="none" stroke="#000" strokeWidth={1.5} />
      </g>
    );
  };

  // Traços do perfil na top view (duas flanges + alma) — linhas VERMELHAS contínuas
  const PlateBeamTopTrace = ({ plateW, plateL }: { plateW: number; plateL: number }) => {
    const rects = sectionRects({h:p.sectionDepth,b:p.beamWidth,tf:p.flangeThickness,tw:p.webThickness});
    return <g stroke="#b83232" strokeWidth={0.8} fill="#fceaea">{rects.map((r: any,i:number) => <rect key={i} x={(plateW-mm(p.sectionDepth))/2+mm(r.x)} y={(plateL-mm(p.beamWidth))/2+mm(r.y)} width={mm(r.width)} height={mm(r.height)} />)}</g>;
  };

  // Furos: gera malha
  const PlateHolesGrid = (
    plateWpx: number,
    plateLpx: number,
    cfg: HoleCfg,
    valid: boolean,
    holeRpx: number
  ) => {
    const { rows, cols, spacingX, spacingY, edgeDistXLeft, edgeDistYTop } = cfg;
    const ex = mm(edgeDistXLeft);
    const ey = mm(edgeDistYTop);
    const sx = mm(spacingX);
    const sy = mm(spacingY);
    const circles: JSX.Element[] = [];
    for (let r = 0; r < Math.min(50, Math.max(1, rows)); r++) {
      const y = ey + r * sy;
      for (let c = 0; c < Math.min(50, Math.max(1, cols)); c++) {
        const x = ex + c * sx;
        circles.push(
          <circle key={`h-${r}-${c}`} cx={x} cy={y} r={holeRpx} fill={valid ? "none" : "#ffd6d6"} stroke="#000" strokeWidth={1.2} />
        );
      }
    }
    return <>{circles}</>;
  };

  // Texto dimensões (em negrito) — sem letras auxiliares
  const DimTexts = ({ w, l }: { w: number; l: number }) => (
    <g fill="#0066cc" fontSize={10} fontWeight="bold">
      <text x={w / 2} y={-10} textAnchor="middle">
        {Math.round(w / scale)} mm
      </text>
      <text x={-16} y={l / 2} transform={`rotate(-90, -16, ${l / 2})`} textAnchor="middle">
        {Math.round(l / scale)} mm
      </text>
    </g>
  );

  const EdgeAndSpacingDims = ({
    plateW,
    plateL,
    edges,
    spacing,
    rows,
    cols,
  }: {
    plateW: number;
    plateL: number;
    edges: { left: number; right: number; top: number; bottom: number };
    spacing: { spacingX: number; spacingY: number };
    rows: number;
    cols: number;
  }) => {
    const countX = Math.max(0, cols - 1);
    const countY = Math.max(0, rows - 1);
    const bottomSpacingCenterX = mm(edges.left) + (mm(spacing.spacingX) * countX) / 2;
    const rightSpacingCenterY = mm(edges.top) + (mm(spacing.spacingY) * countY) / 2;
    return (
      <g fill="#0066cc" fontSize={10} fontWeight="bold">
        {/* Base inferior: esquerda, espaçamento, direita */}
        <text x={mm(edges.left) / 2} y={plateL + 16} textAnchor="middle">
          {edges.left}
        </text>
        <text x={bottomSpacingCenterX} y={plateL + 16} textAnchor="middle">
          {spacing.spacingX}
        </text>
        <text x={plateW - mm(edges.right) / 2} y={plateL + 16} textAnchor="middle">
          {edges.right}
        </text>
        {/* Lado direito: topo, espaçamento, base */}
        <text x={plateW + 14} y={mm(edges.top) / 2} transform={`rotate(-90, ${plateW + 14}, ${mm(edges.top) / 2})`} textAnchor="middle">
          {edges.top}
        </text>
        <text x={plateW + 14} y={rightSpacingCenterY} transform={`rotate(-90, ${plateW + 14}, ${rightSpacingCenterY})`} textAnchor="middle">
          {spacing.spacingY}
        </text>
        <text x={plateW + 14} y={plateL - mm(edges.bottom) / 2} transform={`rotate(-90, ${plateW + 14}, ${plateL - mm(edges.bottom) / 2})`} textAnchor="middle">
          {edges.bottom}
        </text>
      </g>
    );
  };

  const gridValid = (plateWmm: number, plateLmm: number, cfg: HoleCfg) => {
    return validGrid(plateWmm, plateLmm, cfg, 0);
  };

  const topGridOK = validGrid(p.topPlateWidth, p.topPlateLength, p.topPlateHoles, p.topHolesDiameter);
  const baseGridOK = validGrid(p.basePlateWidth, p.basePlateLength, p.basePlateHoles, p.baseHolesDiameter);

  const TopPlateView = () => {
    const w = mm(p.topPlateWidth);
    const l = mm(p.topPlateLength);
    const x = centerX - w / 2;
    const y = topPlateY;
    const edges = {
      left: p.topPlateHoles.edgeDistXLeft,
      right: p.topPlateHoles.edgeDistXRight,
      top: p.topPlateHoles.edgeDistYTop,
      bottom: p.topPlateHoles.edgeDistYBottom,
    };

    return (
      <g transform={`translate(${x}, ${y})`}>
        <rect x={0} y={0} width={w} height={l} fill="#f8f8f8" stroke="#000" strokeWidth={1.5} />
        <line x1={w / 2} y1={0} x2={w / 2} y2={l} stroke="#999" strokeDasharray="6 4" />
        <line x1={0} y1={l / 2} x2={w} y2={l / 2} stroke="#999" strokeDasharray="6 4" />

        <PlateBeamTopTrace plateW={w} plateL={l} />
        {PlateHolesGrid(w, l, p.topPlateHoles, topGridOK, mm(p.topHolesDiameter) / 2)}
        <DimTexts w={w} l={l} />
        <EdgeAndSpacingDims
          plateW={w}
          plateL={l}
          edges={edges}
          spacing={{ spacingX: p.topPlateHoles.spacingX, spacingY: p.topPlateHoles.spacingY }}
          rows={p.topPlateHoles.rows}
          cols={p.topPlateHoles.cols}
        />
        {!topGridOK && (
          <g>
            <rect x={w / 2 - 120} y={l + 20} width={240} height={24} fill="#fff5f5" stroke="#cc0000" />
            <text x={w / 2} y={l + 37} textAnchor="middle" fill="#cc0000" fontSize={12} fontWeight="bold">
              CHECK HOLE LAYOUT (TOP)
            </text>
          </g>
        )}
      </g>
    );
  };

  const ElevationView = () => {
    const topY = elevationY;
    const topPlateW = mm(p.topPlateWidth);
    const basePlateW = mm(p.basePlateWidth);
    const topPlateH = mm(p.topPlateThickness);
    const basePlateH = mm(p.basePlateThickness);
    const beamH = beamHVis;

    return (
      <g>
        <rect x={centerX - topPlateW / 2} y={topY} width={topPlateW} height={topPlateH} fill="#f8f8f8" stroke="#000" strokeWidth={1.5} />
        <SideFlanges x={centerX} y={topY + topPlateH} height={beamH} />
        <rect x={centerX - basePlateW / 2} y={topY + topPlateH + beamH} width={basePlateW} height={basePlateH} fill="#f8f8f8" stroke="#000" strokeWidth={1.5} />

        {/* Perfil centralizado e vertical (dentro do perfil) */}
        <text
          x={centerX}
          y={topY + topPlateH + beamH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={22}
          fill="#cc0000"
          fontWeight="bold"
          transform={`rotate(-90, ${centerX}, ${topY + topPlateH + beamH / 2})`}
        >
          {p.beamProfile}
        </text>

        {/* Cota de altura destacada */}
        <g fill="#0066cc">
          <text
            x={centerX - beamWpx / 2 - 28}
            y={topY + topPlateH + beamH / 2}
            transform={`rotate(-90, ${centerX - beamWpx / 2 - 28}, ${topY + topPlateH + beamH / 2})`}
            textAnchor="middle"
            fontSize={22}
            fontWeight="bold"
          >
            {p.beamHeight}
          </text>
        </g>

        <g fill="#0066cc" fontSize={10} fontWeight="bold">
          <text x={centerX + topPlateW / 2 + 8} y={topY + topPlateH / 2 + 3}>
            {p.topPlateThickness} mm
          </text>
          <text x={centerX + basePlateW / 2 + 8} y={topY + topPlateH + beamH + basePlateH / 2 + 3}>
            {p.basePlateThickness} mm
          </text>
        </g>
      </g>
    );
  };

  const BasePlateView = () => {
    const w = mm(p.basePlateWidth);
    const l = mm(p.basePlateLength);
    const x = centerX - w / 2;
    const y = basePlateY;

    const edges = {
      left: p.basePlateHoles.edgeDistXLeft,
      right: p.basePlateHoles.edgeDistXRight,
      top: p.basePlateHoles.edgeDistYTop,
      bottom: p.basePlateHoles.edgeDistYBottom,
    };

    return (
      <g transform={`translate(${x}, ${y})`}>
        <rect x={0} y={0} width={w} height={l} fill="#f8f8f8" stroke="#000" strokeWidth={1.5} />
        <line x1={w / 2} y1={0} x2={w / 2} y2={l} stroke="#999" strokeDasharray="6 4" />
        <line x1={0} y1={l / 2} x2={w} y2={l / 2} stroke="#999" strokeDasharray="6 4" />

        <PlateBeamTopTrace plateW={w} plateL={l} />
        {PlateHolesGrid(w, l, p.basePlateHoles, baseGridOK, mm(p.baseHolesDiameter) / 2)}
        <DimTexts w={w} l={l} />
        <EdgeAndSpacingDims
          plateW={w}
          plateL={l}
          edges={edges}
          spacing={{ spacingX: p.basePlateHoles.spacingX, spacingY: p.basePlateHoles.spacingY }}
          rows={p.basePlateHoles.rows}
          cols={p.basePlateHoles.cols}
        />
        {!baseGridOK && (
          <g>
            <rect x={w / 2 - 120} y={l + 20} width={240} height={24} fill="#fff5f5" stroke="#cc0000" />
            <text x={w / 2} y={l + 37} textAnchor="middle" fill="#cc0000" fontSize={12} fontWeight="bold">
              CHECK HOLE LAYOUT (BASE)
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <svg width={pageW} height={pageH} viewBox={`0 0 ${pageW} ${pageH}`} style={{ border: "1px solid #ccc", background: "white", fontFamily: "Inter, Arial, sans-serif" }}>
      {/* Header */}
      <text x={40} y={50} fontSize={24} fontWeight="bold">
        CUSTOMER: {p.customer}
      </text>

      {/* Invoke views */}
      <g>
        {(TopPlateView as any)()}
        {(ElevationView as any)()}
        {(BasePlateView as any)()}
      </g>

      {/* CUT NOTE + PAINT — cartucho vertical no lado esquerdo, centralizado */}
      <g
        transform={`translate(${cutX}, ${pageH / 2}) rotate(-90) translate(${-cutRectW/2}, ${-cutRectH/2})`}
        fill="#cc0000"
        fontSize={12}
      >
        <rect x={0} y={0} width={cutRectW} height={cutRectH} fill="#fff" stroke="#cc0000" strokeWidth={1.5} rx={4} />
        <text x={cutRectW/2} y={28} textAnchor="middle" fontWeight="bold" fontSize={16}>
          {(p.cutNote || "").toUpperCase()}
        </text>
        <text x={cutRectW/2} y={52} textAnchor="middle" fontWeight="bold">
          (PAINT {p.paintType.toUpperCase()})
        </text>
      </g>

      {/* Notas gerais no canto inferior direito (sem carimbo fixo) */}
      <g transform={`translate(${pageW - 40 - 360}, ${pageH - 40 - 140})`} fontSize={11} fill="#333">
        <rect x={0} y={-18} width={360} height={140} fill="#fff" stroke="#000" strokeWidth={1} />
        <text x={8} y={0} fontWeight="bold">
          GENERAL NOTES
        </text>
        <text x={8} y={20}>{p.generalNotes.match(/.{1,48}(?:\s|$)|.{1,48}/g)?.slice(0,6).map((line,i)=><tspan key={i} x={8} dy={i ? 16 : 0}>{line}</tspan>)}</text>
      </g>

      {/* Moldura */}
      <rect x={8} y={8} width={pageW - 16} height={pageH - 16} fill="none" stroke="#000" strokeWidth={1} />
    </svg>
  );
};

// Valores iniciais
const initialParams: StructuralParams = {
  beamProfile: "203x203x46",
  beamHeight: 3760,
  sectionDepth: 203.2,
  beamWidth: 203.6,
  flangeThickness: 11,
  webThickness: 7.2,
  customer: "",

  topPlateWidth: 440,
  topPlateLength: 300,
  topPlateThickness: 15,

  basePlateWidth: 450,
  basePlateLength: 450,
  basePlateThickness: 25,

  topHolesDiameter: 22,
  baseHolesDiameter: 22,

  topPlateHoles: {
    rows: 2,
    cols: 2,
    spacingX: 340,
    spacingY: 100,
    edgeDistXLeft: 50,
    edgeDistXRight: 50,
    edgeDistYTop: 100,
    edgeDistYBottom: 100,
  },
  basePlateHoles: {
    rows: 2,
    cols: 2,
    spacingX: 350,
    spacingY: 350,
    edgeDistXLeft: 50,
    edgeDistXRight: 50,
    edgeDistYTop: 50,
    edgeDistYBottom: 50,
  },

  paintType: "RED",
  generalNotes: "All welds to be continuous. Material grade S355.",
  cutNote: "Cut from 6 METER",
};

export default function App() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const handleLoadCSV = async (file?: File | null) => {
    try {
      if (!file) return;
      const text = await file.text();
      const imported = parseCSV(text);
      Object.assign(BLUE_BOOK_DB, imported);
      const added = Object.keys(imported).length;
      const bb = BLUE_BOOK_DB[normalizeKey(params.beamProfile)];
      if (bb) setParams(p => ({...p, sectionDepth:bb.h, beamWidth:bb.b, flangeThickness:bb.tf, webThickness:bb.tw}));
      setRevision(r => r + 1);
      alert(`Blue Book: ${added} perfis importados.`);
    } catch (err) {
      console.error("[BlueBook] CSV load error", err);
      alert(String(err));
    }
  };
  const [params, setParams] = useState<StructuralParams>(initialParams);
  const [isQuickViewOpen, setQuickViewOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const layoutOffsetX = 0;
  const known = !!BLUE_BOOK_DB[normalizeKey(params.beamProfile)];
  const dimensionsOK = [params.sectionDepth,params.beamWidth,params.flangeThickness,params.webThickness,params.beamHeight,params.topPlateWidth,params.topPlateLength,params.topPlateThickness,params.basePlateWidth,params.basePlateLength,params.basePlateThickness,params.topHolesDiameter,params.baseHolesDiameter].every(v => Number.isFinite(v) && v > 0) && params.sectionDepth > 2*params.flangeThickness && params.beamWidth > params.webThickness;
  const holesOK = validGrid(params.topPlateWidth,params.topPlateLength,params.topPlateHoles,params.topHolesDiameter) && validGrid(params.basePlateWidth,params.basePlateLength,params.basePlateHoles,params.baseHolesDiameter);
  const platesOK = params.topPlateWidth >= params.sectionDepth && params.basePlateWidth >= params.sectionDepth && params.topPlateLength >= params.beamWidth && params.basePlateLength >= params.beamWidth;
  const valid = known && dimensionsOK && holesOK && platesOK;
  const download = () => {
    const svg = document.querySelector('.drawing svg'); if (!svg || !valid) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='steel-sketch.svg'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <><header className="app-header"><div><small>STRUCTURAL STEEL / WORKSHOP TOOLS</small><h1>Sketch Creator<span> / UB + UC</span></h1></div><div className="actions"><button disabled={!valid} onClick={download}>Download SVG</button><button disabled={!valid} onClick={()=>setQuickViewOpen(true)}>Quick view / PNG</button><button className="primary" disabled={!valid} onClick={()=>window.print()}>Print / Save PDF</button></div></header>
    <main><aside><div className="catalogue"><strong>Section catalogue</strong><p>{Object.keys(BLUE_BOOK_DB).length} profiles · dimensions in mm</p><button onClick={()=>fileInputRef.current?.click()}>Import CSV</button><input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={e=>{handleLoadCSV(e.target.files?.[0]);e.target.value='';}}/><p><a href="/example-profiles.csv" download>CSV template</a> · size,h,b,tf,tw</p></div><InputForm key={revision} params={params} onChange={setParams}/></aside>
    <section className="workspace"><div className="drawing-status"><strong>A4 drawing</strong><span>{params.beamProfile} · {params.beamHeight} mm</span></div>
    {!known && <p role="alert" className="error">Profile not found. Select a listed size or import a valid CSV. Previous dimensions have been cleared.</p>}
    {!dimensionsOK && <p role="alert" className="error">Enter positive dimensions; h must exceed 2 × tf and b must exceed tw.</p>}
    {!holesOK && <p role="alert" className="error">Check hole spacing, edge distances and diameters. Export is disabled.</p>}
    {!platesOK && dimensionsOK && <p role="alert" className="error">The profile extends beyond a plate. Increase the plate dimensions.</p>}
    {known && dimensionsOK ? <div className="drawing"><TechnicalDrawing {...params} layoutOffsetX={layoutOffsetX}/></div> : <div className="empty">Choose a valid UB / UC profile to preview the drawing.</div>}
    <p className="caption">Schematic elevation — do not scale. Section trace omits root radii. Check dimensions before fabrication.</p></section></main>
    <QuickPreviewModal isOpen={isQuickViewOpen && valid} onClose={()=>setQuickViewOpen(false)} title="A4 drawing" fileNameBase="steel-sketch"><TechnicalDrawing {...params} layoutOffsetX={layoutOffsetX}/></QuickPreviewModal></>;
}
