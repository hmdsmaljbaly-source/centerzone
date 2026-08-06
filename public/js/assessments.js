let currentGroupId = null;
let currentAssessmentId = null;
let currentMaxScore = 0;
let groupStudents = [];
let currentGrades = {};

document.addEventListener('DOMContentLoaded', () => {
    loadGroups();
    
    document.getElementById('groupSelect').addEventListener('change', (e) => {
        currentGroupId = e.target.value;
        const btnNew = document.getElementById('btnNewAssessment');
        const assessSelect = document.getElementById('assessmentSelect');
        
        if (currentGroupId) {
            btnNew.disabled = false;
            assessSelect.disabled = false;
            loadAssessmentsForGroup();
            fetchGroupStudents();
        } else {
            btnNew.disabled = true;
            assessSelect.disabled = true;
            assessSelect.innerHTML = '<option value="">برجاء اختيار المجموعة أولاً</option>';
            document.getElementById('studentsList').innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500 font-bold">برجاء اختيار مجموعة وتقييم للبدء بالرصد</td></tr>';
            document.getElementById('btnSaveGrades').classList.add('hidden');
        }
    });

    document.getElementById('assessmentSelect').addEventListener('change', (e) => {
        currentAssessmentId = e.target.value;
        if (currentAssessmentId) {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            currentMaxScore = parseFloat(selectedOpt.dataset.max) || 0;
            document.getElementById('btnSaveGrades').classList.remove('hidden');
            renderStudentsGrid();
        } else {
            document.getElementById('btnSaveGrades').classList.add('hidden');
            document.getElementById('studentsList').innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500 font-bold">برجاء اختيار تقييم لعرض قائمة الرصد</td></tr>';
        }
    });
});

