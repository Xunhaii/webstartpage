/* ============================================================
   Xunhaii 起始页 · 404 页面脚本
   与主页面共用 localStorage（theme / followSystemTheme / blurEnabled / bgConfig）
   ============================================================ */

(function () {
    'use strict';

    // ============================================================
    // 主题：与主页共用 localStorage
    // ============================================================
    function applyTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            setThemeToggleIcon('sun');
        } else {
            document.body.classList.remove('dark-mode');
            setThemeToggleIcon('moon');
        }
        const meta = document.getElementById('theme-color');
        if (meta) meta.content = isDark ? '#1a1a2e' : '#f5f7fa';
    }

    function setThemeToggleIcon(kind) {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        btn.innerHTML = kind === 'sun'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }

    function initTheme() {
        const followSystem = localStorage.getItem('followSystemTheme') !== 'false';
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme');

        if (followSystem) applyTheme(systemPrefersDark);
        else applyTheme(savedTheme === 'dark');

        // 监听系统主题变化（仅当跟随系统时生效）
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            if (localStorage.getItem('followSystemTheme') !== 'false') {
                applyTheme(e.matches);
            }
        });
    }

    function toggleTheme() {
        const isDark = document.body.classList.contains('dark-mode');

        // 手动切换即视为不再跟随系统
        if (localStorage.getItem('followSystemTheme') !== 'false') {
            localStorage.setItem('followSystemTheme', 'false');
        }

        applyTheme(!isDark);
        localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    }

    // ============================================================
    // 高斯模糊开关（与主页共用 localStorage.blurEnabled）
    // ============================================================
    function initBlur() {
        const enabled = localStorage.getItem('blurEnabled') !== 'false';
        document.body.classList.toggle('no-blur', !enabled);
    }

    // ============================================================
    // 背景图片
    // - URL 类型：已在 <head> 内联脚本中应用
    // - DB 类型（上传到 IndexedDB）：异步读取并应用
    // ============================================================
    function initBackground() {
        let cfg;
        try {
            const raw = localStorage.getItem('bgConfig');
            cfg = raw ? JSON.parse(raw) : null;
        } catch (e) {
            cfg = null;
        }

        if (!cfg || cfg.type !== 'db') return;

        const request = indexedDB.open('XunhaiiStartPageDB', 2);

        request.onsuccess = function (event) {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('backgroundImage')) return;

            try {
                const tx = db.transaction(['backgroundImage'], 'readonly');
                const store = tx.objectStore('backgroundImage');
                const req = store.get('current');

                req.onsuccess = function (e) {
                    const record = e.target.result;
                    if (record && record.data) {
                        const escaped = String(record.data)
                            .replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"');
                        document.documentElement.style.setProperty('--bg-image', 'url("' + escaped + '")');
                        document.body.classList.add('has-custom-bg');
                    }
                };
            } catch (e) { /* 忽略 */ }
        };

        request.onerror = function () { /* 忽略 */ };
    }

    // ============================================================
    // 显示当前访问的路径（截断避免溢出）
    // ============================================================
    function showCurrentPath() {
        const el = document.getElementById('error-path');
        if (!el) return;

        let path = window.location.pathname + window.location.search + window.location.hash;
        if (path === '/' || path === '') return;
        if (path.length > 60) path = path.slice(0, 57) + '...';

        el.textContent = path;
    }

    // ============================================================
    // 返回上一页
    // ============================================================
    function setupBackButton() {
        const btn = document.getElementById('go-back');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/';
            }
        });
    }

    // ============================================================
    // 初始化
    // ============================================================
    function init() {
        initTheme();
        initBlur();
        initBackground();
        showCurrentPath();
        setupBackButton();

        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();