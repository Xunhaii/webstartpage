// 默认搜索引擎和快捷方式
const DEFAULT_SHORTCUTS = [
  { name: 'Xunhaii', url: 'https://xunhaii.com', icon: 'fa-link' },
  { name: 'GitHub', url: 'https://github.com', icon: 'fa-github' },
  { name: 'Bilibili', url: 'https://www.bilibili.com', icon: 'fa-television' },
  { name: '网易企业邮', url: 'https://mail.xunhaii.com', icon: 'fa-envelope' },
];

// 搜索引擎配置
const SEARCH_ENGINES = {
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search?q=',
  },
  baidu: {
    name: '百度',
    url: 'https://www.baidu.com/s?wd=',
  },
  google: {
    name: 'Google',
    url: 'https://www.google.com/search?q=',
  }
};

// DOM 元素
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchEngineBtns = document.querySelectorAll('.search-engine-btn');
const shortcutsGrid = document.getElementById('shortcuts-grid');
const addShortcutBtn = document.getElementById('add-shortcut-btn');
const addShortcutModal = document.getElementById('add-shortcut-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelShortcutBtn = document.getElementById('cancel-shortcut-btn');
const shortcutForm = document.getElementById('shortcut-form');
const shortcutName = document.getElementById('shortcut-name');
const shortcutUrl = document.getElementById('shortcut-url');
const shortcutIcon = document.getElementById('shortcut-icon');
const themeToggle = document.getElementById('theme-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const autoThemeToggle = document.getElementById('auto-theme-toggle');
const bgStyleBtns = document.querySelectorAll('.bg-style-btn');
const layoutBtns = document.querySelectorAll('.layout-btn');

// 当前活动的搜索引擎
let currentEngine = 'bing';

// 初始化
function init() {
  // 加载主题设置
  loadTheme();
  
  // 加载搜索引擎设置
  loadSearchEngine();
  
  // 加载快捷方式
  loadShortcuts();
  
  // 加载背景样式设置
  loadBgStyle();
  
  // 加载快捷方式布局设置
  loadShortcutLayout();

  // 检查自动切换主题的状态
  const savedAutoTheme = localStorage.getItem('autoTheme');
  if (savedAutoTheme === 'true') {
    autoThemeToggle.checked = true;
    handleAutoThemeToggle();
  }
  
  // 添加事件监听器
  setupEventListeners();
}

// 设置事件监听器
function setupEventListeners() {
  // 搜索表单提交
  searchForm.addEventListener('submit', handleSearch);
  
  // 搜索引擎切换
  searchEngineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentEngine = btn.dataset.engine;
      updateActiveEngine();
      saveSearchEngine();
    });
  });
  
  // 添加快捷方式按钮
  addShortcutBtn.addEventListener('click', () => {
    openModal(addShortcutModal);
    shortcutName.focus();
  });
  
  // 关闭模态框
  closeModalBtn.addEventListener('click', () => closeModal(addShortcutModal));
  cancelShortcutBtn.addEventListener('click', () => closeModal(addShortcutModal));
  
  // 快捷方式表单提交
  shortcutForm.addEventListener('submit', handleAddShortcut);
  
  // 主题切换
  themeToggle.addEventListener('click', toggleTheme);
  
  // 设置按钮
  settingsBtn.addEventListener('click', () => openModal(settingsModal));
  closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));
  
  // 重置设置按钮
  resetSettingsBtn.addEventListener('click', resetSettings);
  
  // 窗口滚动事件
  window.addEventListener('scroll', handleScroll);

  // 自动切换主题
  autoThemeToggle.addEventListener('change', handleAutoThemeToggle);

  // 背景样式切换
  bgStyleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.style;
      updateBgStyle(style);
      saveBgStyle(style);
    });
  });
  
  // 快捷方式布局切换
  layoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.layout;
      updateShortcutLayout(layout);
      saveShortcutLayout(layout);
    });
  });
}

// 处理搜索
function handleSearch(e) {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    const engine = SEARCH_ENGINES[currentEngine];
    window.location.href = `${engine.url}${encodeURIComponent(query)}`;
  }
}

// 更新活动搜索引擎
function updateActiveEngine() {
  searchEngineBtns.forEach(btn => {
    if (btn.dataset.engine === currentEngine) {
      btn.classList.add('bg-primary', 'text-white');
      btn.classList.remove('text-gray-700', 'dark:text-gray-300');
    } else {
      btn.classList.remove('bg-primary', 'text-white');
      btn.classList.add('text-gray-700', 'dark:text-gray-300');
    }
  });
}

// 加载搜索引擎设置
function loadSearchEngine() {
  const savedEngine = localStorage.getItem('searchEngine');
  if (savedEngine && SEARCH_ENGINES[savedEngine]) {
    currentEngine = savedEngine;
  }
  updateActiveEngine();
}

// 保存搜索引擎设置
function saveSearchEngine() {
  localStorage.setItem('searchEngine', currentEngine);
}

// 加载快捷方式
function loadShortcuts() {
  let shortcuts = JSON.parse(localStorage.getItem('shortcuts'));
  
  // 如果没有保存的快捷方式，使用默认值
  if (!shortcuts || shortcuts.length === 0) {
    shortcuts = DEFAULT_SHORTCUTS;
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
  }
  
  // 渲染快捷方式
  renderShortcuts(shortcuts);
}

