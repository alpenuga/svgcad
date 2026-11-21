// Глобальное состояние приложения
let state = {
    format: 'A4',
    orient: 'portrait',
    stamp: {
        type: 'full',
        width: 185,
        extraRows: 2,
        title: 'Втулка направляющая',
        code: 'АБВГ.711141.001',
        mat: 'Сталь 45 ГОСТ 1050',
        scale: '1:1',
        dev: 'Иванов',
        chk: 'Петров',
        org: 'Кафедра Инженерии'
    },
    part: {
        type: 'bushing',
        viewMode: 'cut',
        L: 70, D: 50, d: 24, s: 36
    },
    primitives: [] // Пользовательские и ИИ примитивы
};

// База стандартных деталей по умолчанию
const defaultLibrary = {
    "Втулка ГОСТ (Разрез)": { part: { type: 'bushing', viewMode: 'cut', L: 70, D: 50, d: 24, s: 36 }, title: "Втулка направляющая", primitives: [] },
    "Плита опорная (3 вида)": { part: { type: 'plate', viewMode: '3views', L: 80, D: 60, d: 20, s: 15 }, title: "Плита опорная", primitives: [] },
    "Вал приводной (Сечение)": { part: { type: 'shaft', viewMode: 'section', L: 90, D: 40, d: 12, s: 28 }, title: "Вал приводной", primitives: [] }
};

let library = JSON.parse(localStorage.getItem('cad_lib')) || defaultLibrary;

// Инициализация при запуске
window.onload = () => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) document.getElementById('gemini-key').value = savedKey;
    updateLibUI();
    generatePart();
};

// Переключение вкладок меню
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Обновление настроек штампа и листа
function updateStampSettings() {
    state.format = document.getElementById('paper-format').value;
    state.orient = document.getElementById('paper-orient').value;
    state.stamp.type = document.getElementById('stamp-type').value;
    state.stamp.width = parseFloat(document.getElementById('stamp-width').value);
    state.stamp.extraRows = parseInt(document.getElementById('stamp-rows').value);
    
    document.getElementById('stamp-w-val').innerText = state.stamp.width;
    document.getElementById('stamp-r-val').innerText = state.stamp.extraRows;

    state.stamp.title = document.getElementById('st-title').value;
    state.stamp.code = document.getElementById('st-code').value;
    state.stamp.mat = document.getElementById('st-mat').value;
    state.stamp.scale = document.getElementById('st-scale').value;
    state.stamp.dev = document.getElementById('st-dev').value;
    state.stamp.chk = document.getElementById('st-chk').value;
    state.stamp.org = document.getElementById('st-org').value;

    renderSVG();
}

