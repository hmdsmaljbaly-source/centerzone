async function executeLogin(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const alertBox = document.getElementById('loginAlert');
            const alertText = document.getElementById('loginAlertText');

            alertBox.classList.add('hidden');

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const resData = await response.json();

                if (response.ok && resData.success && resData.data) {
                    const { token, userRole, centerId } = resData.data;
                    localStorage.setItem('token', token);
                    localStorage.setItem('centerzone_token', token);
                    localStorage.setItem('userRole', userRole);
                    if (centerId) {
                        localStorage.setItem('active_center_id', centerId);
                        localStorage.setItem('x-center-id', centerId);
                        localStorage.setItem('centerId', centerId);
                        localStorage.setItem('currentCenterId', centerId);
                    }
                    localStorage.setItem('username', username);
                    
                    sessionStorage.removeItem('redirect_after_login');
                    if (userRole === 'SUPER_ADMIN' || resData.redirectUrl === '/super-admin.html' || (resData.data && resData.data.redirectUrl === '/super-admin.html')) {
                        window.location.href = '/super-admin.html';
                    } else {
                        window.location.href = '/index.html';
                    }
                } else {
                    alertText.textContent = resData.message || 'اسم المستخدم أو كلمة السر غير صحيحة';
                    alertBox.classList.remove('hidden');
                }
            } catch (error) {
                alertText.textContent = 'خطأ في الاتصال بالسيرفر وقاعدة البيانات';
                alertBox.classList.remove('hidden');
            }
        }