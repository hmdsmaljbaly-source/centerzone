tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Cairo', 'Inter', 'sans-serif'] },
                    colors: { odoo: { bg: '#0F172A', card: '#1E293B', accent: '#3B82F6' } }
                }
            }
        }
    


        function getActiveCenterHeader() {
            return localStorage.getItem('currentCenterId') || localStorage.getItem('x-center-id') || localStorage.getItem('centerId') || '';
        }
        window.getActiveCenterHeader = getActiveCenterHeader;
        (function() {
            const token = localStorage.getItem('centerzone_token') || localStorage.getItem('token');
            if (!token) {
                sessionStorage.setItem('redirect_after_login', window.location.pathname);
                window.location.href = '/login.html';
                return;
            }
            const originalFetch = window.fetch;
            window.fetch = async function(url, options = {}) {
                options.headers = options.headers || {};
                const currentToken = localStorage.getItem('centerzone_token') || localStorage.getItem('token');
                const currentCenterId = getActiveCenterHeader();
                if (url && url.toString().startsWith('/api/')) {
                    if (options.headers instanceof Headers) {
                        if (currentToken && !options.headers.has('Authorization')) options.headers.set('Authorization', 'Bearer ' + currentToken);
                        if (currentCenterId && !options.headers.has('x-center-id')) options.headers.set('x-center-id', currentCenterId);
                    } else {
                        options.headers['Authorization'] = options.headers['Authorization'] || (currentToken ? 'Bearer ' + currentToken : undefined);
                        if (currentCenterId && !options.headers['x-center-id']) options.headers['x-center-id'] = currentCenterId;
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
    


        // STRICT RULE: No hardcoded mock data anywhere in JS. Start all lists as empty arrays.
        let teachersList = [];
        let expensesList = [];
        let auditList = [];

        window.onload = function() {
            const tenant = localStorage.getItem('currentCenterId') || localStorage.getItem('x-center-id') || localStorage.getItem('centerId') || '';
            document.getElementById('headerCenterName').textContent = tenant ? `Tenant: ${tenant}` : 'السنتر الحالي';
            loadAllFinancialData();
        };

        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('tab-active');
                b.classList.add('text-slate-400');
            });
            document.getElementById('sectionTeachers').classList.add('hidden');
            document.getElementById('sectionExpenses').classList.add('hidden');
            document.getElementById('sectionAudit').classList.add('hidden');

            if (tabId === 'teachers') {
                document.getElementById('btnTabTeachers').classList.add('tab-active');
                document.getElementById('btnTabTeachers').classList.remove('text-slate-400');
                document.getElementById('sectionTeachers').classList.remove('hidden');
            } else if (tabId === 'expenses') {
                document.getElementById('btnTabExpenses').classList.add('tab-active');
                document.getElementById('btnTabExpenses').classList.remove('text-slate-400');
                document.getElementById('sectionExpenses').classList.remove('hidden');
            } else if (tabId === 'audit') {
                document.getElementById('btnTabAudit').classList.add('tab-active');
                document.getElementById('btnTabAudit').classList.remove('text-slate-400');
                document.getElementById('sectionAudit').classList.remove('hidden');
            }
        }

        async function loadAllFinancialData() {
            await Promise.all([
                fetchSummary(),
                fetchTeachersBreakdown(),
                fetchExpenses(),
                fetchAuditStream()
            ]);
        }

        async function fetchSummary() {
            try {
                const res = await fetch('/api/financials/summary');
                const data = await res.json();
                if (data.success && data.data) {
                    document.getElementById('valGrossRevenue').innerHTML = `${(data.data.grossRevenue || 0).toLocaleString()} <span class="text-xs font-normal text-slate-500">ج.م</span>`;
                    document.getElementById('valExpenses').innerHTML = `${(data.data.operationalExpenses || 0).toLocaleString()} <span class="text-xs font-normal text-slate-500">ج.م</span>`;
                    document.getElementById('valNetProfit').innerHTML = `${(data.data.centerNetProfit || 0).toLocaleString()} <span class="text-xs font-normal text-slate-500">ج.م</span>`;
                    document.getElementById('valUnsettledTeachers').innerHTML = `${(data.data.unsettledTeacherBalances || 0).toLocaleString()} <span class="text-xs font-normal text-slate-500">ج.م</span>`;
                }
            } catch (err) {
                console.error('Error fetching financial summary:', err);
            }
        }

        async function fetchTeachersBreakdown() {
            try {
                const res = await fetch('/api/financials/teachers-breakdown');
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    teachersList = data.data;
                } else {
                    teachersList = [];
                }
                renderTeachersTable(teachersList);
            } catch (err) {
                console.error('Error fetching teachers breakdown:', err);
                teachersList = [];
                renderTeachersTable(teachersList);
            }
        }

        function renderTeachersTable(list) {
            const tbody = document.getElementById('teachersTableBody');
            tbody.innerHTML = '';

            if (!list || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-500">لا توجد بيانات مدرسين مسجلة بالداتابيز لهذا السنتر.</td></tr>`;
                return;
            }

            list.forEach(t => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/40 transition-colors';
                
                let badgeRemain = 'text-slate-300';
                if (t.remainingBalance > 0) badgeRemain = 'text-amber-400 font-black';
                else if (t.remainingBalance < 0) badgeRemain = 'text-rose-400 font-bold';

                tr.innerHTML = `
                    <td class="p-4 text-center font-bold text-white">
                        <div>${t.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${t.subject || 'مادة عامة'}</div>
                    </td>
                    <td class="p-4 text-center font-mono text-xs">
                        <span class="text-pink-400 font-bold" title="حصة المدرس">${t.teacherPercentage}%</span> /
                        <span class="text-sky-400 font-bold" title="حصة السنتر">${t.centerPercentage}%</span>
                    </td>
                    <td class="p-4 text-center font-mono text-slate-300 font-bold">${t.paidStudentsCount}</td>
                    <td class="p-4 text-center font-mono text-emerald-400 font-bold">${(t.totalCollected || 0).toLocaleString()} ج.م</td>
                    <td class="p-4 text-center font-mono text-sky-300 font-bold">${(t.centerShare || 0).toLocaleString()} ج.م</td>
                    <td class="p-4 text-center font-mono text-pink-300 font-bold">${(t.teacherShare || 0).toLocaleString()} ج.م</td>
                    <td class="p-4 text-center font-mono text-emerald-500">${(t.totalPaidOut || 0).toLocaleString()} ج.م</td>
                    <td class="p-4 text-center font-mono ${badgeRemain}">${(t.remainingBalance || 0).toLocaleString()} ج.م</td>
                    <td class="p-4 text-center">
                        <button onclick="openPayoutModal('${t.id}', '${t.name}', ${t.remainingBalance})" class="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-600/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto">
                            <i class="fa-solid fa-comments-dollar"></i> تسوية / دفع
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function filterTeachersTable() {
            const query = document.getElementById('teacherSearchInput').value.trim().toLowerCase();
            const filtered = teachersList.filter(t => t.name.toLowerCase().includes(query) || (t.subject && t.subject.toLowerCase().includes(query)));
            renderTeachersTable(filtered);
        }

        async function fetchExpenses() {
            try {
                const res = await fetch('/api/financials/expenses');
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    expensesList = data.data;
                } else {
                    expensesList = [];
                }
                renderExpensesTable(expensesList);
            } catch (err) {
                console.error('Error fetching expenses:', err);
                expensesList = [];
                renderExpensesTable(expensesList);
            }
        }

        function renderExpensesTable(list) {
            const tbody = document.getElementById('expensesTableBody');
            document.getElementById('totalExpensesCount').textContent = `Total: ${list.length}`;
            tbody.innerHTML = '';

            if (!list || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500">لا توجد مصروفات تشغيلية مسجلة حتى الآن.</td></tr>`;
                return;
            }

            const catLabels = {
                'Electricity': '⚡ كهرباء',
                'Water': '💧 مياه',
                'Rent': '🏢 إيجار المقر',
                'Maintenance': '🔧 صيانة ونظافة',
                'Other': '📝 أخرى'
            };

            list.forEach(e => {
                const dateStr = e.createdAt ? new Date(e.createdAt).toLocaleString('ar-EG') : 'الآن';
                const catLabel = catLabels[e.category] || e.category || '📝 مصروف عام';

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/40 transition-colors';
                tr.innerHTML = `
                    <td class="p-3.5 text-right font-bold text-white">${e.title}</td>
                    <td class="p-3.5 text-center font-bold text-slate-300 text-[11px]"><span class="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">${catLabel}</span></td>
                    <td class="p-3.5 text-center font-mono font-bold text-rose-400">${(e.amount || 0).toLocaleString()} ج.م</td>
                    <td class="p-3.5 text-center text-slate-400 font-mono text-[11px]">${dateStr}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function handleRecordExpense(e) {
            e.preventDefault(); // STRICT RULE: prevent default form behavior
            const btn = document.getElementById('btnSubmitExpense');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التسجيل...';

            const title = document.getElementById('expenseTitle').value.trim();
            const category = document.getElementById('expenseCategory').value;
            const amount = document.getElementById('expenseAmount').value;

            try {
                const res = await fetch('/api/financials/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, category, amount })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('تم تسجيل المصروف التشغيلي بنجاح');
                    document.getElementById('expenseForm').reset();
                    await Promise.all([fetchExpenses(), fetchSummary(), fetchAuditStream()]);
                } else {
                    showToast(data.message || 'فشل تسجيل المصروف');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بسيرفر الداتابيز');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }

        async function fetchAuditStream() {
            try {
                const res = await fetch('/api/financials/audit-stream');
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    auditList = data.data;
                } else {
                    auditList = [];
                }
                renderAuditTable(auditList);
            } catch (err) {
                console.error('Error fetching audit stream:', err);
                auditList = [];
                renderAuditTable(auditList);
            }
        }

        function renderAuditTable(list) {
            const tbody = document.getElementById('auditTableBody');
            tbody.innerHTML = '';

            if (!list || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">لا توجد حركات مالية مسجلة بالسجل حتى الآن.</td></tr>`;
                return;
            }

            list.forEach(a => {
                let typeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                let typeLabel = '🟢 إيراد / تحصيل';
                let amountStr = `+${(a.amount || 0).toLocaleString()} ج.م`;
                let amountColor = 'text-emerald-400';

                if (a.type === 'EXPENSE') {
                    typeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    typeLabel = '🔴 مصروف تشغيلي';
                    amountStr = `${(a.amount || 0).toLocaleString()} ج.م`;
                    amountColor = 'text-rose-400';
                } else if (a.type === 'PAYOUT') {
                    typeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    typeLabel = '🟡 تسوية مدرس';
                    amountStr = `${(a.amount || 0).toLocaleString()} ج.م`;
                    amountColor = 'text-amber-400';
                }

                const dateStr = a.date ? new Date(a.date).toLocaleString('ar-EG') : 'الآن';

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/40 transition-colors';
                tr.innerHTML = `
                    <td class="p-4 text-center font-mono font-bold text-slate-400 text-[11px]">${a.id || '---'}</td>
                    <td class="p-4 text-right font-bold text-slate-200">${a.title || 'بدون عنوان'}</td>
                    <td class="p-4 text-center"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${typeClass}">${typeLabel}</span></td>
                    <td class="p-4 text-center font-mono font-black ${amountColor}">${amountStr}</td>
                    <td class="p-4 text-center text-slate-400 font-mono text-[11px]">${dateStr}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function openPayoutModal(teacherId, teacherName, remain) {
            document.getElementById('modalTeacherId').value = teacherId;
            document.getElementById('modalTeacherName').textContent = `المدرس: ${teacherName}`;
            document.getElementById('modalTeacherBalance').textContent = `${(remain || 0).toLocaleString()} ج.م`;
            if (remain > 0) {
                document.getElementById('payoutAmountInput').value = remain.toFixed(2);
            } else {
                document.getElementById('payoutAmountInput').value = '';
            }
            document.getElementById('payoutNotesInput').value = `تسوية مستحقات الأستاذ ${teacherName}`;
            document.getElementById('payoutModal').classList.remove('hidden');
        }

        function closePayoutModal() {
            document.getElementById('payoutModal').classList.add('hidden');
            document.getElementById('payoutForm').reset();
        }

        async function handleSubmitPayout(e) {
            e.preventDefault(); // STRICT RULE: prevent default form behavior
            const btn = document.getElementById('btnSubmitPayout');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التنفيذ...';

            const teacherId = document.getElementById('modalTeacherId').value;
            const amount = document.getElementById('payoutAmountInput').value;
            const notes = document.getElementById('payoutNotesInput').value.trim();

            try {
                const res = await fetch('/api/financials/payouts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherId, amount, notes })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message || 'تم تسديد الدفعة بنجاح');
                    closePayoutModal();
                    await Promise.all([fetchTeachersBreakdown(), fetchSummary(), fetchAuditStream()]);
                } else {
                    showToast(data.message || 'فشل تسديد الدفعة');
                }
            } catch (err) {
                showToast('خطأ في الاتصال بسيرفر الداتابيز');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }

        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            document.getElementById('toastMessage').textContent = message;
            toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
            setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
            }, 3500);
        }