// ГЛАВНЫЙ РЕНДЕР ЧЕРТЕЖА В SVG (Масштаб 1 ед = 1 мм)
function renderSVG() {
    // Определение габаритов листа в мм
    let W = state.format === 'A4' ? 210 : 297;
    let H = state.format === 'A4' ? 297 : 420;
    if (state.orient === 'landscape') { [W, H] = [H, W]; }

    // Отступы рамки по ГОСТ (слева 20мм для подшивки, остальные по 5мм)
    const mLeft = 20, mTop = 5, mRight = 5, mBottom = 5;
    const frameW = W - mLeft - mRight;
    const frameH = H - mTop - mBottom;

    // Проверка, чтобы штамп не пробил левую рамку
    let actualStampW = Math.min(state.stamp.width, frameW);

    let svg = `<svg id="main-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">
    <defs>
        <!-- Паттерн штриховки ГОСТ (под 45 градусов) -->
        <pattern id="hatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#000" stroke-width="0.25" />
        </pattern>
        <!-- Стрелки для размеров -->
        <marker id="arrow-end" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3 L 0 6 z" fill="#000"/>
        </marker>
        <style>
            .main-line { stroke: #000; stroke-width: 0.7; fill: none; stroke-linecap: round; }
            .thin-line { stroke: #000; stroke-width: 0.25; fill: none; }
            .dashed-line { stroke: #000; stroke-width: 0.35; stroke-dasharray: 4,2; fill: none; }
            .axis-line { stroke: #000; stroke-width: 0.25; stroke-dasharray: 12,2,1,2; fill: none; }
            .gost-text { font-family: 'ISOCPEUR', 'Arial', sans-serif; font-style: italic; fill: #000; }
            .dim-text { font-family: 'Arial', sans-serif; font-style: italic; font-size: 3.5px; fill: #000; text-anchor: middle; }
        </style>
    </defs>

    <!-- Внешний контур листа -->
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#ccc" stroke-width="0.2"/>
    
    <!-- Основная рамка чертежа -->
    <rect x="${mLeft}" y="${mTop}" width="${frameW}" height="${frameH}" class="main-line"/>`;

    // Отрисовка рабочей зоны (детали и примитивы)
    svg += `<g id="drawing-layer">`;
    state.primitives.forEach(p => {
        svg += drawPrimitiveSVG(p);
    });
    svg += `</g>`;

    // Отрисовка штампа в правом нижнем углу
    if (state.stamp.type !== 'none') {
        const stRight = W - mRight;
        const stBottom = H - mBottom;
        const stLeft = stRight - actualStampW;
        svg += generateStampSVG(stLeft, stBottom, actualStampW);
    }

    svg += `</svg>`;
    document.getElementById('canvas-container').innerHTML = svg;
}

