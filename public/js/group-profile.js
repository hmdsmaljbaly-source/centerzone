const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('id');

if (!groupId) {
    window.showToast?.("رقم المجموعة غير متوفر", "error");
    setTimeout(() => { window.location.href = 'teachers.html'; }, 1500);
}

let groupData = null;

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('headerCenterName');
    if (el && window.getActiveCenterHeader) el.textContent = window.getActiveCenterHeader();
    
    fetchGroupProfile();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        renderRoster(query);
    });
});

async function fetchGroupProfile() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/groups/${groupId}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error fetching group profile');
        }
        
        groupData = data.data;
        renderGroupProfile();
    } catch (err) {
        window.showToast?.("فشل في تحميل بيانات المجموعة", "error");
        document.getElementById('loading').innerText = "حدث خطأ أثناء التحميل";
    }
}

function renderGroupProfile() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('groupContent').classList.remove('hidden');
    
    document.getElementById('groupName').innerText = groupData.name;
    document.getElementById('groupTeacher').innerHTML = `<i class="fa-solid fa-chalkboard-user ml-1"></i>${groupData.teacher?.name || 'غير محدد'}`;
    document.getElementById('groupGrade').innerText = groupData.grade || "عام";
    
    document.getElementById('groupSchedule').innerText = `${groupData.dayOfWeek || ''} ${groupData.startTime || ''} ${groupData.hall ? `(${groupData.hall.name})` : ''}`;
    document.getElementById('groupPrice').innerText = `${groupData.price || 0} ج.م`;

    renderRoster('');
}

function renderRoster(searchQuery) {
    const tbody = document.getElementById('rosterBody');
    tbody.innerHTML = '';
    
    if (!groupData.students || groupData.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500 font-bold">لا يوجد طلاب مسجلين بهذه المجموعة</td></tr>`;
        return;
    }

    const filtered = groupData.students.filter(s => {
        if (!searchQuery) return true;
        return (s.name && s.name.includes(searchQuery)) || (s.code && s.code.includes(searchQuery)) || (s.student_phone && s.student_phone.includes(searchQuery));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500 font-bold">لا يوجد نتائج للبحث</td></tr>`;
        return;
    }

    filtered.forEach(st => {
        const rem = st.remainingSessions || 0;
        const badge = rem <= 0 ? `<span class="px-2 py-1 bg-rose-500/10 text-rose-400 font-bold rounded-lg border border-rose-500/20">${rem} حصص</span>` : `<span class="px-2 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20">${rem} حصص</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-3 font-mono text-sky-400"><a href="student-profile.html?id=${st.id}" class="hover:underline">${st.code}</a></td>
                <td class="p-3 font-bold text-white"><a href="student-profile.html?id=${st.id}" class="hover:underline">${st.name}</a></td>
                <td class="p-3 text-slate-400 font-mono">${st.student_phone || '--'}</td>
                <td class="p-3 text-amber-300 font-mono">${st.parent_phone || '--'}</td>
                <td class="p-3 text-center">${badge}</td>
            </tr>
        `;
    });
}
