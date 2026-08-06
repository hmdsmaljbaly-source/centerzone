tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Cairo', 'Inter', 'sans-serif'],
                    }
                }
            }
        }
    


        function getActiveCenterHeader() {
            return localStorage.getItem('currentCenterId') || localStorage.getItem('x-center-id') || localStorage.getItem('centerId') || '';
        }
        window.getActiveCenterHeader = getActiveCenterHeader;
        (function() {
            const token = localStorage.getItem('centerzone_token');
            const role = localStorage.getItem('userRole');
            if (!token || role !== 'SUPER_ADMIN') {
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
    


        let centersList = [];

        window.onload = function() {
            fetchCentersFromApi();
        };

        async function fetchCentersFromApi() {
            try {
                const response = await fetch('/api/super-admin/centers');
                const resData = await response.json();
                if (resData.success && Array.isArray(resData.data)) {
                    centersList = resData.data.map(c => ({
                        id: c.centerId || c.code || c.id,
                        dbId: c.id,
                        name: c.name,
                        username: (c.users && c.users.length > 0) ? c.users[0].username : 'admin',
                        phone: c.phone || 'غير مسجل',
                        status: c.isActive !== false ? (c.subscription_status || 'ACTIVE') : 'SUSPENDED',
                        expiry: (c.expiresAt || c.expires_at) ? (c.expiresAt || c.expires_at).split('T')[0] : 'غير محدد',
                        studentCount: c._count ? (c._count.students || 0) : 0,
                        teacherCount: c._count ? (c._count.teachers || 0) : 0
                    }));
                } else {
                    centersList = [];
                }
            } catch (e) {
                console.error('API Error fetching centers:', e);
                centersList = [];
            }
            filterCentersTable();
        }

        function updateMetrics() {
            document.getElementById('metricTotalCenters').textContent = centersList.length;
            document.getElementById('metricActiveCenters').textContent = centersList.filter(c => c.status === 'ACTIVE').length;
            document.getElementById('metricSuspendedCenters').textContent = centersList.filter(c => c.status === 'SUSPENDED').length;
            document.getElementById('metricMonthlyRevenue').textContent = (centersList.filter(c => c.status === 'ACTIVE').length * 1500).toLocaleString() + ' ج.م';
        }

        function renderCentersTable(data) {
            const tbody = document.getElementById('centersTableBody');
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">لا توجد سنترات مسجلة بقاعدة البيانات حالياً.</td></tr>`;
                return;
            }

            data.forEach(center => {
                let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                let statusLabel = '🟢 نشط';
                if (center.status === 'SUSPENDED') {
                    badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    statusLabel = '🔴 موقوف';
                } else if (center.status === 'TRIAL') {
                    badgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                    statusLabel = '🟡 فترة تجريبية';
                }

                const rowHtml = `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="p-3.5 font-mono font-bold text-purple-400">${center.id}</td>
                        <td class="p-3.5 font-bold text-white">${center.name}</td>
                        <td class="p-3.5 font-mono text-sky-400">${center.username}</td>
                        <td class="p-3.5 font-mono text-slate-300">${center.phone}</td>
                        <td class="p-3.5 font-mono text-center text-indigo-300"><i class="fa-solid fa-user-graduate text-xs ml-1"></i>${center.studentCount} / <i class="fa-solid fa-chalkboard-user text-xs ml-1"></i>${center.teacherCount}</td>
                        <td class="p-3.5"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${badgeClass}">${statusLabel}</span></td>
                        <td class="p-3.5 font-mono text-slate-400">${center.expiry}</td>
                        <td class="p-3.5 text-center">
                            <div class="flex items-center justify-center gap-1.5 flex-wrap">
                                <button onclick="toggleCenterStatus('${center.id}')" class="px-2.5 py-1.5 ${center.status === 'ACTIVE' ? 'bg-amber-600/20 hover:bg-amber-600 text-amber-300' : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300'} hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all" title="تفعيل/تجميد">
                                    ${center.status === 'ACTIVE' ? 'تجميد 🟡' : 'تفعيل 🟢'}
                                </button>
                                <button onclick="changeCenterPassword('${center.id}', '${center.name}')" class="px-2.5 py-1.5 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all" title="تغيير كلمة السر">
                                    <i class="fa-solid fa-key mr-1"></i>كلمة السر
                                </button>
                                <button onclick="deleteCenter('${center.id}', '${center.name}')" class="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all" title="حذف السنتر بالكامل">
                                    <i class="fa-solid fa-trash mr-1"></i>حذف
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }

        function filterCentersTable() {
            const query = document.getElementById('centerSearchInput').value.trim().toLowerCase();
            const status = document.getElementById('statusFilterSelect').value;

            const filtered = centersList.filter(c => {
                const matchQ = !query || c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(query) || c.phone.includes(query);
                const matchStatus = status === 'ALL' || c.status === status;
                return matchQ && matchStatus;
            });

            renderCentersTable(filtered);
            updateMetrics();
        }

        async function toggleCenterStatus(idOrCode) {
            try {
                const res = await fetch(`/api/super-admin/centers/${idOrCode}/status`, { method: 'PATCH' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message);
                    fetchCentersFromApi();
                } else {
                    showToast(data.message || 'فشل تعديل حالة السنتر');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        async function changeCenterPassword(centerId, centerName) {
            const newPass = prompt(`أدخل كلمة المرور الجديدة لحساب مدير سنتر: (${centerName})`);
            if (!newPass || !newPass.trim()) return;
            try {
                const res = await fetch(`/api/super-admin/centers/${centerId}/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword: newPass.trim() })
                });
                const data = await res.json();
                showToast(data.message || 'تم تغيير كلمة المرور');
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        async function deleteCenter(centerId, centerName) {
            if (!confirm(`⚠️ تحذير خطير: هل أنت متأكد من رغبتك في حذف (${centerName}) وجميع البيانات المربوطة به بالكامل (طلاب، معلمين، فصول، مبيعات)؟ لا يمكن التراجع عن هذا الإجراء!`)) {
                return;
            }
            try {
                const res = await fetch(`/api/super-admin/centers/${centerId}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message);
                    fetchCentersFromApi();
                } else {
                    showToast(data.message || 'فشل حذف السنتر');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        function openAddCenterModal() {
            document.getElementById('addCenterModal').classList.remove('hidden');
        }
        function closeAddCenterModal() {
            document.getElementById('addCenterModal').classList.add('hidden');
            document.getElementById('addCenterForm').reset();
        }

        async function handleCreateCenter(e) {
            e.preventDefault();
            const name = document.getElementById('inputCenterName').value.trim();
            const code = document.getElementById('inputCenterCode').value.trim();
            const phone = document.getElementById('inputCenterPhone').value.trim();
            const maxStudentCodes = document.getElementById('inputMaxStudentCodes').value;
            const adminUsername = document.getElementById('inputAdminUsername').value.trim();
            const adminPassword = document.getElementById('inputAdminPassword').value.trim();
            const plan = document.getElementById('inputSubscriptionPlan').value;
            const expiresAt = document.getElementById('inputExpiryDate').value;

            try {
                const response = await fetch('/api/super-admin/centers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, code, phone, maxStudentCodes, adminUsername, adminPassword, plan, expiresAt })
                });

                const resData = await response.json();
                if (resData.success) {
                    showToast(`تم إنشاء السنتر ${name} وحفظه في الداتابيز!`);
                    closeAddCenterModal();
                    fetchCentersFromApi();
                } else {
                    showToast(resData.message || 'خطأ أثناء إنشاء السنتر');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        function openProfileSettingsModal() {
            document.getElementById('profileSettingsModal').classList.remove('hidden');
        }
        function closeProfileSettingsModal() {
            document.getElementById('profileSettingsModal').classList.add('hidden');
            document.getElementById('profileSettingsForm').reset();
        }
        async function handleUpdateProfile(e) {
            e.preventDefault();
            const currentPassword = document.getElementById('profCurrentPassword').value;
            const newPassword = document.getElementById('profNewPassword').value;
            const newUsername = document.getElementById('profNewUsername').value.trim();
            const newEmail = document.getElementById('profNewEmail').value.trim();
            try {
                const res = await fetch('/api/super-admin/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword, newUsername, newEmail })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('تم تحديث بيانات الحساب بنجاح');
                    closeProfileSettingsModal();
                } else {
                    showToast(data.message || 'حدث خطأ أثناء التحديث');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        function handleLogout() {
            localStorage.clear();
        }

        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            document.getElementById('toastMessage').textContent = message;
            toast.classList.remove('translate-y-20', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3000);
        }