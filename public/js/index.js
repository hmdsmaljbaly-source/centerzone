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