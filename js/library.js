// js/library.js — сохранение деталей в localStorage
const KEY = "cadLibrary";

export function listParts() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { return []; }
}

export function savePart(name, primitives) {
  const lib = listParts();
  lib.push({
    id: Date.now(),
    name,
    primitives: JSON.parse(JSON.stringify(primitives)),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(KEY, JSON.stringify(lib));
}

export function deletePart(id) {
  const lib = listParts().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(lib));
}

export function loadPart(id) {
  return listParts().find(p => p.id === id);
}