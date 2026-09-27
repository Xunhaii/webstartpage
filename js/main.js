// ============================================================
// 安全函数
// ============================================================
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sanitizeFaClass(cls) {
    if (!cls) return '';
    return cls.toString().replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
}

function cssUrl(url) {
    if (!url) return 'none';
    const escaped = url
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    return `url("${escaped}")`;
}

// ============================================================
// 颜色工具
// ============================================================
function normalizeHex(hex) {
    if (!hex || typeof hex !== 'string') return null;
    let h = hex.trim();
    if (!h.startsWith('#')) h = '#' + h;
    if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
        h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return null;
    return h.toLowerCase();
}

function hexToRgb(hex) {
    const norm = normalizeHex(hex);
    if (!norm) return null;
    const h = norm.slice(1);
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    };
}

function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return rgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}

// ============================================================
// 常量
// ============================================================
const DEFAULT_BG_URL = 'https://www.xunhaii.com/bing-wallpaper/bing-wallpaper.jpg';
const CONFIG_VERSION = 1;
const MAX_HISTORY = 30;

const DEFAULT_THEME_COLORS = { primary: '#4da6ff', accent: '#80c0ff' };

// ============================================================
// IndexedDB
// ============================================================
let db;
const DB_NAME = "XunhaiiStartPageDB";
const DB_VERSION = 2;
const LINK_ICONS_STORE = "linkIcons";
const ENGINE_ICONS_STORE = "engineIcons";
const BG_STORE = "backgroundImage";
const BG_KEY = "current";

function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB 错误:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(LINK_ICONS_STORE)) db.createObjectStore(LINK_ICONS_STORE, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(ENGINE_ICONS_STORE)) db.createObjectStore(ENGINE_ICONS_STORE, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(BG_STORE)) db.createObjectStore(BG_STORE, { keyPath: 'id' });
        };
    });
}

function saveIconToDB(storeName, id, data) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("数据库未初始化");
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put({ id, data });
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

function getIconFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("数据库未初始化");
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = (event) => {
            const result = event.target.result;
            resolve(result ? result.data : null);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

function deleteIconFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("数据库未初始化");
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// ============================================================
// 模态框/对话框：锁滚动 + 焦点陷阱
// ============================================================
let openModalCount = 0;

function lockBodyScroll() {
    openModalCount++;
    document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
    openModalCount = Math.max(0, openModalCount - 1);
    if (openModalCount === 0) document.body.classList.remove('modal-open');
}

function trapFocusWithin(container, e) {
    if (e.key !== 'Tab') return;
    const focusable = container.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const list = Array.prototype.filter.call(focusable, el => el.offsetParent !== null || el === document.activeElement);
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

// ============================================================
// 通用对话框系统
// 使用 visibility + opacity 控制，避免 setTimeout + display 冲突
// ============================================================
const DIALOG_ICONS = {
    info:     'fa-info-circle',
    warning:  'fa-exclamation-triangle',
    error:    'fa-times-circle',
    success:  'fa-check-circle',
    question: 'fa-question-circle'
};

function openDialog(config) {
    return new Promise((resolve) => {
        const overlay   = document.getElementById('dialog-overlay');
        const dialogEl  = overlay.querySelector('.dialog');
        const iconEl    = document.getElementById('dialog-icon');
        const titleEl   = document.getElementById('dialog-title');
        const messageEl = document.getElementById('dialog-message');
        const okBtn     = document.getElementById('dialog-ok');
        const cancelBtn = document.getElementById('dialog-cancel');

        if (!overlay) {
            if (config.showCancel) resolve(window.confirm(config.message));
            else { window.alert(config.message); resolve(true); }
            return;
        }

        titleEl.textContent = config.title || '提示';
        messageEl.textContent = config.message || '';
        messageEl.style.display = config.message ? '' : 'none';

        const type = DIALOG_ICONS[config.iconType] ? config.iconType : 'info';
        iconEl.className = 'dialog-icon ' + type;
        iconEl.innerHTML = '<i class="fas ' + DIALOG_ICONS[type] + '"></i>';

        okBtn.textContent = config.okText || '确定';
        okBtn.className = 'btn ' + (config.danger ? 'btn-danger' : 'btn-primary');

        if (config.showCancel) {
            cancelBtn.style.display = '';
            cancelBtn.textContent = config.cancelText || '取消';
        } else {
            cancelBtn.style.display = 'none';
        }

        // 只切换 show 类，不操作 display
        overlay.classList.add('show');
        lockBodyScroll();

        setTimeout(() => okBtn.focus(), 50);

        let settled = false;

        const cleanup = () => {
            if (settled) return;
            settled = true;

            // 只移除 show 类 —— CSS transition 会处理淡出
            overlay.classList.remove('show');
            unlockBodyScroll();

            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onOverlayClick);
            document.removeEventListener('keydown', onKeydown, true);
        };

        const finish = (value) => { cleanup(); resolve(value); };

        const onOk = (e) => { e.stopPropagation(); finish(true); };
        const onCancel = (e) => { e.stopPropagation(); finish(false); };
        const onOverlayClick = (e) => { if (e.target === overlay) finish(false); };
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
            } else if (e.key === 'Tab') {
                trapFocusWithin(dialogEl, e);
            } else if (e.key === 'Enter') {
                if (document.activeElement === cancelBtn && config.showCancel) {
                    e.preventDefault();
                    finish(false);
                } else if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
                    // 让原生按钮处理
                } else {
                    e.preventDefault();
                    finish(true);
                }
            }
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKeydown, true);
    });
}

function showAlert(message, options = {}) {
    return openDialog({
        title: options.title || '提示',
        message: message,
        iconType: options.iconType || 'info',
        okText: options.okText || '知道了',
        showCancel: false,
        danger: false
    }).then(() => undefined);
}

function showConfirm(message, options = {}) {
    return openDialog({
        title: options.title || '确认操作',
        message: message,
        iconType: options.iconType || 'question',
        okText: options.okText || '确定',
        cancelText: options.cancelText || '取消',
        showCancel: true,
        danger: !!options.danger
    });
}

// ============================================================
// 表单内联错误
// ============================================================
function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) field.classList.add('error');
    const errEl = document.getElementById(fieldId + '-error');
    if (errEl) {
        const span = errEl.querySelector('span');
        if (span) span.textContent = message;
        errEl.classList.remove('show');
        void errEl.offsetWidth;
        errEl.classList.add('show');
    }
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.classList.remove('error');
    const errEl = document.getElementById(fieldId + '-error');
    if (errEl) errEl.classList.remove('show');
}

function clearAllFieldErrors(scope) {
    const root = scope || document;
    root.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
    root.querySelectorAll('.form-error.show').forEach(el => el.classList.remove('show'));
}

// ============================================================
// 主题颜色
// ============================================================
function getThemeColors() {
    try {
        const raw = localStorage.getItem('themeColors');
        const c = raw ? JSON.parse(raw) : null;
        if (c && c.primary && c.accent) return c;
    } catch (e) {}
    return { ...DEFAULT_THEME_COLORS };
}

function applyThemeColors(primary, accent) {
    const root = document.documentElement;
    const p = normalizeHex(primary) || DEFAULT_THEME_COLORS.primary;
    const a = normalizeHex(accent) || DEFAULT_THEME_COLORS.accent;

    root.style.setProperty('--accent', p);
    root.style.setProperty('--accent-2', a);

    const rgb1 = hexToRgb(p);
    if (rgb1) {
        root.style.setProperty('--accent-rgb', `${rgb1.r}, ${rgb1.g}, ${rgb1.b}`);
        root.style.setProperty('--accent-dark', darkenHex(p, 0.15));
    }

    const rgb2 = hexToRgb(a);
    if (rgb2) {
        root.style.setProperty('--accent-2-rgb', `${rgb2.r}, ${rgb2.g}, ${rgb2.b}`);
    }
}

function initThemeColors() {
    const colors = getThemeColors();
    applyThemeColors(colors.primary, colors.accent);
}

function updateColorPreview() {
    const primary = normalizeHex(document.getElementById('primary-color-text').value);
    const accent = normalizeHex(document.getElementById('accent-color-text').value);
    const preview = document.querySelector('.color-preview');
    if (!preview) return;
    preview.style.setProperty('--preview-accent', primary || DEFAULT_THEME_COLORS.primary);
    preview.style.setProperty('--preview-accent-2', accent || DEFAULT_THEME_COLORS.accent);
}

function openThemeColorsModal() {
    const modal = document.getElementById('theme-colors-modal');
    const config = getThemeColors();

    clearAllFieldErrors(modal);
    document.getElementById('primary-color-picker').value = config.primary;
    document.getElementById('primary-color-text').value = config.primary;
    document.getElementById('accent-color-picker').value = config.accent;
    document.getElementById('accent-color-text').value = config.accent;

    updateColorPreview();

    modal.classList.add('show');
    lockBodyScroll();
}

