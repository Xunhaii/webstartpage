// 安全函数：转义HTML特殊字符
function escapeHtml(unsafe) {
    if (!unsafe) return unsafe;
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// IndexedDB 数据库初始化
let db;
const DB_NAME = "XunhaiiStartPageDB";
const DB_VERSION = 1;
const LINK_ICONS_STORE = "linkIcons";
const ENGINE_ICONS_STORE = "engineIcons";

// 初始化 IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = function(event) {
            console.error("IndexedDB 错误:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = function(event) {
            const db = event.target.result;

            // 创建存储对象仓库
            if (!db.objectStoreNames.contains(LINK_ICONS_STORE)) {
                db.createObjectStore(LINK_ICONS_STORE, {
                    keyPath: 'id'
                });
            }

            if (!db.objectStoreNames.contains(ENGINE_ICONS_STORE)) {
                db.createObjectStore(ENGINE_ICONS_STORE, {
                    keyPath: 'id'
                });
            }
        };
    });
}

// 保存图标到 IndexedDB
function saveIconToDB(storeName, id, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("数据库未初始化");
            return;
        }

        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put({
            id,
            data
        });

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// 从 IndexedDB 获取图标
function getIconFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("数据库未初始化");
            return;
        }

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

// 从 IndexedDB 删除图标
function deleteIconFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("数据库未初始化");
            return;
        }

        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 初始化 IndexedDB
    try {
        await initIndexedDB();
    } catch (error) {
        console.error("IndexedDB 初始化失败:", error);
        alert("浏览器存储初始化失败，部分功能可能不可用");
    }

    // 初始化时间和日期
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // 初始化搜索引擎
    initSearchEngines();

    // 初始化快捷链接
    initQuickLinks();

    // 初始化历史记录
    initSearchHistory();

    // 初始化主题
    initTheme();

    // 设置事件监听器
    setupEventListeners();

    // 初始化拖放功能
    initDragAndDrop();
});

// 更新时间和日期
function updateDateTime() {
    const now = new Date();
    const timeElement = document.getElementById('current-time');
    const dateElement = document.getElementById('current-date');

    // 格式化时间
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}`;

    // 格式化日期
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const dayName = days[now.getDay()];
    const month = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();
    dateElement.textContent = `${year}年${month}${date}日 ${dayName}`;
}

// 初始化搜索引擎
function initSearchEngines() {
    let engines = getSavedEngines();

    // 如果没有保存的引擎，创建默认引擎
    if (engines.length === 0) {
        engines = [{
                id: 'bing',
                name: '必应',
                url: 'https://www.bing.com/search?q={query}',
                icon: 'fab fa-microsoft',
                type: 'fa',
                isDefault: true
            },
            {
                id: 'baidu',
                name: '百度',
                url: 'https://www.baidu.com/s?wd={query}',
                icon: 'https://start.xunhaii.com/src/svg/baidu.svg',
                type: 'url',
                isDefault: true
            },
            {
                id: 'google',
                name: '谷歌',
                url: 'https://www.google.com/search?q={query}',
                icon: 'fab fa-google',
                type: 'fa',
                isDefault: true
            }
        ];
        localStorage.setItem('searchEngines', JSON.stringify(engines));
    }

    // 设置默认引擎
    const savedEngine = localStorage.getItem('searchEngine') || engines[0].id;
    setActiveEngine(savedEngine);

    // 渲染引擎
    renderSearchEngines(engines);
}

// 获取保存的搜索引擎
function getSavedEngines() {
    const savedEngines = localStorage.getItem('searchEngines');
    if (savedEngines) {
        return JSON.parse(savedEngines);
    }
    return [];
}

// 渲染搜索引擎
function renderSearchEngines(engines) {
    const container = document.getElementById('engine-container');
    container.innerHTML = '';

    engines.forEach(engine => {
        const engineContainer = document.createElement('div');
        engineContainer.className = 'engine-btn-container';

        let iconContent = '';
        if (engine.type === 'fa') {
            iconContent = `<i class="${engine.icon}"></i>`;
        } else if (engine.type === 'url') {
            iconContent = `<img src="${engine.icon}" alt="${engine.name}" style="width:14px;height:14px;margin-right:3px;">`;
        } else if (engine.type === 'db') {
            // 对于数据库类型，稍后异步加载
            iconContent = `<i class="fas fa-spinner fa-spin"></i>`;
        }

        engineContainer.innerHTML = `
                    <button class="engine-btn" data-engine="${engine.id}">
                        ${iconContent}
                        <span>${engine.name}</span>
                    </button>
                    <button class="engine-edit-btn" data-engine="${engine.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                `;

        // 如果是数据库类型，异步加载图标
        if (engine.type === 'db') {
            loadEngineIcon(engine.id, engineContainer);
        }

        container.appendChild(engineContainer);
    });

    // 设置当前激活的引擎
    const activeEngine = localStorage.getItem('searchEngine') || engines[0].id;
    setActiveEngine(activeEngine);
}