// Генератор адаптивного штампа
function generateStampSVG(x, bottomY, width) {
    const k = width / 185; // Коэффициент масштабирования колонок при сдвиге левого края
    const s = state.stamp;
    let out = `<g id="stamp-layer">`;

    if (s.type === 'mini') {
        const h = 15;
        const y = bottomY - h;
        out += `<rect x="${x}" y="${y}" width="${width}" height="${h}" fill="#fff" class="main-line"/>`;
        out += `<line x1="${x + 65*k}" y1="${y}" x2="${x + 65*k}" y2="${bottomY}" class="main-line"/>`;
        out += `<text x="${x + 5}" y="${y + 9}" class="gost-text" font-size="3.5">${s.code}</text>`;
        out += `<text x="${x + 70*k}" y="${y + 9}" class="gost-text" font-size="4.5">${s.title}</text>`;
        return out + `</g>`;
    }

    const baseH = s.type === 'simple' ? 30 : 55;
    const extraH = s.extraRows * 5;
    const totalH = baseH + extraH;
    const topY = bottomY - totalH;

    // Белая подложка штампа (перекрывает линии чертежа если наехали)
    out += `<rect x="${x}" y="${topY}" width="${width}" height="${totalH}" fill="#fff" class="main-line"/>`;

    // Дополнительные строки сверху (Изм. Лист №док Подп Дата)
    for (let i = 0; i < s.extraRows; i++) {
        let ry = topY + i * 5;
        out += `<line x1="${x}" y1="${ry + 5}" x2="${x + 65*k}" y2="${ry + 5}" class="thin-line"/>`;
    }

    const mainTop = topY + extraH;
    if (s.extraRows > 0) {
        out += `<line x1="${x}" y1="${mainTop}" x2="${x + width}" y2="${mainTop}" class="main-line"/>`;
    }

    // Вертикальное деление левого блока (Разраб, Пров...) - ширина 65*k
    const colLeftW = 65 * k;
    out += `<line x1="${x + colLeftW}" y1="${topY}" x2="${x + colLeftW}" y2="${bottomY}" class="main-line"/>`;
    out += `<line x1="${x + 17*k}" y1="${mainTop}" x2="${x + 17*k}" y2="${bottomY}" class="thin-line"/>`;
    out += `<line x1="${x + 40*k}" y1="${mainTop}" x2="${x + 40*k}" y2="${bottomY}" class="thin-line"/>`;
    out += `<line x1="${x + 55*k}" y1="${mainTop}" x2="${x + 55*k}" y2="${bottomY}" class="thin-line"/>`;

    // Горизонтальные строки в левом блоке
    const rowsCount = s.type === 'simple' ? 6 : 11;
    for (let i = 1; i < rowsCount; i++) {
        let ry = mainTop + i * 5;
        out += `<line x1="${x}" y1="${ry}" x2="${x + colLeftW}" y2="${ry}" class="thin-line"/>`;
    }

    // Правый блок (Шифр, Название, Материал, Масштаб)
    const rightX = x + colLeftW;
    const rightW = width - colLeftW;

    if (s.type === 'full') {
        // Шифр сверху (высота 15мм)
        out += `<line x1="${rightX}" y1="${mainTop + 15}" x2="${x + width}" y2="${mainTop + 15}" class="main-line"/>`;
        // Нижняя полоса (Материал + Организация, высота 15мм от низа)
        out += `<line x1="${rightX}" y1="${bottomY - 15}" x2="${x + width}" y2="${bottomY - 15}" class="main-line"/>`;
        // Блок Литера, Масса, Масштаб справа
        const litX = x + 135 * k;
        out += `<line x1="${litX}" y1="${mainTop + 15}" x2="${litX}" y2="${bottomY}" class="main-line"/>`;
        out += `<line x1="${litX}" y1="${mainTop + 20}" x2="${x + width}" y2="${mainTop + 20}" class="thin-line"/>`;
        out += `<line x1="${litX}" y1="${mainTop + 35}" x2="${x + width}" y2="${mainTop + 35}" class="main-line"/>`;

        // Тексты полного штампа
        out += `<text x="${rightX + rightW/2}" y="${mainTop + 10}" text-anchor="middle" class="gost-text" font-size="5">${s.code}</text>`;
        out += `<text x="${rightX + (70*k)/2}" y="${mainTop + 28}" text-anchor="middle" class="gost-text" font-size="4.5">${s.title}</text>`;
        out += `<text x="${rightX + (70*k)/2}" y="${bottomY - 6}" text-anchor="middle" class="gost-text" font-size="3.5">${s.mat}</text>`;
        out += `<text x="${litX + (50*k)/2}" y="${bottomY - 6}" text-anchor="middle" class="gost-text" font-size="3.5">${s.org}</text>`;
        out += `<text x="${litX + 5}" y="${mainTop + 19}" class="gost-text" font-size="2.5">Лит.   Масса   Масштаб</text>`;
        out += `<text x="${litX + 35*k}" y="${mainTop + 29}" class="gost-text" font-size="4">${s.scale}</text>`;

        // Подписи слева
        out += `<text x="${x + 1}" y="${mainTop + 4}" class="gost-text" font-size="2.5">Изм. Лист № докум. Подп. Дата</text>`;
        out += `<text x="${x + 1}" y="${mainTop + 9}" class="gost-text" font-size="2.8">Разраб.</text>`;
        out += `<text x="${x + 18*k}" y="${mainTop + 9}" class="gost-text" font-size="2.8">${s.dev}</text>`;
        out += `<text x="${x + 1}" y="${mainTop + 14}" class="gost-text" font-size="2.8">Пров.</text>`;
        out += `<text x="${x + 18*k}" y="${mainTop + 14}" class="gost-text" font-size="2.8">${s.chk}</text>`;
    } else {
        // Упрощенный штамп
        out += `<line x1="${rightX}" y1="${mainTop + 10}" x2="${x + width}" y2="${mainTop + 10}" class="main-line"/>`;
        out += `<text x="${rightX + rightW/2}" y="${mainTop + 7}" text-anchor="middle" class="gost-text" font-size="4">${s.code}</text>`;
        out += `<text x="${rightX + rightW/2}" y="${mainTop + 22}" text-anchor="middle" class="gost-text" font-size="4.5">${s.title} (${s.scale})</text>`;
        out += `<text x="${x + 2}" y="${mainTop + 9}" class="gost-text" font-size="2.8">Чертил: ${s.dev}</text>`;
        out += `<text x="${x + 2}" y="${mainTop + 19}" class="gost-text" font-size="2.8">Пров: ${s.chk}</text>`;
    }

    out += `</g>`;
    return out;
}

