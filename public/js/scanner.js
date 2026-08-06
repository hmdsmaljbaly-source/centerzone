let currentGroupId = null;
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
            const input = document.getElementById('barcodeInput');
            input.disabled = false;
            input.placeholder = 'امسح الكود الآن...';
            input.focus(); // Auto focus immediately
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
        const statusHtml = isPresent 
            ? `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">[حضر]</span>` 
            : `<span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">[غائب]</span>`;
            
        const remaining = (st.enrollments && st.enrollments.length > 0) ? st.enrollments[0].remainingSessions : (st.remainingSessions || 0);
        let balClass = 'text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 text-xs';
        if (remaining <= 0) {
            balClass = 'text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30 text-xs font-bold animate-pulse';
        } else if (remaining <= 2) {
            balClass = 'text-orange-400 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/30 text-xs font-bold';
        }

        tbody.innerHTML += `
            <tr id="row-${st.id}" class="hover:bg-slate-800/50 transition-colors border-b border-slate-800/60">
                <td class="px-6 py-4 font-bold text-white"><a href="student-profile.html?id=${st.id}" class="text-sky-400 hover:text-sky-300 hover:underline">${st.name}</a></td>
                <td class="px-6 py-4 text-slate-300 font-mono tracking-wider"><a href="student-profile.html?id=${st.id}" class="hover:underline">${st.code}</a></td>
                <td class="px-6 py-4" id="status-${st.id}">
                    ${statusHtml}
                </td>
                <td class="px-6 py-4">
                    <span id="bal-${st.id}" class="font-mono ${balClass}">
                        ${remaining}
                    </span>
                </td>
            </tr>
        `;
    });
}

function updateKPIs() {
    const total = groupStudents.length;
    const present = groupStudents.filter(s => s.attendances && s.attendances.length > 0).length;
    const absent = total - present;
    const expired = groupStudents.filter(s => {
        const rem = (s.enrollments && s.enrollments.length > 0) ? s.enrollments[0].remainingSessions : (s.remainingSessions || 0);
        return rem <= 0;
    }).length;
    
    document.getElementById('kpiTotal').innerText = total;
    document.getElementById('kpiPresent').innerText = present;
    document.getElementById('kpiAbsent').innerText = absent;
    document.getElementById('kpiExpired').innerText = expired;
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
            window.showToast(`تم تسجيل حضور: ${result.student.name}`, "success");
            
            if (result.needsRecharge) {
                window.showToast(result.warning, "warning");
            }
            
            // Update local state directly
            const idx = groupStudents.findIndex(s => s.id === result.student.id);
            if (idx !== -1) {
                groupStudents[idx].remainingSessions = result.student.remainingSessions;
                if (!groupStudents[idx].attendances) groupStudents[idx].attendances = [];
                groupStudents[idx].attendances.push(result.attendance);
                renderStudents();
                updateKPIs();
            } else {
                fetchGroupData();
            }
        } else {
            window.showToast(data.message, "error");
        }
    } catch (err) {
        window.showToast("خطأ أثناء المسح", "error");
    }
}