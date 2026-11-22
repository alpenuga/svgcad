// js/stamp-editor.js — визуальный редактор штампа
import { state } from "./core.js";
import { saveStamp, defaultGostTemplate, defaultSchoolTemplate } from "./stamp.js";

export function renderStampEditor(container, onDone) {
  container.innerHTML = `
    <div class="screen">
      <h2>🏛️ Редактор штампа</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <button id="tplGost">Шаблон ГОСТ</button>
        <button id="tplSchool">Школьный</button>
        <button id="tplClear">Очистить текст</button>
      </div>
      <div style="margin-bottom:10px">
        <label>Ширина (мм): </label>
        <input id="stWidth" type="text" value="${state.stamp.width}"
               style="width:70px;padding:6px;border:1px solid #ccc;border-radius:4px">
      </div>
      <p style="font-size:12px;color:#666;margin-bottom:8px">
        Клик — выделить ячейку. Двойной клик — редактировать текст, шрифт, выравнивание.
      </p>
      <div id="gridContainer" style="overflow:auto;margin-bottom:12px;border:1px solid #eee"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <button data-op="merge">Объединить</button>
        <button data-op="split">Разъединить</button>
        <button data-op="addRow">+ Строка</button>
        <button data-op="delRow">− Строка</button>
        <button data-op="addCol">+ Столбец</button>
        <button data-op="delCol">− Столбец</button>
      </div>
      <button id="stSave" class="primary" style="width:100%;padding:12px">Готово</button>
    </div>`;

  let selected = new Set();

  function getCellAt(r, c) {
    return state.stamp.grid.cells.find(cell =>
      r >= cell.r && r < cell.r + (cell.rs || 1) &&
      c >= cell.c && c < cell.c + (cell.cs || 1)
    );
  }
  function findCellByKey(key) {
    const [r, c] = key.split(",").map(Number);
    return state.stamp.grid.cells.find(cell => cell.r === r && cell.c === c);
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function buildGridHtml() {
    const grid = state.stamp.grid;
    const rows = grid.rows.length;
    const cols = grid.cols.length;
    const map = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const cell of grid.cells) {
      for (let r = cell.r; r < cell.r + (cell.rs || 1); r++) {
        for (let c = cell.c; c < cell.c + (cell.cs || 1); c++) {
          if (r < rows && c < cols) map[r][c] = cell;
        }
      }
    }
    let html = '<table style="border-collapse:collapse;table-layout:fixed;width:100%;">';
    html += '<colgroup>';
    const totalW = grid.cols.reduce((a,b)=>a+b,0) || 1;
    for (let c = 0; c < cols; c++) {
      html += `<col style="width:${grid.cols[c] / totalW * 100}%">`;
    }
    html += '</colgroup>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const cell = map[r][c];
        if (!cell) { html += '<td></td>'; continue; }
        if (cell.r !== r || cell.c !== c) continue;
        const key = `${cell.r},${cell.c}`;
        const isSel = selected.has(key);
        const bg = isSel ? "#ffe0b2" : "#fff";
        html += `<td rowspan="${cell.rs||1}" colspan="${cell.cs||1}" data-key="${key}"
          style="border:1px solid #333;padding:2px;background:${bg};cursor:pointer;
                 font-size:${Math.min((cell.fontSize||2.5)*3, 16)}px;
                 text-align:${cell.align||'left'};
                 font-weight:${cell.bold?'bold':'normal'};
                 vertical-align:middle;height:26px;overflow:hidden;">
          <div style="pointer-events:none">${escapeHtml(cell.text||'')}</div>
        </td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  }

  function rerender() {
    const cont = document.getElementById("gridContainer");
    cont.innerHTML = buildGridHtml();
    cont.querySelectorAll("td[data-key]").forEach(td => {
      td.onclick = (e) => {
        e.stopPropagation();
        const key = td.dataset.key;
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        rerender();
      };
      td.ondblclick = (e) => {
        e.stopPropagation();
        const cell = findCellByKey(td.dataset.key);
        if (!cell) return;
        const text = prompt("Текст ячейки:", cell.text || "");
        if (text !== null) cell.text = text;
        const fsStr = prompt("Размер шрифта (мм):", cell.fontSize || 2.5);
        if (fsStr !== null && !isNaN(parseFloat(fsStr))) cell.fontSize = parseFloat(fsStr);
        const align = prompt("Выравнивание (left / center / right):", cell.align || "center");
        if (align && ["left","center","right"].includes(align)) cell.align = align;
        cell.bold = confirm("Жирный шрифт?");
        rerender();
      };
    });
  }

  document.querySelectorAll("[data-op]").forEach(btn => {
    btn.onclick = () => {
      const op = btn.dataset.op;
      const grid = state.stamp.grid;
      if (op === "merge") {
        if (selected.size < 2) { alert("Выделите хотя бы 2 ячейки"); return; }
        let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
        for (const key of selected) {
          const [r, c] = key.split(",").map(Number);
          const cell = findCellByKey(key);
          if (!cell) continue;
          minR = Math.min(minR, r);
          minC = Math.min(minC, c);
          maxR = Math.max(maxR, r + (cell.rs||1) - 1);
          maxC = Math.max(maxC, c + (cell.cs||1) - 1);
        }
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const cell = getCellAt(r, c);
            if (cell && !selected.has(`${cell.r},${cell.c}`)) {
              alert("Выделение не прямоугольное"); return;
            }
          }
        }
        const firstCell = findCellByKey([...selected][0]);
        const newCell = {
          r: minR, c: minC,
          rs: maxR - minR + 1,
          cs: maxC - minC + 1,
          text: firstCell ? firstCell.text : "",
          fontSize: firstCell ? firstCell.fontSize : 2.5,
          align: firstCell ? firstCell.align : "center",
          bold: firstCell ? firstCell.bold : false
        };
        grid.cells = grid.cells.filter(cell => !selected.has(`${cell.r},${cell.c}`));
        grid.cells.push(newCell);
        selected.clear();
        rerender();
      } else if (op === "split") {
        for (const key of selected) {
          const cell = findCellByKey(key);
          if (!cell || ((cell.rs||1) <= 1 && (cell.cs||1) <= 1)) continue;
          grid.cells = grid.cells.filter(c => c !== cell);
          for (let r = cell.r; r < cell.r + (cell.rs||1); r++) {
            for (let c = cell.c; c < cell.c + (cell.cs||1); c++) {
              grid.cells.push({
                r, c, rs: 1, cs: 1,
                text: (r === cell.r && c === cell.c) ? cell.text : "",
                fontSize: cell.fontSize || 2.5,
                align: cell.align || "center",
                bold: cell.bold || false
              });
            }
          }
        }
        selected.clear();
        rerender();
      } else if (op === "addRow") {
        const lastH = grid.rows[grid.rows.length - 1] || 11;
        grid.rows.push(lastH);
        const newR = grid.rows.length - 1;
        for (let c = 0; c < grid.cols.length; c++) {
          grid.cells.push({ r: newR, c, rs: 1, cs: 1, text: "", fontSize: 2.5, align: "center", bold: false });
        }
        rerender();
      } else if (op === "delRow") {
        if (grid.rows.length <= 1) return;
        if (!confirm("Удалить последнюю строку?")) return;
        const lastR = grid.rows.length - 1;
        grid.rows.pop();
        grid.cells = grid.cells.filter(cell => {
          if (cell.r >= lastR) return false;
          if (cell.r + (cell.rs||1) > lastR) cell.rs = lastR - cell.r;
          return true;
        });
        rerender();
      } else if (op === "addCol") {
        const lastW = grid.cols[grid.cols.length - 1] || 10;
        grid.cols.push(lastW);
        const newC = grid.cols.length - 1;
        for (let r = 0; r < grid.rows.length; r++) {
          grid.cells.push({ r, c: newC, rs: 1, cs: 1, text: "", fontSize: 2.5, align: "center", bold: false });
        }
        rerender();
      } else if (op === "delCol") {
        if (grid.cols.length <= 1) return;
        if (!confirm("Удалить последний столбец?")) return;
        const lastC = grid.cols.length - 1;
        grid.cols.pop();
        grid.cells = grid.cells.filter(cell => {
          if (cell.c >= lastC) return false;
          if (cell.c + (cell.cs||1) > lastC) cell.cs = lastC - cell.c;
          return true;
        });
        rerender();
      }
    };
  });

  document.getElementById("tplGost").onclick = () => {
    state.stamp.grid = defaultGostTemplate(state.stamp.width, 55);
    selected.clear();
    rerender();
  };
  document.getElementById("tplSchool").onclick = () => {
  state.stamp.width = 145;  // Задаем точную ширину
  state.stamp.height = 30;  // Задаем точную высоту
  document.getElementById("stWidth").value = 145; // Обновляем поле ввода
  state.stamp.grid = defaultSchoolTemplate(145, 30);
  selected.clear();
  rerender();
};
  document.getElementById("tplClear").onclick = () => {
    if (!confirm("Очистить текст всех ячеек?")) return;
    state.stamp.grid.cells.forEach(cell => cell.text = "");
    rerender();
  };

  document.getElementById("stWidth").onchange = (e) => {
    const w = parseFloat(e.target.value);
    if (w > 20 && w < 300) {
      state.stamp.width = w;
      saveStamp();
    }
  };
  document.getElementById("stSave").onclick = () => {
    saveStamp();
    onDone();
  };

  if (!state.stamp.grid) state.stamp.grid = defaultGostTemplate(state.stamp.width, 55);
  rerender();
}