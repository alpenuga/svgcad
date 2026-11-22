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
2. Ты можешь использовать прямоугольники ("rect") или линии ("line").
3. Если используешь "rect", ОБЯЗАТЕЛЬНО указывай: x, y, w (ширина), h (высота).
4. Если используешь "line", ОБЯЗАТЕЛЬНО указывай ВСЕ ЧЕТЫРЕ координаты: x1, y1, x2, y2. 
   НИКОГДА не пропускай x2 или y2!
5. Для отверстий используй "circle" (cx, cy, r).
6. Не добавляй размерные линии, только контур (outline).`;

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

// --- ФУНКЦИЯ ОЧИСТКИ (Строгая) ---
export function sanitizeAIPrimitives(primitives) {
  const clean = [];
  for (const p of primitives) {
    if (p.type === "line") {
      // Если ИИ забыл хотя бы одну координату — выкидываем эту линию
      if (p.x1 !== undefined && p.y1 !== undefined && p.x2 !== undefined && p.y2 !== undefined) {
        if (p.x1 !== p.x2 || p.y1 !== p.y2) {
          clean.push(p);
        }
      }
    } 
    else if (p.type === "rect") {
      // Если прямоугольник без ширины или высоты — пропускаем
      if (p.w > 0 && p.h > 0) {
        clean.push(p);
      }
    }
    else if (p.type === "circle") {
      if (p.r > 0) clean.push(p);
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
