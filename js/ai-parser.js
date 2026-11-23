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
Твоя задача — построить её ГЛАВНЫЙ ВИД (вид спереди) в 2D.
Верни ТОЛЬКО JSON по схеме. Никаких пояснений.

ПРАВИЛА:
1. Размеры в миллиметрах. (0,0) — левый нижний угол. Ось Y идет ВВЕРХ.
2. ГЛАВНЫЙ КОНТУР детали опиши как ОДИН полигон ("polygon").
   Для этого перечисли все углы детали по порядку (по или против часовой стрелки).
   Формат: "points": [[x1, y1], [x2, y2], ...]
3. Отверстия опиши как "circle" (cx, cy, r).
4. НЕ ИСПОЛЬЗУЙ прямоугольники ("rect") и линии ("line"). Только polygon и circle!

ПРИМЕР ступенчатой детали 60x40 (основание 20, два выступа шириной 20 и 10):
{
  "partName": "Ступенчатая деталь",
  "overall": { "width": 60, "height": 40 },
  "primitives": [
    {
      "type": "polygon",
      "role": "outline",
      "points": [[0,0], [0,20], [20,20], [20,40], [30,40], [30,20], [50,20], [50,40], [60,40], [60,0]]
    }
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
          type: { type: "string", enum: ["polygon", "circle"] },
          role: { type: "string", enum: ["outline", "hole"] },
          points: { 
            type: "array", 
            items: { 
              type: "array", 
              items: { type: "number" } 
            } 
          },
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

// Упрощенная функция очистки для нового формата
export function sanitizeAIPrimitives(primitives) {
  const clean = [];
  for (const p of primitives) {
    if (p.type === "polygon" && p.points && p.points.length > 2) {
      clean.push(p);
    } 
    else if (p.type === "circle" && p.r > 0) {
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