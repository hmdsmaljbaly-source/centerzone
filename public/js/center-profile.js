(function() {
    const token = localStorage.getItem('centerzone_token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'SUPER_ADMIN') {
        sessionStorage.setItem('redirect_after_login', window.location.pathname + window.location.search);
        window.location.href = '/login.html';
        return;
    }

    // Set authorization header interceptor
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        options.headers = options.headers || {};
        const currentToken = localStorage.getItem('centerzone_token');
        if (url && url.toString().startsWith('/api/')) {
            if (options.headers instanceof Headers) {
                if (currentToken && !options.headers.has('Authorization')) {
                    options.headers.set('Authorization', 'Bearer ' + currentToken);
                }
            } else {
                options.headers['Authorization'] = options.headers['Authorization'] || (currentToken ? 'Bearer ' + currentToken : undefined);
            }
        }
        const response = await originalFetch.call(this, url, options);
        if (response.status === 401) {
            localStorage.clear();
            alert("جلسة العمل انتهت، يرجى إعادة الدخول");
            window.location.href = '/login.html';
        }
        return response;
    };
})();

// Get center database UUID from URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || '';
}

const centerDbId = getQueryParam('id');
let centerData = null;

window.onload = function() {
    if (!centerDbId) {
        showToast('لم يتم تحديد كود السنتر بشكل صحيح');
        setTimeout(() => { window.location.href = '/super-admin.html'; }, 2000);
        return;
    }
    loadCenterProfileStats();
};

async function loadCenterProfileStats() {
    try {
        const response = await fetch(`/api/super-admin/centers/${centerDbId}`);
        const resData = await response.json();

        if (!response.ok || !resData.success) {
            showToast(resData.message || 'فشل جلب بيانات السنتر');
            return;
        }

        centerData = resData.data;
        renderCenterDetails(centerData);
    } catch (err) {
        showToast('خطأ في الاتصال بالخادم لجلب الإحصائيات');
    }
}

function renderCenterDetails(data) {
    // Header & Info
    document.getElementById('headerCenterName').textContent = data.name;
    document.getElementById('centerName').textContent = data.name;
    document.getElementById('centerCode').textContent = data.code || data.centerId || data.id;
    document.getElementById('adminUsername').textContent = data.adminUsername;
    document.getElementById('centerPhone').textContent = data.phone;
    document.getElementById('subscriptionExpiry').textContent = data.expiresAt ? data.expiresAt.split('T')[0] : 'غير محدد';

    // Subscription status badge
    const statusEl = document.getElementById('subscriptionStatus');
    statusEl.textContent = data.isActive ? (data.plan === 'TRIAL' ? 'تجريبي نشط' : 'نشط (ACTIVE)') : 'موقوف (SUSPENDED)';
    statusEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold ';
    if (!data.isActive) {
        statusEl.className += 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    } else if (data.plan === 'TRIAL') {
        statusEl.className += 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
    } else {
        statusEl.className += 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }

    // Quota details
    document.getElementById('statAllowedCodes').textContent = data.allowedStudentCodes;
    document.getElementById('statUsedCodes').textContent = data.usedStudentCodes;
    document.getElementById('statRemainingCodes').textContent = data.remainingCodes;
    document.getElementById('usedCodesLabel').textContent = `${data.usedStudentCodes} / ${data.allowedStudentCodes}`;
    
    const percentage = data.allowedStudentCodes > 0 ? (data.usedStudentCodes / data.allowedStudentCodes) * 100 : 0;
    document.getElementById('quotaProgress').style.width = `${Math.min(100, percentage)}%`;

    // Activity counts
    document.getElementById('statStudentsCount').textContent = data.studentsCount;
    document.getElementById('statTeachersCount').textContent = data.teachersCount;
    document.getElementById('statGroupsCount').textContent = data.groupsCount;

    // Pre-populate renewal form
    document.getElementById('renewalMaxCodes').value = data.allowedStudentCodes;
    document.getElementById('renewalExpiryDate').value = data.expiresAt ? data.expiresAt.split('T')[0] : '';
    document.getElementById('renewalPlan').value = data.plan;
    document.getElementById('renewalIsActive').value = String(data.isActive);
}

// Generate code batch
async function handleProfileGenerateCodes(e) {
    e.preventDefault();
    const quantity = parseInt(document.getElementById('profileGenQuantity').value) || 0;
    const startIndex = parseInt(document.getElementById('profileGenStartIndex').value) || 0;

    if (quantity <= 0 || startIndex <= 0) {
        showToast('يرجى كتابة كمية ومسلسل بدء صحيحين');
        return;
    }

    try {
        const response = await fetch('/api/super-admin/generate-codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ centerId: centerDbId, quantity, startIndex })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast(data.message || 'تم توليد الدفعة بنجاح');
            loadCenterProfileStats();
        } else {
            showToast(data.message || 'فشل التوليد: تجاوزت الحد الأقصى للمشتركين');
        }
    } catch (err) {
        showToast('خطأ في الاتصال بالخادم');
    }
}

// Download codes sheet in CSV format
async function downloadProfileCodesCSV() {
    try {
        const response = await fetch(`/api/super-admin/centers/${centerDbId}/prepaid-cards`);
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

// Print codes as barcodes sheet popup
async function printProfileCodesBarcodes() {
    try {
        const response = await fetch(`/api/super-admin/centers/${centerDbId}/prepaid-cards`);
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
        showToast('حدث خطأ أثناء طباعة كروت الباركود');
    }
}

// Subscription Renewal Modification
async function handleProfileRenewal(e) {
    e.preventDefault();
    const maxCodes = parseInt(document.getElementById('renewalMaxCodes').value) || 0;
    const expiryDate = document.getElementById('renewalExpiryDate').value;
    const plan = document.getElementById('renewalPlan').value;
    const isActive = document.getElementById('renewalIsActive').value === 'true';

    if (maxCodes <= 0 || !expiryDate) {
        showToast('يرجى ملء بيانات التجديد بشكل صحيح');
        return;
    }

    try {
        const response = await fetch(`/api/super-admin/centers/${centerDbId}/subscription`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expiresAt: expiryDate,
                allowedStudentCodes: maxCodes,
                plan,
                isActive
            })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast('تم تحديث وتطبيق إعدادات الاشتراك والـ Quotas بنجاح!');
            loadCenterProfileStats();
        } else {
            showToast(data.message || 'حدث خطأ أثناء تعديل الاشتراك');
        }
    } catch (err) {
        showToast('خطأ في الاتصال بالخادم لتعديل الاشتراك');
    }
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
