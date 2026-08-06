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
    


        let masterTeachers = [];
        let masterGroups = [];
        let masterHalls = [];
        let currentTeacherStats = { totalCollected: 0 };
        let currentGroupStudents = [];
        let activeTab = 'teachers';

        const stageGrades = {
            'PRIMARY': ['الصف الرابع', 'الصف الخامس', 'الصف السادس'],
            'PREP': ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'],
            'SECONDARY': ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي']
        };

        const weekDays = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

        window.onload = function() {
            const el = document.getElementById('headerCenterName');
            if (el && window.getActiveCenterHeader) {
                el.textContent = window.getActiveCenterHeader();
            }
            fetchTeachersFromApi();
            fetchGroupsFromApi();
            fetchHallsFromApi();
        };

        function updateKpiCards() {
            const teachersEl = document.getElementById('kpiTotalTeachers');
            const groupsEl = document.getElementById('kpiTotalGroups');
            const hallsEl = document.getElementById('kpiTotalHalls');
            const studentsEl = document.getElementById('kpiTotalStudents');

            if (teachersEl) teachersEl.textContent = masterTeachers?.length ?? 0;
            if (groupsEl) groupsEl.textContent = masterGroups?.length ?? 0;
            if (hallsEl) hallsEl.textContent = masterHalls?.length ?? 0;

            const totalEnrolled = (masterGroups || []).reduce((acc, g) => acc + (parseInt(g.enrolledCount) || 0), 0);
            if (studentsEl) studentsEl.textContent = totalEnrolled;
        }

        function switchTab(tabId) {
            activeTab = tabId;
            const tabs = ['teachers', 'groups', 'schedule', 'halls'];
            
            tabs.forEach(id => {
                const content = document.getElementById(`tabContent${id.charAt(0).toUpperCase() + id.slice(1)}`);
                const btn = document.getElementById(`tabBtn${id.charAt(0).toUpperCase() + id.slice(1)}`);
                
                if (id === tabId) {
                    content?.classList.remove('hidden');
                    btn?.className && (btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all bg-purple-600 text-white shadow-md flex items-center gap-1.5");
                } else {
                    content?.classList.add('hidden');
                    btn?.className && (btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1.5");
                }
            });

            if (tabId === 'teachers') renderTeachersCards();
            if (tabId === 'groups') renderGroupsTable();
            if (tabId === 'schedule') renderWeeklyScheduleGrid();
            if (tabId === 'halls') renderHallsCards();
        }

        async function fetchTeachersFromApi() {
            try {
                const response = await fetch('/api/teachers');
                const resData = await response.json();
                if (response.ok && resData?.success && Array.isArray(resData.data)) {
                    masterTeachers = resData.data;
                    updateKpiCards();
                    if (activeTab === 'teachers') renderTeachersCards();
                    populateGroupTeacherDropdown();
                } else {
                    console.error("Failed to fetch teachers:", resData?.message);
                }
            } catch (e) {
                console.error("Error fetching teachers:", e);
            }
        }

        async function fetchGroupsFromApi() {
            try {
                const response = await fetch('/api/groups');
                const resData = await response.json();
                if (response.ok && resData?.success && Array.isArray(resData.data)) {
                    masterGroups = resData.data;
                    updateKpiCards();
                    if (activeTab === 'teachers') renderTeachersCards();
                    if (activeTab === 'groups') renderGroupsTable();
                    if (activeTab === 'schedule') renderWeeklyScheduleGrid();
                } else {
                    console.error("Failed to fetch groups:", resData?.message);
                }
            } catch (e) {
                console.error("Error fetching groups:", e);
            }
        }

        async function fetchHallsFromApi() {
            try {
                const response = await fetch('/api/halls');
                const resData = await response.json();
                if (response.ok && resData?.success && Array.isArray(resData.data)) {
                    masterHalls = resData.data;
                    updateKpiCards();
                    if (activeTab === 'schedule') renderWeeklyScheduleGrid();
                    if (activeTab === 'halls') renderHallsCards();
                }
            } catch (e) {
                console.warn("Halls API error:", e);
            }
            populateGroupHallDropdown();
        }

        function handleStageChange() {
            const stage = document.getElementById('teacherStageSelect')?.value;
            const container = document.getElementById('gradesContainer');
            const checkboxesDiv = document.getElementById('gradesCheckboxes');
            if (!container || !checkboxesDiv) return;

            if (!stage || !stageGrades[stage]) {
                container.classList.add('hidden');
                return;
            }

            checkboxesDiv.innerHTML = stageGrades[stage].map(grade => `
                <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" name="teacherGrades" value="${grade}" class="rounded accent-purple-500">
                    <span>${grade}</span>
                </label>
            `).join('');

            container.classList.remove('hidden');
        }

        function renderTeachersCards() {
            const grid = document.getElementById('teachersCardsGrid');
            if (!grid) return;
            grid.innerHTML = '';

            if (!masterTeachers || masterTeachers.length === 0) {
                grid.innerHTML = `<div class="col-span-3 text-center py-8 text-slate-500 text-xs">لا يوجد مدرسون مسجلون بقاعدة البيانات.</div>`;
                return;
            }

            masterTeachers.forEach(teacher => {
                const teacherGroups = (masterGroups || []).filter(g => g.teacherId === teacher.id || g.teacher_id === teacher.id);
                const gradesList = Array.isArray(teacher.grades) ? teacher.grades.join(' - ') : (teacher.grades || 'جميع الصفوف');

                const cardHtml = `
                    <div class="teacher-card bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-purple-500/50 transition-all group">
                        <div>
                            <div class="flex items-start justify-between mb-3">
                                <div>
                                    <h3 class="text-base font-bold text-white group-hover:text-purple-400 transition-colors">${teacher.name ?? 'بدون اسم'}</h3>
                                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 mt-1">
                                        مادة ${teacher.subject ?? 'عام'}
                                    </span>
                                </div>
                                <div class="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-lg">
                                    <i class="fa-solid fa-chalkboard-user"></i>
                                </div>
                            </div>

                            <div class="space-y-1.5 text-xs text-slate-300 border-t border-b border-slate-800/80 py-3 my-3">
                                <div class="flex justify-between">
                                    <span class="text-slate-400">الهاتف:</span>
                                    <span class="font-mono text-slate-200">${teacher.phone ?? '--'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-400">الصفوف:</span>
                                    <span class="text-purple-300 font-bold truncate max-w-[150px]">${gradesList}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-400">المجموعات:</span>
                                    <span class="font-bold text-sky-400">${teacherGroups.length} مجموعات</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-2">
                            <span class="text-[11px] text-slate-500 flex items-center"><i class="fa-solid fa-circle text-[8px] text-emerald-500 ml-1.5"></i>نشط بالسنتر</span>
                            <button onclick="openTeacherProfileModal('${teacher.id}')" class="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl text-xs font-bold border border-purple-500/30 transition-all shadow-sm">
                                <i class="fa-solid fa-id-card ml-1"></i> عرض البروفايل
                            </button>
                        </div>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHtml);
            });
        }

        function renderGroupsTable() {
            const tbody = document.getElementById('groupsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!masterGroups || masterGroups.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500 text-xs">لا يوجد مجموعات دراسية مسجلة حالياً.</td></tr>`;
                return;
            }

            masterGroups.forEach(group => {
                const teacherName = group.teacher?.name ?? 'غير محدد';
                const subject = group.teacher?.subject ?? 'عام';
                const hallName = group.hall?.name ?? 'بدون قاعة';
                const scheduleText = `${group.dayOfWeek ?? ''} ${group.startTime ? `(${group.startTime} - ${group.endTime})` : ''}`.trim() || 'مواعيد غير محددة';
                const enrolled = group.enrolledCount ?? 0;
                const price = group.price ?? 0;

                const rowHtml = `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="p-4 font-bold text-white">${group.name ?? '--'}</td>
                        <td class="p-4">
                            <span class="block text-slate-200">${teacherName}</span>
                            <span class="text-[10px] text-purple-400 font-bold">مادة ${subject}</span>
                        </td>
                        <td class="p-4">
                            <span class="block text-sky-400 font-bold">${hallName}</span>
                            <span class="text-slate-400 text-[11px]">${scheduleText}</span>
                        </td>
                        <td class="p-4 text-center font-mono text-amber-400 font-bold">${group.sessionsPerMonth ?? 4}</td>
                        <td class="p-4 text-center font-mono text-emerald-400 font-bold">${price} ج.م</td>
                        <td class="p-4 text-center">
                            <span class="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-200 font-mono font-bold">${enrolled} طالب</span>
                        </td>
                        <td class="p-4 text-center">
                            <button onclick="openGroupProfileModal('${group.id}')" class="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white rounded-xl text-xs font-bold border border-sky-500/30 transition-all">
                                <i class="fa-solid fa-folder-open ml-1"></i> ملف المجموعة
                            </button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }

        function renderWeeklyScheduleGrid() {
            const thead = document.getElementById('scheduleGridHead');
            const tbody = document.getElementById('scheduleGridBody');
            if (!thead || !tbody) return;

            if (!masterHalls || masterHalls.length === 0) {
                thead.innerHTML = `<tr class="bg-slate-950/80 border border-slate-800 text-slate-300 font-bold"><th class="p-3.5 border border-slate-800 bg-slate-900 text-amber-400">اليوم / القاعات</th></tr>`;
                tbody.innerHTML = `<tr><td class="p-6 text-center text-slate-500 text-xs">لا توجد قاعات مضافة بالسنتر لعرض الجدول. قم بإضافة قاعات أولاً.</td></tr>`;
                return;
            }

            // Build Header with Halls
            let headCols = `<th class="p-3.5 border border-slate-800 bg-slate-900 w-32 text-amber-400 font-mono">اليوم / القاعة</th>`;
            masterHalls.forEach(h => {
                headCols += `<th class="p-3.5 border border-slate-800 bg-slate-900/90 text-slate-200 font-bold text-center">${h.name} <span class="text-[10px] text-slate-500 font-mono">(${h.capacity} طالب)</span></th>`;
            });
            thead.innerHTML = `<tr class="bg-slate-950/80 border border-slate-800">${headCols}</tr>`;

            // Build Rows per weekday
            tbody.innerHTML = '';
            weekDays.forEach(day => {
                let rowCells = `<td class="p-4 border border-slate-800 bg-slate-950/60 font-bold text-amber-400 font-mono">${day}</td>`;
                
                masterHalls.forEach(hall => {
                    const hallGroups = (masterGroups || []).filter(g => {
                        const isSameHall = (g.hallId === hall.id) || (g.hall?.id === hall.id);
                        const isSameDay = g.dayOfWeek && g.dayOfWeek.includes(day);
                        return isSameHall && isSameDay;
                    });

                    let cellContent = '';
                    if (hallGroups.length === 0) {
                        cellContent = `<span class="text-slate-600 text-[11px]">- متاح -</span>`;
                    } else {
                        cellContent = hallGroups.map(g => `
                            <div onclick="openGroupProfileModal('${g.id}')" class="bg-slate-900 border border-sky-500/30 hover:border-sky-400 p-2 rounded-xl text-right my-1 cursor-pointer shadow transition-all">
                                <div class="font-bold text-white text-[11px] truncate">${g.name ?? 'مجموعة'}</div>
                                <div class="text-[10px] text-purple-400 font-bold">${g.teacher?.name ?? 'مدرس'}</div>
                                ${g.startTime ? `<div class="text-[10px] font-mono text-emerald-400 mt-0.5"><i class="fa-regular fa-clock ml-1"></i>${g.startTime} - ${g.endTime}</div>` : ''}
                            </div>
                        `).join('');
                    }
                    rowCells += `<td class="p-2 border border-slate-800/80 align-top">${cellContent}</td>`;
                });

                tbody.insertAdjacentHTML('beforeend', `<tr class="hover:bg-slate-800/20 transition-colors">${rowCells}</tr>`);
            });
        }

        function renderHallsCards() {
            const grid = document.getElementById('hallsCardsGrid');
            if (!grid) return;
            grid.innerHTML = '';

            if (!masterHalls || masterHalls.length === 0) {
                grid.innerHTML = `<div class="col-span-3 text-center py-8 text-slate-500 text-xs">لا توجد قاعات مضافة حالياً في السنتر.</div>`;
                return;
            }

            masterHalls.forEach(hall => {
                const hallGroupsCount = (masterGroups || []).filter(g => (g.hallId === hall.id || g.hall?.id === hall.id)).length;

                const cardHtml = `
                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-amber-500/40 transition-all">
                        <div>
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h3 class="text-base font-bold text-white">${hall.name ?? 'قاعة'}</h3>
                                    <span class="text-xs text-amber-400 font-bold mt-0.5 block">سعة القاعة: ${hall.capacity ?? 0} طالب</span>
                                </div>
                                <div class="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold">
                                    <i class="fa-solid fa-school"></i>
                                </div>
                            </div>
                            <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 flex items-center justify-between my-2">
                                <span class="text-slate-400">المجموعات المرتبطة بالقاعة:</span>
                                <span class="font-bold font-mono text-sky-400">${hallGroupsCount} مجموعة</span>
                            </div>
                        </div>
                        <div class="flex justify-end pt-2 border-t border-slate-800/80 mt-2">
                            <span class="text-[11px] text-emerald-400 font-bold flex items-center"><i class="fa-solid fa-check-circle ml-1"></i> متاحة للاستخدام</span>
                        </div>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHtml);
            });
        }

        function populateGroupTeacherDropdown() {
            const select = document.getElementById('groupTeacherSelect');
            if (!select) return;
            if (!masterTeachers || masterTeachers.length === 0) {
                select.innerHTML = '<option value="">لا يوجد مدرسين - أضف مدرس أولاً</option>';
                return;
            }
            select.innerHTML = masterTeachers.map(t => `<option value="${t.id}">${t.name} (${t.subject})</option>`).join('');
        }

        function populateGroupHallDropdown() {
            const select = document.getElementById('groupHallSelect');
            if (!select) return;
            if (!masterHalls || masterHalls.length === 0) {
                select.innerHTML = '<option value="">لا يوجد قاعات - أضف قاعة أولاً</option>';
                return;
            }
            select.innerHTML = '<option value="">اختر القاعة...</option>' + masterHalls.map(h => `<option value="${h.id}">${h.name} (سعة: ${h.capacity})</option>`).join('');
        }

        function openAddTeacherModal() { document.getElementById('addTeacherModal')?.classList.remove('hidden'); }
        function closeAddTeacherModal() { 
            document.getElementById('addTeacherModal')?.classList.add('hidden'); 
            document.getElementById('addTeacherForm')?.reset();
            document.getElementById('gradesContainer')?.classList.add('hidden');
        }

        function openAddGroupModal() { document.getElementById('addGroupModal')?.classList.remove('hidden'); }
        function closeAddGroupModal() { 
            document.getElementById('addGroupModal')?.classList.add('hidden'); 
            document.getElementById('addGroupForm')?.reset();
        }

        function openAddHallModal() { document.getElementById('addHallModal')?.classList.remove('hidden'); }
        function closeAddHallModal() { 
            document.getElementById('addHallModal')?.classList.add('hidden'); 
            document.getElementById('addHallForm')?.reset();
        }

        async function handleCreateTeacher(e) {
            e.preventDefault();
            const name = document.getElementById('teacherNameInput')?.value?.trim() || '';
            const subject = document.getElementById('teacherSubjectInput')?.value?.trim() || '';
            const phone = document.getElementById('teacherPhoneInput')?.value?.trim() || '';
            const stage = document.getElementById('teacherStageSelect')?.value || null;
            const selectedGrades = Array.from(document.querySelectorAll('input[name="teacherGrades"]:checked')).map(cb => cb.value);

            try {
                const response = await fetch('/api/teachers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, subject, phone, stage, grades: selectedGrades })
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData?.message || 'حدث خطأ أثناء حفظ المدرس');
                    return;
                }
                closeAddTeacherModal();
                showToast(`تم حفظ المدرس ${name} بنجاح`);
                fetchTeachersFromApi();
            } catch (err) {
                showToast('حدث خطأ في الاتصال بالسيرفر');
            }
        }

        async function handleCreateGroup(e) {
            e.preventDefault();
            const teacherId = document.getElementById('groupTeacherSelect')?.value || '';
            const hallId = document.getElementById('groupHallSelect')?.value || '';
            const name = document.getElementById('groupNameInput')?.value?.trim() || '';
            const price = parseFloat(document.getElementById('groupPriceInput')?.value) || 0;
            const sessionsPerMonth = parseInt(document.getElementById('groupSessionsInput')?.value) || 4;
            const startTime = document.getElementById('groupStartTimeInput')?.value?.trim() || '';
            const endTime = document.getElementById('groupEndTimeInput')?.value?.trim() || '';
            const selectedDays = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => cb.value);

            try {
                const response = await fetch('/api/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        teacher_id: teacherId,
                        hall_id: hallId || null,
                        name,
                        price,
                        sessionsPerMonth,
                        dayOfWeek: selectedDays.join(' - '),
                        startTime,
                        endTime
                    })
                });

                const resData = await response.json();
                if (response.status === 409 || !response.ok || !resData.success) {
                    showToast(resData?.message || (response.status === 409 ? "عفواً، القاعة مشغولة في هذا الوقت بمجموعة أخرى" : "حدث خطأ أثناء حفظ المجموعة"));
                    return;
                }
                closeAddGroupModal();
                showToast(`تم حفظ مجموعة (${name}) بنجاح`);
                fetchGroupsFromApi();
            } catch (err) {
                showToast('حدث خطأ أثناء حفظ المجموعة');
            }
        }

        async function handleCreateHall(e) {
            e.preventDefault();
            const name = document.getElementById('hallNameInput')?.value?.trim() || '';
            const capacity = parseInt(document.getElementById('hallCapacityInput')?.value) || 0;

            if (!name || capacity <= 0) {
                showToast('يرجى إدخال اسم القاعة وسعة صحيحة');
                return;
            }

            try {
                const response = await fetch('/api/halls', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, capacity })
                });
                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    showToast(resData?.message || 'حدث خطأ أثناء حفظ القاعة');
                    return;
                }
                closeAddHallModal();
                showToast(`تم إضافة القاعة ${name} بنجاح`);
                fetchHallsFromApi();
            } catch (err) {
                showToast('حدث خطأ أثناء حفظ القاعة');
            }
        }

        async function openTeacherProfileModal(teacherId) {
            const modal = document.getElementById('teacherProfileModal');
            if (!modal) return;

            // Show modal and set temporary loading states
            document.getElementById('tpName').textContent = 'جاري التحميل...';
            document.getElementById('tpSubject').textContent = '--';
            document.getElementById('tpGroupsCount').textContent = '0';
            document.getElementById('tpStudentsCount').textContent = '0';
            document.getElementById('tpBookletsSales').textContent = '0 ج.م';
            document.getElementById('tpTotalCollected').textContent = '0 ج.م';
            document.getElementById('tpTeacherNet').textContent = '0 ج.م';
            document.getElementById('tpCenterShare').textContent = '0 ج.م';
            document.getElementById('tpGroupsList').innerHTML = '<div class="text-xs text-slate-500 text-center py-4">جاري تحميل البيانات...</div>';
            modal.classList.remove('hidden');

            try {
                const response = await fetch(`/api/teachers/${teacherId}/profile`);
                const resData = await response.json();

                if (!response.ok || !resData?.success) {
                    showToast(resData?.message || 'تعذر تحميل بيانات بروفايل المدرس');
                    closeTeacherProfileModal();
                    return;
                }

                const data = resData.data;
                document.getElementById('tpName').textContent = data.name ?? 'بدون اسم';
                document.getElementById('tpSubject').textContent = data.subject ?? 'عام';
                document.getElementById('tpGroupsCount').textContent = data.groups?.length ?? 0;
                document.getElementById('tpStudentsCount').textContent = data.activeStudentsCount ?? 0;
                document.getElementById('tpBookletsSales').textContent = (data.bookletsSales ?? 0) + ' ج.م';

                currentTeacherStats.totalCollected = data.totalCollected ?? 0;
                document.getElementById('tpTotalCollected').textContent = currentTeacherStats.totalCollected + ' ج.م';
                
                if (data.centerPercentage != null) {
                    const commInput = document.getElementById('tpCommissionValue');
                    if (commInput) commInput.value = data.teacherPercentage ?? 50;
                }
                calculatePayout();

                const gl = document.getElementById('tpGroupsList');
                gl.innerHTML = '';
                if (!data.groups || data.groups.length === 0) {
                    gl.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">لا يوجد مجموعات نشطة للمدرس</div>';
                } else {
                    data.groups.forEach(g => {
                        gl.innerHTML += `
                        <div class="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800 my-1">
                            <div>
                                <span class="text-slate-200 font-bold block">${g.name ?? '--'}</span>
                                <span class="text-[10px] text-slate-400">${g.hallName ?? 'بدون قاعة'} (${g.enrolledCount ?? 0} طالب)</span>
                            </div>
                            <span class="text-emerald-400 font-mono font-bold text-xs">${g.price ?? 0} ج.م</span>
                        </div>`;
                    });
                }
            } catch (err) {
                console.error("Teacher profile load error:", err);
                showToast('خطأ في الاتصال بالسيرفر أثناء تحميل البروفايل');
                closeTeacherProfileModal();
            }
        }

        function closeTeacherProfileModal() {
            document.getElementById('teacherProfileModal')?.classList.add('hidden');
        }

        function calculatePayout() {
            const val = parseFloat(document.getElementById('tpCommissionValue')?.value) || 50;
            const collected = currentTeacherStats.totalCollected || 0;
            const tShare = (collected * val) / 100;
            const cShare = collected - tShare;
            
            const netEl = document.getElementById('tpTeacherNet');
            const centerEl = document.getElementById('tpCenterShare');
            if (netEl) netEl.textContent = tShare.toFixed(2) + ' ج.م';
            if (centerEl) centerEl.textContent = cShare.toFixed(2) + ' ج.م';
        }

        async function openGroupProfileModal(groupId) {
            const modal = document.getElementById('groupProfileModal');
            if (!modal) return;

            document.getElementById('gpName').textContent = 'جاري التحميل...';
            document.getElementById('gpHallTime').textContent = '--';
            document.getElementById('gpSessions').textContent = '--';
            document.getElementById('gpPrice').textContent = '--';
            document.getElementById('gpStudentSearch').value = '';
            const tbody = document.getElementById('gpStudentsTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-500">جاري إحضار بيانات الطلاب...</td></tr>';
            modal.classList.remove('hidden');

            try {
                const groupObj = (masterGroups || []).find(g => g.id === groupId);
                if (groupObj) {
                    document.getElementById('gpName').textContent = groupObj.name ?? 'بدون اسم';
                    document.getElementById('gpHallTime').textContent = `${groupObj.hall?.name ?? 'بدون قاعة'} ${groupObj.dayOfWeek ? `(${groupObj.dayOfWeek})` : ''}`;
                    document.getElementById('gpSessions').textContent = groupObj.sessionsPerMonth ?? 4;
                    document.getElementById('gpPrice').textContent = (groupObj.price ?? 0) + ' ج.م';
                }

                const response = await fetch(`/api/groups/${groupId}/students`);
                const resData = await response.json();

                if (!response.ok || !resData?.success) {
                    showToast(resData?.message || 'تعذر تحميل قائمة طلاب المجموعة');
                    closeGroupProfileModal();
                    return;
                }

                if (resData.groupName && !groupObj) {
                    document.getElementById('gpName').textContent = resData.groupName;
                    document.getElementById('gpSessions').textContent = resData.sessionsPerMonth ?? 4;
                }

                currentGroupStudents = resData.data || [];
                renderGroupStudentsTable(currentGroupStudents);
            } catch (err) {
                console.error("Group profile error:", err);
                showToast('حدث خطأ في تحميل بيانات المجموعة');
                closeGroupProfileModal();
            }
        }

        function renderGroupStudentsTable(studentsList) {
            const tbody = document.getElementById('gpStudentsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!studentsList || studentsList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-500">لا يوجد طلاب مسجلون في هذه المجموعة حالياً.</td></tr>';
                return;
            }

            studentsList.forEach(st => {
                let quotaBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                if (st.remainingSessions <= 1) {
                    quotaBadgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse";
                } else if (st.remainingSessions <= 2) {
                    quotaBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                }

                const rowHtml = `
                    <tr class="hover:bg-slate-800/30 transition-colors">
                        <td class="p-3 font-mono font-bold text-sky-400">${st.barcode ?? st.code ?? '--'}</td>
                        <td class="p-3 font-bold text-white">${st.name ?? 'طالب'}</td>
                        <td class="p-3 font-mono text-slate-300">${st.phone ?? 'غير مسجل'}</td>
                        <td class="p-3 text-center font-mono font-bold text-slate-200">${st.attendedCount ?? 0} من ${st.sessionsPerMonth ?? 4}</td>
                        <td class="p-3 text-center">
                            <span class="px-3 py-1 rounded-full border text-xs font-mono font-bold ${quotaBadgeClass}">
                                ${st.remainingSessions ?? 0} حصص متبقية
                            </span>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }

        function filterGroupStudents() {
            const query = document.getElementById('gpStudentSearch')?.value?.toLowerCase().trim() || '';
            if (!query) {
                renderGroupStudentsTable(currentGroupStudents);
                return;
            }
            const filtered = (currentGroupStudents || []).filter(s => {
                const nameMatch = s.name && s.name.toLowerCase().includes(query);
                const codeMatch = s.code && s.code.toString().toLowerCase().includes(query);
                const barMatch = s.barcode && s.barcode.toString().toLowerCase().includes(query);
                return nameMatch || codeMatch || barMatch;
            });
            renderGroupStudentsTable(filtered);
        }

        function closeGroupProfileModal() {
            document.getElementById('groupProfileModal')?.classList.add('hidden');
        }

        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            const msgEl = document.getElementById('toastMessage');
            if (!toast || !msgEl) return;
            msgEl.textContent = message;
            toast.classList.remove('translate-y-20', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3000);
        }