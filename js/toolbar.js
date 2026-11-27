// js/toolbar.js — отрисовка и привязка панели инструментов
import { addPrimitive, undo, state, renderSheet } from "./core.js";

function promptNumber(msg, def = 0) {
  const v = prompt(msg, String(def));
  if (v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export function buildToolbarHtml() {
  return `
    <section id="toolbar">
      <label>Формат:
        <select id="paperSize">
          <option value="A4P" ${state.paper === "A4P" ? "selected" : ""}>А4 портрет</option>
          <option value="A4L" ${state.paper === "A4L" ? "selected" : ""}>А4 ландшафт</option>
          <option value="A3P" ${state.paper === "A3P" ? "selected" : ""}>А3 портрет</option>
          <option value="A3L" ${state.paper === "A3L" ? "selected" : ""}>А3 ландшафт</option>
        </select>
      </label>
      <button id="addLine">Линия</button>
      <button id="addCircle">Круг</button>
      <button id="addRect">Прямоуг.</button>
      <button id="addArc">Дуга</button>
      <button id="addDim">Размер</button>
      <button id="undoBtn">↶</button>
      <button id="clearBtn">🧹</button>
      <button id="toggleStamp">Штамп: Вкл</button>
      <button id="exportSvg">⬇ SVG</button>
    </section>
    <section id="canvasWrap">
      <svg id="sheet" xmlns="http://www.w3.org/2000/svg"></svg>
    </section>
  `;
}

export function bindToolbar() {
  const size = document.getElementById("paperSize");
  if (size) size.onchange = e => renderSheet(e.target.value);

  const lineBtn = document.getElementById("addLine");
  if (lineBtn) lineBtn.onclick = () => {
    const x1 = promptNumber("x1 (мм)", 50);   if (x1 === null) return;
    const y1 = promptNumber("y1 (мм)", 50);   if (y1 === null) return;
    const x2 = promptNumber("x2 (мм)", 150);  if (x2 === null) return;
    const y2 = promptNumber("y2 (мм)", 150);  if (y2 === null) return;
    addPrimitive({ type: "line", role: "outline", x1, y1, x2, y2 });
    renderSheet(state.paper);
  };

  const circleBtn = document.getElementById("addCircle");
  if (circleBtn) circleBtn.onclick = () => {
    const cx = promptNumber("Центр X (мм)", 100); if (cx === null) return;
    const cy = promptNumber("Центр Y (мм)", 100); if (cy === null) return;
    const r  = promptNumber("Радиус (мм)", 10);   if (r === null || r <= 0) return;
    addPrimitive({ type: "circle", role: "hole", cx, cy, r });
    renderSheet(state.paper);
  };

  const rectBtn = document.getElementById("addRect");
  if (rectBtn) rectBtn.onclick = () => {
    const x = promptNumber("X (мм)", 50);       if (x === null) return;
    const y = promptNumber("Y (мм)", 50);       if (y === null) return;
    const w = promptNumber("Ширина (мм)", 80);  if (w === null || w <= 0) return;
    const h = promptNumber("Высота (мм)", 50);  if (h === null || h <= 0) return;
    addPrimitive({ type: "rect", role: "outline", x, y, w, h });
    renderSheet(state.paper);
  };

  const arcBtn = document.getElementById("addArc");
  if (arcBtn) arcBtn.onclick = () => {
    const cx = promptNumber("Центр X (мм)", 100); if (cx === null) return;
    const cy = promptNumber("Центр Y (мм)", 100); if (cy === null) return;
    const r  = promptNumber("Радиус (мм)", 20);   if (r === null || r <= 0) return;
    const a1 = promptNumber("Начало (°)", 0);     if (a1 === null) return;
    const a2 = promptNumber("Конец (°)", 90);     if (a2 === null) return;
    addPrimitive({ type: "arc", role: "fillet", cx, cy, r, startAngle: a1, endAngle: a2 });
    renderSheet(state.paper);
  };

  const dimBtn = document.getElementById("addDim");
  if (dimBtn) dimBtn.onclick = () => {
    const x1 = promptNumber("Начало X (мм)", 50); if (x1 === null) return;
    const y1 = promptNumber("Начало Y (мм)", 100); if (y1 === null) return;
    const x2 = promptNumber("Конец X (мм)", 110); if (x2 === null) return;
    const y2 = promptNumber("Конец Y (мм)", 100); if (y2 === null) return;
    
    // Считаем длину по теореме Пифагора
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(1);
    
    addPrimitive({ 
      type: "dimension", role: "dimension", 
      x1, y1, x2, y2, text: length 
    });
    renderSheet(state.paper);
  };

  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) undoBtn.onclick = () => { undo(); renderSheet(state.paper); };

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) clearBtn.onclick = () => {
    if (confirm("Очистить весь чертёж?")) {
      state.primitives = [];
      renderSheet(state.paper);
    }
  };

  const btnStamp = document.getElementById("toggleStamp");
  if (btnStamp) {
    btnStamp.textContent = state.showStamp ? "Штамп: Вкл" : "Штамп: Выкл";
    btnStamp.onclick = () => {
      state.showStamp = !state.showStamp;
      btnStamp.textContent = state.showStamp ? "Штамп: Вкл" : "Штамп: Выкл";
      renderSheet(state.paper);
    };
  }

  const exportBtn = document.getElementById("exportSvg");
  if (exportBtn) exportBtn.onclick = () => {
    const svg = document.getElementById("sheet");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drawing.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}