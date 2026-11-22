// js/projections.js — геометрия проекций, без UI
import { addPrimitive, newId, state, renderSheet, FRAME } from "./core.js";

export function boundingBox(prims) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of prims) {
    const pts = [];
    if (p.type === "line")   pts.push([p.x1, p.y1], [p.x2, p.y2]);
    if (p.type === "circle") pts.push([p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy + p.r]);
    if (p.type === "rect")   pts.push([p.x, p.y], [p.x + p.w, p.y + p.h]);
    if (p.type === "arc")    pts.push([p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy + p.r]);
    if (p.type === "text")   pts.push([p.x, p.y]);
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function shiftPrimitive(p, dx, dy) {
  const q = { ...p };
  if (q.x1 !== undefined) { q.x1 += dx; q.y1 += dy; }
  if (q.x2 !== undefined) { q.x2 += dx; q.y2 += dy; }
  if (q.cx !== undefined) { q.cx += dx; q.cy += dy; }
  if (q.x  !== undefined) { q.x  += dx; q.y  += dy; }
  if (!q.id) q.id = newId();
  return q;
}

function hatchRect(x, y, w, h, step = 3) {
  const lines = [];
  const cStep = step * Math.SQRT2;
  const cMin  = y - x - w;
  const cMax  = y - x + h;
  for (let c = cMin; c <= cMax; c += cStep) {
    const xs = Math.max(x, y - c);
    const xe = Math.min(x + w, y + h - c);
    if (xs >= xe) continue;
    lines.push({
      type: "line", role: "dimension",
      x1: xs, y1: xs + c,
      x2: xe, y2: xe + c
    });
  }
  return lines;
}

export function buildThreeViews() {
  const bb = boundingBox(state.primitives);
  if (bb.w === 0 || bb.h === 0) {
    alert("Сначала постройте деталь (вид спереди).");
    return;
  }
  const gap = 20;
  const ox1 = FRAME.left + 20;
  const oy1 = FRAME.top  + 20;

  state.primitives = state.primitives.map(p =>
    shiftPrimitive(p, ox1 - bb.x, oy1 - bb.y)
  );

  const depth = bb.h * 0.5;

  const oy2 = oy1 + bb.h + gap;
  addPrimitive({ type: "rect", role: "outline", x: ox1, y: oy2, w: bb.w, h: depth });

  state.primitives
    .filter(p => p.type === "circle" && p.role === "hole")
    .forEach(p => addPrimitive({ type: "circle", role: "hole",
      cx: p.cx, cy: oy2 + depth / 2, r: p.r }));

  const ox3 = ox1 + bb.w + gap;
  addPrimitive({ type: "rect", role: "outline", x: ox3, y: oy1, w: depth, h: bb.h });

  renderSheet(state.paper);
}

export function buildSection() {
  const bb = boundingBox(state.primitives);
  if (bb.w === 0) { alert("Сначала постройте деталь."); return; }
  const x = FRAME.left + 20;
  const y = FRAME.top  + 20;
  state.primitives = state.primitives.map(p =>
    shiftPrimitive(p, x - bb.x, y - bb.y)
  );
  hatchRect(x, y, bb.w, bb.h, 3).forEach(p => addPrimitive(p));
  renderSheet(state.paper);
}

export function buildCutaway() {
  const bb = boundingBox(state.primitives);
  if (bb.w === 0) { alert("Сначала постройте деталь."); return; }
  const x = FRAME.left + 20;
  const y = FRAME.top  + 20;
  state.primitives = state.primitives.map(p =>
    shiftPrimitive(p, x - bb.x, y - bb.y)
  );
  hatchRect(x, y, bb.w, bb.h, 1.5).forEach(p => addPrimitive(p));
  renderSheet(state.paper);
}