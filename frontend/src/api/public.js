import api from './index';

// 公共 API（无需认证）
export const publicApi = {
  // 获取公共统计
  getStats: () => api.get('/api/public/stats'),

  // 获取公共配置
  getConfig: () => api.get('/api/manage/public-config'),
};

// OAuth 相关 API
export const oauthApi = {
  // 获取认证 URL
  getAuthUrl: (params) => api.get('/api/oauth/auth-url', { params }),

  // 提交回调 URL
  submitCallback: (data) => api.post('/api/oauth/from-callback-url', data),
};

export { default as api } from './index';
export { authApi } from './auth';
export { credentialsApi } from './credentials';
export { adminApi } from './admin';