// 异步加载引擎图标
async function loadEngineIcon(engineId, container) {
    try {
        const iconData = await getIconFromDB(ENGINE_ICONS_STORE, engineId);
        if (iconData) {
            const iconElement = container.querySelector('.engine-btn i');
            if (iconElement) {
                // 替换为img元素
                const img = document.createElement('img');
                img.src = iconData;
                img.alt = "Engine icon";
                img.style = "width:14px;height:14px;margin-right:3px;";
                iconElement.replaceWith(img);
            }
        }
    } catch (error) {
        console.error("加载引擎图标失败:", error);
    }
}

// 设置当前搜索引擎
function setActiveEngine(engineId) {
    // 更新按钮状态
    document.querySelectorAll('.engine-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.engine === engineId) {
            btn.classList.add('active');
        }
    });

    // 保存到localStorage
    localStorage.setItem('searchEngine', engineId);
}

// 执行搜索
function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    const engineId = localStorage.getItem('searchEngine');
    const engines = getSavedEngines();
    const engine = engines.find(e => e.id === engineId);

    if (!engine) {
        alert('未找到搜索引擎配置');
        return;
    }

    const searchUrl = engine.url.replace('{query}', encodeURIComponent(query));
    window.open(searchUrl, '_self');

    // 保存搜索历史
    saveSearchHistory(query, engine.name);
}

// 初始化快捷链接
function initQuickLinks() {
    const links = getSavedLinks();
    renderLinks(links);
}

// 获取保存的链接
function getSavedLinks() {
    const savedLinks = localStorage.getItem('quickLinks');
    if (savedLinks) {
        return JSON.parse(savedLinks);
    }

    // 默认链接
    return [{
            id: 'link1',
            name: 'Xunhaii',
            url: 'https://xunhaii.com',
            icon: 'fab fa-x',
            type: 'fa'
        },
        {
            id: 'link2',
            name: '知乎',
            url: 'https://www.zhihu.com',
            icon: 'fab fa-zhihu',
            type: 'fa'
        },
        {
            id: 'link3',
            name: 'B站',
            url: 'https://www.bilibili.com',
            icon: 'fab fa-bilibili',
            type: 'fa'
        },
        {
            id: 'link4',
            name: '抖音',
            url: 'https://www.douyin.com',
            icon: 'fab fa-tiktok',
            type: 'fa'
        },
        {
            id: 'link5',
            name: '微博',
            url: 'https://weibo.com',
            icon: 'fab fa-weibo',
            type: 'fa'
        },
        {
            id: 'link6',
            name: '淘宝',
            url: 'https://www.taobao.com',
            icon: 'fas fa-shopping-cart',
            type: 'fa'
        }
    ];
}