// 渲染快捷方式
function renderShortcuts(shortcuts) {
  shortcutsGrid.innerHTML = '';
  
  shortcuts.forEach((shortcut, index) => {
    const shortcutCard = document.createElement('div');
    shortcutCard.className = 'hover-scale bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-4 flex flex-col items-center justify-center cursor-pointer group transition-all';
    
    // 构建图标元素
    const iconElement = document.createElement('div');
    iconElement.className = 'w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors';
    
    const icon = document.createElement('i');
    icon.className = `fa ${shortcut.icon} text-xl text-primary dark:text-primary`;
    iconElement.appendChild(icon);
    
    // 构建名称元素
    const nameElement = document.createElement('span');
    nameElement.className = 'text-sm font-medium text-neutral dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors';
    nameElement.textContent = shortcut.name;
    
    // 添加右键菜单支持
    shortcutCard.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      deleteShortcut(index);
    });
    
    // 添加点击事件
    shortcutCard.addEventListener('click', () => {
      window.open(shortcut.url, '_blank');
    });
    
    shortcutCard.appendChild(iconElement);
    shortcutCard.appendChild(nameElement);
    shortcutsGrid.appendChild(shortcutCard);
  });
}

// 处理添加快捷方式
function handleAddShortcut(e) {
  e.preventDefault();
  
  const name = shortcutName.value.trim();
  const url = shortcutUrl.value.trim();
  let icon = shortcutIcon.value.trim();
  
  if (!name || !url) {
    alert('请填写名称和网址');
    return;
  }
  
  // 如果没有提供图标，使用默认图标
  if (!icon) {
    icon = 'fa-link';
  }
  
  // 添加 http 前缀（如果没有）
  const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
  
  // 获取现有快捷方式
  let shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || [];
  
  // 添加新快捷方式
  shortcuts.push({ name, url: formattedUrl, icon });
  
  // 保存并重新渲染
  localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
  renderShortcuts(shortcuts);
  
  // 关闭模态框并重置表单
  closeModal(addShortcutModal);
  shortcutForm.reset();
}

// 删除快捷方式
function deleteShortcut(index) {
  if (confirm('确定要删除这个快捷方式吗？')) {
    let shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || [];
    shortcuts.splice(index, 1);
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    renderShortcuts(shortcuts);
  }
}

// 打开模态框
function openModal(modal) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// 关闭模态框
function closeModal(modal) {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// 主题切换
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  localStorage.removeItem('autoTheme');
  autoThemeToggle.checked = false;
}

// 加载主题设置
function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// 处理滚动事件
function handleScroll() {
  const header = document.querySelector('header');
  if (window.scrollY > 10) {
    header.classList.add('shadow-md');
  } else {
    header.classList.remove('shadow-md');
  }
}

// 重置设置
function resetSettings() {
  if (confirm('确定要重置所有设置为默认值吗？')) {
    // 重置主题
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
    
    // 重置搜索引擎
    currentEngine = 'bing';
    updateActiveEngine();
    saveSearchEngine();
    
    // 重置快捷方式
    localStorage.setItem('shortcuts', JSON.stringify(DEFAULT_SHORTCUTS));
    renderShortcuts(DEFAULT_SHORTCUTS);
    
    // 重置自动切换主题
    autoThemeToggle.checked = false;
    localStorage.removeItem('autoTheme');
    
    // 重置背景样式
    updateBgStyle('gradient');
    localStorage.removeItem('bgStyle');
    
    // 重置快捷方式布局
    updateShortcutLayout('grid');
    localStorage.removeItem('shortcutLayout');
    
    // 关闭设置模态框
    closeModal(settingsModal);
  }
}

// 处理自动切换主题
function handleAutoThemeToggle() {
  const isChecked = autoThemeToggle.checked;
  if (isChecked) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    });
    localStorage.setItem('autoTheme', 'true');
  } else {
    localStorage.removeItem('autoTheme');
  }
}

// 更新背景样式
function updateBgStyle(style) {
  const body = document.body;
  if (style === 'gradient') {
    body.classList.add('bg-gradient-to-br', 'from-blue-50', 'to-indigo-50');
    body.classList.remove('bg-solid', 'bg-image');
  } else if (style === 'solid') {
    body.classList.add('bg-solid');
    body.classList.remove('bg-gradient-to-br', 'from-blue-50', 'to-indigo-50', 'bg-image');
  } else if (style === 'image') {
    body.classList.add('bg-image');
    body.classList.remove('bg-gradient-to-br', 'from-blue-50', 'to-indigo-50', 'bg-solid');
  }
}

// 保存背景样式设置
function saveBgStyle(style) {
  localStorage.setItem('bgStyle', style);
}

// 加载背景样式设置
function loadBgStyle() {
  const savedStyle = localStorage.getItem('bgStyle');
  if (savedStyle) {
    updateBgStyle(savedStyle);
  }
}

// 更新快捷方式布局
function updateShortcutLayout(layout) {
  const shortcutsGrid = document.getElementById('shortcuts-grid');
  if (layout === 'grid') {
    shortcutsGrid.classList.add('grid');
    shortcutsGrid.classList.remove('list', 'card');
  } else if (layout === 'list') {
    shortcutsGrid.classList.add('list');
    shortcutsGrid.classList.remove('grid', 'card');
  } else if (layout === 'card') {
    shortcutsGrid.classList.add('card');
    shortcutsGrid.classList.remove('grid', 'list');
  }
}

// 保存快捷方式布局设置
function saveShortcutLayout(layout) {
  localStorage.setItem('shortcutLayout', layout);
}

// 加载快捷方式布局设置
function loadShortcutLayout() {
  const savedLayout = localStorage.getItem('shortcutLayout');
  if (savedLayout) {
    updateShortcutLayout(savedLayout);
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', init);