function closeThemeColorsModal() {
    const modal = document.getElementById('theme-colors-modal');
    if (!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    unlockBodyScroll();
}

function saveThemeColors() {
    const modal = document.getElementById('theme-colors-modal');
    clearAllFieldErrors(modal);

    const primaryRaw = document.getElementById('primary-color-text').value.trim();
    const accentRaw = document.getElementById('accent-color-text').value.trim();

    const primary = normalizeHex(primaryRaw);
    const accent = normalizeHex(accentRaw);

    let hasError = false;
    if (!primary) {
        setFieldError('primary-color-text', '请输入有效的十六进制颜色（例如 #4da6ff）');
        hasError = true;
    }
    if (!accent) {
        setFieldError('accent-color-text', '请输入有效的十六进制颜色（例如 #80c0ff）');
        hasError = true;
    }
    if (hasError) return;

    localStorage.setItem('themeColors', JSON.stringify({ primary, accent }));
    applyThemeColors(primary, accent);
    closeThemeColorsModal();
}

// ============================================================
// 全局状态
// ============================================================
let currentEditLinkIndex = null;
let currentEditLinkId = null;
let currentEditLinkOriginalType = null;
let currentLinkIconType = 'fa';
let currentLinkKeepExistingIcon = false;

let currentEditEngine = null;
let currentEngineIconType = 'fa';
let currentEngineKeepExistingIcon = false;

let currentBgType = 'none';
let currentBgValue = '';
let bgKeepExisting = false;
let previewEffects = { blur: 0, brightness: 100, saturation: 100, overlay: 0 };

let touchState = {
    card: null,
    container: null,
    timer: null,
    started: false,
    dragging: false,
    startX: 0,
    startY: 0,
    shouldOpenOnTap: false
};
let suppressNextClick = false;

let linksTipInitialized = false;
let themeSystemListenerBound = false;

const DEFAULT_EFFECTS = { blur: 0, brightness: 100, saturation: 100, overlay: 0 };

const BG_PRESETS = {
    none:   { blur: 0,  brightness: 100, saturation: 100, overlay: 0 },
    dreamy: { blur: 8,  brightness: 108, saturation: 120, overlay: 0 },
    cinema: { blur: 4,  brightness: 75,  saturation: 85,  overlay: 30 },
    mono:   { blur: 2,  brightness: 100, saturation: 0,   overlay: 10 },
    vivid:  { blur: 0,  brightness: 105, saturation: 160, overlay: 0 }
};

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_CANCEL = 12;
const DRAG_START_THRESHOLD = 15;

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await initIndexedDB();
    } catch (error) {
        console.error("IndexedDB 初始化失败:", error);
        showAlert("浏览器存储初始化失败，部分功能可能不可用", { iconType: 'warning' });
    }

    updateDateTime();
    setInterval(updateDateTime, 1000);

    initThemeColors();
    initSearchEngines();
    initQuickLinks();
    initSearchHistory();
    initTheme();
    initBlurToggle();
    await loadBackground();
    initLinksTip();

    setupEventListeners();
    initDragAndDrop();
    initEngineDragAndDrop();
});

// ============================================================
// 时间
// ============================================================
function updateDateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('current-time').textContent = `${hours}:${minutes}`;

    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('current-date').textContent =
        `${now.getFullYear()}年${months[now.getMonth()]}${now.getDate()}日 ${days[now.getDay()]}`;
}

// ============================================================
// 提示卡片
// ============================================================
function initLinksTip() {
    const tip = document.getElementById('links-tip-card');
    const btn = document.getElementById('links-tip-dismiss');
    if (!tip || !btn) return;

    if (localStorage.getItem('linksTipDismissed') === 'true') {
        tip.classList.add('dismissed');
    } else {
        tip.classList.remove('dismissed');
    }

    if (linksTipInitialized) return;
    linksTipInitialized = true;

    btn.addEventListener('click', () => {
        tip.classList.add('dismissed');
        localStorage.setItem('linksTipDismissed', 'true');
    });
}

// ============================================================
// 搜索引擎
// ============================================================
function initSearchEngines() {
    let engines = getSavedEngines();

    if (engines.length === 0) {
        engines = [
            { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={query}', icon: 'fab fa-microsoft', type: 'fa', isDefault: true },
            { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}', icon: 'https://static.xunhaii.com/images/svg/baidu.svg', type: 'url', isDefault: true },
            { id: 'google', name: '谷歌', url: 'https://www.google.com/search?q={query}', icon: 'fab fa-google', type: 'fa', isDefault: true }
        ];
        localStorage.setItem('searchEngines', JSON.stringify(engines));
    }

    let savedEngine = localStorage.getItem('searchEngine');
    if (!savedEngine || !engines.some(e => e.id === savedEngine)) {
        savedEngine = engines[0].id;
        localStorage.setItem('searchEngine', savedEngine);
    }

    setActiveEngine(savedEngine);
    renderSearchEngines(engines);
}

function getSavedEngines() {
    const raw = localStorage.getItem('searchEngines');
    if (raw) {
        try { return JSON.parse(raw); }
        catch (e) { console.error('解析搜索引擎数据失败:', e); return []; }
    }
    return [];
}

function renderSearchEngines(engines) {
    const container = document.getElementById('engine-container');
    container.innerHTML = '';

    engines.forEach(engine => {
        const engineContainer = document.createElement('div');
        engineContainer.className = 'engine-btn-container';
        engineContainer.setAttribute('draggable', 'true');
        engineContainer.dataset.engineId = engine.id;

        const safeName = escapeHtml(engine.name);
        const safeId = escapeHtml(engine.id);

        let iconContent = '';
        if (engine.type === 'fa') {
            iconContent = `<i class="${sanitizeFaClass(engine.icon)}"></i>`;
        } else if (engine.type === 'url') {
            iconContent = `<img src="${escapeHtml(engine.icon)}" alt="" onerror="this.style.display='none'">`;
        } else if (engine.type === 'db') {
            iconContent = `<i class="fas fa-spinner fa-spin"></i>`;
        }

        engineContainer.innerHTML = `
            <button class="engine-btn" data-engine="${safeId}" type="button">
                ${iconContent}
                <span>${safeName}</span>
            </button>
            <button class="engine-edit-btn" data-engine="${safeId}" type="button" aria-label="编辑">
                <i class="fas fa-edit"></i>
            </button>
        `;

        if (engine.type === 'db') loadEngineIcon(engine.id, engineContainer);
        container.appendChild(engineContainer);
    });

    const activeEngine = localStorage.getItem('searchEngine') || (engines[0] && engines[0].id);
    if (activeEngine) setActiveEngine(activeEngine);
}

async function loadEngineIcon(engineId, container) {
    try {
        const iconData = await getIconFromDB(ENGINE_ICONS_STORE, engineId);
        if (iconData && container.isConnected) {
            const iconElement = container.querySelector('.engine-btn i, .engine-btn img');
            if (iconElement) {
                const img = document.createElement('img');
                img.src = iconData;
                img.alt = "";
                iconElement.replaceWith(img);
            }
        }
    } catch (error) {
        console.error("加载引擎图标失败:", error);
    }
}

function setActiveEngine(engineId) {
    document.querySelectorAll('.engine-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.engine === engineId) btn.classList.add('active');
    });
    localStorage.setItem('searchEngine', engineId);
}

function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    const engineId = localStorage.getItem('searchEngine');
    const engines = getSavedEngines();
    let engine = engines.find(e => e.id === engineId);

    if (!engine) {
        engine = engines[0];
        if (engine) setActiveEngine(engine.id);
    }

    if (!engine) {
        showAlert('未找到搜索引擎配置', { iconType: 'error' });
        return;
    }

    window.open(engine.url.replace('{query}', encodeURIComponent(query)), '_self');
    saveSearchHistory(query, engine.name);
}

// ============================================================
// 快捷链接
// ============================================================
function initQuickLinks() {
    renderLinks(getSavedLinks());
}

function getSavedLinks() {
    const raw = localStorage.getItem('quickLinks');
    if (raw) {
        try { return JSON.parse(raw); }
        catch (e) { console.error('解析快捷链接数据失败:', e); return []; }
    }
    return [
        { id: 'link1', name: 'Xunhaii', url: 'https://xunhaii.com', icon: 'fab fa-x', type: 'fa' },
        { id: 'link2', name: '知乎', url: 'https://www.zhihu.com', icon: 'fab fa-zhihu', type: 'fa' },
        { id: 'link3', name: 'B站', url: 'https://www.bilibili.com', icon: 'fab fa-bilibili', type: 'fa' },
        { id: 'link4', name: '抖音', url: 'https://www.douyin.com', icon: 'fab fa-tiktok', type: 'fa' },
        { id: 'link5', name: '微博', url: 'https://weibo.com', icon: 'fab fa-weibo', type: 'fa' },
        { id: 'link6', name: '淘宝', url: 'https://www.taobao.com', icon: 'fas fa-shopping-cart', type: 'fa' }
    ];
}

function renderLinks(links) {
    const container = document.getElementById('links-container');
    container.innerHTML = '';

    links.forEach((link, index) => {
        const card = document.createElement('div');
        card.className = 'link-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('tabindex', '0');
        card.dataset.index = index;
        card.dataset.id = link.id;

        const safeName = escapeHtml(link.name);

        let iconContent = '';
        if (link.type === 'fa') {
            iconContent = `<i class="${sanitizeFaClass(link.icon)}"></i>`;
        } else if (link.type === 'url') {
            iconContent = `<img src="${escapeHtml(link.icon)}" alt="" onerror="this.style.display='none'">`;
        } else if (link.type === 'db') {
            iconContent = `<i class="fas fa-spinner fa-spin"></i>`;
        }

        card.innerHTML = `
            <div class="link-icon-container">
                <div class="link-icon">
                    ${iconContent}
                </div>
            </div>
            <div class="link-name">${safeName}</div>
            <button class="link-edit-btn" data-index="${index}" type="button" aria-label="编辑">
                <i class="fas fa-edit"></i>
            </button>
        `;

        card.addEventListener('click', (e) => {
            if (suppressNextClick) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.target.closest('.link-edit-btn')) return;
            if (card.classList.contains('dragging')) return;
            if (card.classList.contains('long-press-active')) return;

            if (card.dataset.tapBlocked === '1') {
                delete card.dataset.tapBlocked;
                return;
            }
            window.open(link.url, '_self');
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.target.closest('.link-edit-btn')) {
                window.open(link.url, '_self');
            }
        });

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
        });

        container.appendChild(card);
        if (link.type === 'db') loadLinkIcon(link.id, card);
    });
}