async function loadGroups() {
    try {
        const res = await fetch(`${window.API_BASE_URL}/groups`);
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

async function fetchGroupStudents() {
    try {
        const res = await fetch(`${window.API_BASE_URL}/attendance/groups/${currentGroupId}`);
        const data = await res.json();
        if (data.success) {
            groupStudents = data.data;
            if (currentAssessmentId) renderStudentsGrid();
        }
    } catch (err) {
        window.showToast("خطأ في جلب بيانات الطلاب", "error");
    }
}

async function loadAssessmentsForGroup() {
    try {
        // Fetch assessments for group. We need to build this backend endpoint or just fetch from groups endpoint if included.
        const res = await fetch(`${window.API_BASE_URL}/assessments/group/${currentGroupId}`);
        const data = await res.json();
        const select = document.getElementById('assessmentSelect');
        select.innerHTML = '<option value="">اختر التقييم...</option>';
        if (data.success) {
            data.data.forEach(a => {
                select.innerHTML += `<option value="${a.id}" data-max="${a.maxScore}">${a.title} (من ${a.maxScore})</option>`;
            });
        }
    } catch (err) {
        // endpoint might not exist yet, but we will create it
    }
}

function renderStudentsGrid() {
    const tbody = document.getElementById('studentsList');
    tbody.innerHTML = '';
    currentGrades = {};
    
    groupStudents.forEach(st => {
        // Pre-fill existing grades if available in student.studentGrades array
        let existingGrade = st.studentGrades?.find(g => g.assessmentId === currentAssessmentId);
        let defaultScore = existingGrade ? existingGrade.score : '';
        let isAbsent = existingGrade ? existingGrade.isAbsent : false;
        
        let perc = existingGrade ? ((defaultScore / currentMaxScore) * 100).toFixed(1) + '%' : '0%';
        if (isAbsent) perc = 'غائب';
        
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b dark:border-gray-700">
                <td class="px-6 py-3 font-bold">${st.name}</td>
                <td class="px-6 py-3 text-gray-500 font-mono">${st.code}</td>
                <td class="px-6 py-3 text-center">
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="absent-${st.id}" onchange="toggleAbsent('${st.id}')" ${isAbsent ? 'checked' : ''} class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500">
                        <span class="mr-2 text-sm text-gray-700 dark:text-gray-300">غائب</span>
                    </label>
                </td>
                <td class="px-6 py-3 text-center">
                    <input type="number" id="score-${st.id}" value="${defaultScore}" onkeyup="calcPerc('${st.id}')" onchange="calcPerc('${st.id}')" ${isAbsent ? 'disabled' : ''} class="w-24 border p-2 rounded text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-900 dark:border-gray-600 disabled:opacity-50">
                </td>
                <td class="px-6 py-3 text-center">
                    <span id="perc-${st.id}" class="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-gray-900 px-3 py-1 rounded-full">${perc}</span>
                </td>
            </tr>
        `;
    });
}

window.toggleAbsent = function(studentId) {
    const isAbsent = document.getElementById(`absent-${studentId}`).checked;
    const scoreInput = document.getElementById(`score-${studentId}`);
    const percSpan = document.getElementById(`perc-${studentId}`);
    
    if (isAbsent) {
        scoreInput.disabled = true;
        scoreInput.value = '';
        percSpan.innerText = 'غائب';
        percSpan.className = 'font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full';
    } else {
        scoreInput.disabled = false;
        percSpan.innerText = '0%';
        percSpan.className = 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-gray-900 px-3 py-1 rounded-full';
    }
}

window.calcPerc = function(studentId) {
    const score = parseFloat(document.getElementById(`score-${studentId}`).value);
    const percSpan = document.getElementById(`perc-${studentId}`);
    
    if (isNaN(score)) {
        percSpan.innerText = '0%';
    } else {
        let perc = ((score / currentMaxScore) * 100).toFixed(1);
        percSpan.innerText = `${perc}%`;
    }
}

function openAssessmentModal() {
    document.getElementById('assessmentModal').classList.remove('hidden');
}

function closeAssessmentModal() {
    document.getElementById('assessmentModal').classList.add('hidden');
}

window.saveNewAssessment = async function() {
    const type = document.getElementById('newType').value;
    const title = document.getElementById('newTitle').value;
    const maxScore = document.getElementById('newMaxScore').value;
    
    if (!title || !maxScore) {
        window.showToast("برجاء إدخال العنوان والدرجة النهائية", "warning");
        return;
    }
    
    const fullTitle = `[${type}] ${title}`;
    
    try {
        const res = await fetch(`${window.API_BASE_URL}/assessments`, {
            method: 'POST',
            body: JSON.stringify({ groupId: currentGroupId, title: fullTitle, maxScore })
        });
        const data = await res.json();
        
        if (data.success) {
            window.showToast("تم إنشاء التقويم بنجاح", "success");
            closeAssessmentModal();
            loadAssessmentsForGroup(); // reload dropdown
            
            // Auto select the new one
            setTimeout(() => {
                document.getElementById('assessmentSelect').value = data.data.id;
                document.getElementById('assessmentSelect').dispatchEvent(new Event('change'));
            }, 500);
        }
    } catch (err) {
        window.showToast("فشل إنشاء التقويم", "error");
    }
}

window.submitBulkGrades = async function() {
    const payload = [];
    
    groupStudents.forEach(st => {
        const isAbsent = document.getElementById(`absent-${st.id}`).checked;
        const scoreVal = document.getElementById(`score-${st.id}`).value;
        
        if (isAbsent) {
            payload.push({ studentId: st.id, score: 0, isAbsent: true });
        } else if (scoreVal !== '') {
            payload.push({ studentId: st.id, score: parseFloat(scoreVal), isAbsent: false });
        }
    });
    
    if (payload.length === 0) {
        window.showToast("لا يوجد بيانات ليتم حفظها", "warning");
        return;
    }
    
    try {
        document.getElementById('btnSaveGrades').innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحفظ...';
        
        const res = await fetch(`${window.API_BASE_URL}/assessments/${currentAssessmentId}/grades/bulk`, {
            method: 'POST',
            body: JSON.stringify({ grades: payload })
        });
        
        if (res.ok) {
            window.showToast("تم حفظ الدرجات بنجاح", "success");
            fetchGroupStudents(); // refresh state
        } else {
            throw new Error();
        }
    } catch (err) {
        window.showToast("خطأ أثناء حفظ الدرجات", "error");
    } finally {
        document.getElementById('btnSaveGrades').innerHTML = '<i class="fas fa-save ml-2"></i>حفظ الرصد';
    }
}
