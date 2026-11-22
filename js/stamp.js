// js/stamp.js — штамп как редактируемая сетка
import { el, state, PAPERS, FRAME } from "./core.js";

const STORAGE_KEY = "cadStampV2";

export function loadStamp() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.stamp.width = p.width || 185;
      state.stamp.grid  = p.grid  || defaultGostTemplate(185, 55);
    } else {
      state.stamp.width = 185;
      state.stamp.grid  = defaultGostTemplate(185, 55);
    }
  } catch {
    state.stamp.width = 185;
    state.stamp.grid  = defaultGostTemplate(185, 55);
  }
}

export function saveStamp() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    width: state.stamp.width,
    grid:  state.stamp.grid
  }));
}

/* ---------- Шаблон ГОСТ 2.104 (форма 1) ---------- */
export function defaultGostTemplate(width = 185, height = 55) {
  const rowH = height / 5;
  const rows = [rowH, rowH, rowH, rowH, rowH];
  const cols = [7, 23, 15, 15, 62, 21, 21, 21];  // сумма 185
  const cells = [];
  const labels = ["Разраб.", "Пров.", "Т.контр.", "Н.контр.", "Утв."];
  for (let r = 0; r < 5; r++) {
    cells.push({ r, c: 0, rs: 1, cs: 1, text: labels[r], fontSize: 2.4, align: "center", bold: false });
    cells.push({ r, c: 1, rs: 1, cs: 1, text: "", fontSize: 2.4, align: "left", bold: false });
    cells.push({ r, c: 2, rs: 1, cs: 1, text: "", fontSize: 2.4, align: "left", bold: false });
    cells.push({ r, c: 3, rs: 1, cs: 1, text: "", fontSize: 2.4, align: "left", bold: false });
  }
  cells.push({ r: 0, c: 4, rs: 1, cs: 1, text: "Лит.",     fontSize: 2.2, align: "center", bold: false });
  cells.push({ r: 0, c: 5, rs: 1, cs: 1, text: "Масса",    fontSize: 2.2, align: "center", bold: false });
  cells.push({ r: 0, c: 6, rs: 1, cs: 1, text: "Масштаб",  fontSize: 2.2, align: "center", bold: false });
  cells.push({ r: 1, c: 4, rs: 1, cs: 3, text: "", fontSize: 5,   align: "center", bold: false });
  cells.push({ r: 2, c: 4, rs: 1, cs: 3, text: "", fontSize: 4.5, align: "center", bold: false });
  cells.push({ r: 3, c: 4, rs: 1, cs: 3, text: "", fontSize: 2.8, align: "left",   bold: false });
  cells.push({ r: 4, c: 4, rs: 1, cs: 3, text: "", fontSize: 2.8, align: "center", bold: false });
  return { rows, cols, cells };
}

/* ---------- Школьный упрощённый шаблон  ---------- */
export function defaultSchoolTemplate(width = 145, height = 30) {
  const rows = [11, 11, 8]; 
  const cols = [25, 30, 15, 35, 20, 20]; // Сумма = 145
  
  const cells = [
    // 1 строка
    { r: 0, c: 0, rs: 1, cs: 1, text: "Чертил", fontSize: 3.5, align: "center", bold: true },
    { r: 0, c: 1, rs: 1, cs: 1, text: "Иванов М", fontSize: 3.5, align: "center", bold: true },
    { r: 0, c: 2, rs: 1, cs: 1, text: "10.10.90", fontSize: 3, align: "center", bold: true },
    
    // 2 строка
    { r: 1, c: 0, rs: 1, cs: 1, text: "Проверил", fontSize: 3.5, align: "center", bold: true },
    { r: 1, c: 1, rs: 1, cs: 1, text: "", fontSize: 3.5, align: "center", bold: false },
    { r: 1, c: 2, rs: 1, cs: 1, text: "", fontSize: 3, align: "center", bold: false },
    
    // Правая часть (Объединяем 1 и 2 строку, а также 3 последних столбца)
    { r: 0, c: 3, rs: 2, cs: 3, text: "Кольцо", fontSize: 8, align: "center", bold: true },
    
    // 3 строка (нижняя)
    { r: 2, c: 0, rs: 1, cs: 1, text: "Школа", fontSize: 3.5, align: "center", bold: true },
    { r: 2, c: 1, rs: 1, cs: 1, text: "класс", fontSize: 3.5, align: "center", bold: true },
    { r: 2, c: 2, rs: 1, cs: 1, text: "", fontSize: 3, align: "center", bold: false },
    
    // Нижняя правая часть (Материал, Масштаб, Номер)
    { r: 2, c: 3, rs: 1, cs: 1, text: "Резина", fontSize: 3.5, align: "center", bold: true },
    { r: 2, c: 4, rs: 1, cs: 1, text: "1:1", fontSize: 3.5, align: "center", bold: true },
    { r: 2, c: 5, rs: 1, cs: 1, text: "№ 3", fontSize: 3.5, align: "center", bold: true }
  ];
  
  return { rows, cols, cells };
}

/* ---------- Отрисовка ---------- */
export function renderStamp(svg) {
  if (!state.stamp.grid) return;
  const { w, h } = PAPERS[state.paper];
  const maxW = w - FRAME.left - FRAME.right;
  const stampW = Math.min(state.stamp.width, maxW);
  const grid = state.stamp.grid;

  const totalCols = grid.cols.reduce((a, b) => a + b, 0) || 1;
  const totalRows = grid.rows.reduce((a, b) => a + b, 0) || 1;
  const scaleX = stampW / totalCols;
  const scaleY = state.stamp.height / totalRows;

  const x0 = w - FRAME.right - stampW;
  const y0 = h - FRAME.bottom - state.stamp.height;

  const g = el("g", { id: "stamp" });
  svg.appendChild(g);

  // Позиции
  const colX = [0];
  for (let i = 0; i < grid.cols.length; i++) colX.push(colX[i] + grid.cols[i] * scaleX);
  const rowY = [0];
  for (let i = 0; i < grid.rows.length; i++) rowY.push(rowY[i] + grid.rows[i] * scaleY);

  for (const cell of grid.cells) {
    const c0 = cell.c, c1 = cell.c + (cell.cs || 1);
    const r0 = cell.r, r1 = cell.r + (cell.rs || 1);
    const x  = x0 + colX[c0];
    const y  = y0 + rowY[r0];
    const cw = colX[c1] - colX[c0];
    const ch = rowY[r1] - rowY[r0];

    g.appendChild(el("rect", {
      x, y, width: cw, height: ch,
      fill: "none", stroke: "#000", "stroke-width": 0.5
    }));

    if (cell.text) {
      const fs = cell.fontSize || 2.5;
      let tx = x + 1, anchor = "start";
      if (cell.align === "center") { tx = x + cw / 2; anchor = "middle"; }
      else if (cell.align === "right") { tx = x + cw - 1; anchor = "end"; }
      const t = el("text", {
        x: tx, y: y + ch / 2 + fs * 0.35,
        "font-size": fs, "font-family": "Arial, sans-serif",
        "text-anchor": anchor,
        "font-weight": cell.bold ? "bold" : "normal"
      });
      t.textContent = cell.text;
      g.appendChild(t);
    }
  }
}

if (typeof window !== "undefined") {
  window.__renderStamp = svg => renderStamp(svg);
}