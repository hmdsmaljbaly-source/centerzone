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
            populatePrepaidCenterSelect();
        }

        function populatePrepaidCenterSelect() {
            const genSelect = document.getElementById('genCenterSelect');
            if (genSelect) {
                genSelect.innerHTML = '<option value="">اختر السنتر...</option>';
                centersList.forEach(c => {
                    genSelect.insertAdjacentHTML('beforeend', `<option value="${c.dbId}">${c.name} (${c.id})</option>`);
                });
            }
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
                const nameStr = c.name ? String(c.name).toLowerCase() : '';
                const userStr = c.username ? String(c.username).toLowerCase() : '';
                const phoneStr = c.phone ? String(c.phone) : '';

                const matchQ = !query || nameStr.includes(query) || userStr.includes(query) || phoneStr.includes(query);
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

        async function handleGeneratePrepaidCodes(e) {
            e.preventDefault();
            const centerId = document.getElementById('genCenterSelect').value;
            const quantity = parseInt(document.getElementById('genQuantity').value) || 0;
            const startIndex = parseInt(document.getElementById('genStartIndex').value) || 0;

            if (!centerId || quantity <= 0 || startIndex <= 0) {
                showToast('يرجى ملء جميع الحقول بشكل صحيح');
                return;
            }

            try {
                const response = await fetch('/api/super-admin/generate-codes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ centerId, quantity, startIndex })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    showToast(data.message || 'تم توليد الأكواد بنجاح');
                    fetchCentersFromApi();
                } else {
                    showToast(data.message || 'فشل توليد الأكواد');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        async function exportPrintablePrepaidCards() {
            const centerId = document.getElementById('genCenterSelect').value;
            if (!centerId) {
                showToast('يرجى اختيار السنتر أولاً لتصدير الشيت');
                return;
            }

            try {
                const response = await fetch(`/api/super-admin/centers/${centerId}/prepaid-cards`);
                const resData = await response.json();

                if (!response.ok || !resData.success) {
                    showToast(resData.message || 'تعذر جلب الأكواد من السيرفر');
                    return;
                }

                const cards = resData.data || [];
                if (cards.length === 0) {
                    showToast('لا توجد أكواد مولدة لهذا السنتر حالياً');
                    return;
                }

                const centerName = resData.centerName || 'السنتر';
                const maxCodes = resData.maxStudentCodes || 500;
                const dateStr = new Date().toLocaleDateString('ar-EG');

                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="ar" dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>شيت كروت التسجيل - ${centerName}</title>
                        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                        <style>
                            body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
                            .meta-box { border: 2px solid #333; padding: 15px; margin-bottom: 20px; border-radius: 10px; background-color: #f9f9f9; }
                            .meta-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
                            .meta-details { display: grid; grid-template-cols: 1fr 1fr; gap: 10px; font-size: 13px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 12px; }
                            th { background-color: #f1f1f1; }
                            .btn-print { background-color: #7c3aed; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-bottom: 15px; }
                            @media print {
                                .btn-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <button class="btn-print" onclick="window.print()">طباعة الشيت 🖨️</button>
                        
                        <div class="meta-box">
                            <div class="meta-title">كشف أكواد كروت التسجيل مسبقة الدفع</div>
                            <div class="meta-details">
                                <div><strong>السنتر التعليمي:</strong> ${centerName}</div>
                                <div><strong>تاريخ التصدير:</strong> ${dateStr}</div>
                                <div><strong>إجمالي الأكواد:</strong> ${cards.length} كود</div>
                                <div><strong>الحد الأقصى للسنتر (Quota):</strong> ${maxCodes} كود</div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>م</th>
                                    <th>كود الكارت (Serial Code)</th>
                                    <th>الحالة (Status)</th>
                                    <th>الباركوود الخطي (Barcode)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cards.map((c, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td style="font-family: monospace; font-size: 14px; font-weight: bold;">${c.code}</td>
                                        <td style="font-weight: bold; color: ${c.status === 'USED' ? 'red' : 'green'}">${c.status === 'USED' ? 'مستعمل' : 'غير مستعمل'}</td>
                                        <td>
                                            <svg id="barcode-${c.id}"></svg>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <script>
                            window.onload = function() {
                                ${cards.map(c => `
                                    try {
                                        JsBarcode("#barcode-${c.id}", "${c.code}", {
                                            format: "CODE128",
                                            height: 35,
                                            width: 1.5,
                                            displayValue: false,
                                            margin: 5
                                        });
                                    } catch(e) {
                                        console.error(e);
                                    }
                                `).join('')}
                            };
                        </script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            } catch (err) {
                showToast('حدث خطأ أثناء تصدير شيت الكروت');
            }
        }

        async function downloadPrepaidCardsCSV() {
            const centerId = document.getElementById('genCenterSelect').value;
            if (!centerId) {
                showToast('يرجى اختيار السنتر أولاً لتصدير الشيت');
                return;
            }

            try {
                const response = await fetch(`/api/super-admin/centers/${centerId}/prepaid-cards`);
                const resData = await response.json();

                if (!response.ok || !resData.success) {
                    showToast(resData.message || 'تعذر جلب الأكواد من السيرفر');
                    return;
                }

                const cards = resData.data || [];
                if (cards.length === 0) {
                    showToast('لا توجد أكواد مولدة لهذا السنتر حالياً');
                    return;
                }

                const centerName = resData.centerName || 'السنتر';
                const maxCodes = resData.maxStudentCodes || 500;
                const dateStr = new Date().toLocaleDateString('ar-EG').replace(/\//g, '-');

                let csvContent = '\ufeff'; // UTF-8 BOM
                csvContent += `السنتر التعليمي:,${centerName}\n`;
                csvContent += `تاريخ التصدير:,${dateStr}\n`;
                csvContent += `إجمالي الكروت:,${cards.length}\n`;
                csvContent += `الحد الأقصى المسموح (Quota):,${maxCodes}\n\n`;
                
                csvContent += 'كود الكارت (Serial Code),الحالة (Status),قيمة الباركود (Barcode Value)\n';
                
                cards.forEach(c => {
                    const statusLabel = c.status === 'USED' ? 'مستعمل' : 'غير مستعمل';
                    csvContent += `"${c.code}","${statusLabel}","${c.code}"\n`;
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `كروت_تسجيل_${centerName}_${dateStr}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('تم تحميل شيت الكروت بنجاح!');
            } catch (err) {
                showToast('حدث خطأ أثناء تصدير شيت الكروت');
            }
        }