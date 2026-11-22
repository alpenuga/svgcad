// js/stamp.js — ГОСТ 2.104, форма 1 с адаптивной левой границей
import { el, state, PAPERS, FRAME } from "./core.js";

export function renderStamp(svg) {
  const { w, h } = PAPERS[state.paper];
  const maxW = w - FRAME.left - FRAME.right;
  const stampW = Math.min(state.stamp.width, maxW);
  const stampH = state.stamp.height;
  const x0 = w - FRAME.right - stampW;
  const y0 = h - FRAME.bottom - stampH;

  const g = el("g", { id: "stamp" });
  svg.appendChild(g);

  g.appendChild(el("rect", {
    x: x0, y: y0, width: stampW, height: stampH,
    fill: "none", stroke: "#000", "stroke-width": 0.7
  }));

  const rowH = stampH / 5;
  const colW = 7, nameW = 23, sigW = 15, dateW = 15;
  const leftW = colW + nameW + sigW + dateW;
  const splitX = x0 + leftW;

  // Разделитель слева / справа
  g.appendChild(el("line", {
    x1: splitX, y1: y0, x2: splitX, y2: y0 + stampH,
    stroke: "#000", "stroke-width": 0.7
  }));

  // Горизонтали в левой части
  for (let i = 1; i < 5; i++) {
    g.appendChild(el("line", {
      x1: x0, y1: y0 + i * rowH, x2: splitX, y2: y0 + i * rowH,
      stroke: "#000", "stroke-width": 0.4
    }));
  }

  // Вертикали колонок
  const colXs = [x0 + colW, x0 + colW + nameW, x0 + colW + nameW + sigW];
  for (const cx of colXs) {
    g.appendChild(el("line", {
      x1: cx, y1: y0, x2: cx, y2: y0 + stampH,
      stroke: "#000", "stroke-width": 0.4
    }));
  }

  // Заголовки строк
  const rowLabels = ["Разраб.", "Пров.", "Т.контр.", "Н.контр.", "Утв."];
  const rowKeys = ["author", "checker", "tcontrol", "ncontrol", "approver"];
  rowLabels.forEach((label, i) => {
    g.appendChild(textAt(x0 + colW / 2, y0 + i * rowH + rowH / 2 + 1.2, label, 2.2, "middle"));
    const f = state.stamp.fields[rowKeys[i]] || {};
    if (f.name) g.appendChild(textAt(x0 + colW + 1, y0 + i * rowH + 7, f.name, 2.2));
    if (f.date) g.appendChild(textAt(x0 + colW + nameW + sigW + 1, y0 + i * rowH + 7, f.date, 2.2));
  });

  // Правая часть
  const rx = splitX;
  const rightW = stampW - leftW;
  const f = state.stamp.fields;

  // Строка Лит./Масса/Масштаб (15 мм)
  g.appendChild(el("line", {
    x1: rx, y1: y0 + 15, x2: x0 + stampW, y2: y0 + 15,
    stroke: "#000", "stroke-width": 0.4
  }));
  const blockHeaders = ["Лит.", "Масса", "Масштаб"];
  blockHeaders.forEach((label, i) => {
    const cw = rightW / 3;
    if (i > 0) g.appendChild(el("line", {
      x1: rx + i * cw, y1: y0, x2: rx + i * cw, y2: y0 + 15,
      stroke: "#000", "stroke-width": 0.4
    }));
    g.appendChild(textAt(rx + i * cw + cw / 2, y0 + 12, label, 2, "middle"));
  });

  // Средний блок: обозначение + наименование (25 мм)
  g.appendChild(el("line", {
    x1: rx, y1: y0 + 40, x2: x0 + stampW, y2: y0 + 40,
    stroke: "#000", "stroke-width": 0.4
  }));
  if (f.designation) {
    g.appendChild(textAt(rx + rightW / 2, y0 + 22, f.designation, 4.5, "middle"));
  }
  if (f.title) {
    g.appendChild(textAt(rx + rightW / 2, y0 + 34, f.title, 4, "middle"));
  }

  // Нижний блок (15 мм): материал + организация
  if (f.material) {
    g.appendChild(textAt(rx + 2, y0 + 48, "Материал: " + f.material, 2.5));
  }
  if (f.organization) {
    g.appendChild(textAt(rx + rightW / 2, y0 + 54, f.organization, 2.8, "middle"));
  }
}

function textAt(x, y, text, size, anchor = "start") {
  const t = el("text", {
    x, y, "font-size": size, "font-family": "Arial, sans-serif", "text-anchor": anchor
  });
  t.textContent = text;
  return t;
}

if (typeof window !== "undefined") {
  window.__renderStamp = svg => renderStamp(svg);
}