async function loadLinkIcon(linkId, card) {
    try {
        const iconData = await getIconFromDB(LINK_ICONS_STORE, linkId);
        if (iconData && card.isConnected) {
            const iconContainer = card.querySelector('.link-icon');
            if (iconContainer) {
                iconContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = iconData;
                img.alt = "";
                iconContainer.appendChild(img);
            }
        }
    } catch (error) {
        console.error("加载链接图标失败:", error);
    }
}

// ============================================================
// FLIP 动画
// ============================================================
function reorderWithFlip(container, selector, doReorder) {
    const items = [...container.querySelectorAll(selector)];
    const firsts = new Map();
    items.forEach(el => firsts.set(el, el.getBoundingClientRect()));

    doReorder();

    items.forEach(el => {
        const first = firsts.get(el);
        const last = el.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        try {
            el.animate(
                [
                    { transform: `translate(${dx}px, ${dy}px)` },
                    { transform: 'translate(0, 0)' }
                ],
                { duration: 260, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' }
            );
        } catch (e) { }
    });
}

// ============================================================
// 拖拽排序：链接
// ============================================================
function initDragAndDrop() {
    const container = document.getElementById('links-container');
    let draggedItem = null;

    container.addEventListener('dragstart', function (e) {
        if (e.target.classList && e.target.classList.contains('link-card')) {
            draggedItem = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', e.target.dataset.index);
        }
    });

    container.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!draggedItem) return;
        e.dataTransfer.dropEffect = 'move';

        const afterElement = getDragAfterElement(container, '.link-card', e.clientX, e.clientY);
        const currentNext = draggedItem.nextElementSibling;
        if (afterElement === null) {
            if (currentNext !== null) {
                reorderWithFlip(container, '.link-card:not(.dragging)', () => {
                    container.appendChild(draggedItem);
                });
            }
        } else if (afterElement !== currentNext) {
            reorderWithFlip(container, '.link-card:not(.dragging)', () => {
                container.insertBefore(draggedItem, afterElement);
            });
        }
    });

    container.addEventListener('dragend', function () {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            updateLinksOrder();
        }
    });

    attachTouchHandlers(container, 'links');
}

function updateLinksOrder() {
    const container = document.getElementById('links-container');
    const links = getSavedLinks();
    const newLinks = [];

    container.querySelectorAll('.link-card').forEach((card) => {
        const originalIndex = parseInt(card.dataset.index, 10);
        if (!isNaN(originalIndex) && links[originalIndex]) newLinks.push(links[originalIndex]);
    });

    if (newLinks.length !== links.length) {
        console.warn('拖拽排序后数据长度不一致，已取消本次排序');
        renderLinks(links);
        return;
    }

    localStorage.setItem('quickLinks', JSON.stringify(newLinks));
    renderLinks(newLinks);
}

// ============================================================
// 拖拽排序：引擎
// ============================================================
function initEngineDragAndDrop() {
    const container = document.getElementById('engine-container');
    let draggedItem = null;

    container.addEventListener('dragstart', function (e) {
        if (e.target.classList && e.target.classList.contains('engine-btn-container')) {
            if (e.target.closest('.engine-edit-btn')) {
                e.preventDefault();
                return;
            }
            draggedItem = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', e.target.dataset.engineId || '');
        }
    });

    container.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!draggedItem) return;
        e.dataTransfer.dropEffect = 'move';

        const afterElement = getDragAfterElement(container, '.engine-btn-container', e.clientX, e.clientY);
        const currentNext = draggedItem.nextElementSibling;
        if (afterElement === null) {
            if (currentNext !== null) {
                reorderWithFlip(container, '.engine-btn-container:not(.dragging)', () => {
                    container.appendChild(draggedItem);
                });
            }
        } else if (afterElement !== currentNext) {
            reorderWithFlip(container, '.engine-btn-container:not(.dragging)', () => {
                container.insertBefore(draggedItem, afterElement);
            });
        }
    });

    container.addEventListener('dragend', function () {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            updateEnginesOrder();
        }
    });

    attachTouchHandlers(container, 'engines');
}

function updateEnginesOrder() {
    const container = document.getElementById('engine-container');
    const engines = getSavedEngines();
    const newOrder = [];

    container.querySelectorAll('.engine-btn-container').forEach(el => {
        const id = el.dataset.engineId;
        const engine = engines.find(e => e.id === id);
        if (engine) newOrder.push(engine);
    });

    if (newOrder.length !== engines.length) {
        renderSearchEngines(engines);
        return;
    }

    localStorage.setItem('searchEngines', JSON.stringify(newOrder));
}

// ============================================================
// 触屏手势
// ============================================================
function attachTouchHandlers(container, kind) {
    const selector = kind === 'links' ? '.link-card' : '.engine-btn-container';
    const editBtnSel = kind === 'links' ? '.link-edit-btn' : '.engine-edit-btn';

    container.addEventListener('touchstart', function (e) {
        const target = e.target.closest(selector);
        if (!target) return;
        if (e.target.closest(editBtnSel)) return;

        const isAlreadyActive = target.classList.contains('touch-active');
        touchState.shouldOpenOnTap = isAlreadyActive;

        container.querySelectorAll('.touch-active').forEach(el => {
            if (el !== target) el.classList.remove('touch-active');
        });
        target.classList.add('touch-active');

        if (!isAlreadyActive && kind === 'links') {
            target.dataset.tapBlocked = '1';
        } else {
            delete target.dataset.tapBlocked;
        }

        if (touchState.timer) clearTimeout(touchState.timer);

        const touch = e.touches[0];
        touchState.card = target;
        touchState.container = kind;
        touchState.started = false;
        touchState.dragging = false;
        touchState.startX = touch.clientX;
        touchState.startY = touch.clientY;

        touchState.timer = setTimeout(() => {
            if (!touchState.card) return;
            touchState.started = true;
            touchState.card.classList.add('long-press-active');
            if (navigator.vibrate) navigator.vibrate(20);
        }, LONG_PRESS_MS);
    }, { passive: true });

    container.addEventListener('touchmove', function (e) {
        if (!touchState.card || touchState.container !== kind) return;

        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchState.startX);
        const dy = Math.abs(touch.clientY - touchState.startY);

        if (!touchState.started) {
            if (dx > LONG_PRESS_MOVE_CANCEL || dy > LONG_PRESS_MOVE_CANCEL) {
                if (touchState.timer) clearTimeout(touchState.timer);
                touchState.timer = null;
                if (touchState.card) {
                    touchState.card.classList.remove('touch-active');
                    delete touchState.card.dataset.tapBlocked;
                }
                touchState.card = null;
                touchState.container = null;
            }
            return;
        }

        if (!touchState.dragging && (dx > DRAG_START_THRESHOLD || dy > DRAG_START_THRESHOLD)) {
            touchState.dragging = true;
            touchState.card.classList.remove('long-press-active');
            touchState.card.classList.add('dragging');
        }

        if (touchState.dragging) {
            e.preventDefault();
            const item = touchState.card;
            const afterElement = getDragAfterElement(container, selector, touch.clientX, touch.clientY);
            const currentNext = item.nextElementSibling;
            const flipSelector = selector + ':not(.dragging)';

            if (afterElement === null) {
                if (currentNext !== null) {
                    reorderWithFlip(container, flipSelector, () => {
                        container.appendChild(item);
                    });
                }
            } else if (afterElement !== currentNext) {
                reorderWithFlip(container, flipSelector, () => {
                    container.insertBefore(item, afterElement);
                });
            }
        }
    }, { passive: false });

    container.addEventListener('touchend', function () {
        if (touchState.container !== kind) return;
        if (touchState.timer) clearTimeout(touchState.timer);

        const card = touchState.card;
        const wasDragging = touchState.dragging;
        const wasStarted = touchState.started;
        const shouldOpenOnTap = touchState.shouldOpenOnTap;

        touchState = {
            card: null, container: null, timer: null,
            started: false, dragging: false,
            startX: 0, startY: 0, shouldOpenOnTap: false
        };

        if (!card) return;
        card.classList.remove('long-press-active');

        if (wasDragging) {
            card.classList.remove('dragging');
            if (kind === 'links') updateLinksOrder();
            else updateEnginesOrder();
            suppressNextClick = true;
            setTimeout(() => { suppressNextClick = false; }, 350);
        } else if (wasStarted) {
            suppressNextClick = true;
            setTimeout(() => { suppressNextClick = false; }, 350);
        } else if (shouldOpenOnTap) {
            suppressNextClick = false;
        } else {
            suppressNextClick = true;
            setTimeout(() => { suppressNextClick = false; }, 350);
        }
    });

    container.addEventListener('touchcancel', function () {
        if (touchState.container !== kind) return;
        if (touchState.timer) clearTimeout(touchState.timer);
        if (touchState.card) {
            touchState.card.classList.remove('long-press-active', 'dragging', 'touch-active');
            delete touchState.card.dataset.tapBlocked;
        }
        touchState = {
            card: null, container: null, timer: null,
            started: false, dragging: false,
            startX: 0, startY: 0, shouldOpenOnTap: false
        };
    });
}