// Отрисовка отдельного примитива
function drawPrimitiveSVG(p) {
    const cls = p.style === 'thin' ? 'thin-line' : p.style === 'dashed' ? 'dashed-line' : p.style === 'axis' ? 'axis-line' : 'main-line';
    
    if (p.type === 'line') {
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" class="${cls}"/>`;
    }
    if (p.type === 'rect') {
        return `<rect x="${p.x1}" y="${p.y1}" width="${p.x2}" height="${p.y2}" class="${cls}"/>`;
    }
    if (p.type === 'circle') {
        return `<circle cx="${p.x1}" cy="${p.y1}" r="${p.x2}" class="${cls}"/>`;
    }
    if (p.type === 'hatch') {
        return `<rect x="${p.x1}" y="${p.y1}" width="${p.x2}" height="${p.y2}" fill="url(#hatch)" stroke="#000" stroke-width="0.25"/>`;
    }
    if (p.type === 'text') {
        return `<text x="${p.x1}" y="${p.y1}" class="gost-text" font-size="${p.size || 4}">${p.text}</text>`;
    }
    if (p.type === 'dim') {
        const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
        const len = Math.round(Math.hypot(dx, dy));
        const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
        const label = p.text || len;
        return `<g>
            <line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" class="thin-line" marker-start="url(#arrow-end)" marker-end="url(#arrow-end)"/>
            <text x="${mx}" y="${my - 1.5}" class="dim-text">${label}</text>
        </g>`;
    }
    return '';
}

