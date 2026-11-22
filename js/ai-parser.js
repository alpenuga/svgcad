// js/ai-parser.js — распознавание чертежей через Gemini
const MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export async function checkModel(apiKey, modelId = "gemini-3.8-flash") {
  try {
    const res = await fetch(`${API}/${modelId}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    return res.ok;
  } catch { return false; }
}

const PROMPT = `Ты — инженер-конструктор. На изображении — 3D-деталь (изометрия).
Построй её ГЛАВНЫЙ ВИД (вид спереди) в 2D.
Верни ТОЛЬКО JSON по схеме. Никаких пояснений вне JSON.

ПРАВИЛА:
1. Размеры в миллиметрах. (0,0) — левый нижний угол.
2. ВАЖНО: Строй деталь ИСКЛЮЧИТЕЛЬНО из прямоугольников ("rect")!
   Для каждого прямоугольника ОБЯЗАТЕЛЬНО указывай: x (отступ слева), y (отступ снизу), w (ширина), h (высота).
   Например, деталь 60x40 с выступом — это 2-3 прямоугольника, наложенных друг на друга.
3. Линии ("line") используй ТОЛЬКО для наклонных контуров (фаски). 
   Для линий ОБЯЗАТЕЛЬНО указывай x1, y1, x2, y2.
4. Для отверстий используй "circle" (cx, cy, r).
5. Не добавляй размерные линии, только контур (outline).`;

const SCHEMA = {
  type: "object",
  properties: {
    partName: { type: "string" },
    overall: {
      type: "object",
      properties: { width: { type: "number" }, height: { type: "number" } },
      required: ["width", "height"]
    },
    primitives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["line", "circle", "rect"] },
          role: { type: "string", enum: ["outline", "hole"] },
          // Поля для прямоугольника
          x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
          // Поля для линии
          x1: { type: "number" }, y1: { type: "number" }, x2: { type: "number" }, y2: { type: "number" },
          // Поля для круга
          cx: { type: "number" }, cy: { type: "number" }, r: { type: "number" }
        },
        required: ["type", "role"]
      }
    },
    confidence: { type: "number" },
    notes: { type: "string" }
  },
  required: ["partName", "overall", "primitives", "confidence"]
};

// --- ФУНКЦИЯ ОЧИСТКИ ---
export function sanitizeAIPrimitives(primitives) {
  const clean = [];
  for (const p of primitives) {
    if (p.type === "line") {
      const x1 = p.x1 || 0;
      const y1 = p.y1 || 0;
      const x2 = p.x2 !== undefined ? p.x2 : x1; 
      const y2 = p.y2 !== undefined ? p.y2 : y1;
      if (x1 !== x2 || y1 !== y2) {
        clean.push({ ...p, x1, y1, x2, y2 });
      }
    } 
    else if (p.type === "rect") {
      const w = p.w !== undefined ? p.w : 10;
      const h = p.h !== undefined ? p.h : (p.y2 ? p.y2 - (p.y || 0) : 10);
      if (w > 0 && h > 0) {
        clean.push({ ...p, w, h, x: p.x || 0, y: p.y || 0 });
      }
    }
    else if (p.type === "circle") {
      if (p.r > 0) clean.push(p);
    }
    else {
      clean.push(p);
    }
  }
  return clean;
}

export async function recognizeImage(apiKey, base64, mimeType) {
  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: base64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      thinkingConfig: { thinkingBudget: 1024 }
    }
  };

  let lastError;
  for (const model of MODEL_CHAIN) {
    try {
      const res = await fetch(`${API}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Пустой ответ от модели");
        return JSON.parse(text);
      }
      if (res.status === 429 || res.status === 404) { lastError = `HTTP ${res.status}`; continue; }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    } catch (e) { lastError = e.message || String(e); }
  }
  throw new Error("Все модели недоступны: " + lastError);
}

// Конвертация изображения в base64 (без префикса)
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}