// ============================================================
// 网格感知的拖拽插入点
// ============================================================
function getDragAfterElement(container, selector, x, y) {
    const items = [...container.querySelectorAll(selector + ':not(.dragging)')];
    if (items.length === 0) return null;

    const rowsMap = [];
    items.forEach(item => {
        const box = item.getBoundingClientRect();
        let foundRow = null;
        for (const row of rowsMap) {
            if (Math.abs(row.top - box.top) < box.height / 2) {
                foundRow = row;
                break;
            }
        }
        if (foundRow) {
            foundRow.items.push({ el: item, box });
            foundRow.bottom = Math.max(foundRow.bottom, box.bottom);
        } else {
            rowsMap.push({ top: box.top, bottom: box.bottom, items: [{ el: item, box }] });
        }
    });

    rowsMap.sort((a, b) => a.top - b.top);

    let targetRow = rowsMap[0];
    let minDist = Infinity;
    for (const row of rowsMap) {
        if (y >= row.top - 5 && y <= row.bottom + 5) {
            targetRow = row;
            minDist = 0;
            break;
        }
        const dist = y < row.top ? row.top - y : y - row.bottom;
        if (dist < minDist) {
            minDist = dist;
            targetRow = row;
        }
    }

    targetRow.items.sort((a, b) => a.box.left - b.box.left);

    for (const item of targetRow.items) {
        const centerX = item.box.left + item.box.width / 2;
        if (x < centerX) return item.el;
    }

    const rowIndex = rowsMap.indexOf(targetRow);
    if (rowIndex < rowsMap.length - 1) {
        const nextRow = rowsMap[rowIndex + 1];
        nextRow.items.sort((a, b) => a.box.left - b.box.left);
        return nextRow.items[0].el;
    }

    return null;
}

// ============================================================
// 搜索历史（最多 30 条）
// ============================================================
function initSearchHistory() {
    renderSearchHistory(getSearchHistory());
}

function getSearchHistory() {
    const raw = localStorage.getItem('searchHistory');
    if (raw) {
        try { return JSON.parse(raw); }
        catch (e) { return []; }
    }
    return [];
}

function saveSearchHistory(query, engineName) {
    const history = getSearchHistory();
    const existingIndex = history.findIndex(item => item.query === query && item.engine === engineName);
    if (existingIndex !== -1) history.splice(existingIndex, 1);

    history.unshift({ query, engine: engineName, timestamp: new Date().toISOString() });
    if (history.length > MAX_HISTORY) history.pop();

    localStorage.setItem('searchHistory', JSON.stringify(history));
    renderSearchHistory(history);
}

function renderSearchHistory(history) {
    const container = document.getElementById('history-container');
    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = '<div class="no-history">暂无搜索记录</div>';
        return;
    }

    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'history-content';

        const queryDiv = document.createElement('div');
        queryDiv.className = 'history-query';
        queryDiv.textContent = item.query;
        queryDiv.title = item.query;

        const engineDiv = document.createElement('div');
        engineDiv.className = 'history-engine';
        engineDiv.textContent = `使用 ${item.engine} 搜索`;

        contentDiv.appendChild(queryDiv);
        contentDiv.appendChild(engineDiv);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-history';
        deleteBtn.dataset.index = index;
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', '删除记录');
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';

        historyItem.appendChild(contentDiv);
        historyItem.appendChild(deleteBtn);

        historyItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-history')) {
                document.getElementById('search-input').value = item.query;
                performSearch();
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSearchHistory(index);
        });

        container.appendChild(historyItem);
    });
}

function deleteSearchHistory(index) {
    const history = getSearchHistory();
    history.splice(index, 1);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    renderSearchHistory(history);
}

function clearSearchHistory() {
    localStorage.removeItem('searchHistory');
    renderSearchHistory([]);
}

// ============================================================
// 主题
// ============================================================
function initTheme() {
    const followSystem = localStorage.getItem('followSystemTheme') !== 'false';
    document.getElementById('system-theme-toggle').checked = followSystem;

    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (followSystem) applyTheme(systemPrefersDark);
    else applyTheme(savedTheme === 'dark');

    if (!themeSystemListenerBound) {
        themeSystemListenerBound = true;
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (document.getElementById('system-theme-toggle').checked) applyTheme(e.matches);
        });
    }

    setThemeColor();
}

function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    const followSystem = document.getElementById('system-theme-toggle').checked;
    if (followSystem) {
        document.getElementById('system-theme-toggle').checked = false;
        localStorage.setItem('followSystemTheme', 'false');
    }

    if (document.body.classList.contains('dark-mode')) {
        applyTheme(false);
        localStorage.setItem('theme', 'light');
    } else {
        applyTheme(true);
        localStorage.setItem('theme', 'dark');
    }
    setThemeColor();
}

function toggleFollowSystem() {
    localStorage.setItem('followSystemTheme', document.getElementById('system-theme-toggle').checked);
    initTheme();
}

function setThemeColor() {
    const themeColor = document.getElementById('theme-color');
    if (!themeColor) return;
    themeColor.content = document.body.classList.contains('dark-mode') ? '#1a1a2e' : '#f5f7fa';
}

// ============================================================
// 高斯模糊开关
// ============================================================
function initBlurToggle() {
    const enabled = localStorage.getItem('blurEnabled') !== 'false';
    const toggle = document.getElementById('blur-toggle');
    if (toggle) toggle.checked = enabled;
    document.body.classList.toggle('no-blur', !enabled);
}

// ============================================================
// 自定义背景
// ============================================================
function getBgConfig() {
    try {
        const raw = localStorage.getItem('bgConfig');
        return raw ? JSON.parse(raw) : { type: 'none' };
    } catch {
        return { type: 'none' };
    }
}

function saveBgConfig(config) {
    localStorage.setItem('bgConfig', JSON.stringify(config));
}

function applyBgEffects(effects) {
    const e = Object.assign({}, DEFAULT_EFFECTS, effects || {});
    const root = document.documentElement;
    root.style.setProperty('--bg-blur', e.blur + 'px');
    root.style.setProperty('--bg-brightness', e.brightness + '%');
    root.style.setProperty('--bg-saturation', e.saturation + '%');
    root.style.setProperty('--bg-overlay', (e.overlay / 100).toString());
}

async function loadBackground() {
    const config = getBgConfig();
    document.body.classList.remove('has-custom-bg');

    applyBgEffects(config.effects);

    if (!config || config.type === 'none') {
        document.documentElement.style.removeProperty('--bg-image');
        return;
    }

    if (config.type === 'url') {
        if (config.value) {
            document.documentElement.style.setProperty('--bg-image', cssUrl(config.value));
            document.body.classList.add('has-custom-bg');
        }
        return;
    }

    if (config.type === 'db') {
        try {
            const data = await getIconFromDB(BG_STORE, BG_KEY);
            if (data) {
                document.documentElement.style.setProperty('--bg-image', cssUrl(data));
                document.body.classList.add('has-custom-bg');
            } else {
                saveBgConfig({ type: 'none', effects: config.effects });
                document.documentElement.style.removeProperty('--bg-image');
            }
        } catch (err) {
            console.error('加载背景失败:', err);
        }
    }
}

function openBgModal() {
    const modal = document.getElementById('bg-modal');
    const config = getBgConfig();

    document.querySelectorAll('#bg-modal .icon-option').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('#bg-modal .icon-selector').forEach(el => el.style.display = 'none');
    document.getElementById('bg-url-input').value = '';
    document.getElementById('bg-image-upload').value = '';
    document.getElementById('bg-upload-hint').style.display = 'none';
    clearAllFieldErrors(modal);

    bgKeepExisting = false;
    currentBgType = config.type === 'db' ? 'upload' : (config.type || 'none');
    currentBgValue = config.value || '';

    previewEffects = Object.assign({}, DEFAULT_EFFECTS, config.effects || {});
    setSlidersFromEffects(previewEffects);

    const previewImage = document.getElementById('bg-preview-image');

    if (currentBgType === 'url') {
        document.getElementById('bg-url-option').classList.add('active');
        document.getElementById('bg-url-container').style.display = 'block';
        document.getElementById('bg-url-input').value = currentBgValue;
        previewImage.style.backgroundImage = currentBgValue ? cssUrl(currentBgValue) : cssUrl(DEFAULT_BG_URL);
    } else if (currentBgType === 'upload') {
        document.getElementById('bg-upload-option').classList.add('active');
        document.getElementById('bg-upload-container').style.display = 'block';
        document.getElementById('bg-upload-hint').style.display = 'block';
        bgKeepExisting = true;
        getIconFromDB(BG_STORE, BG_KEY).then(data => {
            previewImage.style.backgroundImage = cssUrl(data || DEFAULT_BG_URL);
        }).catch(() => {
            previewImage.style.backgroundImage = cssUrl(DEFAULT_BG_URL);
        });
    } else {
        document.getElementById('bg-none-option').classList.add('active');
        previewImage.style.backgroundImage = cssUrl(DEFAULT_BG_URL);
    }

    updateBgPreviewEffects();
    updateAllSliderProgress();

    modal.classList.add('show');
    lockBodyScroll();
}