// ПАРАМЕТРИЧЕСКИЙ ГЕНЕРАТОР (3 Вида, Разрез, Сечение)
function generatePart() {
    state.part.type = document.getElementById('part-type').value;
    state.part.viewMode = document.getElementById('view-mode').value;
    state.part.L = parseFloat(document.getElementById('p-L').value) || 60;
    state.part.D = parseFloat(document.getElementById('p-D').value) || 40;
    state.part.d = parseFloat(document.getElementById('p-d').value) || 20;
    state.part.s = parseFloat(document.getElementById('p-s').value) || 30;

    state.primitives = [];
    const { type, viewMode, L, D, d, s } = state.part;
    
    // Базовая точка отсчета главного вида
    const ox = 45, oy = 40;

    if (type === 'bushing') {
        // Главный вид (или Фронтальный РАЗРЕЗ)
        const rOut = D / 2, rIn = d / 2, rStep = s / 2;
        const cy = oy + rOut;

        if (viewMode === 'cut') {
            // Заштрихованные половинки разреза
            state.primitives.push({ type: 'hatch', x1: ox, y1: cy - rOut, x2: L/2, y2: rOut - rIn });
            state.primitives.push({ type: 'hatch', x1: ox + L/2, y1: cy - rStep, x2: L/2, y2: rStep - rIn });
            state.primitives.push({ type: 'hatch', x1: ox, y1: cy + rIn, x2: L/2, y2: rOut - rIn });
            state.primitives.push({ type: 'hatch', x1: ox + L/2, y1: cy + rIn, x2: L/2, y2: rStep - rIn });
            // Видимые линии отверстия в разрезе
            state.primitives.push({ type: 'line', x1: ox, y1: cy - rIn, x2: ox + L, y2: cy - rIn, style: 'main' });
            state.primitives.push({ type: 'line', x1: ox, y1: cy + rIn, x2: ox + L, y2: cy + rIn, style: 'main' });
            state.primitives.push({ type: 'text', x1: ox + L/2 - 15, y1: oy - 6, text: 'Разрез А-А', size: 4.5 });
        } else {
            // Невидимые линии отверстия
            state.primitives.push({ type: 'line', x1: ox, y1: cy - rIn, x2: ox + L, y2: cy - rIn, style: 'dashed' });
            state.primitives.push({ type: 'line', x1: ox, y1: cy + rIn, x2: ox + L, y2: cy + rIn, style: 'dashed' });
        }

        // Внешний контур ступенчатой втулки
        state.primitives.push({ type: 'rect', x1: ox, y1: cy - rOut, x2: L/2, y2: D, style: 'main' });
        state.primitives.push({ type: 'rect', x1: ox + L/2, y1: cy - rStep, x2: L/2, y2: s, style: 'main' });
        // Осевая
        state.primitives.push({ type: 'line', x1: ox - 5, y1: cy, x2: ox + L + 5, y2: cy, style: 'axis' });
        // Размеры
        state.primitives.push({ type: 'dim', x1: ox, y1: cy + rOut + 10, x2: ox + L, y2: cy + rOut + 10, text: `${L}` });
        state.primitives.push({ type: 'dim', x1: ox - 8, y1: cy - rOut, x2: ox - 8, y2: cy + rOut, text: `⌀${D}` });

        // Если выбраны 3 основных вида -> строим Вид слева и Вид сверху
        if (viewMode === '3views' || viewMode === 'cut') {
            const leftCx = ox + L + 35 + rOut;
            state.primitives.push({ type: 'circle', x1: leftCx, y1: cy, x2: rOut, style: 'main' });
            state.primitives.push({ type: 'circle', x1: leftCx, y1: cy, x2: rStep, style: 'main' });
            state.primitives.push({ type: 'circle', x1: leftCx, y1: cy, x2: rIn, style: 'main' });
            state.primitives.push({ type: 'line', x1: leftCx - rOut - 4, y1: cy, x2: leftCx + rOut + 4, y2: cy, style: 'axis' });
            state.primitives.push({ type: 'line', x1: leftCx, y1: cy - rOut - 4, x2: leftCx, y2: cy + rOut + 4, style: 'axis' });
        }

        if (viewMode === '3views') {
            const topY = cy + rOut + 25;
            state.primitives.push({ type: 'rect', x1: ox, y1: topY, x2: L/2, y2: D, style: 'main' });
            state.primitives.push({ type: 'rect', x1: ox + L/2, y1: topY + (D-s)/2, x2: L/2, y2: s, style: 'main' });
            state.primitives.push({ type: 'line', x1: ox - 5, y1: topY + rOut, x2: ox + L + 5, y2: topY + rOut, style: 'axis' });
        }

        if (viewMode === 'section') {
            // Вынесенное СЕЧЕНИЕ А-А
            const secX = ox + L * 0.75;
            state.primitives.push({ type: 'line', x1: secX, y1: cy - rStep - 8, x2: secX, y2: cy + rStep + 8, style: 'axis' });
            state.primitives.push({ type: 'text', x1: secX - 2, y1: cy - rStep - 10, text: 'А', size: 4.5 });
            state.primitives.push({ type: 'text', x1: secX - 2, y1: cy + rStep + 14, text: 'А', size: 4.5 });

            const scx = ox + L + 40;
            state.primitives.push({ type: 'text', x1: scx - 8, y1: cy - rStep - 6, text: 'А-А', size: 4.5 });
            state.primitives.push({ type: 'circle', x1: scx, y1: cy, x2: rStep, style: 'main' });
            state.primitives.push({ type: 'circle', x1: scx, y1: cy, x2: rIn, style: 'main' });
            state.primitives.push({ type: 'hatch', x1: scx - rStep*0.7, y1: cy - rStep*0.7, x2: rStep*1.4, y2: (rStep-rIn)*0.6 });
        }
    } else if (type === 'plate') {
        // Плита с отверстием
        state.primitives.push({ type: 'rect', x1: ox, y1: oy, x2: L, y2: D, style: 'main' });
        state.primitives.push({ type: 'circle', x1: ox + L/2, y1: oy + D/2, x2: d/2, style: 'main' });
        state.primitives.push({ type: 'line', x1: ox - 4, y1: oy + D/2, x2: ox + L + 4, y2: oy + D/2, style: 'axis' });
        state.primitives.push({ type: 'line', x1: ox + L/2, y1: oy - 4, x2: ox + L/2, y2: oy + D + 4, style: 'axis' });
        state.primitives.push({ type: 'dim', x1: ox, y1: oy + D + 8, x2: ox + L, y2: oy + D + 8, text: `${L}` });

        // Нижний вид / Разрез
        const by = oy + D + 22;
        if (viewMode === 'cut') {
            state.primitives.push({ type: 'hatch', x1: ox, y1: by, x2: (L - d)/2, y2: s });
            state.primitives.push({ type: 'hatch', x1: ox + (L + d)/2, y1: by, x2: (L - d)/2, y2: s });
        }
        state.primitives.push({ type: 'rect', x1: ox, y1: by, x2: L, y2: s, style: 'main' });
        state.primitives.push({ type: 'line', x1: ox + (L-d)/2, y1: by, x2: ox + (L-d)/2, y2: by + s, style: viewMode === 'cut' ? 'main' : 'dashed' });
        state.primitives.push({ type: 'line', x1: ox + (L+d)/2, y1: by, x2: ox + (L+d)/2, y2: by + s, style: viewMode === 'cut' ? 'main' : 'dashed' });
    } else if (type === 'shaft') {
        // Вал со шпоночным пазом
        state.primitives.push({ type: 'rect', x1: ox, y1: oy, x2: L, y2: D, style: 'main' });
        state.primitives.push({ type: 'rect', x1: ox + 15, y1: oy + D/2 - d/2, x2: L - 30, y2: d, style: 'main' });
        state.primitives.push({ type: 'line', x1: ox - 5, y1: oy + D/2, x2: ox + L + 5, y2: oy + D/2, style: 'axis' });
        
        // Вынесенное сечение вала
        const scx = ox + L + 35, scy = oy + D/2;
        state.primitives.push({ type: 'text', x1: scx - 8, y1: oy - 5, text: 'А-А (Сечение)', size: 4 });
        state.primitives.push({ type: 'circle', x1: scx, y1: scy, x2: D/2, style: 'main' });
        state.primitives.push({ type: 'hatch', x1: scx - D*0.35, y1: scy - D*0.35, x2: D*0.7, y2: D*0.7 });
        state.primitives.push({ type: 'rect', x1: scx - D/2, y1: scy - d/2, x2: 6, y2: d, style: 'main' });
    }

    renderSVG();
}

