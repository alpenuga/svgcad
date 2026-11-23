// js/interact.js — перетаскивание примитивов
import { state, renderSheet } from "./core.js";

let isDragging = false;
let selectedPrim = null;
let startX = 0;
let startY = 0;
let initialCoords = {};

export function initInteractivity() {
  const svg = document.getElementById("sheet");
  if (!svg) return;

  // Конвертация координат мыши/пальца в миллиметры листа
  function getMousePos(evt) {
    const rect = svg.getBoundingClientRect();
    const scaleX = (svg.viewBox.baseVal.width) / rect.width;
    const scaleY = (svg.viewBox.baseVal.height) / rect.height;
    // Учитываем, что лист может быть прокручен
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  // 1. Нажатие (выбор элемента)
  svg.addEventListener("pointerdown", (e) => {
    const target = e.target.closest("[data-id]");
    if (!target) return;

    const id = target.dataset.id;
    selectedPrim = state.primitives.find(p => p.id === id);
    if (!selectedPrim) return;

    isDragging = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    // Запоминаем изначальные координаты
    initialCoords = JSON.parse(JSON.stringify(selectedPrim));

    // Подсветка (визуально)
    target.style.opacity = "0.5";
    svg.setPointerCapture(e.pointerId);
  });

  // 2. Движение (перетаскивание)
  svg.addEventListener("pointermove", (e) => {
    if (!isDragging || !selectedPrim) return;

    const pos = getMousePos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    // Обновляем координаты в зависимости от типа
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

  // 3. Отпускание (сохранение)
  svg.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    selectedPrim = null;
    svg.releasePointerCapture(e.pointerId);
    renderSheet(state.paper); // Сбрасываем подсветку
  });
}