function closeBgModal() {
    const modal = document.getElementById('bg-modal');
    if (!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    unlockBodyScroll();
}

function setSlidersFromEffects(effects) {
    document.getElementById('bg-blur').value = effects.blur;
    document.getElementById('bg-brightness').value = effects.brightness;
    document.getElementById('bg-saturation').value = effects.saturation;
    document.getElementById('bg-overlay').value = effects.overlay;
    updateSliderLabels();
}

function updateSliderLabels() {
    document.getElementById('bg-blur-value').textContent = previewEffects.blur + 'px';
    document.getElementById('bg-brightness-value').textContent = previewEffects.brightness + '%';
    document.getElementById('bg-saturation-value').textContent = previewEffects.saturation + '%';
    document.getElementById('bg-overlay-value').textContent = previewEffects.overlay + '%';
}

function updateSliderProgress(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--progress', pct + '%');
}

function updateAllSliderProgress() {
    ['bg-blur', 'bg-brightness', 'bg-saturation', 'bg-overlay'].forEach(id => {
        updateSliderProgress(document.getElementById(id));
    });
}

function updateBgPreviewEffects() {
    const image = document.getElementById('bg-preview-image');
    const overlay = document.getElementById('bg-preview-overlay');
    if (!image || !overlay) return;

    image.style.filter = `blur(${previewEffects.blur}px) brightness(${previewEffects.brightness}%) saturate(${previewEffects.saturation}%)`;
    overlay.style.background = `rgba(0, 0, 0, ${previewEffects.overlay / 100})`;
}

function updateBgPreviewFromUrl() {
    const url = document.getElementById('bg-url-input').value.trim();
    const previewImage = document.getElementById('bg-preview-image');
    previewImage.style.backgroundImage = url ? cssUrl(url) : cssUrl(DEFAULT_BG_URL);
}

async function saveBg() {
    clearAllFieldErrors(document.getElementById('bg-modal'));

    if (currentBgType === 'none') {
        try { await deleteIconFromDB(BG_STORE, BG_KEY); } catch (e) {}
        saveBgConfig({ type: 'none', effects: { ...previewEffects } });
        await loadBackground();
        closeBgModal();
        return;
    }

    if (currentBgType === 'url') {
        const url = document.getElementById('bg-url-input').value.trim();
        if (!url) { setFieldError('bg-url-input', '请输入图片链接'); return; }
        try { new URL(url); }
        catch {
            setFieldError('bg-url-input', '请输入有效的图片 URL（例如：https://example.com/img.jpg）');
            return;
        }

        try { await deleteIconFromDB(BG_STORE, BG_KEY); } catch (e) {}

        saveBgConfig({ type: 'url', value: url, effects: { ...previewEffects } });
        await loadBackground();
        closeBgModal();
        return;
    }

    if (currentBgType === 'upload') {
        const fileInput = document.getElementById('bg-image-upload');
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (!file.type.match('image.*')) {
                setFieldError('bg-image-upload', '请选择图片文件');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setFieldError('bg-image-upload', '图片文件过大，请选择小于 5MB 的图片');
                return;
            }

            const reader = new FileReader();
            reader.onload = async function (ev) {
                try {
                    await saveIconToDB(BG_STORE, BG_KEY, ev.target.result);
                    saveBgConfig({ type: 'db', effects: { ...previewEffects } });
                    await loadBackground();
                    closeBgModal();
                } catch (e) {
                    console.error(e);
                    showAlert('保存背景图片失败，请重试', { iconType: 'error' });
                }
            };
            reader.onerror = () => showAlert('读取文件失败', { iconType: 'error' });
            reader.readAsDataURL(file);
            return;
        } else if (bgKeepExisting) {
            saveBgConfig({ type: 'db', effects: { ...previewEffects } });
            await loadBackground();
            closeBgModal();
            return;
        } else {
            setFieldError('bg-image-upload', '请选择图片文件');
            return;
        }
    }
}

// ============================================================
// 配置导出 / 导入
// ============================================================
const CONFIG_KEYS = [
    'searchEngines', 'searchEngine', 'quickLinks', 'searchHistory',
    'theme', 'followSystemTheme', 'blurEnabled', 'bgConfig',
    'linksTipDismissed', 'themeColors'
];

function getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        try {
            const tx = db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        } catch (e) { reject(e); }
    });
}

