// js/app.js — точка входа, меню, экраны
import { state, renderSheet, addPrimitive, PAPERS } from "./core.js";
import { buildToolbarHtml, bindToolbar } from "./toolbar.js";
import "./stamp.js";
import { loadStamp } from "./stamp.js";
loadStamp();   // загружаем сохранённый штамп или ГОСТ по умолчанию

// Регистрируем Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

/* ------- Утилиты экранов ------- */
function hideMenu() { document.getElementById("menu").classList.add("hidden"); }

function showToolbarAndSheet() {
  document.getElementById("app").innerHTML = buildToolbarHtml();
  bindToolbar();
  renderSheet(state.paper);
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
      <input id="keyInput" type="password" placeholder="AIza...">
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
    if (!k) {
      document.getElementById("keyStatus").textContent = "Ключ пустой";
      return;
    }
    localStorage.setItem("geminiKey", k);
    document.getElementById("keyStatus").textContent = "Проверка...";
    const { checkModel } = await import("./ai-parser.js");
    const ok = await checkModel(k, "gemini-3.8-flash");
    document.getElementById("keyStatus").textContent = ok
      ? "✅ Ключ работает, модель gemini-3.8-flash доступна"
      : "❌ Ключ не прошёл проверку (или модель недоступна)";
    document.getElementById("keyStatus").style.color = ok ? "#080" : "#c00";
  };
};

document.querySelector('[data-view="ai"]').onclick = async () => {
  hideMenu();
  const { recognizeImage, fileToBase64 } = await import("./ai-parser.js");

  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="screen">
      <h2>📷 Распознать деталь</h2>
      <p style="font-size:13px;color:#666">
        Сфотографируйте деталь на белом фоне, ровно сверху. Чем чётче контур — тем лучше.
      </p>
      <input type="file" id="aiFile" accept="image/*" capture="environment"
             style="padding:10px;border:1px solid #cbd5e0;border-radius:6px;width:100%">
      <div id="aiResult" style="margin-top:12px"></div>
      <button id="aiBuild" class="primary" style="display:none;margin-top:12px">
        Построить чертёж
      </button>
    </div>`;

  let parsed = null;

  document.getElementById("aiFile").onchange = async e => {
    const key = localStorage.getItem("geminiKey");
    const box = document.getElementById("aiResult");
    if (!key) { box.innerHTML = '<p style="color:#c00">Сначала введите ключ в Настройках</p>'; return; }
    const file = e.target.files[0];
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
  };

  document.getElementById("aiBuild").onclick = async () => {
    if (!parsed) return;
    state.primitives = [];
    parsed.primitives.forEach(p => addPrimitive({ ...p }));
    const m = await import("./toolbar.js");
    document.getElementById("app").innerHTML = m.buildToolbarHtml();
    m.bindToolbar();
    renderSheet(state.paper);
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
    // Перерисовать лист и вернуть кнопки
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
  const { renderStampEditor } = await import("./stamp-editor.js"); renderStampEditor(document.getElementById("app"), () => {
    showToolbarAndSheet();
  });
};

/* ------- Стартовая инициализация ------- */
showToolbarAndSheet();
