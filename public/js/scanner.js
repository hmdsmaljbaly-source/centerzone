let currentGroupId = null;
let currentAssessmentId = null;
let groupStudents = [];

document.addEventListener('DOMContentLoaded', () => {
    loadGroups();
    
    const barcodeInput = document.getElementById('barcodeInput');
    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const barcode = e.target.value.trim();
            if (barcode && currentGroupId) {
                scanStudent(barcode);
            }
            e.target.value = ''; // clear instantly
        }
    });

    document.getElementById('groupSelect').addEventListener('change', (e) => {
        currentGroupId = e.target.value;
        if (currentGroupId) {
            document.getElementById('barcodeInput').disabled = false;
            document.getElementById('barcodeInput').placeholder = 'امسح الكود الآن...';
            document.getElementById('barcodeInput').focus();
            fetchGroupData();
        } else {
            document.getElementById('barcodeInput').disabled = true;
        }
    });
});

async function loadGroups() {
    try {
        const res = await fetch(`${window.API_BASE_URL}/groups/today`);
        const data = await res.json();
        const select = document.getElementById('groupSelect');
        select.innerHTML = '<option value="">اختر المجموعة...</option>';
        if (data.success) {
            data.data.forEach(g => {
                select.innerHTML += `<option value="${g.id}">${g.name} (${g.grade})</option>`;
            });
        }
    } catch (err) {
        window.showToast("فشل تحميل المجموعات", "error");
    }
}

async function fetchGroupData() {
    try {
        const res = await fetch(`${window.API_BASE_URL}/attendance/groups/${currentGroupId}`);
        const data = await res.json();
        if (data.success) {
            groupStudents = data.data;
            renderStudents();
            updateKPIs();
        }
    } catch (err) {
        window.showToast("خطأ في جلب بيانات الطلاب", "error");
    }
}

function renderStudents() {
    const tbody = document.getElementById('studentList');
    tbody.innerHTML = '';
    
    groupStudents.forEach(st => {
        // check attendance today
        const isPresent = st.attendances && st.attendances.length > 0;
        
        let gradeHtml = '';
        if (currentAssessmentId) {
            gradeHtml = `
            <td class="px-6 py-3 text-center">
                <input type="number" onblur="submitGrade('${st.id}', this.value)" class="w-20 border rounded p-1 text-center" placeholder="الدرجة">
            </td>`;
        }
        
        tbody.innerHTML += `
            <tr id="row-${st.id}" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <td class="px-6 py-3 font-bold">${st.name}</td>
                <td class="px-6 py-3 text-gray-500 font-mono">${st.code}</td>
                <td class="px-6 py-3" id="status-${st.id}">
                    <span class="px-3 py-1 rounded-full text-sm font-bold ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}">
                        ${isPresent ? 'حاضر' : 'غائب'}
                    </span>
                </td>
                <td class="px-6 py-3">
                    <span id="bal-${st.id}" class="font-bold ${st.remainingSessions <= 0 ? 'text-rose-600' : 'text-emerald-600'}">
                        ${st.remainingSessions}
                    </span>
                </td>
                ${currentAssessmentId ? gradeHtml : '<td class="hidden"></td>'}
            </tr>
        `;
    });
}

function updateKPIs() {
    const total = groupStudents.length;
    const present = groupStudents.filter(s => s.attendances && s.attendances.length > 0).length;
    const absent = total - present;
    
    document.getElementById('kpiTotal').innerText = total;
    document.getElementById('kpiPresent').innerText = present;
    document.getElementById('kpiAbsent').innerText = absent;
}

async function scanStudent(barcode) {
    try {
        const res = await fetch(`${window.API_BASE_URL}/attendance/scan`, {
            method: 'POST',
            body: JSON.stringify({ studentBarcode: barcode, groupId: currentGroupId })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            const result = data.data;
            // Play success sound here if needed
            window.showToast(`تم تسجيل حضور: ${result.student.name}`, "success");
            
            if (result.needsRecharge) {
                window.showToast(result.warning, "warning");
                // Play warning sound
            }
            
            // Update local state directly to avoid full refetch
            const idx = groupStudents.findIndex(s => s.id === result.student.id);
            if (idx !== -1) {
                groupStudents[idx].remainingSessions = result.student.remainingSessions;
                if (!groupStudents[idx].attendances) groupStudents[idx].attendances = [];
                groupStudents[idx].attendances.push(result.attendance);
                renderStudents();
                updateKPIs();
            } else {
                // if student wasn't originally in the list? Refetch.
                fetchGroupData();
            }
        } else {
            window.showToast(data.message, "error");
        }
    } catch (err) {
        window.showToast("خطأ أثناء المسح", "error");
    }
}

async function createAssessment() {
    const title = document.getElementById('assessTitle').value;
    const maxScore = document.getElementById('assessMax').value;
    
    if (!currentGroupId || !title || !maxScore) {
        window.showToast("برجاء اختيار المجموعة وكتابة اسم التقييم والدرجة", "warning");
        return;
    }
    
    try {
        const res = await fetch(`${window.API_BASE_URL}/attendance/assessments`, {
            method: 'POST',
            body: JSON.stringify({ groupId: currentGroupId, title, maxScore })
        });
        const data = await res.json();
        
        if (data.success) {
            currentAssessmentId = data.data.id;
            window.showToast("تم إنشاء التقييم، يمكنك رصد الدرجات الآن", "success");
            document.getElementById('gradeColHeader').classList.remove('hidden');
            renderStudents();
        }
    } catch (err) {
        window.showToast("فشل إنشاء التقييم", "error");
    }
}

async function submitGrade(studentId, score) {
    if (!score || score === "") return;
    
    try {
        const res = await fetch(`${window.API_BASE_URL}/attendance/assessments/${currentAssessmentId}/grades`, {
            method: 'POST',
            body: JSON.stringify({ studentId, score })
        });
        
        if (res.ok) {
            window.showToast("تم حفظ الدرجة", "success");
        }
    } catch (err) {
        window.showToast("لم يتم حفظ الدرجة", "error");
    }
}