// js/core.js — состояние чертежа, лист, примитивы
export const PAPERS = {
  A4P: { w: 210, h: 297, name: "А4" },
  A4L: { w: 297, h: 210, name: "А4" },
  A3P: { w: 297, h: 420, name: "А3" },
  A3L: { w: 420, h: 297, name: "А3" }
};

export const FRAME = { left: 20, top: 5, right: 5, bottom: 5 };

export const state = {
  paper: "A4P",
  primitives: [],
  stamp: {
    width: 185, height: 55,
    fields: {
      designation: "",
      title: "",
      material: "",
      organization: "",
      author:   { name: "", date: "" },
      checker:  { name: "", date: "" },
      tcontrol: { name: "", date: "" },
      ncontrol: { name: "", date: "" },
      approver: { name: "", date: "" }
    }
  }
};

let nextId = 1;
export function newId() { return "p" + (nextId++); }

export function el(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  return node;
}

export function renderSheet(paperKey) {
  if (paperKey) state.paper = paperKey;
  const { w, h } = PAPERS[state.paper];
  const svg = document.getElementById("sheet");
  if (!svg) return;

  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w * 3);
  svg.setAttribute("height", h * 3);
  svg.innerHTML = "";

  // Лист
  svg.appendChild(el("rect", { x: 0, y: 0, width: w, height: h, fill: "#fff" }));

  // Рамка по ГОСТ
  svg.appendChild(el("rect", {
    x: FRAME.left, y: FRAME.top,
    width: w - FRAME.left - FRAME.right,
    height: h - FRAME.top - FRAME.bottom,
    fill: "none", stroke: "#000", "stroke-width": 0.7
  }));

  // Слой примитивов
  const g = el("g", { id: "primitives" });
  svg.appendChild(g);
  for (const p of state.primitives) g.appendChild(primitiveToSvg(p));

  // Штамп
  if (window.__renderStamp) window.__renderStamp(svg);

  return svg;
}

export function primitiveToSvg(p) {
  const strokeMap = {
    outline: "#000",
    hole: "#000",
    slot: "#000",
    fillet: "#000",
    chamfer: "#000",
    centerline: "#c00",
    dimension: "#06c",
    other: "#000"
  };
  const stroke = strokeMap[p.role] || "#000";
  const dash = p.role === "centerline" ? "6 2 1 2" : undefined;
  const sw = p.role === "outline" ? 0.5 : (p.role === "dimension" ? 0.2 : 0.35);

  let node;
  switch (p.type) {
    case "line":
      node = el("line", { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 });
      break;
    case "circle":
      node = el("circle", { cx: p.cx, cy: p.cy, r: p.r, fill: "none" });
      break;
    case "rect":
      node = el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, fill: "none" });
      break;
    case "arc":
      node = el("path", { d: arcPath(p), fill: "none" });
      break;
    case "text":
      node = el("text", {
        x: p.x, y: p.y, "font-size": p.size || 3,
        "font-family": "Arial, sans-serif",
        "text-anchor": p.anchor || "start"
      });
      node.textContent = p.text;
      break;
  }
  if (node) {
    if (p.type !== "text") {
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", sw);
      if (dash) node.setAttribute("stroke-dasharray", dash);
    } else {
      node.setAttribute("fill", stroke);
    }
    if (p.id) node.dataset.id = p.id;
  }
  return node;
}

function arcPath(p) {
  const a1 = p.startAngle * Math.PI / 180;
  const a2 = p.endAngle * Math.PI / 180;
  const x1 = p.cx + p.r * Math.cos(a1);
  const y1 = p.cy + p.r * Math.sin(a1);
  const x2 = p.cx + p.r * Math.cos(a2);
  const y2 = p.cy + p.r * Math.sin(a2);
  const large = Math.abs(p.endAngle - p.startAngle) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${p.r} ${p.r} 0 ${large} 1 ${x2} ${y2}`;
}

export function addPrimitive(p) {
  p.id = p.id || newId();
  state.primitives.push(p);
  return p;
}

export function removePrimitive(id) {
  state.primitives = state.primitives.filter(p => p.id !== id);
}

export function undo() {
  state.primitives.pop();
}

export function clearAll() {
  state.primitives = [];
}