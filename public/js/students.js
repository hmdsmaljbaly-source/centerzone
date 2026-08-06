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
    


        let studentsData = [];
        let allTeachersList = [];
        let allGroupsList = [];

        window.onload = function() {
            const el = document.getElementById('headerCenterName');
            if (el && window.getActiveCenterHeader) el.textContent = window.getActiveCenterHeader();
            loadFilterDropdowns();
            fetchFilteredStudents();
        };

        async function loadFilterDropdowns() {
            try {
                const [resT, resG] = await Promise.all([
                    fetch('/api/teachers'),
                    fetch('/api/groups')
                ]);
                const dataT = await resT.json();
                const dataG = await resG.json();

                const teacherSelect = document.getElementById('filterTeacher');
                const subjectSelect = document.getElementById('filterSubject');
                const groupSelect = document.getElementById('filterGroup');

                const subjectsSet = new Set();
                if (dataT.success && Array.isArray(dataT.data)) {
                    allTeachersList = dataT.data;
                    dataT.data.forEach(t => {
                        teacherSelect.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name} (${t.subject})</option>`);
                        if (t.subject) subjectsSet.add(t.subject.trim());
                    });
                    Array.from(subjectsSet).forEach(sub => {
                        subjectSelect.insertAdjacentHTML('beforeend', `<option value="${sub}">${sub}</option>`);
                    });
                }

                if (dataG.success && Array.isArray(dataG.data)) {
                    allGroupsList = dataG.data;
                    dataG.data.forEach(g => {
                        groupSelect.insertAdjacentHTML('beforeend', `<option value="${g.id}">${g.name} - ${g.teacher ? g.teacher.name : ''}</option>`);
                    });
                }
            } catch (e) {
                console.error('Error loading filter dropdowns:', e);
            }
        }

        let filterTimeout = null;
        function handleFilterChange(e) {
            if (e && e.type === 'input') {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => { fetchFilteredStudents(); }, 350);
            } else {
                fetchFilteredStudents();
            }
        }

        function filterStudents() {
            fetchFilteredStudents();
        }

        async function fetchFilteredStudents() {
            const search = document.getElementById('searchInput').value.trim();
            const teacherId = document.getElementById('filterTeacher').value;
            const subject = document.getElementById('filterSubject').value;
            const groupId = document.getElementById('filterGroup').value;
            const grade = document.getElementById('filterGrade').value;
            const status = document.getElementById('filterStatus').value;

            const params = new URLSearchParams({
                teacherId,
                subject,
                groupId,
                grade,
                status,
                search
            });

            try {
                const response = await fetch(`/api/students?${params.toString()}`);
                const resData = await response.json();
                if (resData?.success && Array.isArray(resData.data)) {
                    studentsData = resData.data;
                    renderTable(studentsData);
                    updateSummaryStats(studentsData);
                }
            } catch (e) {
                console.error('Error refetching filtered students:', e);
            }
        }

        function updateSummaryStats(filteredData) {
            document.getElementById('statTotalStudents').textContent = filteredData.length;
            document.getElementById('statActiveStudents').textContent = filteredData.filter(s => s.alert_status === 'NORMAL').length;
            document.getElementById('statWarningStudents').textContent = filteredData.filter(s => s.alert_status === 'WARNING').length;
            document.getElementById('statBlockedStudents').textContent = filteredData.filter(s => s.alert_status === 'BLOCKED').length;
        }

        function renderTable(dataList) {
            const tbody = document.getElementById('studentsTableBody');
            const emptyState = document.getElementById('emptyState');
            tbody.innerHTML = '';

            if (!dataList || dataList.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            } else {
                emptyState.classList.add('hidden');
            }

            dataList.forEach(student => {
                let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                let statusLabel = '🟢 نشط (عادي)';
                if (student.alert_status === 'WARNING') {
                    badgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                    statusLabel = '🟡 تنبيه مالي';
                } else if (student.alert_status === 'BLOCKED') {
                    badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    statusLabel = '🔴 محظور';
                }

                const rowHtml = `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="p-3.5 font-mono font-bold cursor-pointer text-indigo-400 hover:underline" onclick="openStudentProfileModal('${student.id}')">${student.code}</td>
                        <td class="p-3.5 font-bold cursor-pointer text-indigo-400 hover:underline" onclick="openStudentProfileModal('${student.id}')">${student.name}</td>
                        <td class="p-3.5">
                            <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold ${student.remainingSessions <= 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'}">
                                ${student.remainingSessions ?? 0} حصص
                            </span>
                        </td>
                        <td class="p-3.5 font-mono text-slate-300">${student.student_phone || '--'}</td>
                        <td class="p-3.5 font-mono text-slate-300">${student.parent_phone}</td>
                        <td class="p-3.5">
                            <div class="bg-white p-1 rounded-lg w-max shadow-sm border border-slate-300">
                                <svg id="table-barcode-${student.id}" class="h-8"></svg>
                            </div>
                        </td>
                        <td class="p-3.5">
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${badgeClass}">
                                ${statusLabel}
                            </span>
                        </td>
                        <td class="p-3.5 text-center">
                            <button onclick="openFinanceModal('${student.id}')" title="تحصيل مالي" class="p-2 bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition-all ml-1">
                                <i class="fa-solid fa-money-bill-wave"></i>
                            </button>
                            <button onclick="openPrintCardModal('${student.id}')" title="طباعة كارت الباركوود" class="p-2 bg-slate-800 hover:bg-sky-600 text-sky-400 hover:text-white rounded-xl transition-all">
                                <i class="fa-solid fa-barcode"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);

                setTimeout(() => {
                    try {
                        JsBarcode(`#table-barcode-${student.id}`, student.code, {
                            format: "CODE128",
                            height: 25,
                            width: 1.2,
                            displayValue: false,
                            margin: 0,
                            lineColor: "#000000"
                        });
                    } catch(e) {}
                }, 50);
            });
        }

        function openAddStudentModal() {
            document.getElementById('addStudentModal').classList.remove('hidden');
            const teacherSelect = document.getElementById('studentTeacherSelect');
            const groupSelect = document.getElementById('studentGroupSelect');
            
            if (teacherSelect && groupSelect) {
                teacherSelect.innerHTML = '<option value="">اختر المدرس...</option>';
                groupSelect.innerHTML = '<option value="">اختر المجموعة...</option>';
                
                allTeachersList.forEach(t => {
                    teacherSelect.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name} (${t.subject})</option>`);
                });

                allGroupsList.forEach(g => {
                    groupSelect.insertAdjacentHTML('beforeend', `<option value="${g.id}">${g.name} (${g.teacher ? g.teacher.name : 'عام'})</option>`);
                });
            }
        }

        function closeAddStudentModal() {
            document.getElementById('addStudentModal').classList.add('hidden');
            document.getElementById('addStudentForm').reset();
        }

        function handleTeacherSelectChange() {
            const selectedTeacherId = document.getElementById('studentTeacherSelect').value;
            const groupSelect = document.getElementById('studentGroupSelect');
            if (!groupSelect) return;
            groupSelect.innerHTML = '<option value="">اختر المجموعة...</option>';

            const filteredGroups = selectedTeacherId ? allGroupsList.filter(g => g.teacherId === selectedTeacherId || (g.teacher && g.teacher.id === selectedTeacherId)) : allGroupsList;
            
            filteredGroups.forEach(g => {
                groupSelect.insertAdjacentHTML('beforeend', `<option value="${g.id}">${g.name} - ${g.dayOfWeek || ''} ${g.startTime || ''}</option>`);
            });
        }

        async function handleCreateStudent(e) {
            e.preventDefault();
            // Safely check usedStudentCodes using defensive null-coalescing operator
            const usedStudentCodes = window.settings?.usedStudentCodes ?? [];
            
            const name = document.getElementById('inputStudentName')?.value?.trim() || '';
            const parentPhone = document.getElementById('inputParentPhone')?.value?.trim() || '';
            const studentPhone = document.getElementById('inputStudentPhone')?.value?.trim() || '';
            const alertNote = document.getElementById('inputAlertNote')?.value?.trim() || '';
            const grade = document.getElementById('inputStudentGrade')?.value || 'الصف الأول الثانوي';
            const teacherId = document.getElementById('studentTeacherSelect')?.value || '';
            const groupId = document.getElementById('studentGroupSelect')?.value || '';

            try {
                const payload = { 
                    name, 
                    phone: studentPhone,
                    student_phone: studentPhone, 
                    parentPhone,
                    parent_phone: parentPhone, 
                    grade,
                    teacherId: teacherId || null,
                    groupId: groupId || null,
                    notes: alertNote,
                    alert_note: alertNote,
                    alert_status: alertNote ? 'WARNING' : 'NORMAL' 
                };

                const response = await fetch('/api/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData?.message || resData?.error || 'حدث خطأ أثناء حفظ الطالب');
                    return;
                }
                closeAddStudentModal();
                showToast(`تم حفظ الطالب ${name} وتوليد الكود بنجاح`);
                fetchFilteredStudents();
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        function openPrintCardModal(studentId) {
            const student = studentsData.find(s => s.id === studentId);
            if (!student) return;
            document.getElementById('cardStudentName').textContent = student.name;
            document.getElementById('cardStudentCode').textContent = `كود: ${student.code}`;
            JsBarcode("#barcodeCanvas", student.code, { format: "CODE128", height: 45, width: 1.8, displayValue: true, margin: 5 });
            document.getElementById('printableCardModal').classList.remove('hidden');
        }

        function closePrintCardModal() { document.getElementById('printableCardModal').classList.add('hidden'); }

        let currentFinanceStudentId = null;

        function openFinanceModal(studentId) {
            const student = studentsData.find(s => s.id === studentId);
            if (!student) return;
            currentFinanceStudentId = student.id;
            document.getElementById('financeStudentName').textContent = student.name;
            document.getElementById('financeStudentCode').textContent = `كود: ${student.code}`;
            document.getElementById('financeModal').classList.remove('hidden');
        }

        function closeFinanceModal() {
            document.getElementById('financeModal').classList.add('hidden');
            document.getElementById('financeForm').reset();
            currentFinanceStudentId = null;
        }

        async function handleFinanceCollection(e) {
            e.preventDefault();
            const type = document.getElementById('financeTypeSelect')?.value || '';
            const amount = parseFloat(document.getElementById('financeAmount')?.value) || 0;
            const targetId = document.getElementById('financeTargetId')?.value || '';
            const note = document.getElementById('financeNote')?.value?.trim() || '';

            try {
                const response = await fetch(`/api/students/${currentFinanceStudentId}/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId: currentFinanceStudentId,
                        paymentType: type,
                        type,
                        amount,
                        groupId: targetId || null,
                        targetId: targetId || null,
                        note
                    })
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData?.message || 'حدث خطأ أثناء تسديد الرسوم');
                    return;
                }
                closeFinanceModal();
                showToast(`تم تسجيل التحصيل المالي وتجديد الحصص بنجاح`);
                fetchFilteredStudents();
            } catch (err) {
                showToast('خطأ في الاتصال بالسيرفر');
            }
        }

        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            document.getElementById('toastMessage').textContent = message;
            toast.classList.remove('translate-y-20', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => { toast.classList.remove('translate-y-0', 'opacity-100'); toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
        }

        function openStudentProfileModal(studentId) {
            window.location.href = `student-profile.html?id=${studentId}`;
        }

        function switchProfileTab(tab) {
            const btnAtt = document.getElementById('tabBtnAttendance');
            const btnEx = document.getElementById('tabBtnExams');
            const contentAtt = document.getElementById('profileTabAttendance');
            const contentEx = document.getElementById('profileTabExams');

            if (tab === 'attendance') {
                btnAtt.className = 'px-4 py-1.5 rounded-lg bg-indigo-600 text-white shadow-md transition-all font-bold';
                btnEx.className = 'px-4 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all font-bold';
                contentAtt.classList.remove('hidden');
                contentEx.classList.add('hidden');
            } else {
                btnEx.className = 'px-4 py-1.5 rounded-lg bg-indigo-600 text-white shadow-md transition-all font-bold';
                btnAtt.className = 'px-4 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all font-bold';
                contentEx.classList.remove('hidden');
                contentAtt.classList.add('hidden');
            }
        }