// 渲染链接
function renderLinks(links) {
    const container = document.getElementById('links-container');
    container.innerHTML = '';

    links.forEach((link, index) => {
        const card = document.createElement('div');
        card.className = 'link-card';
        card.setAttribute('draggable', 'true');
        card.dataset.index = index;
        card.dataset.id = link.id;

        let iconContent = '';
        if (link.type === 'fa') {
            iconContent = `<i class="${link.icon}"></i>`;
        } else if (link.type === 'url') {
            iconContent = `<img src="${link.icon}" alt="${link.name}">`;
        } else if (link.type === 'db') {
            // 对于数据库类型，先显示加载图标
            iconContent = `<i class="fas fa-spinner fa-spin"></i>`;
        }

        card.innerHTML = `
                    <div class="link-icon-container">
                        <div class="link-icon">
                            ${iconContent}
                        </div>
                    </div>
                    <div class="link-name">${link.name}</div>
                    <div class="link-actions">
                        <button class="action-btn edit-link" data-index="${index}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-link" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;

        // 添加点击事件打开链接
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn') && !e.target.closest('.link-icon-container')) {
                window.open(link.url, '_self');
            }
        });

        container.appendChild(card);

        // 如果是数据库类型，异步加载图标
        if (link.type === 'db') {
            loadLinkIcon(link.id, card);
        }
    });
}

// 异步加载链接图标
async function loadLinkIcon(linkId, card) {
    try {
        const iconData = await getIconFromDB(LINK_ICONS_STORE, linkId);
        if (iconData) {
            const iconContainer = card.querySelector('.link-icon');
            if (iconContainer) {
                // 移除加载图标，添加实际图标
                iconContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = iconData;
                img.alt = "Link icon";
                iconContainer.appendChild(img);
            }
        }
    } catch (error) {
        console.error("加载链接图标失败:", error);
    }
}

// 初始化拖放功能
function initDragAndDrop() {
    const container = document.getElementById('links-container');
    let draggedItem = null;

    container.addEventListener('dragstart', function(e) {
        if (e.target.classList.contains('link-card')) {
            draggedItem = e.target;
            e.target.classList.add('dragging');

            // 设置拖拽效果
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', e.target.dataset.index);
        }
    });

    container.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (draggedItem) {
            e.dataTransfer.dropEffect = 'move';

            const afterElement = getDragAfterElement(container, e.clientY);
            const currentItem = document.querySelector('.dragging');

            if (afterElement) {
                container.insertBefore(currentItem, afterElement);
            } else {
                container.appendChild(currentItem);
            }
        }
    });

    container.addEventListener('dragend', function(e) {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;

            // 更新链接顺序
            updateLinksOrder();
        }
    });

    // 防止拖拽时触发点击事件
    container.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('link-card')) {
            e.target.style.cursor = 'grabbing';
        }
    });

    container.addEventListener('mouseup', function(e) {
        if (e.target.classList.contains('link-card')) {
            e.target.style.cursor = 'move';
        }
    });
}

// 获取拖拽后的位置元素
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.link-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return {
                offset: offset,
                element: child
            };
        } else {
            return closest;
        }
    }, {
        offset: Number.NEGATIVE_INFINITY
    }).element;
}

// 更新链接顺序
function updateLinksOrder() {
    const container = document.getElementById('links-container');
    const links = getSavedLinks();
    const newLinks = [];

    container.querySelectorAll('.link-card').forEach((card, index) => {
        const originalIndex = parseInt(card.dataset.index);
        newLinks.push(links[originalIndex]);
        card.dataset.index = index;
    });

    // 保存新顺序
    localStorage.setItem('quickLinks', JSON.stringify(newLinks));
}

// 初始化历史记录
function initSearchHistory() {
    const history = getSearchHistory();
    renderSearchHistory(history);
}

// 获取搜索历史
function getSearchHistory() {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
        return JSON.parse(savedHistory);
    }
    return [];
}

// 保存搜索历史
function saveSearchHistory(query, engineName) {
    const history = getSearchHistory();

    // 避免重复记录
    const existingIndex = history.findIndex(item => item.query === query && item.engine === engineName);
    if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
    }

    // 添加新记录
    history.unshift({
        query: query,
        engine: engineName,
        timestamp: new Date().toISOString()
    });

    // 只保留最近的10条记录
    if (history.length > 10) {
        history.pop();
    }

    // 保存到localStorage
    localStorage.setItem('searchHistory', JSON.stringify(history));

    // 重新渲染
    renderSearchHistory(history);
}

// 渲染搜索历史
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

        // 安全渲染：使用textContent代替innerHTML
        const contentDiv = document.createElement('div');
        contentDiv.className = 'history-content';

        const queryDiv = document.createElement('div');
        queryDiv.className = 'history-query';
        queryDiv.textContent = item.query; // 安全渲染

        const engineDiv = document.createElement('div');
        engineDiv.className = 'history-engine';
        engineDiv.textContent = `使用 ${item.engine} 搜索`; // 安全渲染

        contentDiv.appendChild(queryDiv);
        contentDiv.appendChild(engineDiv);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-history';
        deleteBtn.dataset.index = index;
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';

        historyItem.appendChild(contentDiv);
        historyItem.appendChild(deleteBtn);

        // 点击事件 - 重新搜索
        historyItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-history')) {
                document.getElementById('search-input').value = item.query;
                performSearch();
            }
        });

        // 删除按钮
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSearchHistory(index);
        });

        container.appendChild(historyItem);
    });
}

// 删除单条搜索历史
function deleteSearchHistory(index) {
    const history = getSearchHistory();
    history.splice(index, 1);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    renderSearchHistory(history);
}

// 清空搜索历史
function clearSearchHistory() {
    localStorage.removeItem('searchHistory');
    renderSearchHistory([]);
}

// 初始化主题
function initTheme() {
    // 检查是否跟随系统主题
    const followSystem = localStorage.getItem('followSystemTheme') !== 'false';
    document.getElementById('system-theme-toggle').checked = followSystem;

    // 获取系统主题偏好
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 获取用户保存的主题设置
    const savedTheme = localStorage.getItem('theme');

    // 设置主题
    if (followSystem) {
        // 跟随系统
        if (systemPrefersDark) {
            document.body.classList.add('dark-mode');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        }
    } else {
        // 使用用户选择的主题
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (document.getElementById('system-theme-toggle').checked) {
            if (e.matches) {
                document.body.classList.add('dark-mode');
                document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.body.classList.remove('dark-mode');
                document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
            }
            setThemeColor();
        }
    });
    // 设置主题色
    setThemeColor();
}

// 切换主题
function toggleTheme() {
    const followSystem = document.getElementById('system-theme-toggle').checked;

    if (followSystem) {
        // 如果当前是跟随系统，则切换到手动模式
        document.getElementById('system-theme-toggle').checked = false;
        localStorage.setItem('followSystemTheme', 'false');
    }

    // 切换主题
    if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode');
        document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    }
    // 更新主题色
    setThemeColor();
}

// 切换是否跟随系统主题
function toggleFollowSystem() {
    const followSystem = document.getElementById('system-theme-toggle').checked;
    localStorage.setItem('followSystemTheme', followSystem);

    // 更新主题
    initTheme();
}

// 重置所有设置
async function resetAllSettings() {
    if (confirm('确定要重置所有设置吗？这将清除所有自定义设置并恢复默认状态。')) {
        // 清除所有本地存储
        localStorage.removeItem('searchEngines');
        localStorage.removeItem('searchEngine');
        localStorage.removeItem('quickLinks');
        localStorage.removeItem('searchHistory');
        localStorage.removeItem('theme');
        localStorage.removeItem('followSystemTheme');

        // 清除 IndexedDB 数据
        try {
            const transaction = db.transaction([LINK_ICONS_STORE, ENGINE_ICONS_STORE], "readwrite");
            const linkStore = transaction.objectStore(LINK_ICONS_STORE);
            const engineStore = transaction.objectStore(ENGINE_ICONS_STORE);

            linkStore.clear();
            engineStore.clear();
        } catch (error) {
            console.error("重置 IndexedDB 失败:", error);
        }

        // 重新初始化页面
        initSearchEngines();
        initQuickLinks();
        initSearchHistory();
        initTheme();

        // 关闭设置面板
        document.getElementById('settings-panel').classList.remove('open');

        alert('所有设置已重置成功！');
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索引擎切换
    document.getElementById('engine-container').addEventListener('click', (e) => {
        if (e.target.closest('.engine-btn')) {
            const btn = e.target.closest('.engine-btn');
            setActiveEngine(btn.dataset.engine);
        }

        if (e.target.closest('.engine-edit-btn')) {
            const btn = e.target.closest('.engine-edit-btn');
            const engineId = btn.dataset.engine;
            openEngineModal(engineId);
        }
    });

    // 搜索按钮
    document.getElementById('search-btn').addEventListener('click', performSearch);

    // 回车键搜索
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 添加快捷方式按钮
    document.getElementById('add-link-btn').addEventListener('click', () => {
        openLinkModal();
    });

    // 添加搜索引擎按钮
    document.getElementById('add-engine-btn').addEventListener('click', () => {
        openEngineModal();
    });

    // 关闭模态框
    document.getElementById('close-link-modal').addEventListener('click', closeLinkModal);
    document.getElementById('cancel-link-btn').addEventListener('click', closeLinkModal);
    document.getElementById('close-engine-modal').addEventListener('click', closeEngineModal);
    document.getElementById('cancel-engine-btn').addEventListener('click', closeEngineModal);

    // 保存链接
    document.getElementById('save-link-btn').addEventListener('click', saveLink);

    // 保存搜索引擎
    document.getElementById('save-engine-btn').addEventListener('click', saveEngine);

    // 删除搜索引擎
    document.getElementById('delete-engine-btn').addEventListener('click', deleteEngine);

    // 使用事件委托处理编辑和删除链接
    document.getElementById('links-container').addEventListener('click', (e) => {
        if (e.target.closest('.edit-link')) {
            const index = e.target.closest('.edit-link').dataset.index;
            openLinkModal(index);
        }

        if (e.target.closest('.delete-link')) {
            const index = e.target.closest('.delete-link').dataset.index;
            deleteLink(index);
        }
    });

    // 主题切换
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('system-theme-toggle').addEventListener('change', toggleFollowSystem);

    // 清空历史记录
    document.getElementById('clear-history').addEventListener('click', () => {
        if (confirm('确定要清空所有搜索历史吗？')) {
            clearSearchHistory();
        }
    });

    // 链接图标选项切换
    document.querySelectorAll('#link-modal .icon-option').forEach(option => {
        option.addEventListener('click', () => {
            // 更新选中状态
            document.querySelectorAll('#link-modal .icon-option').forEach(o => {
                o.classList.remove('active');
            });
            option.classList.add('active');

            // 显示对应输入框
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => {
                el.style.display = 'none';
            });

            const type = option.dataset.type;
            if (type === 'fa') {
                document.getElementById('link-fa-container').style.display = 'block';
            } else if (type === 'url') {
                document.getElementById('link-url-container').style.display = 'block';
            } else if (type === 'upload') {
                document.getElementById('link-upload-container').style.display = 'block';
            }

            // 更新当前选择的图标类型
            currentLinkIconType = type;
        });
    });

    // 链接图标输入变化
    document.getElementById('link-fa-icon').addEventListener('input', updateLinkIconPreview);
    document.getElementById('link-icon-url').addEventListener('input', updateLinkIconPreview);
    document.getElementById('link-icon-upload').addEventListener('change', handleLinkIconUpload);

    // 引擎图标选项切换
    document.querySelectorAll('#engine-modal .icon-option').forEach(option => {
        option.addEventListener('click', () => {
            // 更新选中状态
            document.querySelectorAll('#engine-modal .icon-option').forEach(o => {
                o.classList.remove('active');
            });
            option.classList.add('active');

            // 显示对应输入框
            document.querySelectorAll('#engine-modal .icon-selector').forEach(el => {
                el.style.display = 'none';
            });

            const type = option.dataset.type;
            if (type === 'fa') {
                document.getElementById('engine-fa-container').style.display = 'block';
            } else if (type === 'url') {
                document.getElementById('engine-url-container').style.display = 'block';
            } else if (type === 'upload') {
                document.getElementById('engine-upload-container').style.display = 'block';
            }

            // 更新当前选择的图标类型
            currentEngineIconType = type;
        });
    });

    // 引擎图标输入变化
    document.getElementById('engine-fa-icon').addEventListener('input', updateEngineIconPreview);
    document.getElementById('engine-icon-url').addEventListener('input', updateEngineIconPreview);
    document.getElementById('engine-icon-upload').addEventListener('change', handleEngineIconUpload);

    // 设置面板切换
    document.getElementById('settings-toggle').addEventListener('click', function() {
        document.getElementById('settings-panel').classList.toggle('open');
    });

    // 重置设置按钮
    document.getElementById('reset-settings').addEventListener('click', resetAllSettings);

    // 点击页面其他地方关闭设置面板
    document.addEventListener('click', function(e) {
        const settingsPanel = document.getElementById('settings-panel');
        const settingsToggle = document.getElementById('settings-toggle');

        if (settingsPanel.classList.contains('open') &&
            !settingsPanel.contains(e.target) &&
            !settingsToggle.contains(e.target)) {
            settingsPanel.classList.remove('open');
        }
    });
}

// 打开链接模态框
function openLinkModal(index = null) {
    const modal = document.getElementById('link-modal');
    const title = document.getElementById('link-modal-title');
    const nameInput = document.getElementById('link-name');
    const urlInput = document.getElementById('link-url');
    const faInput = document.getElementById('link-fa-icon');
    const urlIconInput = document.getElementById('link-icon-url');
    const uploadInput = document.getElementById('link-icon-upload');

    // 重置模态框状态
    document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
    document.getElementById('link-fa-option').classList.add('active');
    document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
    document.getElementById('link-fa-container').style.display = 'block';
    currentLinkIconType = 'fa';
    faInput.value = '';
    urlIconInput.value = '';
    uploadInput.value = '';

    if (index !== null) {
        // 编辑模式
        title.textContent = '编辑快捷方式';
        const links = getSavedLinks();
        const link = links[index];
        nameInput.value = link.name;
        urlInput.value = link.url;

        // 设置图标
        currentLinkIconType = link.type;
        if (link.type === 'fa') {
            faInput.value = link.icon;
            document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('link-fa-option').classList.add('active');
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('link-fa-container').style.display = 'block';
        } else if (link.type === 'url') {
            urlIconInput.value = link.icon;
            document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('link-url-option').classList.add('active');
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('link-url-container').style.display = 'block';
        } else if (link.type === 'db') {
            document.querySelectorAll('#link-modal .icon-option').forEach(o => o.classList.remove('active'));
            document.getElementById('link-upload-option').classList.add('active');
            document.querySelectorAll('#link-modal .icon-selector').forEach(el => el.style.display = 'none');
            document.getElementById('link-upload-container').style.display = 'block';
        }

        updateLinkIconPreview();
        currentEditLinkIndex = index;
    } else {
        // 添加模式
        title.textContent = '添加快捷方式';
        nameInput.value = '';
        urlInput.value = '';
        currentEditLinkIndex = null;

        // 重置图标预览
        const preview = document.getElementById('link-icon-preview');
        preview.innerHTML = '<i class="fas fa-link"></i>';
    }

    modal.style.display = 'flex';
    nameInput.focus();
}

// 更新链接图标预览
function updateLinkIconPreview() {
    const preview = document.getElementById('link-icon-preview');

    if (currentLinkIconType === 'fa') {
        const faClass = document.getElementById('link-fa-icon').value;
        if (faClass) {
            preview.innerHTML = `<i class="${faClass}"></i>`;
        } else {
            preview.innerHTML = '<i class="fas fa-link"></i>';
        }
    } else if (currentLinkIconType === 'url') {
        const url = document.getElementById('link-icon-url').value;
        if (url) {
            preview.innerHTML = `<img src="${escapeHtml(url)}" alt="图标预览">`;
        } else {
            preview.innerHTML = '<i class="fas fa-link"></i>';
        }
    }
}

// 处理链接图标上传
function handleLinkIconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
        alert('请选择图片文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('link-icon-preview');
        preview.innerHTML = `<img src="${e.target.result}" alt="上传的图标">`;
    };
    reader.readAsDataURL(file);
}

// 关闭链接模态框
function closeLinkModal() {
    document.getElementById('link-modal').style.display = 'none';
}

// 保存链接
async function saveLink() {
    const name = document.getElementById('link-name').value.trim();
    const url = document.getElementById('link-url').value.trim();

    if (!name || !url) {
        alert('请填写名称和网址');
        return;
    }

    // 验证URL格式
    try {
        new URL(url);
    } catch (e) {
        alert('请输入有效的网址（例如：https://example.com）');
        return;
    }

    // 获取图标
    let iconValue = '';
    let iconType = currentLinkIconType;
    let id = '';

    if (iconType === 'upload') {
        const fileInput = document.getElementById('link-icon-upload');
        if (!fileInput.files[0]) {
            alert('请选择要上传的图标');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function() {
            iconValue = reader.result;
            // 对于上传的图片，我们将其保存到IndexedDB
            iconType = 'db';

            // 完成保存
            await completeSaveLink(name, url, iconValue, iconType, id);
        };
        reader.readAsDataURL(file);
        return; // 异步处理，稍后继续
    } else if (iconType === 'fa') {
        iconValue = document.getElementById('link-fa-icon').value.trim();
        if (!iconValue) {
            alert('请输入Font Awesome图标类名');
            return;
        }
    } else if (iconType === 'url') {
        iconValue = document.getElementById('link-icon-url').value.trim();
        if (!iconValue) {
            alert('请输入图标URL');
            return;
        }
        try {
            new URL(iconValue);
        } catch (e) {
            alert('请输入有效的图标URL');
            return;
        }
    }

    await completeSaveLink(name, url, iconValue, iconType, id);
}

async function completeSaveLink(name, url, iconValue, iconType, id) {
    const links = getSavedLinks();
    const linkData = {
        id: id || 'link_' + Date.now(),
        name: name,
        url: url,
        icon: iconValue,
        type: iconType
    };

    // 如果是上传的图片类型，保存到IndexedDB
    if (iconType === 'db') {
        try {
            await saveIconToDB(LINK_ICONS_STORE, linkData.id, iconValue);
        } catch (error) {
            console.error("保存链接图标失败:", error);
            alert("保存图标时出错，请重试");
            return;
        }
        // 在链接数据中不存储实际图标数据，只存储类型为'db'
        linkData.icon = '';
    }

    if (currentEditLinkIndex !== null) {
        // 更新现有链接
        links[currentEditLinkIndex] = linkData;
    } else {
        // 添加新链接
        links.push(linkData);
    }

    // 保存到localStorage
    localStorage.setItem('quickLinks', JSON.stringify(links));

    // 重新渲染链接
    renderLinks(links);

    // 关闭模态框
    closeLinkModal();
}

// 删除链接
async function deleteLink(index) {
    if (confirm('确定要删除这个快捷方式吗？')) {
        const links = getSavedLinks();
        const link = links[index];

        // 如果是存储在IndexedDB中的图标，删除它
        if (link.type === 'db') {
            try {
                await deleteIconFromDB(LINK_ICONS_STORE, link.id);
            } catch (error) {
                console.error("删除链接图标失败:", error);
            }
        }

        links.splice(index, 1);
        localStorage.setItem('quickLinks', JSON.stringify(links));
        renderLinks(links);
    }
}

// 打开搜索引擎模态框
function openEngineModal(engineId = null) {
    const modal = document.getElementById('engine-modal');
    const title = document.getElementById('engine-modal-title');
    const nameInput = document.getElementById('engine-name');
    const urlInput = document.getElementById('engine-url');
    const faInput = document.getElementById('engine-fa-icon');
    const urlIconInput = document.getElementById('engine-icon-url');
    const uploadInput = document.getElementById('engine-icon-upload');
    const deleteBtn = document.getElementById('delete-engine-btn');

    // 重置模态框状态
    document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
    document.getElementById('engine-fa-option').classList.add('active');
    document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
    document.getElementById('engine-fa-container').style.display = 'block';
    currentEngineIconType = 'fa';
    faInput.value = '';
    urlIconInput.value = '';
    uploadInput.value = '';

    if (engineId) {
        // 编辑模式
        title.textContent = '编辑搜索引擎';
        const engines = getSavedEngines();
        const engine = engines.find(e => e.id === engineId);

        if (engine) {
            nameInput.value = engine.name;
            urlInput.value = engine.url;

            // 设置图标
            currentEngineIconType = engine.type;
            if (engine.type === 'fa') {
                faInput.value = engine.icon;
                document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
                document.getElementById('engine-fa-option').classList.add('active');
                document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
                document.getElementById('engine-fa-container').style.display = 'block';
            } else if (engine.type === 'url') {
                urlIconInput.value = engine.icon;
                document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
                document.getElementById('engine-url-option').classList.add('active');
                document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
                document.getElementById('engine-url-container').style.display = 'block';
            } else if (engine.type === 'db') {
                document.querySelectorAll('#engine-modal .icon-option').forEach(o => o.classList.remove('active'));
                document.getElementById('engine-upload-option').classList.add('active');
                document.querySelectorAll('#engine-modal .icon-selector').forEach(el => el.style.display = 'none');
                document.getElementById('engine-upload-container').style.display = 'block';
            }

            updateEngineIconPreview();
            currentEditEngine = engine;

            // 如果是默认引擎，隐藏删除按钮
            deleteBtn.style.display = engine.isDefault ? 'none' : 'inline-block';
        }
    } else {
        // 添加模式
        title.textContent = '添加搜索引擎';
        nameInput.value = '';
        urlInput.value = '';
        currentEditEngine = null;
        deleteBtn.style.display = 'none';

        // 重置图标预览
        const preview = document.getElementById('engine-icon-preview');
        preview.innerHTML = '<i class="fas fa-search"></i>';
    }

    modal.style.display = 'flex';
    nameInput.focus();
}

// 更新引擎图标预览
function updateEngineIconPreview() {
    const preview = document.getElementById('engine-icon-preview');

    if (currentEngineIconType === 'fa') {
        const faClass = document.getElementById('engine-fa-icon').value;
        if (faClass) {
            preview.innerHTML = `<i class="${faClass}"></i>`;
        } else {
            preview.innerHTML = '<i class="fas fa-search"></i>';
        }
    } else if (currentEngineIconType === 'url') {
        const url = document.getElementById('engine-icon-url').value;
        if (url) {
            preview.innerHTML = `<img src="${escapeHtml(url)}" alt="图标预览">`;
        } else {
            preview.innerHTML = '<i class="fas fa-search"></i>';
        }
    }
}

// 处理引擎图标上传
function handleEngineIconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
        alert('请选择图片文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('engine-icon-preview');
        preview.innerHTML = `<img src="${e.target.result}" alt="上传的图标">`;
    };
    reader.readAsDataURL(file);
}

// 关闭引擎模态框
function closeEngineModal() {
    document.getElementById('engine-modal').style.display = 'none';
}

// 保存搜索引擎
async function saveEngine() {
    const name = document.getElementById('engine-name').value.trim();
    const url = document.getElementById('engine-url').value.trim();

    if (!name || !url) {
        alert('请填写名称和搜索URL');
        return;
    }

    if (!url.includes('{query}')) {
        alert('搜索URL中必须包含{query}占位符');
        return;
    }

    // 获取图标
    let iconValue = '';
    let iconType = currentEngineIconType;

    if (iconType === 'upload') {
        const fileInput = document.getElementById('engine-icon-upload');
        if (!fileInput.files[0]) {
            alert('请选择要上传的图标');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function() {
            iconValue = reader.result;
            // 对于上传的图片，我们将其保存到IndexedDB
            iconType = 'db';

            // 完成保存
            await completeSaveEngine(name, url, iconValue, iconType);
        };
        reader.readAsDataURL(file);
        return; // 异步处理，稍后继续
    } else if (iconType === 'fa') {
        iconValue = document.getElementById('engine-fa-icon').value.trim();
        if (!iconValue) {
            alert('请输入Font Awesome图标类名');
            return;
        }
    } else if (iconType === 'url') {
        iconValue = document.getElementById('engine-icon-url').value.trim();
        if (!iconValue) {
            alert('请输入图标URL');
            return;
        }
        try {
            new URL(iconValue);
        } catch (e) {
            alert('请输入有效的图标URL');
            return;
        }
    }

    await completeSaveEngine(name, url, iconValue, iconType);
}

async function completeSaveEngine(name, url, iconValue, iconType) {
    const engines = getSavedEngines();
    const engineId = currentEditEngine ? currentEditEngine.id : `engine_${Date.now()}`;

    // 如果是上传的图片类型，保存到IndexedDB
    if (iconType === 'db') {
        try {
            await saveIconToDB(ENGINE_ICONS_STORE, engineId, iconValue);
        } catch (error) {
            console.error("保存搜索引擎图标失败:", error);
            alert("保存图标时出错，请重试");
            return;
        }
        // 在引擎数据中不存储实际图标数据，只存储类型为'db'
        iconValue = '';
    }

    const engineData = {
        id: engineId,
        name: name,
        url: url,
        icon: iconValue,
        type: iconType,
        isDefault: false
    };

    if (currentEditEngine) {
        // 更新现有引擎
        const index = engines.findIndex(e => e.id === engineId);
        if (index !== -1) {
            engines[index] = engineData;
        }
    } else {
        // 添加新引擎
        engines.push(engineData);
    }

    // 保存到localStorage
    localStorage.setItem('searchEngines', JSON.stringify(engines));

    // 重新渲染引擎
    renderSearchEngines(engines);

    // 关闭模态框
    closeEngineModal();
}

// 删除搜索引擎
async function deleteEngine() {
    if (!currentEditEngine || currentEditEngine.isDefault) return;

    if (confirm(`确定要删除搜索引擎 "${currentEditEngine.name}" 吗？`)) {
        const engines = getSavedEngines();
        const index = engines.findIndex(e => e.id === currentEditEngine.id);

        if (index !== -1) {
            // 如果是存储在IndexedDB中的图标，删除它
            if (currentEditEngine.type === 'db') {
                try {
                    await deleteIconFromDB(ENGINE_ICONS_STORE, currentEditEngine.id);
                } catch (error) {
                    console.error("删除搜索引擎图标失败:", error);
                }
            }

            engines.splice(index, 1);

            // 保存到localStorage
            localStorage.setItem('searchEngines', JSON.stringify(engines));

            // 重新渲染引擎
            renderSearchEngines(engines);

            // 关闭模态框
            closeEngineModal();
        }
    }
}

// 设置主题色
function setThemeColor() {
    const themeColor = document.getElementById('theme-color');
    if (document.body.classList.contains('dark-mode')) {
        themeColor.content = '#1a1a2e'; // 夜间模式主题色
    } else {
        themeColor.content = '#f5f7fa'; // 日间模式主题色
    }
}

// 全局变量
let currentEditLinkIndex = null;
let currentLinkIconType = 'fa'; // 'fa', 'url', 'upload'
let currentEditEngine = null;
let currentEngineIconType = 'fa'; // 'fa', 'url', 'upload'