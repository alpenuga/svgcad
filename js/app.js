// js/app.js — точка входа, меню, экраны
import { state, renderSheet, addPrimitive, PAPERS, FRAME } from "./core.js";
import { buildToolbarHtml, bindToolbar } from "./toolbar.js";
import "./stamp.js";
import { loadStamp } from "./stamp.js";
import { initInteractivity } from "./interact.js";

loadStamp();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

/* ------- Утилиты экранов ------- */
function hideMenu() { document.getElementById("menu").classList.add("hidden"); }

function showToolbarAndSheet() {
  document.getElementById("app").innerHTML = buildToolbarHtml();
  bindToolbar();
  renderSheet(state.paper);
  initInteractivity();
}

/* ------- Обработчики меню ------- */
document.getElementById("menuBtn").onclick = () => {
  document.getElementById("menu").classList.toggle("hidden");
};
document.getElementById("helpBtn").onclick = () => {
  document.querySelector('[data-view="tutorial"]').click();
};

document.querySelector('[data-view="draw"]').onclick = () => {
  hideMenu();
  showToolbarAndSheet();
};

document.querySelector('[data-view="tutorial"]').onclick = async () => {
  hideMenu();
  const m = await import("./tutorial.js");
  m.renderTutorial();
};

document.querySelector('[data-view="settings"]').onclick = async () => {
  hideMenu();
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="screen">
      <h2>⚙️ Настройки</h2>
      <p style="font-size:13px;color:#666">
        Ключ хранится в localStorage этого устройства. Никуда не передаётся,
        кроме Google при распознавании.
      </p>
      <label style="display:block;margin:12px 0 4px">Gemini API Key:</label>
      <input id="keyInput" type="password" placeholder="AIza... или AQ...">
      <button id="saveKey" class="primary" style="margin-top:12px">Сохранить и проверить</button>
      <p id="keyStatus" style="color:#666;font-size:13px;margin-top:8px"></p>
      <p style="font-size:12px;color:#999;margin-top:24px">
        Ключ можно получить на
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
        aistudio.google.com/apikey</a>.
      </p>
    </div>`;
  document.getElementById("keyInput").value = localStorage.getItem("geminiKey") || "";
  
  document.getElementById("saveKey").onclick = async () => {
    const k = document.getElementById("keyInput").value.trim();
    if (!k) return;
    localStorage.setItem("geminiKey", k);
    
    const status = document.getElementById("keyStatus");
    status.textContent = "Проверка...";
    status.style.color = "#666";
    
    const { checkModel } = await import("./ai-parser.js");
    const result = await checkModel(k);
    
    if (result.ok) {
      status.textContent = "✅ Ключ работает, модель доступна";
      status.style.color = "#080";
    } else {
      status.textContent = "❌ Ошибка: " + result.error;
      status.style.color = "#c00";
    }
  };
};

document.querySelector('[data-view="ai"]').onclick = async () => {
  hideMenu();
  const { recognizeImage, fileToBase64, sanitizeAIPrimitives } = await import("./ai-parser.js");

  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="screen">
      <h2>📷 Распознать деталь</h2>
      <p style="font-size:13px;color:#666">
        Сфотографируйте деталь на белом фоне или выберите готовое фото/скриншот из галереи.
      </p>
      
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <label class="primary" style="flex:1;padding:12px;border-radius:8px;background:#0b6cbf;color:#fff;text-align:center;font-weight:bold;cursor:pointer">
          📸 Сделать фото
          <input type="file" id="aiFileCamera" accept="image/*" capture="environment" style="display:none">
        </label>

        <label style="flex:1;padding:12px;border-radius:8px;background:#f7fafc;border:1px solid #cbd5e0;text-align:center;font-weight:bold;cursor:pointer;color:#0b6cbf">
          🖼️ Из галереи
          <input type="file" id="aiFileGallery" accept="image/*" style="display:none">
        </label>
      </div>

      <div id="aiResult" style="margin-top:12px"></div>
      <button id="aiBuild" class="primary" style="display:none;margin-top:12px">
        Построить чертёж
      </button>
    </div>`;

  let parsed = null;

  async function handleFile(file) {
    const key = localStorage.getItem("geminiKey");
    const box = document.getElementById("aiResult");
    
    if (!key) { 
      box.innerHTML = '<p style="color:#c00">Сначала введите ключ в Настройках</p>'; 
      return; 
    }
    if (!file) return;

    box.textContent = "🤖 Распознаю...";
    try {
      const b64 = await fileToBase64(file);
      parsed = await recognizeImage(key, b64, file.type);
      
      box.innerHTML = `
        <p><b>${parsed.partName}</b> — ${parsed.overall.width}×${parsed.overall.height} мм</p>
        <p style="font-size:12px;color:#666">Уверенность: ${(parsed.confidence*100).toFixed(0)}%
        ${parsed.notes ? '<br>Заметки: '+parsed.notes : ''}</p>
        <pre>${JSON.stringify(parsed.primitives, null, 2)}</pre>`;
      
      document.getElementById("aiBuild").style.display = "block";
    } catch (err) {
      box.innerHTML = `<p style="color:#c00">Ошибка: ${err.message}</p>`;
    }
  }

  document.getElementById("aiFileCamera").onchange = (e) => handleFile(e.target.files[0]);
  document.getElementById("aiFileGallery").onchange = (e) => handleFile(e.target.files[0]);

  document.getElementById("aiBuild").onclick = async () => {
    if (!parsed) return;
    const cleanPrimitives = sanitizeAIPrimitives(parsed.primitives);
    
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="screen">
        <h2>🔍 Проверьте данные</h2>
        <p style="font-size:13px;color:#666">ИИ распознал эти параметры. Вы можете их изменить перед построением.</p>
        <div id="editForm" style="margin-top:16px"></div>
        <button id="confirmBuild" class="primary" style="margin-top:20px;width:100%;padding:12px">✅ Построить</button>
        <button id="cancelBuild" style="margin-top:8px;width:100%;padding:12px;background:#eee;color:#333">Отмена</button>
      </div>`;

    const form = document.getElementById("editForm");

    cleanPrimitives.forEach((p, index) => {
      const div = document.createElement("div");
      div.style.cssText = "padding:10px; border:1px solid #ddd; margin-bottom:10px; border-radius:8px; background:#fff";
      
      let inputs = "";
      if (p.type === "rect") {
        inputs = `
          <label>X: <input type="number" data-idx="${index}" data-key="x" value="${p.x}"></label>
          <label>Y: <input type="number" data-idx="${index}" data-key="y" value="${p.y}"></label>
          <label>Ширина: <input type="number" data-idx="${index}" data-key="w" value="${p.w}"></label>
          <label>Высота: <input type="number" data-idx="${index}" data-key="h" value="${p.h}"></label>
        `;
      } else if (p.type === "circle") {
        inputs = `
          <label>X центра: <input type="number" data-idx="${index}" data-key="cx" value="${p.cx}"></label>
          <label>Y центра: <input type="number" data-idx="${index}" data-key="cy" value="${p.cy}"></label>
          <label>Радиус: <input type="number" data-idx="${index}" data-key="r" value="${p.r}"></label>
        `;
      } else if (p.type === "line") {
        inputs = `
          <label>X1: <input type="number" data-idx="${index}" data-key="x1" value="${p.x1}"></label>
          <label>Y1: <input type="number" data-idx="${index}" data-key="y1" value="${p.y1}"></label>
          <label>X2: <input type="number" data-idx="${index}" data-key="x2" value="${p.x2}"></label>
          <label>Y2: <input type="number" data-idx="${index}" data-key="y2" value="${p.y2}"></label>
        `;
      } else if (p.type === "polygon") {
         inputs = "";
         p.points.forEach((pt, ptIdx) => {
           inputs += `
             <div style="width:100%; margin-top:8px; font-size:12px; font-weight:bold; color:#555;">Точка ${ptIdx + 1}:</div>
             <label>X: <input type="number" data-idx="${index}" data-pt="${ptIdx}" data-axis="0" value="${pt[0]}"></label>
             <label>Y: <input type="number" data-idx="${index}" data-pt="${ptIdx}" data-axis="1" value="${pt[1]}"></label>
           `;
         });
      }

      div.innerHTML = `<b>${index + 1}. ${p.type} (${p.role})</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${inputs}</div>`;
      form.appendChild(div);
    });

    document.getElementById("confirmBuild").onclick = () => {
            form.querySelectorAll("input").forEach(inp => {
        const idx = +inp.dataset.idx;
        const key = inp.dataset.key;
        const ptIdx = inp.dataset.pt;
        const axis = inp.dataset.axis;

        if (ptIdx !== undefined) {
          // Обновляем координаты полигона
          cleanPrimitives[idx].points[ptIdx][+axis] = parseFloat(inp.value) || 0;
        } else if (key) {
          // Обновляем координаты прямоугольников, кругов и линий
          cleanPrimitives[idx][key] = parseFloat(inp.value) || 0;
        }
      });

      const overall = parsed.overall || { width: 100, height: 100 };
      const page = PAPERS[state.paper];
      const drawW = page.w - FRAME.left - FRAME.right;
      const drawH = page.h - FRAME.top - FRAME.bottom;
      const offsetX = FRAME.left + drawW / 2 - overall.width / 2;
      const offsetY = FRAME.top + drawH / 2 + overall.height / 2;

      state.primitives = [];
      cleanPrimitives.sort((a, b) => (a.type === "rect" || a.type === "polygon" ? -1 : 1));
      
      cleanPrimitives.forEach(p => {
        const np = { ...p };
        if (np.type === "rect") {
          np.x += offsetX;
          np.y = offsetY - np.y - np.h;
          np.fill = "#fff";
        } else if (np.type === "polygon") {
          np.points = np.points.map(pt => [pt[0] + offsetX, offsetY - pt[1]]);
          np.fill = "#fff";
        } else if (np.type === "circle") {
          np.cx += offsetX;
          np.cy = offsetY - np.cy;
        } else if (np.type === "line") {
          np.x1 += offsetX; np.y1 = offsetY - np.y1;
          np.x2 += offsetX; np.y2 = offsetY - np.y2;
        }
        state.primitives.push(np);
      });
      
      showToolbarAndSheet();
    };

    document.getElementById("cancelBuild").onclick = () => {
      state.primitives = [];
      showToolbarAndSheet();
    };
  };
};

document.querySelector('[data-view="views"]').onclick = async () => {
  hideMenu();
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="screen">
      <h2>📐 Виды и разрезы</h2>
      <p style="font-size:13px;color:#666">
        Сначала постройте деталь в разделе «Чертёж».
      </p>
      <button id="btn3v">Три основных вида</button>
      <button id="btnSection">Разрез</button>
      <button id="btnCut">Сечение</button>
      <button id="btnBack" style="background:#eee">← Назад к листу</button>
    </div>`;

  document.getElementById("btn3v").onclick = async () => {
    const m = await import("./projections.js");
    m.buildThreeViews();
    showToolbarAndSheet();
  };
  document.getElementById("btnSection").onclick = async () => {
    const m = await import("./projections.js");
    m.buildSection();
    showToolbarAndSheet();
  };
  document.getElementById("btnCut").onclick = async () => {
    const m = await import("./projections.js");
    m.buildCutaway();
    showToolbarAndSheet();
  };
  document.getElementById("btnBack").onclick = () => {
    showToolbarAndSheet();
  };
};

document.querySelector('[data-view="library"]').onclick = async () => {
  hideMenu();
  const { listParts, savePart, deletePart, loadPart } = await import("./library.js");

  function render() {
    const lib = listParts();
    document.getElementById("app").innerHTML = `
      <div class="screen">
        <h2>📚 Библиотека</h2>
        <button id="saveCurrent" class="primary">💾 Сохранить текущий чертёж</button>
        <ul style="margin-top:12px">
          ${lib.map(p => `
            <li>
              <span>${p.name}</span>
              <button data-load="${p.id}">Загрузить</button>
              <button data-del="${p.id}">🗑</button>
            </li>`).join("") || "<li style='color:#999'>Пусто</li>"}
        </ul>
        <button id="libBack" style="background:#eee;margin-top:16px">← Назад к листу</button>
      </div>`;

    document.getElementById("saveCurrent").onclick = () => {
      const name = prompt("Название детали");
      if (name) { savePart(name, state.primitives); render(); }
    };
    document.querySelectorAll("[data-load]").forEach(b => b.onclick = () => {
      const item = loadPart(+b.dataset.load);
      if (!item) return;
      state.primitives = JSON.parse(JSON.stringify(item.primitives));
      showToolbarAndSheet();
    });
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      deletePart(+b.dataset.del);
      render();
    });
    document.getElementById("libBack").onclick = () => showToolbarAndSheet();
  }
  render();
};

document.querySelector('[data-view="stampSettings"]').onclick = async () => {
  hideMenu();
  const { renderStampEditor } = await import("./stamp-editor.js");

  renderStampEditor(document.getElementById("app"), () => {
    showToolbarAndSheet();
  });
};

/* ------- Стартовая инициализация ------- */
showToolbarAndSheet();