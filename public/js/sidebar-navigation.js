(function() {
    // Generate Sidebar HTML
    const sidebarHtml = `
    <aside id="sidebar-wrapper" class="w-64 bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-300 relative z-30 min-h-screen">
        <!-- Floating toggle button -->
        <button id="sidebar-toggle-btn" class="absolute top-8 left-0 -translate-x-1/2 w-6 h-6 rounded-full bg-purple-600 hover:bg-purple-500 border border-slate-700 text-white flex items-center justify-center text-xs shadow-lg cursor-pointer z-40 transition-transform outline-none">
            <i class="fa-solid fa-chevron-right transition-transform" id="toggle-icon"></i>
        </button>

        <!-- Sidebar Header (Logo/Center Info) -->
        <div class="p-6 border-b border-slate-800 flex flex-col gap-2.5">
            <div class="flex items-center gap-3 logo-details">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-purple-500/10">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <span class="font-black text-white text-sm logo-text">Center Zone</span>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center logo-text">
                <span class="text-[10px] text-slate-400 block font-medium">السنتر الحالي</span>
                <span id="sidebar-center-badge" class="text-xs font-bold text-purple-300">--</span>
            </div>
        </div>

        <!-- Navigation Menu Items -->
        <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            <a href="/index.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/index.html">
                <i class="fa-solid fa-house text-sm w-4 text-center"></i>
                <span class="menu-text">لوحة التحكم (الرئيسية)</span>
            </a>
            <a href="/students.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/students.html">
                <i class="fa-solid fa-user-graduate text-sm w-4 text-center"></i>
                <span class="menu-text">إدارة الطلاب</span>
            </a>
            <a href="/teachers.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/teachers.html">
                <i class="fa-solid fa-users-rectangle text-sm w-4 text-center"></i>
                <span class="menu-text">المجموعات والمعلمون</span>
            </a>
            <a href="/scanner.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/scanner.html">
                <i class="fa-solid fa-barcode text-sm w-4 text-center"></i>
                <span class="menu-text">مسح الحضور والغياب</span>
            </a>
            <a href="/inventory.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/inventory.html">
                <i class="fa-solid fa-boxes-stacked text-sm w-4 text-center"></i>
                <span class="menu-text">المخزن والمبيعات</span>
            </a>
            <a href="/financials.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/financials.html">
                <i class="fa-solid fa-sack-dollar text-sm w-4 text-center"></i>
                <span class="menu-text">الماليات والتقارير</span>
            </a>
            <a href="/settings.html" class="menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-xs font-bold" data-path="/settings.html">
                <i class="fa-solid fa-sliders text-sm w-4 text-center"></i>
                <span class="menu-text">إعدادات السنتر</span>
            </a>
            <a href="/super-admin.html" id="sidebar-superadmin-link" class="hidden menu-item flex items-center gap-3.5 px-4 py-3 rounded-xl text-purple-300 hover:bg-purple-600/10 border border-purple-500/10 transition-all text-xs font-black" data-path="/super-admin.html">
                <i class="fa-solid fa-shield-halved text-sm w-4 text-center text-purple-400"></i>
                <span class="menu-text">لوحة السوبر أدمن</span>
            </a>
        </nav>

        <!-- Sidebar Footer -->
        <div class="p-4 border-t border-slate-800/80 bg-slate-950/20 flex flex-col gap-3">
            <div class="flex items-center gap-3 user-info px-2">
                <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-purple-400 text-xs font-bold border border-slate-700">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <div class="user-details overflow-hidden">
                    <span id="sidebar-username" class="text-xs font-bold text-white block truncate">المستخدم</span>
                    <span id="sidebar-role" class="text-[10px] text-slate-400 block font-medium">--</span>
                </div>
            </div>
            <button onclick="handleLogout()" class="menu-item w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all text-xs font-bold border border-transparent">
                <i class="fa-solid fa-right-from-bracket text-sm w-4 text-center"></i>
                <span class="menu-text">تسجيل الخروج</span>
            </button>
        </div>
    </aside>
    `;

    function injectSidebar() {
        // Prepend to body
        document.body.insertAdjacentHTML('afterbegin', sidebarHtml);

        const sidebar = document.getElementById('sidebar-wrapper');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        
        function toggleSidebar(shouldCollapse) {
            if (shouldCollapse) {
                sidebar.classList.add('sidebar-collapsed');
                localStorage.setItem('cz_sidebar_collapsed', 'true');
            } else {
                sidebar.classList.remove('sidebar-collapsed');
                localStorage.setItem('cz_sidebar_collapsed', 'false');
            }
        }
        
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
            toggleSidebar(!isCollapsed);
        });

        // Load state persistence
        const initiallyCollapsed = localStorage.getItem('cz_sidebar_collapsed') === 'true';
        toggleSidebar(initiallyCollapsed);

        // Populate Center details
        const centerBadge = document.getElementById('sidebar-center-badge');
        if (centerBadge && window.getActiveCenterHeader) {
            centerBadge.textContent = window.getActiveCenterHeader() || 'غير محدد';
        }

        // Populate User credentials
        const username = localStorage.getItem('username') || 'المستخدم';
        const role = localStorage.getItem('userRole') || 'CENTER_ADMIN';
        document.getElementById('sidebar-username').textContent = username;
        document.getElementById('sidebar-role').textContent = role === 'SUPER_ADMIN' ? 'سوبر أدمن' : 'مسؤول سنتر';

        if (role === 'SUPER_ADMIN') {
            document.getElementById('sidebar-superadmin-link').classList.remove('hidden');
        }

        // Highlight Active Link
        const path = window.location.pathname;
        highlightActiveSidebarLink(path);
    }

    function highlightActiveSidebarLink(path) {
        const menuLinks = document.querySelectorAll('.menu-item');
        menuLinks.forEach(link => {
            const linkPath = link.getAttribute('data-path') || link.getAttribute('href');
            if (linkPath) {
                // Clear active styles
                link.classList.remove('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/15');
                link.classList.add('text-slate-300', 'hover:bg-slate-850');
                
                // Set active styles if matches
                if (path === linkPath || path.endsWith(linkPath) || (linkPath === '/index.html' && (path === '/' || path === ''))) {
                    link.classList.remove('text-slate-300', 'hover:bg-slate-850');
                    link.classList.add('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/15');
                }
            }
        });
    }

    async function navigateToPage(url, pushState = true) {
        const mainContent = document.getElementById('main-content-area');
        if (!mainContent) {
            window.location.href = url;
            return;
        }
        
        try {
            mainContent.style.opacity = '0.5';
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const htmlText = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            const targetContentArea = doc.getElementById('main-content-area');
            if (targetContentArea) {
                document.title = doc.title || document.title;
                mainContent.innerHTML = targetContentArea.innerHTML;
                
                if (pushState) {
                    history.pushState({ url }, '', url);
                }
                
                highlightActiveSidebarLink(url);
                
                // Reset window.onload to ensure clean slate for page scripts
                window.onload = null;
                
                const pageScripts = doc.querySelectorAll('script');
                for (const script of pageScripts) {
                    const src = script.getAttribute('src') || '';
                    if (src.includes('app-core.js') || src.includes('sidebar-navigation.js') || src.includes('tailwind.config')) continue;
                    
                    let scriptContent = '';
                    if (script.src) {
                        try {
                            const res = await fetch(script.src);
                            scriptContent = await res.text();
                        } catch (e) {
                            console.error('Failed to fetch script src:', script.src, e);
                            continue;
                        }
                    } else {
                        scriptContent = script.textContent;
                    }
                    
                    if (!scriptContent.trim()) continue;
                    
                    // Extract function declarations to dynamically register them on the window object
                    const functionRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g;
                    const functionNames = [];
                    let match;
                    while ((match = functionRegex.exec(scriptContent)) !== null) {
                        functionNames.push(match[1]);
                    }
                    
                    const exposureCode = functionNames.map(name => `window.${name} = ${name};`).join('\n');
                    const wrappedCode = `
(function() {
    try {
        ${scriptContent}
        
        // Expose functions to window for HTML event handlers
        ${exposureCode}
    } catch(err) {
        console.error("Error executing script:", err);
    }
})();
                    `;
                    
                    const newScript = document.createElement('script');
                    newScript.textContent = wrappedCode;
                    document.body.appendChild(newScript);
                }
                
                const navEvent = new CustomEvent('cz-navigated', { detail: { url } });
                window.dispatchEvent(navEvent);
                
                if (typeof window.onload === 'function') {
                    window.onload();
                }
            } else {
                window.location.href = url;
            }
        } catch (err) {
            console.error('SPA Routing Error - falling back to full reload:', err);
            window.location.href = url;
        } finally {
            mainContent.style.opacity = '1';
        }
    }

    // Intercept navigation link clicks globally
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href) return;
        
        if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || link.target === '_blank') {
            return;
        }

        if (href.includes('login.html')) return;
        
        e.preventDefault();
        navigateToPage(href);
    });

    // Handle history popstate events
    window.addEventListener('popstate', (e) => {
        const url = (e.state && e.state.url) ? e.state.url : window.location.pathname;
        navigateToPage(url, false);
    });

    // Global Logout function fallback
    window.handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login.html';
    };

    // Run on Dom Content Loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSidebar);
    } else {
        injectSidebar();
    }
})();