// Добавление ручного примитива
function addPrimitive() {
    const p = {
        type: document.getElementById('prim-type').value,
        style: document.getElementById('prim-style').value,
        x1: parseFloat(document.getElementById('pr-x1').value) || 0,
        y1: parseFloat(document.getElementById('pr-y1').value) || 0,
        x2: parseFloat(document.getElementById('pr-x2').value) || 0,
        y2: parseFloat(document.getElementById('pr-y2').value) || 0
    };
    state.primitives.push(p);
    renderSVG();
    switchTab('tab-draw');
}

function clearDrawing() {
    state.primitives = [];
    renderSVG();
}

// РАБОТА С БИБЛИОТЕКОЙ ДЕТАЛЕЙ
function updateLibUI() {
    const sel = document.getElementById('lib-select');
    sel.innerHTML = '';
    Object.keys(library).forEach(name => {
        let opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        sel.appendChild(opt);
    });
}

function loadFromLib() {
    const name = document.getElementById('lib-select').value;
    const item = library[name];
    if (!item) return;

    document.getElementById('st-title').value = item.title || name;
    state.stamp.title = item.title || name;

    if (item.part) {
        document.getElementById('part-type').value = item.part.type;
        document.getElementById('view-mode').value = item.part.viewMode;
        document.getElementById('p-L').value = item.part.L;
        document.getElementById('p-D').value = item.part.D;
        document.getElementById('p-d').value = item.part.d;
        document.getElementById('p-s').value = item.part.s;
        generatePart();
    }
    if (item.primitives && item.primitives.length > 0) {
        state.primitives = JSON.parse(JSON.stringify(item.primitives));
        renderSVG();
    }
}

