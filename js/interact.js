// js/interact.js — перетаскивание примитивов и редактирование
import { state, renderSheet } from "./core.js";

let isDragging = false;
let selectedPrim = null;
let startX = 0;
let startY = 0;
let initialCoords = {};
let activePointerId = null;
let lastTap = 0;

// --- Функция редактирования (вызывается по двойному клику) ---
function editPrimitive(prim) {
  if (prim.type === "line" || prim.type === "dimension") {
    const len = Math.sqrt(Math.pow(prim.x2 - prim.x1, 2) + Math.pow(prim.y2 - prim.y1, 2)).toFixed(1);
    const newLen = prompt("Длина линии (мм):", len);
    if (newLen && !isNaN(newLen)) {
      const angle = Math.atan2(prim.y2 - prim.y1, prim.x2 - prim.x1);
      prim.x2 = prim.x1 + parseFloat(newLen) * Math.cos(angle);
      prim.y2 = prim.y1 + parseFloat(newLen) * Math.sin(angle);
      if (prim.text !== undefined) prim.text = newLen;
    }
  } else if (prim.type === "rect") {
    const w = prompt("Ширина (мм):", prim.w);
    if (w && !isNaN(w)) prim.w = parseFloat(w);
    const h = prompt("Высота (мм):", prim.h);
    if (h && !isNaN(h)) prim.h = parseFloat(h);
  } else if (prim.type === "circle") {
    const r = prompt("Радиус (мм):", prim.r);
    if (r && !isNaN(r)) prim.r = parseFloat(r);
  } else if (prim.type === "arc") {
    const r = prompt("Радиус дуги (мм):", prim.r);
    if (r && !isNaN(r)) prim.r = parseFloat(r);
  }
  renderSheet(state.paper);
}

// --- Основная инициализация ---
export function initInteractivity() {
  const svg = document.getElementById("sheet");
  if (!svg) return;
  
  svg.style.touchAction = "none";
  if (svg.dataset.interactive === "true") return;
  svg.dataset.interactive = "true";

  // Конвертация координат пальца в миллиметры листа
  function getMousePos(evt) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: (evt.clientX - rect.left) * (vb.width / rect.width),
      y: (evt.clientY - rect.top) * (vb.height / rect.height)
    };
  }

  // 1. Нажатие (выбор / редактирование / старт перетаскивания)
  svg.addEventListener("pointerdown", (e) => {
    const target = e.target.closest("[data-id]");
    if (!target) return;

    const now = Date.now();
    if (now - lastTap < 300) {
      // Двойной клик — редактируем
      e.preventDefault();
      const id = target.dataset.id;
      const prim = state.primitives.find(p => p.id === id);
      if (prim) editPrimitive(prim);
      lastTap = 0;
      return;
    }
    lastTap = now;

    // Одинарный клик — начинаем перетаскивание
    e.preventDefault();
    
    // ВОТ ТУТ ВАЖНЫЕ СТРОЧКИ, КОТОРЫЕ ПОТЕРЯЛИСЬ:
    const id = target.dataset.id;
    selectedPrim = state.primitives.find(p => p.id === id);
    if (!selectedPrim) return;
    // ------------------------------------------------

    isDragging = true;
    activePointerId = e.pointerId;
    
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    initialCoords = JSON.parse(JSON.stringify(selectedPrim));
    svg.setPointerCapture(e.pointerId);
  });

  // 2. Движение (перетаскивание)
  svg.addEventListener("pointermove", (e) => {
    if (!isDragging || !selectedPrim || e.pointerId !== activePointerId) return;
    e.preventDefault();

    const pos = getMousePos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    if (selectedPrim.type === "line" || selectedPrim.type === "dimension") {
      selectedPrim.x1 = initialCoords.x1 + dx;
      selectedPrim.y1 = initialCoords.y1 + dy;
      selectedPrim.x2 = initialCoords.x2 + dx;
      selectedPrim.y2 = initialCoords.y2 + dy;
    } 
    else if (selectedPrim.type === "rect") {
      selectedPrim.x = initialCoords.x + dx;
      selectedPrim.y = initialCoords.y + dy;
    } 
    else if (selectedPrim.type === "arc") {
      selectedPrim.cx = initialCoords.cx + dx;
      selectedPrim.cy = initialCoords.cy + dy;
    }
    else if (selectedPrim.type === "circle") {
      selectedPrim.cx = initialCoords.cx + dx;
      selectedPrim.cy = initialCoords.cy + dy;
    }
    else if (selectedPrim.type === "polygon") {
      selectedPrim.points = initialCoords.points.map(pt => [pt[0] + dx, pt[1] + dy]);
    }

    renderSheet(state.paper);
  });

  // 3. Отпускание (сохранение)
  const endDrag = (e) => {
    if (e.pointerId !== activePointerId) return;
    isDragging = false;
    selectedPrim = null;
    activePointerId = null;
    renderSheet(state.paper);
  };

  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
}