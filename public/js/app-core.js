// Core Application Logic - Shared interceptors, headers, and UI alerts
window.API_BASE_URL = window.location.origin + '/api';

window.fetchWithCenter = async (resource, config = {}) => {
  return window.fetch(resource, config);
};

window.getActiveCenterHeader = () => {
  return localStorage.getItem('active_center_id') || '';
};

// Global Fetch Interceptor to inject JWT and x-center-id
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (!config) {
    config = {};
  }
  
  if (!config.headers) {
    config.headers = {};
  }
  
  // Inject x-center-id
  const centerId = window.getActiveCenterHeader();
  if (centerId && !config.headers['x-center-id']) {
    config.headers['x-center-id'] = centerId;
  }
  
  // Inject Authorization Bearer Token
  const token = localStorage.getItem('token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Enforce Content-Type JSON for API requests
  if (config.body && !config.headers['Content-Type'] && !(config.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await originalFetch(resource, config);
    
    // Auto-handle 401/403 for global redirects (Optional)
    if (response.status === 401 || response.status === 403) {
      if (!window.location.pathname.includes('login.html')) {
        // window.location.href = '/login.html';
      }
    }
    
    return response;
  } catch (err) {
    window.showToast("خطأ في الاتصال بالخادم", "error");
    throw err;
  }
};

// Global Toast System
window.showToast = (message, type = 'success') => {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    console.warn("Toast container not found in DOM");
    alert(message);
    return;
  }
  
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-600' : (type === 'warning' ? 'bg-amber-500' : 'bg-rose-600');
  toast.className = `flex items-center p-4 mb-4 text-white rounded-lg shadow-lg ${bgColor} transform transition-all duration-300 translate-x-full`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-2xl ml-3"></i>
    <span class="text-lg font-bold">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 10);
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
};

// Utility to parse JWT safely
window.parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};
