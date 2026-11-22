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

const PROMPT = `Ты — инженер-конструктор. На изображении — деталь или её чертёж.
Верни ТОЛЬКО JSON по схеме. Никаких пояснений вне JSON.

Правила:
1. Размеры в миллиметрах. Есть размерные линии — используй их.
   Нет размеров — оцени пропорционально, приняв ширину детали за 100 мм.
2. Начало координат (0,0) — левый нижний угол детали, Y растёт вверх.
3. primitives: контур детали (outline), отверстия (hole),
   пазы (slot), радиусы скруглений (fillet), фаски (chamfer).
4. Если что-то не видно — не выдумывай, добавь в notes.
5. confidence: 0.9+ — чёткий чертёж; 0.6–0.9 — фото с тенями; <0.6 — плохо.`;

const SCHEMA = {
  type: "object",
  properties: {
    partName: { type: "string" },
    overall: {
      type: "object",
      properties: {
        width:  { type: "number" },
        height: { type: "number" }
      },
      required: ["width", "height"]
    },
    primitives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["line", "circle", "rect", "arc"] },
          role: { type: "string", enum: ["outline", "hole", "slot", "fillet", "chamfer", "other"] },
          x1: { type: "number" }, y1: { type: "number" },
          x2: { type: "number" }, y2: { type: "number" },
          cx: { type: "number" }, cy: { type: "number" }, r: { type: "number" },
          x:  { type: "number" }, y:  { type: "number" },
          w:  { type: "number" }, h:  { type: "number" },
          startAngle: { type: "number" }, endAngle: { type: "number" }
        },
        required: ["type", "role"]
      }
    },
    confidence: { type: "number" },
    notes: { type: "string" }
  },
  required: ["partName", "overall", "primitives", "confidence"]
};

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

// конвертация изображения в base64 (без префикса data:image/...,)
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// поворот Y — если ИИ отдаёт координаты с началом в левом ВЕРХНЕМ углу
// (в промпте указано «Y растёт вверх», но модель иногда путает).
// Вспомогательная нормализация:
export function normalizeAiResult(parsed, pageH = null) {
  // Не трогаем — пусть пользователь видит как есть.
  return parsed;
}