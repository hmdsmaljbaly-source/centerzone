const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('id');

if (!studentId) {
    window.showToast("رقم الطالب غير متوفر", "error");
    setTimeout(() => { window.location.href = 'students.html'; }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchStudentData();
});

async function fetchStudentData() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/students/${studentId}/profile`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error fetching profile');
        }
        
        window.currentStudentData = data.data;
        renderProfile(data.data);
    } catch (err) {
        window.showToast("فشل في تحميل بيانات الطالب", "error");
        document.getElementById('loading').innerText = "حدث خطأ أثناء التحميل";
    }
}

function renderProfile(student) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('profileContent').classList.remove('hidden');
    
    document.getElementById('stName').innerText = student.name;
    document.getElementById('stCode').innerText = student.code;
    document.getElementById('stGrade').innerText = student.grade || "غير محدد";
    document.getElementById('stPhone').innerText = student.student_phone || "لا يوجد";
    document.getElementById('stParentPhone').innerText = student.parent_phone || "لا يوجد";
    
    const sessionsBadge = document.getElementById('stSessions');
    sessionsBadge.className = 'flex flex-col gap-1';
    sessionsBadge.innerHTML = (student.enrollments || []).map(en => {
        const cls = en.remainingSessions <= 0 
            ? 'font-bold text-sm text-rose-600 px-3 py-1 bg-rose-100 rounded-full w-max'
            : 'font-bold text-sm text-emerald-600 px-3 py-1 bg-emerald-100 rounded-full w-max';
        return `<span class="${cls}">${en.group?.name || 'مجموعة'}: ${en.remainingSessions} حصص</span>`;
    }).join('') || '<span class="font-bold text-sm text-slate-500 px-3 py-1 bg-slate-100 rounded-full">غير مسجل</span>';

    // Render Attendance
    const attList = document.getElementById('attendanceList');
    attList.innerHTML = student.attendances.map(a => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="px-4 py-3">${new Date(a.date).toLocaleDateString('ar-EG')}</td>
            <td class="px-4 py-3">${a.group?.name || '---'}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                    ${a.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                </span>
            </td>
        </tr>
    `).join('');

    // Render Financials
    const finList = document.getElementById('financialsList');
    finList.innerHTML = student.feePayments.map(f => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="px-4 py-3">${new Date(f.createdAt).toLocaleDateString('ar-EG')}</td>
            <td class="px-4 py-3 font-bold text-emerald-600">${f.amount} ج.م</td>
            <td class="px-4 py-3">${f.paymentType === 'MONTHLY' ? 'شحن رصيد' : (f.paymentType === 'BOOKLET_ONLY' ? 'شراء مذكرة' : f.paymentType)}</td>
        </tr>
    `).join('');

    // Render Grades
    const grdList = document.getElementById('gradesList');
    grdList.innerHTML = student.studentGrades.map(g => {
        const perc = ((g.score / g.assessment.maxScore) * 100).toFixed(1);
        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="px-4 py-3">${g.assessment.title}</td>
            <td class="px-4 py-3 font-bold text-indigo-600">${g.score} / ${g.assessment.maxScore}</td>
            <td class="px-4 py-3">
                <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${perc}%"></div>
                </div>
                <span class="text-xs text-gray-500">${perc}%</span>
            </td>
        </tr>
    `}).join('');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
        btn.classList.add('text-gray-500');
    });
    
    const activeBtn = document.querySelector(`.tab-btn[data-target="${tabId}"]`);
    activeBtn.classList.remove('text-gray-500');
    activeBtn.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
}

function openRechargeModal() {
    document.getElementById('rechargeModal').classList.remove('hidden');
    
    // Attempt to load groups into recharge target if present
    const groupSelect = document.getElementById('chargeGroup');
    if (groupSelect && window.currentStudentData) {
        groupSelect.innerHTML = '<option value="">اختر المجموعة...</option>';
        (window.currentStudentData.enrollments || []).forEach(en => {
            groupSelect.insertAdjacentHTML('beforeend', `<option value="${en.groupId}">${en.group?.name || 'مجموعة'}</option>`);
        });
    }
}

function closeRechargeModal() {
    document.getElementById('rechargeModal').classList.add('hidden');
}

async function submitRecharge() {
    const amount = document.getElementById('chargeAmount').value;
    const sessions = document.getElementById('chargeSessions').value;
    const discountNote = document.getElementById('chargeDiscount').value;
    const groupSelect = document.getElementById('chargeGroup');
    const groupId = groupSelect ? groupSelect.value : '';
    
    if (!amount || !sessions) {
        window.showToast("برجاء إدخال المبلغ وعدد الحصص", "warning");
        return;
    }
    
    if (groupSelect && !groupId) {
        window.showToast("برجاء اختيار المجموعة المستهدفة", "warning");
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/students/${studentId}/pay`, {
            method: 'POST',
            body: JSON.stringify({ amount, sessions: parseInt(sessions), discountNote, groupId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            window.showToast("تم شحن الرصيد بنجاح", "success");
            closeRechargeModal();
            fetchStudentData(); // Refresh UI
        } else {
            throw new Error(data.message || 'فشل في عملية الشحن');
        }
    } catch (err) {
        window.showToast(err.message, "error");
    }
}
