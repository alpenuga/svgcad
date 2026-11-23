// js/ai-parser.js — распознавание чертежей через Gemini
const MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export async function checkModel(apiKey, modelId = "gemini-3.8-flash") {
  try {
    const res = await fetch(`${API}/${modelId}:generateContent`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { 
          maxOutputTokens: 1,
          thinkingConfig: { thinkingBudget: 0 } // Мгновенная проверка
        }
      })
    });
    
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: "Сеть: " + e.message };
  }
}

const PROMPT = `Ты — инженер-конструктор. На изображении — 3D-деталь (изометрия).
Твоя задача — разбить её на простые 2D прямоугольники (вид спереди).
Верни ТОЛЬКО JSON по схеме. Никаких пояснений.

ПРАВИЛА:
1. Размеры в миллиметрах. (0,0) — левый нижний угол.
2. СТРОГОЕ ПРАВИЛО: Используй ИСКЛЮЧИТЕЛЬНО прямоугольники ("rect")!
   Не используй линии ("line") для контуров. 
3. Для каждого прямоугольника указывай: x, y, w (ширина), h (высота).
4. Для отверстий используй "circle" (cx, cy, r).

ПРИМЕР: Если деталь 60x40 имеет основание высотой 20 и два выступа шириной 20 и 10.
Твой ответ:
{
  "partName": "Ступенчатая деталь",
  "overall": { "width": 60, "height": 40 },
  "primitives": [
    { "type": "rect", "role": "outline", "x": 0, "y": 0, "w": 60, "h": 20 },
    { "type": "rect", "role": "outline", "x": 0, "y": 20, "w": 20, "h": 20 },
    { "type": "rect", "role": "outline", "x": 40, "y": 20, "w": 10, "h": 20 }
  ],
  "confidence": 0.9,
  "notes": ""
}`;

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
          type: { type: "string", enum: ["rect", "circle"] }, // Убрали line!
          role: { type: "string", enum: ["outline", "hole"] },
          x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
          cx: { type: "number" }, cy: { type: "number" }, r: { type: "number" }
        },
        required: ["type", "role", "x", "y", "w", "h"] // Заставили ИИ ВСЕГДА писать координаты
      }
    },
    confidence: { type: "number" },
    notes: { type: "string" }
  },
  required: ["partName", "overall", "primitives", "confidence"]
};

// --- УМНАЯ ФУНКЦИЯ ОЧИСТКИ ---
export function sanitizeAIPrimitives(primitives) {
  const clean = [];
  for (const p of primitives) {
    if (p.type === "line") {
      // Если ИИ забыл x2 (вертикальная линия), ставим x2 = x1
      // Если забыл y2 (горизонтальная линия), ставим y2 = y1
      const x1 = p.x1 !== undefined ? p.x1 : 0;
      const y1 = p.y1 !== undefined ? p.y1 : 0;
      const x2 = p.x2 !== undefined ? p.x2 : x1;
      const y2 = p.y2 !== undefined ? p.y2 : y1;

      // Рисуем только если линия не нулевой длины
      if (x1 !== x2 || y1 !== y2) {
        clean.push({ ...p, x1, y1, x2, y2 });
      }
    } 
    else if (p.type === "rect") {
      // Защита от пустых прямоугольников
      const w = p.w !== undefined ? p.w : 10;
      const h = p.h !== undefined ? p.h : (p.y2 ? p.y2 - (p.y || 0) : 10);
      if (w > 0 && h > 0) {
        clean.push({ ...p, w, h, x: p.x || 0, y: p.y || 0 });
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
      responseSchema: SCHEMA
      // Мы убрали thinkingConfig, чтобы ИИ не "зависал" над переводом 3D в 2D
    }
  };

  let lastError;
  for (const model of MODEL_CHAIN) {
    try {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
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

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}