import api from './index';

// 认证相关 API
export const authApi = {
  // 登录
  login: (username, password) =>
    api.post('/api/auth/login', { username, password }),

  // 注册
  register: (data) =>
    api.post('/api/auth/register', data),

  // 获取当前用户信息
  getMe: () =>
    api.get('/api/auth/me'),

  // 获取 API Keys
  getApiKeys: () =>
    api.get('/api/auth/api-keys'),

  // 创建 API Key
  createApiKey: (name) =>
    api.post('/api/auth/api-keys', { name }),

  // 重新生成 API Key
  regenerateApiKey: (keyId) =>
    api.post(`/api/auth/api-keys/${keyId}/regenerate`),
};

export default authApi;
