function getActiveCenterHeader() {
            return localStorage.getItem('currentCenterId') || localStorage.getItem('x-center-id') || localStorage.getItem('centerId') || '';
        }
        window.getActiveCenterHeader = getActiveCenterHeader;
        (function() {
            const token = localStorage.getItem('centerzone_token');
            if (!token) {
                sessionStorage.setItem('redirect_after_login', window.location.pathname);
                window.location.href = '/login.html';
                return;
            }
            const originalFetch = window.fetch;
            window.fetch = async function(url, options = {}) {
                options.headers = options.headers || {};
                const currentToken = localStorage.getItem('centerzone_token');
                const currentCenterId = getActiveCenterHeader();
                if (url && url.toString().startsWith('/api/')) {
                    if (options.headers instanceof Headers) {
                        if (currentToken && !options.headers.has('Authorization')) {
                            options.headers.set('Authorization', 'Bearer ' + currentToken);
                        }
                        if (currentCenterId && !options.headers.has('x-center-id')) {
                            options.headers.set('x-center-id', currentCenterId);
                        }
                    } else {
                        options.headers['Authorization'] = options.headers['Authorization'] || (currentToken ? 'Bearer ' + currentToken : undefined);
                        if (currentCenterId && !options.headers['x-center-id']) {
                            options.headers['x-center-id'] = currentCenterId;
                        }
                    }
                }
                const response = await originalFetch.call(this, url, options);
                if (response.status === 401 || (response.status === 400 || response.status === 404) && url && url.toString().startsWith('/api/')) {
                    if (response.status === 400 || response.status === 404) {
                        const clone = response.clone();
                        try {
                            const data = await clone.json();
                            if (data && data.error && (data.error.includes('tenant') || data.error.includes('Center ID') || data.error.includes('x-center-id'))) {
                                localStorage.removeItem('x-center-id');
                                localStorage.removeItem('currentCenterId');
                                localStorage.removeItem('centerId');
                                alert(data.error || "خطأ في مُعرف السنتر. يرجى تسجيل الدخول مجدداً.");
                                window.location.href = '/login.html';
                                return response;
                            }
                        } catch (e) {}
                    } else if (response.status === 401) {
                        localStorage.clear();
                        alert("جلسة العمل انتهت، يرجى إعادة الدخول");
                        window.location.href = '/login.html';
                    }
                }
                return response;
            };
        })();
    


        window.onload = function() {
            const centerBadge = document.getElementById('currentCenterBadge');
            if (centerBadge && window.getActiveCenterHeader) {
                centerBadge.textContent = window.getActiveCenterHeader();
            }
            fetchDashboardMetrics();
        };

        async function fetchDashboardMetrics() {
            try {
                const stuRes = await fetch('/api/students');
                const stuData = await stuRes.json();
                if (stuData?.success && Array.isArray(stuData.data)) {
                    const el = document.getElementById('kpiTotalStudents');
                    if (el) el.textContent = stuData.data.length;
                }

                const grpRes = await fetch('/api/groups/today');
                const grpData = await grpRes.json();
                if (grpData?.success && Array.isArray(grpData.data)) {
                    const el = document.getElementById('kpiActiveGroups');
                    if (el) el.textContent = grpData.data.length;

                    const listEl = document.getElementById('todayGroupsList');
                    if (listEl) {
                        if (grpData.data.length === 0) {
                            listEl.innerHTML = `
                                <div class="col-span-full text-center py-6 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                                    <i class="fa-solid fa-mug-hot text-2xl text-slate-550 mb-2 block"></i>
                                    <span class="text-xs text-slate-400 font-medium">لا توجد مجموعات مجدولة اليوم في السنتر.</span>
                                </div>`;
                        } else {
                            listEl.innerHTML = grpData.data.map(g => `
                                <div class="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between hover:border-sky-500/40 transition-colors">
                                    <div>
                                        <div class="flex justify-between items-start mb-2">
                                            <span class="text-xs font-bold text-white">${g.name}</span>
                                            <span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold">${g.grade || 'عام'}</span>
                                        </div>
                                        <div class="space-y-1.5 text-[11px] text-slate-400">
                                            <div><i class="fa-solid fa-chalkboard-user ml-1.5 text-slate-500"></i>المدرس: <span class="text-slate-300">${g.teacher?.name || 'غير محدد'}</span></div>
                                            <div><i class="fa-solid fa-clock ml-1.5 text-slate-500"></i>الموعد: <span class="text-slate-300 font-mono">${g.startTime || ''} - ${g.endTime || ''}</span></div>
                                            <div><i class="fa-solid fa-location-dot ml-1.5 text-slate-500"></i>القاعة: <span class="text-slate-300">${g.hall?.name || 'غير محدد'}</span></div>
                                        </div>
                                    </div>
                                    <div class="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                        <span class="text-[10px] text-purple-400 font-bold"><i class="fa-solid fa-money-bill-1 ml-1"></i>${g.price || 0} ج.م</span>
                                        <a href="group-profile.html?id=${g.id}" class="text-[10px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-bold">
                                            <span>لوحة الحصة</span>
                                            <i class="fa-solid fa-chevron-left text-[8px]"></i>
                                        </a>
                                    </div>
                                </div>
                            `).join('');
                        }
                    }
                }

                const tchRes = await fetch('/api/teachers');
                const tchData = await tchRes.json();
                if (tchData?.success && Array.isArray(tchData.data)) {
                    const el = document.getElementById('kpiTeachersCount');
                    if (el) el.textContent = tchData.data.length;
                }

                const invRes = await fetch('/api/inventory');
                const invData = await invRes.json();
                if (invData?.success && Array.isArray(invData.data)) {
                    const el = document.getElementById('kpiInventoryCount');
                    if (el) el.textContent = invData.data.length;
                }
            } catch (e) {
                console.warn('API error fetching metrics:', e);
            }
        }

        function handleLogout() {
            localStorage.clear();
            window.location.href = '/login.html';
        }