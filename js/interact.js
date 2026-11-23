// js/interact.js — перетаскивание примитивов
import { state, renderSheet } from "./core.js";

let isDragging = false;
let selectedPrim = null;
let startX = 0;
let startY = 0;
let initialCoords = {};
let activePointerId = null;

export function initInteractivity() {
  const svg = document.getElementById("sheet");
  if (!svg) return;

  // 1. Отключаем стандартный скролл браузера при касании чертежа
  svg.style.touchAction = "none";

  // Защита от дублирования обработчиков
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

  // 2. Нажатие
  svg.addEventListener("pointerdown", (e) => {
    if (isDragging) return;
    const target = e.target.closest("[data-id]");
    if (!target) return;

    const id = target.dataset.id;
    selectedPrim = state.primitives.find(p => p.id === id);
    if (!selectedPrim) return;

    e.preventDefault();
    isDragging = true;
    activePointerId = e.pointerId;
    
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    initialCoords = JSON.parse(JSON.stringify(selectedPrim));
    svg.setPointerCapture(e.pointerId);
  });

  // 3. Движение
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
    else if (selectedPrim.type === "circle") {
      selectedPrim.cx = initialCoords.cx + dx;
      selectedPrim.cy = initialCoords.cy + dy;
    }
    else if (selectedPrim.type === "polygon") {
      selectedPrim.points = initialCoords.points.map(pt => [pt[0] + dx, pt[1] + dy]);
    }

    renderSheet(state.paper);
  });

  // 4. Отпускание
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