function saveToLib() {
    const name = prompt("Введите название детали для сохранения в библиотеку:", state.stamp.title);
    if (!name) return;
    library[name] = {
        title: state.stamp.title,
        part: { ...state.part },
        primitives: JSON.parse(JSON.stringify(state.primitives))
    };
    localStorage.setItem('cad_lib', JSON.stringify(library));
    updateLibUI();
    document.getElementById('lib-select').value = name;
    alert("Деталь успешно добавлена в библиотеку!");
}

function deleteFromLib() {
    const name = document.getElementById('lib-select').value;
    if (confirm(`Удалить "${name}" из базы?`)) {
        delete library[name];
        localStorage.setItem('cad_lib', JSON.stringify(library));
        updateLibUI();
    }
}

// ИИ GOOGLE GEMINI (OCR И ГЕНЕРАЦИЯ ПАРАМЕТРОВ)
function saveApiKey() {
    localStorage.setItem('gemini_api_key', document.getElementById('gemini-key').value.trim());
}

async function runGeminiOCR() {
    const key = document.getElementById('gemini-key').value.trim();
    const model = document.getElementById('gemini-model').value;
    const fileInput = document.getElementById('ai-image');
    const userPrompt = document.getElementById('ai-prompt').value;
    const status = document.getElementById('ai-status');

    if (!key) {
        alert("Пожалуйста, введите API ключ Google Gemini!");
        return;
    }

    status.innerText = "⏳ Обработка запроса нейросетью Gemini...";
    
    const systemInstruction = `Ты инженер-конструктор ГОСТ. Проанализируй изображение и/или текст пользователя. 
    Верни СТРОГО валидный JSON без маркдауна и пояснений в следующем формате:
    {
      "title": "Название детали",
      "useParametric": true,
      "part": { "type": "bushing" | "plate" | "shaft", "viewMode": "cut" | "3views" | "section", "L": число, "D": число, "d": число, "s": число },
      "customPrimitives": [
         {"type": "line"|"rect"|"circle"|"dim"|"hatch", "style": "main"|"thin"|"dashed"|"axis", "x1": число, "y1": число, "x2": число, "y2": число}
      ]
    }
    Если деталь похожа на втулку/цилиндр, плиту или вал — ставь useParametric: true и заполни размеры в мм (L от 30 до 120, D от 20 до 80). Если деталь нестандартная — построй её в массиве customPrimitives (координаты от 30 до 160).`;

    let contentsParts = [{ text: systemInstruction + "\nЗадание пользователя: " + (userPrompt || "Распознай чертеж и построй деталь.") }];

    if (fileInput.files && fileInput.files[0]) {
        const base64 = await fileToBase64(fileInput.files[0]);
        contentsParts.push({
            inline_data: {
                mime_type: fileInput.files[0].type,
                data: base64.split(',')[1]
            }
        });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: contentsParts }] })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(rawText);

        // Применение распознанных параметров в программу
        if (result.title) {
            document.getElementById('st-title').value = result.title;
            state.stamp.title = result.title;
        }

        if (result.useParametric && result.part) {
            document.getElementById('part-type').value = result.part.type || 'bushing';
            document.getElementById('view-mode').value = result.part.viewMode || 'cut';
            document.getElementById('p-L').value = result.part.L || 70;
            document.getElementById('p-D').value = result.part.D || 50;
            document.getElementById('p-d').value = result.part.d || 24;
            document.getElementById('p-s').value = result.part.s || 36;
            generatePart();
        } else {
            state.primitives = [];
        }

        if (result.customPrimitives && result.customPrimitives.length > 0) {
            state.primitives.push(...result.customPrimitives);
            renderSVG();
        }

        status.innerText = "✅ Чертеж успешно построен по данным ИИ!";
        setTimeout(() => switchTab('tab-draw'), 800);

    } catch (err) {
        status.innerText = "❌ Ошибка: " + err.message;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
    });
}

// Скачивание готового SVG файла
function downloadSVG() {
    const svgEl = document.getElementById('main-svg');
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.stamp.code}_${state.stamp.title}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
