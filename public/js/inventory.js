tailwind.config = { theme: { extend: { fontFamily: { sans: ['Cairo', 'Inter', 'sans-serif'] } } } }
    


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
    


        let inventoryBooks = [];
        let teachersList = [];
        let studentsList = [];

        window.onload = function() {
            const el = document.getElementById('headerCenterName');
            if (el && window.getActiveCenterHeader) el.textContent = window.getActiveCenterHeader();
            fetchInventoryFromApi();
            fetchTeachersFromApi();
            fetchStudentsFromApi();
            fetchAuditTrail();
        };

        async function fetchInventoryFromApi() {
            try {
                const response = await fetch('/api/inventory');
                const resData = await response.json();
                if (resData?.success && Array.isArray(resData.data)) {
                    inventoryBooks = resData.data;
                    renderInventoryTable(inventoryBooks);
                    updateInventoryMetrics();
                }
            } catch (e) {
                console.error("Error fetching inventory:", e);
            }
        }

        async function fetchTeachersFromApi() {
            try {
                const response = await fetch('/api/teachers');
                const resData = await response.json();
                if (resData?.success && Array.isArray(resData.data)) {
                    teachersList = resData.data;
                    populateTeachersDropdown();
                }
            } catch (e) {
                console.error("Error fetching teachers:", e);
            }
        }

        async function fetchStudentsFromApi() {
            try {
                const response = await fetch('/api/students');
                const resData = await response.json();
                if (resData?.success && Array.isArray(resData.data)) {
                    studentsList = resData.data;
                }
            } catch (e) {
                console.error("Error fetching students:", e);
            }
        }

        function populateTeachersDropdown() {
            const select = document.getElementById('bookTeacherSelect');
            if (teachersList.length === 0) {
                select.innerHTML = '<option value="">لا يوجد مدرسون مسجلون</option>';
                return;
            }
            select.innerHTML = '<option value="">-- اختر المدرس --</option>' + teachersList.map(t => 
                `<option value="${t.id}">${t.name} - ${t.subject || ''}</option>`
            ).join('');
        }

        function filterBooksInventory() {
            const query = document.getElementById('inventorySearchInput').value.trim().toLowerCase();

            const filtered = inventoryBooks.filter(bk => {
                const name = bk.service_name || bk.title || '';
                const teacherName = bk.teacher ? bk.teacher.name : '';
                return !query || name.toLowerCase().includes(query) || teacherName.toLowerCase().includes(query);
            });

            renderInventoryTable(filtered);
        }

        function renderInventoryTable(booksList) {
            const tbody = document.getElementById('inventoryTableBody');
            const emptyState = document.getElementById('inventoryEmptyState');
            tbody.innerHTML = '';

            if (!booksList || booksList.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            } else {
                emptyState.classList.add('hidden');
            }

            booksList.forEach(bk => {
                const stock = bk.stock_quantity ?? bk.stock ?? 0;
                let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                let statusLabel = '🟢 متوفر بالمخزن';

                if (stock === 0) {
                    badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    statusLabel = '🔴 نفذت الكمية';
                } else if (stock <= 10) {
                    badgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                    statusLabel = '🟡 مخزون منخفض';
                }

                const rowHtml = `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="p-3.5 font-bold text-white flex items-center gap-2">
                            <i class="fa-solid fa-book-open text-amber-400"></i>
                            ${bk.service_name || bk.title}
                        </td>
                        <td class="p-3.5 text-sky-300 font-semibold">${bk.teacher ? bk.teacher.name : 'غير محدد'}</td>
                        <td class="p-3.5 font-mono font-bold text-emerald-400">${bk.price} ج.م</td>
                        <td class="p-3.5 font-mono font-bold text-slate-200">${stock} نسخة</td>
                        <td class="p-3.5">
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${badgeClass}">
                                ${statusLabel}
                            </span>
                        </td>
                        <td class="p-3.5 text-center flex items-center justify-center gap-2">
                            <button onclick="openPosModal('${bk.id}')" ${stock === 0 ? 'disabled' : ''} 
                                class="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                🛒 بيع سريع
                            </button>
                            <button onclick="deleteBook('${bk.id}', '${bk.service_name || bk.title}')" 
                                class="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all" title="حذف الملزمة">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }

        async function deleteBook(bookId, bookTitle) {
            if (!confirm(`هل أنت تأكد من رغبتك في مسح الملزمة "${bookTitle}" نهائياً من المخزن؟`)) {
                return;
            }

            try {
                const response = await fetch(`/api/inventory/${bookId}`, {
                    method: 'DELETE'
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData?.message || 'خطأ أثناء حذف الملزمة');
                    return;
                }
                showToast('تم حذف الملزمة بنجاح!');
                fetchInventoryFromApi();
            } catch (err) {
                showToast('تعذر الاتصال بالسيرفر');
            }
        }

        function updateInventoryMetrics() {
            const totalStock = inventoryBooks.reduce((acc, curr) => acc + (curr.stock_quantity || 0), 0);
            const totalBooks = inventoryBooks.length;
            const lowStockCount = inventoryBooks.filter(bk => (bk.stock_quantity || 0) > 0 && (bk.stock_quantity || 0) <= 10).length;
            const outOfStockCount = inventoryBooks.filter(bk => (bk.stock_quantity || 0) === 0).length;

            document.getElementById('metricTotalStock').textContent = totalStock.toLocaleString();
            document.getElementById('metricTotalBooks').textContent = totalBooks;
            document.getElementById('metricLowStock').textContent = lowStockCount;
            document.getElementById('metricOutOfStock').textContent = outOfStockCount;
        }

        function openAddBookModal() {
            document.getElementById('addBookModal').classList.remove('hidden');
        }

        function closeAddBookModal() {
            document.getElementById('addBookModal').classList.add('hidden');
            document.getElementById('addBookForm').reset();
        }

        async function handleCreateBook(e) {
            e.preventDefault();
            const title = document.getElementById('bookTitleInput')?.value?.trim() || '';
            const teacherId = document.getElementById('bookTeacherSelect')?.value || '';
            const price = parseFloat(document.getElementById('bookPriceInput')?.value) || 0;
            const stock = parseInt(document.getElementById('bookStockInput')?.value) || 0;

            try {
                const response = await fetch('/api/inventory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title,
                        teacher_id: teacherId,
                        price: price,
                        stock_quantity: stock
                    })
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData?.message || 'خطأ أثناء إضافة الملزمة');
                    return;
                }
                closeAddBookModal();
                showToast('تمت إضافة الملزمة للمخزن بنجاح!');
                fetchInventoryFromApi();
            } catch (err) {
                showToast('تعذر الاتصال بالسيرفر');
            }
        }

        function openPosModal(preSelectedBookId = null) {
            const stuSelect = document.getElementById('posStudentSelect');
            stuSelect.innerHTML = studentsList.map(s => `<option value="${s.id}">${s.name} (${s.code || s.student_code})</option>`).join('');

            const bkSelect = document.getElementById('posBookSelect');
            bkSelect.innerHTML = inventoryBooks.map(b => `<option value="${b.id}">${b.service_name || b.title} - [${b.price} ج.م]</option>`).join('');

            if (preSelectedBookId) {
                bkSelect.value = preSelectedBookId;
            }

            document.getElementById('posModal').classList.remove('hidden');
        }

        function closePosModal() {
            document.getElementById('posModal').classList.add('hidden');
        }

        async function handlePosSale(e) {
            e.preventDefault();
            const studentId = document.getElementById('posStudentSelect')?.value || '';
            const bookletId = document.getElementById('posBookSelect')?.value || '';
            const quantity = parseInt(document.getElementById('posQuantityInput')?.value) || 1;

            if (!studentId || !bookletId || quantity < 1) {
                showToast('يرجى اختيار الطالب والملزمة وتحديد كمية صحيحة', 'error');
                return;
            }

            try {
                const response = await fetch('/api/inventory/sell', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId, bookletId, quantity })
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData.message || 'حدث خطأ أثناء تنفيذ عملية البيع', 'error');
                    return;
                }
                showToast(resData.message || 'تم خصم المخزن وتسجيل البيع بنجاح', 'success');
                closePosModal();
                fetchInventoryFromApi();
                fetchAuditTrail();
            } catch (err) {
                showToast('تعذر الاتصال بالسيرفر. يرجى التأكد من اتصال الشبكة.', 'error');
            }
        }
        const handleExecutePosSale = handlePosSale;
        const fetchInventoryData = fetchInventoryFromApi;

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toastNotification');
            const msgEl = document.getElementById('toastMessage');
            if (!toast || !msgEl) return;
            msgEl.textContent = message;
            if (type === 'error') {
                toast.className = "fixed bottom-5 left-5 z-50 bg-rose-900 border border-rose-700 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100";
            } else {
                toast.className = "fixed bottom-5 left-5 z-50 bg-slate-800 border border-emerald-500/50 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100";
            }
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3500);
        }
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="btn-"]').forEach(el => {
                el.classList.remove('border-amber-500', 'text-amber-400');
                el.classList.add('border-transparent', 'text-slate-500');
            });
            
            document.getElementById(tabId).classList.remove('hidden');
            document.getElementById('btn-' + tabId).classList.remove('border-transparent', 'text-slate-500');
            document.getElementById('btn-' + tabId).classList.add('border-amber-500', 'text-amber-400');
        }

        async function fetchAuditTrail() {
            const tbody = document.getElementById('auditTableBody');
            const emptyState = document.getElementById('auditEmptyState');
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">جاري التحميل...</td></tr>';
            emptyState.classList.add('hidden');

            try {
                const response = await fetch('/api/inventory/audit');
                if (response.ok) {
                    const resData = await response.json();
                    if (resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
                        tbody.innerHTML = resData.data.map(txn => {
                            let typeBadge = txn.type === 'SALE' 
                                ? '<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">بيع (SALE)</span>'
                                : '<span class="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-400">إضافة (ADD)</span>';
                                
                            const dateStr = new Date(txn.createdAt).toLocaleString('ar-EG');
                            const studentName = txn.student ? txn.student.name : (txn.note || '--');
                            
                            return `
                            <tr class="hover:bg-slate-800/40 transition-colors">
                                <td class="p-3.5 font-mono text-[10px] text-slate-400">${dateStr}</td>
                                <td class="p-3.5">${typeBadge}</td>
                                <td class="p-3.5 font-bold">${txn.booklet ? txn.booklet.title : 'ملزمة محذوفة'}</td>
                                <td class="p-3.5 font-mono text-white" dir="ltr">${txn.type === 'SALE' ? '-' : '+'}${txn.quantity}</td>
                                <td class="p-3.5 text-slate-300">${studentName}</td>
                            </tr>`;
                        }).join('');
                    } else {
                        tbody.innerHTML = '';
                        emptyState.classList.remove('hidden');
                    }
                } else {
                    // Fallback to mock UI if endpoint doesn't exist
                    tbody.innerHTML = '';
                    emptyState.classList.remove('hidden');
                    emptyState.textContent = 'سجل الحركات غير متوفر حالياً';
                }
            } catch (e) {
                tbody.innerHTML = '';
                emptyState.classList.remove('hidden');
                emptyState.textContent = 'تعذر جلب سجل الحركات';
            }
        }