async function exportConfig() {
    const data = {
        app: 'XunhaiiStartPage',
        version: CONFIG_VERSION,
        exportedAt: new Date().toISOString(),
        localStorage: {},
        indexedDB: { linkIcons: [], engineIcons: [], backgroundImage: [] }
    };

    CONFIG_KEYS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) data.localStorage[key] = val;
    });

    try {
        data.indexedDB.linkIcons = await getAllFromStore(LINK_ICONS_STORE);
        data.indexedDB.engineIcons = await getAllFromStore(ENGINE_ICONS_STORE);
        data.indexedDB.backgroundImage = await getAllFromStore(BG_STORE);
    } catch (e) { console.error('导出 IndexedDB 数据失败:', e); }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `xunhaii-startpage-config-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    document.getElementById('settings-panel').classList.remove('open');
}

function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        try {
            const tx = db.transaction([storeName], 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
            tx.onabort = (e) => reject(e.target.error);
        } catch (e) { reject(e); }
    });
}

function bulkPutToStore(storeName, items) {
    return new Promise((resolve, reject) => {
        if (!db || !Array.isArray(items) || items.length === 0) return resolve();
        try {
            const tx = db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            items.forEach(item => { if (item && item.id !== undefined) store.put(item); });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
            tx.onabort = (e) => reject(e.target.error);
        } catch (e) { reject(e); }
    });
}

async function importConfigFromFile(file) {
    let text;
    try { text = await file.text(); }
    catch (e) { await showAlert('无法读取文件', { iconType: 'error' }); return; }

    let data;
    try { data = JSON.parse(text); }
    catch (e) { await showAlert('文件格式错误，无法解析 JSON', { iconType: 'error' }); return; }

    if (!data || typeof data !== 'object' || data.app !== 'XunhaiiStartPage') {
        const ok = await showConfirm('该文件可能不是本起始页的配置文件，仍然继续导入吗？', { iconType: 'question' });
        if (!ok) return;
    }

    const ok2 = await showConfirm('导入将覆盖当前所有配置（包括快捷方式、搜索引擎、背景图等），确定继续吗？', {
        iconType: 'warning', title: '确认导入', okText: '继续导入'
    });
    if (!ok2) return;

    // 写入 localStorage
    if (data.localStorage && typeof data.localStorage === 'object') {
        CONFIG_KEYS.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(data.localStorage, key)) {
                if (typeof data.localStorage[key] === 'string') localStorage.setItem(key, data.localStorage[key]);
            } else {
                localStorage.removeItem(key);
            }
        });
    }

    // 写入 IndexedDB
    try {
        const stores = [LINK_ICONS_STORE, ENGINE_ICONS_STORE, BG_STORE];
        for (const s of stores) await clearStore(s);
        if (data.indexedDB) {
            await bulkPutToStore(LINK_ICONS_STORE, data.indexedDB.linkIcons || []);
            await bulkPutToStore(ENGINE_ICONS_STORE, data.indexedDB.engineIcons || []);
            await bulkPutToStore(BG_STORE, data.indexedDB.backgroundImage || []);
        }
    } catch (e) { console.error('导入 IndexedDB 失败:', e); }

    // 重新初始化 UI，不重载页面
    initThemeColors();
    initSearchEngines();
    initQuickLinks();
    initSearchHistory();
    initTheme();
    initBlurToggle();
    await loadBackground();
    initLinksTip();

    await showAlert('导入成功！所有配置已生效。', { iconType: 'success', title: '导入成功' });
}

// ============================================================
// 重置
// ============================================================
async function resetAllSettings() {
    const ok = await showConfirm('确定要重置所有设置吗？这将清除所有自定义设置并恢复默认状态。', {
        iconType: 'warning', title: '重置所有设置', okText: '重置', danger: true
    });
    if (!ok) return;

    CONFIG_KEYS.forEach(k => localStorage.removeItem(k));

    try {
        await new Promise((resolve, reject) => {
            if (!db) return resolve();
            const transaction = db.transaction([LINK_ICONS_STORE, ENGINE_ICONS_STORE, BG_STORE], "readwrite");
            transaction.objectStore(LINK_ICONS_STORE).clear();
            transaction.objectStore(ENGINE_ICONS_STORE).clear();
            transaction.objectStore(BG_STORE).clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
            transaction.onabort = (e) => reject(e.target.error);
        });
    } catch (error) { console.error("重置 IndexedDB 失败:", error); }

    document.body.classList.remove('has-custom-bg', 'no-blur');
    const root = document.documentElement;
    root.style.removeProperty('--bg-image');
    root.style.removeProperty('--bg-blur');
    root.style.removeProperty('--bg-brightness');
    root.style.removeProperty('--bg-saturation');
    root.style.removeProperty('--bg-overlay');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--accent-dark');
    root.style.removeProperty('--accent-rgb');
    root.style.removeProperty('--accent-2-rgb');

    initThemeColors();
    initSearchEngines();
    initQuickLinks();
    initSearchHistory();
    initTheme();
    initBlurToggle();
    await loadBackground();
    initLinksTip();

    document.getElementById('settings-panel').classList.remove('open');
    await showAlert('所有设置已重置成功！', { iconType: 'success', title: '重置成功' });
}

// ============================================================
// 事件监听
// ============================================================
function setupEventListeners() {
    document.getElementById('engine-container').addEventListener('click', (e) => {
        if (suppressNextClick) { e.preventDefault(); e.stopPropagation(); return; }
        const editBtn = e.target.closest('.engine-edit-btn');
        if (editBtn) { openEngineModal(editBtn.dataset.engine); return; }
        const btn = e.target.closest('.engine-btn');
        if (btn) setActiveEngine(btn.dataset.engine);
    });

    document.getElementById('links-container').addEventListener('click', (e) => {
        if (suppressNextClick) return;
        const editBtn = e.target.closest('.link-edit-btn');
        if (editBtn) {
            e.stopPropagation();
            e.preventDefault();
            openLinkModal(parseInt(editBtn.dataset.index, 10));
        }
    });

    document.addEventListener('input', (e) => {
        const el = e.target;
        if (el && el.id && el.classList && el.classList.contains('form-control')) {
            clearFieldError(el.id);
        }
    });

    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    document.getElementById('add-link-btn').addEventListener('click', () => openLinkModal());
    document.getElementById('add-engine-btn').addEventListener('click', () => openEngineModal());

    document.getElementById('close-link-modal').addEventListener('click', closeLinkModal);
    document.getElementById('cancel-link-btn').addEventListener('click', closeLinkModal);
    document.getElementById('close-engine-modal').addEventListener('click', closeEngineModal);
    document.getElementById('cancel-engine-btn').addEventListener('click', closeEngineModal);
    document.getElementById('close-theme-colors-modal').addEventListener('click', closeThemeColorsModal);

    document.getElementById('save-link-btn').addEventListener('click', saveLink);
    document.getElementById('save-engine-btn').addEventListener('click', saveEngine);
    document.getElementById('delete-engine-btn').addEventListener('click', deleteEngine);

    document.getElementById('delete-link-btn').addEventListener('click', async () => {
        if (currentEditLinkIndex === null) return;
        const idx = currentEditLinkIndex;
        const ok = await deleteLink(idx);
        if (ok) closeLinkModal();
    });

    document.getElementById('link-modal').addEventListener('click', (e) => {
        if (e.target.id === 'link-modal') closeLinkModal();
    });
    document.getElementById('engine-modal').addEventListener('click', (e) => {
        if (e.target.id === 'engine-modal') closeEngineModal();
    });
    document.getElementById('theme-colors-modal').addEventListener('click', (e) => {
        if (e.target.id === 'theme-colors-modal') closeThemeColorsModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const dlg = document.getElementById('dialog-overlay');
            if (dlg && dlg.classList.contains('show')) return;
            closeLinkModal();
            closeEngineModal();
            closeBgModal();
            closeThemeColorsModal();
            document.getElementById('settings-panel').classList.remove('open');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.link-card') && !e.target.closest('.engine-btn-container')) {
            document.querySelectorAll('.touch-active').forEach(el => {
                el.classList.remove('touch-active');
                delete el.dataset.tapBlocked;
            });
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('system-theme-toggle').addEventListener('change', toggleFollowSystem);

    document.getElementById('blur-toggle').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('blurEnabled', enabled);
        document.body.classList.toggle('no-blur', !enabled);
    });

    document.getElementById('clear-history').addEventListener('click', async () => {
        const ok = await showConfirm('确定要清空所有搜索历史吗？', {
            iconType: 'warning', title: '清空搜索历史', okText: '清空', danger: true
        });
        if (ok) clearSearchHistory();
    });

    document.getElementById('export-config-btn').addEventListener('click', exportConfig);
    document.getElementById('import-config-btn').addEventListener('click', () => {
        document.getElementById('import-config-file').click();
    });
    document.getElementById('import-config-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        await importConfigFromFile(file);
    });

    // ===== 主题颜色 =====
    document.getElementById('theme-colors-btn').addEventListener('click', () => {
        document.getElementById('settings-panel').classList.remove('open');
        openThemeColorsModal();
    });

    document.getElementById('primary-color-picker').addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('primary-color-text').value = val;
        clearFieldError('primary-color-text');
        updateColorPreview();
    });
    document.getElementById('primary-color-text').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const norm = normalizeHex(val);
        if (norm) {
            document.getElementById('primary-color-picker').value = norm;
        }
        updateColorPreview();
    });
    document.getElementById('accent-color-picker').addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('accent-color-text').value = val;
        clearFieldError('accent-color-text');
        updateColorPreview();
    });
    document.getElementById('accent-color-text').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const norm = normalizeHex(val);
        if (norm) {
            document.getElementById('accent-color-picker').value = norm;
        }
        updateColorPreview();
    });

    document.getElementById('save-theme-colors-btn').addEventListener('click', saveThemeColors);
    document.getElementById('reset-theme-colors-btn').addEventListener('click', () => {
        document.getElementById('primary-color-picker').value = DEFAULT_THEME_COLORS.primary;
        document.getElementById('primary-color-text').value = DEFAULT_THEME_COLORS.primary;
        document.getElementById('accent-color-picker').value = DEFAULT_THEME_COLORS.accent;
        document.getElementById('accent-color-text').value = DEFAULT_THEME_COLORS.accent;
        clearAllFieldErrors(document.getElementById('theme-colors-modal'));
        updateColorPreview();
    });

    document.querySelectorAll('.color-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = btn.dataset.primary;
            const a = btn.dataset.accent;
            document.getElementById('primary-color-picker').value = p;
            document.getElementById('primary-color-text').value = p;
            document.getElementById('accent-color-picker').value = a;
            document.getElementById('accent-color-text').value = a;
            clearAllFieldErrors(document.getElementById('theme-colors-modal'));
            updateColorPreview();
        });
    });

    // ===== 链接图标 =====
    document.querySelectorAll('#link-modal .icon-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
            clearAllFieldErrors(document.getElementById('link-modal'));

            const type = option.dataset.type;
            if (type === 'fa') {
                document.getElementById('link-fa-container').style.display = 'block';
                currentLinkIconType = 'fa';
                currentLinkKeepExistingIcon = false;
            } else if (type === 'url') {
                document.getElementById('link-url-container').style.display = 'block';
                currentLinkIconType = 'url';
                currentLinkKeepExistingIcon = false;
            } else if (type === 'upload') {
                document.getElementById('link-upload-container').style.display = 'block';
                currentLinkIconType = 'upload';
                if (currentEditLinkOriginalType === 'db' && currentEditLinkId) {
                    currentLinkKeepExistingIcon = true;
                }
            }
            updateLinkIconPreview();
        });
    });

    document.getElementById('link-fa-icon').addEventListener('input', updateLinkIconPreview);
    document.getElementById('link-icon-url').addEventListener('input', updateLinkIconPreview);
    document.getElementById('link-icon-upload').addEventListener('change', handleLinkIconUpload);

    // ===== 引擎图标 =====
    document.querySelectorAll('#engine-modal .icon-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
            clearAllFieldErrors(document.getElementById('engine-modal'));

            const type = option.dataset.type;
            if (type === 'fa') {
                document.getElementById('engine-fa-container').style.display = 'block';
                currentEngineIconType = 'fa';
                currentEngineKeepExistingIcon = false;
            } else if (type === 'url') {
                document.getElementById('engine-url-container').style.display = 'block';
                currentEngineIconType = 'url';
                currentEngineKeepExistingIcon = false;
            } else if (type === 'upload') {
                document.getElementById('engine-upload-container').style.display = 'block';
                currentEngineIconType = 'upload';
                if (currentEditEngine && currentEditEngine.type === 'db') {
                    currentEngineKeepExistingIcon = true;
                }
            }
            updateEngineIconPreview();
        });
    });

    document.getElementById('engine-fa-icon').addEventListener('input', updateEngineIconPreview);
    document.getElementById('engine-icon-url').addEventListener('input', updateEngineIconPreview);
    document.getElementById('engine-icon-upload').addEventListener('change', handleEngineIconUpload);

    // ===== 背景 =====
    document.getElementById('bg-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-panel').classList.remove('open');
        openBgModal();
    });
    document.getElementById('close-bg-modal').addEventListener('click', closeBgModal);
    document.getElementById('cancel-bg-btn').addEventListener('click', closeBgModal);
    document.getElementById('save-bg-btn').addEventListener('click', saveBg);
    document.getElementById('bg-modal').addEventListener('click', (e) => {
        if (e.target.id === 'bg-modal') closeBgModal();
    });

    document.querySelectorAll('#bg-modal .icon-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('#bg-modal .icon-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            document.querySelectorAll('#bg-modal .icon-selector').forEach(el => el.style.display = 'none');
            clearAllFieldErrors(document.getElementById('bg-modal'));

            const type = option.dataset.bgType;
            const previewImage = document.getElementById('bg-preview-image');
            const uploadHint = document.getElementById('bg-upload-hint');

            if (type === 'none') {
                currentBgType = 'none';
                previewImage.style.backgroundImage = cssUrl(DEFAULT_BG_URL);
                uploadHint.style.display = 'none';
            } else if (type === 'url') {
                currentBgType = 'url';
                document.getElementById('bg-url-container').style.display = 'block';
                uploadHint.style.display = 'none';
                updateBgPreviewFromUrl();
            } else if (type === 'upload') {
                currentBgType = 'upload';
                document.getElementById('bg-upload-container').style.display = 'block';
                if (bgKeepExisting) {
                    uploadHint.style.display = 'block';
                    getIconFromDB(BG_STORE, BG_KEY).then(data => {
                        previewImage.style.backgroundImage = cssUrl(data || DEFAULT_BG_URL);
                    }).catch(() => {
                        previewImage.style.backgroundImage = cssUrl(DEFAULT_BG_URL);
                    });
                } else {
                    uploadHint.style.display = 'none';
                    previewImage.style.backgroundImage = cssUrl(DEFAULT_BG_URL);
                }
            }
        });
    });

    document.getElementById('bg-url-input').addEventListener('input', updateBgPreviewFromUrl);

    document.getElementById('bg-image-upload').addEventListener('change', (e) => {
        clearFieldError('bg-image-upload');
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) {
            setFieldError('bg-image-upload', '请选择图片文件');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('bg-preview-image').style.backgroundImage = cssUrl(ev.target.result);
            bgKeepExisting = false;
        };
        reader.readAsDataURL(file);
    });

    const effectKeys = ['blur', 'brightness', 'saturation', 'overlay'];
    effectKeys.forEach(key => {
        const input = document.getElementById('bg-' + key);
        input.addEventListener('input', () => {
            previewEffects[key] = parseInt(input.value, 10);
            updateSliderProgress(input);
            updateSliderLabels();
            updateBgPreviewEffects();
        });
    });

    document.getElementById('reset-bg-effects').addEventListener('click', () => {
        previewEffects = { ...DEFAULT_EFFECTS };
        setSlidersFromEffects(previewEffects);
        updateAllSliderProgress();
        updateBgPreviewEffects();
    });

    document.querySelectorAll('.bg-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = BG_PRESETS[btn.dataset.preset];
            if (!preset) return;
            previewEffects = { ...preset };
            setSlidersFromEffects(previewEffects);
            updateAllSliderProgress();
            updateBgPreviewEffects();
        });
    });

    document.getElementById('settings-toggle').addEventListener('click', function (e) {
        e.stopPropagation();
        document.getElementById('settings-panel').classList.toggle('open');
    });

    document.getElementById('reset-settings').addEventListener('click', resetAllSettings);

    document.addEventListener('click', function (e) {
        const settingsPanel = document.getElementById('settings-panel');
        const settingsToggle = document.getElementById('settings-toggle');

        if (settingsPanel.classList.contains('open') &&
            !settingsPanel.contains(e.target) &&
            !settingsToggle.contains(e.target)) {
            settingsPanel.classList.remove('open');
        }
    });
}

// ============================================================
// 快捷方式模态框
// ============================================================
function openLinkModal(index = null) {
    const modal = document.getElementById('link-modal');
    const title = document.getElementById('link-modal-title');
    const nameInput = document.getElementById('link-name');
    const urlInput = document.getElementById('link-url');
    const faInput = document.getElementById('link-fa-icon');
    const urlIconInput = document.getElementById('link-icon-url');
    const uploadInput = document.getElementById('link-icon-upload');
    const uploadHint = document.getElementById('link-upload-hint');
    const deleteBtn = document.getElementById('delete-link-btn');

    document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
    document.getElementById('link-fa-option').classList.add('active');
    document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
    document.getElementById('link-fa-container').style.display = 'block';
    clearAllFieldErrors(modal);
    currentLinkIconType = 'fa';
    currentLinkKeepExistingIcon = false;
    currentEditLinkId = null;
    currentEditLinkOriginalType = null;
    faInput.value = '';
    urlIconInput.value = '';
    uploadInput.value = '';
    uploadHint.style.display = 'none';

    if (index !== null && index >= 0) {
        const links = getSavedLinks();
        const link = links[index];
        if (!link) { showAlert('未找到该快捷方式', { iconType: 'error' }); return; }

        title.textContent = '编辑快捷方式';
        nameInput.value = link.name;
        urlInput.value = link.url;
        currentEditLinkId = link.id;
        currentEditLinkOriginalType = link.type;
        currentEditLinkIndex = index;
        deleteBtn.style.display = 'inline-block';

        if (link.type === 'fa') {
            faInput.value = link.icon;
        } else if (link.type === 'url') {
            urlIconInput.value = link.icon;
            document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('link-url-option').classList.add('active');
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('link-url-container').style.display = 'block';
            currentLinkIconType = 'url';
        } else if (link.type === 'db') {
            document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('link-upload-option').classList.add('active');
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('link-upload-container').style.display = 'block';
            currentLinkIconType = 'upload';
            currentLinkKeepExistingIcon = true;
            uploadHint.style.display = 'block';
        }

        updateLinkIconPreview();
    } else {
        title.textContent = '添加快捷方式';
        nameInput.value = '';
        urlInput.value = '';
        currentEditLinkIndex = null;
        deleteBtn.style.display = 'none';
        document.getElementById('link-icon-preview').innerHTML = '<i class="fas fa-link"></i>';
    }

    modal.classList.add('show');
    lockBodyScroll();
    setTimeout(() => nameInput.focus(), 50);
}

function updateLinkIconPreview() {
    const preview = document.getElementById('link-icon-preview');

    if (currentLinkIconType === 'fa') {
        const faClass = sanitizeFaClass(document.getElementById('link-fa-icon').value);
        preview.innerHTML = faClass ? `<i class="${faClass}"></i>` : '<i class="fas fa-link"></i>';
    } else if (currentLinkIconType === 'url') {
        const url = document.getElementById('link-icon-url').value.trim();
        preview.innerHTML = url
            ? `<img src="${escapeHtml(url)}" alt="图标预览" onerror="this.replaceWith(document.createElement('i'))">`
            : '<i class="fas fa-link"></i>';
    }
}

function handleLinkIconUpload(e) {
    clearFieldError('link-icon-upload');
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
        setFieldError('link-icon-upload', '请选择图片文件');
        e.target.value = '';
        return;
    }
    if (file.size > 500 * 1024) {
        setFieldError('link-icon-upload', '图标文件过大，请选择小于 500KB 的图片');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
        document.getElementById('link-icon-preview').innerHTML = `<img src="${ev.target.result}" alt="上传的图标">`;
        currentLinkKeepExistingIcon = false;
    };
    reader.readAsDataURL(file);
}

function closeLinkModal() {
    const modal = document.getElementById('link-modal');
    if (!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    unlockBodyScroll();
}

async function saveLink() {
    const modal = document.getElementById('link-modal');
    clearAllFieldErrors(modal);

    const name = document.getElementById('link-name').value.trim();
    const url = document.getElementById('link-url').value.trim();

    let hasError = false;
    if (!name) { setFieldError('link-name', '请输入名称'); hasError = true; }
    if (!url) { setFieldError('link-url', '请输入网址'); hasError = true; }
    if (hasError) return;

    let normalizedUrl = url;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) normalizedUrl = 'https://' + url;
    try { new URL(normalizedUrl); }
    catch (e) {
        setFieldError('link-url', '请输入有效的网址（例如：https://example.com）');
        return;
    }

    let iconType = currentLinkIconType;
    let iconValue = '';

    if (iconType === 'upload') {
        const fileInput = document.getElementById('link-icon-upload');
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = async function () {
                await completeSaveLink(name, normalizedUrl, reader.result, 'db', currentEditLinkId, false);
            };
            reader.onerror = () => showAlert('读取文件失败，请重试', { iconType: 'error' });
            reader.readAsDataURL(file);
            return;
        } else if (currentLinkKeepExistingIcon && currentEditLinkId) {
            await completeSaveLink(name, normalizedUrl, '', 'db', currentEditLinkId, true);
            return;
        } else {
            setFieldError('link-icon-upload', '请选择要上传的图标文件');
            return;
        }
    } else if (iconType === 'fa') {
        iconValue = sanitizeFaClass(document.getElementById('link-fa-icon').value);
        if (!iconValue) {
            setFieldError('link-fa-icon', '请输入有效的 Font Awesome 图标类名');
            return;
        }
    } else if (iconType === 'url') {
        iconValue = document.getElementById('link-icon-url').value.trim();
        if (!iconValue) {
            setFieldError('link-icon-url', '请输入图标 URL');
            return;
        }
        try { new URL(iconValue); }
        catch (e) {
            setFieldError('link-icon-url', '请输入有效的图标 URL');
            return;
        }
    }

    await completeSaveLink(name, normalizedUrl, iconValue, iconType, currentEditLinkId, false);
}

async function completeSaveLink(name, url, iconValue, iconType, id, keepExistingIcon) {
    const links = getSavedLinks();
    const finalId = id || ('link_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const oldLink = currentEditLinkIndex !== null ? links[currentEditLinkIndex] : null;

    const linkData = {
        id: finalId,
        name: name,
        url: url,
        icon: iconType === 'db' ? '' : iconValue,
        type: iconType
    };

    if (iconType === 'db') {
        if (!keepExistingIcon) {
            try { await saveIconToDB(LINK_ICONS_STORE, finalId, iconValue); }
            catch (error) {
                console.error("保存链接图标失败:", error);
                showAlert("保存图标时出错，请重试", { iconType: 'error' });
                return;
            }
        }
    } else if (oldLink && oldLink.type === 'db' && oldLink.id === finalId) {
        try { await deleteIconFromDB(LINK_ICONS_STORE, finalId); }
        catch (error) { console.error("清理旧链接图标失败:", error); }
    }

    if (currentEditLinkIndex !== null && links[currentEditLinkIndex]) {
        links[currentEditLinkIndex] = linkData;
    } else {
        links.push(linkData);
    }

    localStorage.setItem('quickLinks', JSON.stringify(links));
    renderLinks(links);
    closeLinkModal();
}

async function deleteLink(index) {
    const ok = await showConfirm('确定要删除这个快捷方式吗？', {
        iconType: 'warning', title: '删除快捷方式', okText: '删除', danger: true
    });
    if (!ok) return false;

    const links = getSavedLinks();
    const link = links[index];
    if (!link) return false;

    if (link.type === 'db') {
        try { await deleteIconFromDB(LINK_ICONS_STORE, link.id); }
        catch (error) { console.error("删除链接图标失败:", error); }
    }

    links.splice(index, 1);
    localStorage.setItem('quickLinks', JSON.stringify(links));
    renderLinks(links);
    return true;
}

// ============================================================
// 搜索引擎模态框
// ============================================================
function openEngineModal(engineId = null) {
    const modal = document.getElementById('engine-modal');
    const title = document.getElementById('engine-modal-title');
    const nameInput = document.getElementById('engine-name');
    const urlInput = document.getElementById('engine-url');
    const faInput = document.getElementById('engine-fa-icon');
    const urlIconInput = document.getElementById('engine-icon-url');
    const uploadInput = document.getElementById('engine-icon-upload');
    const uploadHint = document.getElementById('engine-upload-hint');
    const deleteBtn = document.getElementById('delete-engine-btn');

    document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
    document.getElementById('engine-fa-option').classList.add('active');
    document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
    document.getElementById('engine-fa-container').style.display = 'block';
    clearAllFieldErrors(modal);
    currentEngineIconType = 'fa';
    currentEngineKeepExistingIcon = false;
    faInput.value = '';
    urlIconInput.value = '';
    uploadInput.value = '';
    uploadHint.style.display = 'none';

    if (engineId) {
        const engines = getSavedEngines();
        const engine = engines.find(e => e.id === engineId);
        if (!engine) { showAlert('未找到该搜索引擎', { iconType: 'error' }); return; }

        title.textContent = '编辑搜索引擎';
        nameInput.value = engine.name;
        urlInput.value = engine.url;
        currentEditEngine = engine;

        if (engine.type === 'fa') {
            faInput.value = engine.icon;
        } else if (engine.type === 'url') {
            urlIconInput.value = engine.icon;
            document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('engine-url-option').classList.add('active');
            document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('engine-url-container').style.display = 'block';
            currentEngineIconType = 'url';
        } else if (engine.type === 'db') {
            document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('engine-upload-option').classList.add('active');
            document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('engine-upload-container').style.display = 'block';
            currentEngineIconType = 'upload';
            currentEngineKeepExistingIcon = true;
            uploadHint.style.display = 'block';
        }

        updateEngineIconPreview();
        deleteBtn.style.display = engine.isDefault ? 'none' : 'inline-block';
    } else {
        title.textContent = '添加搜索引擎';
        nameInput.value = '';
        urlInput.value = '';
        currentEditEngine = null;
        deleteBtn.style.display = 'none';
        document.getElementById('engine-icon-preview').innerHTML = '<i class="fas fa-search"></i>';
    }

    modal.classList.add('show');
    lockBodyScroll();
    setTimeout(() => nameInput.focus(), 50);
}

function updateEngineIconPreview() {
    const preview = document.getElementById('engine-icon-preview');

    if (currentEngineIconType === 'fa') {
        const faClass = sanitizeFaClass(document.getElementById('engine-fa-icon').value);
        preview.innerHTML = faClass ? `<i class="${faClass}"></i>` : '<i class="fas fa-search"></i>';
    } else if (currentEngineIconType === 'url') {
        const url = document.getElementById('engine-icon-url').value.trim();
        preview.innerHTML = url
            ? `<img src="${escapeHtml(url)}" alt="图标预览" onerror="this.replaceWith(document.createElement('i'))">`
            : '<i class="fas fa-search"></i>';
    }
}

function handleEngineIconUpload(e) {
    clearFieldError('engine-icon-upload');
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
        setFieldError('engine-icon-upload', '请选择图片文件');
        e.target.value = '';
        return;
    }
    if (file.size > 500 * 1024) {
        setFieldError('engine-icon-upload', '图标文件过大，请选择小于 500KB 的图片');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
        document.getElementById('engine-icon-preview').innerHTML = `<img src="${ev.target.result}" alt="上传的图标">`;
        currentEngineKeepExistingIcon = false;
    };
    reader.readAsDataURL(file);
}

function closeEngineModal() {
    const modal = document.getElementById('engine-modal');
    if (!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    unlockBodyScroll();
}

async function saveEngine() {
    const modal = document.getElementById('engine-modal');
    clearAllFieldErrors(modal);

    const name = document.getElementById('engine-name').value.trim();
    const url = document.getElementById('engine-url').value.trim();

    let hasError = false;
    if (!name) { setFieldError('engine-name', '请输入名称'); hasError = true; }
    if (!url) { setFieldError('engine-url', '请输入搜索 URL'); hasError = true; }
    if (hasError) return;

    if (!url.includes('{query}')) {
        setFieldError('engine-url', '搜索 URL 中必须包含 {query} 占位符');
        return;
    }

    let iconType = currentEngineIconType;
    let iconValue = '';

    if (iconType === 'upload') {
        const fileInput = document.getElementById('engine-icon-upload');
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = async function () {
                await completeSaveEngine(name, url, reader.result, 'db', false);
            };
            reader.onerror = () => showAlert('读取文件失败，请重试', { iconType: 'error' });
            reader.readAsDataURL(file);
            return;
        } else if (currentEngineKeepExistingIcon && currentEditEngine) {
            await completeSaveEngine(name, url, '', 'db', true);
            return;
        } else {
            setFieldError('engine-icon-upload', '请选择要上传的图标文件');
            return;
        }
    } else if (iconType === 'fa') {
        iconValue = sanitizeFaClass(document.getElementById('engine-fa-icon').value);
        if (!iconValue) {
            setFieldError('engine-fa-icon', '请输入有效的 Font Awesome 图标类名');
            return;
        }
    } else if (iconType === 'url') {
        iconValue = document.getElementById('engine-icon-url').value.trim();
        if (!iconValue) {
            setFieldError('engine-icon-url', '请输入图标 URL');
            return;
        }
        try { new URL(iconValue); }
        catch (e) {
            setFieldError('engine-icon-url', '请输入有效的图标 URL');
            return;
        }
    }

    await completeSaveEngine(name, url, iconValue, iconType, false);
}

async function completeSaveEngine(name, url, iconValue, iconType, keepExistingIcon) {
    const engines = getSavedEngines();
    const engineId = currentEditEngine ? currentEditEngine.id : ('engine_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

    if (iconType === 'db') {
        if (!keepExistingIcon) {
            try { await saveIconToDB(ENGINE_ICONS_STORE, engineId, iconValue); }
            catch (error) {
                console.error("保存搜索引擎图标失败:", error);
                showAlert("保存图标时出错，请重试", { iconType: 'error' });
                return;
            }
        }
    } else if (currentEditEngine && currentEditEngine.type === 'db' && currentEditEngine.id === engineId) {
        try { await deleteIconFromDB(ENGINE_ICONS_STORE, engineId); }
        catch (error) { console.error("清理旧引擎图标失败:", error); }
    }

    const engineData = {
        id: engineId,
        name: name,
        url: url,
        icon: iconType === 'db' ? '' : iconValue,
        type: iconType,
        isDefault: currentEditEngine ? !!currentEditEngine.isDefault : false
    };

    if (currentEditEngine) {
        const index = engines.findIndex(e => e.id === engineId);
        if (index !== -1) engines[index] = engineData;
    } else {
        engines.push(engineData);
    }

    localStorage.setItem('searchEngines', JSON.stringify(engines));
    renderSearchEngines(engines);
    closeEngineModal();
}

async function deleteEngine() {
    if (!currentEditEngine || currentEditEngine.isDefault) return;

    const ok = await showConfirm(`确定要删除搜索引擎 "${currentEditEngine.name}" 吗？`, {
        iconType: 'warning', title: '删除搜索引擎', okText: '删除', danger: true
    });
    if (!ok) return;

    const engines = getSavedEngines();
    const index = engines.findIndex(e => e.id === currentEditEngine.id);
    if (index === -1) return;

    if (currentEditEngine.type === 'db') {
        try { await deleteIconFromDB(ENGINE_ICONS_STORE, currentEditEngine.id); }
        catch (error) { console.error("删除搜索引擎图标失败:", error); }
    }

    const deletedId = currentEditEngine.id;
    engines.splice(index, 1);
    localStorage.setItem('searchEngines', JSON.stringify(engines));

    if (localStorage.getItem('searchEngine') === deletedId) {
        if (engines.length > 0) localStorage.setItem('searchEngine', engines[0].id);
        else localStorage.removeItem('searchEngine');
    }

    renderSearchEngines(engines);
    closeEngineModal();
}