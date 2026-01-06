import api from './index';

// 管理员相关 API
export const adminApi = {
  // 用户管理
  users: {
    getAll: () => api.get('/api/admin/users'),
    update: (userId, data) => api.put(`/api/admin/users/${userId}`, data),
    delete: (userId) => api.delete(`/api/admin/users/${userId}`),
    resetPassword: (userId, newPassword) =>
      api.put(`/api/admin/users/${userId}/password`, { new_password: newPassword }),
  },

  // 凭证管理
  credentials: {
    getAll: () => api.get('/api/admin/credentials'),
    add: (name, apiKey) => api.post('/api/admin/credentials', { name, api_key: apiKey }),
    update: (credId, data) => api.put(`/api/admin/credentials/${credId}`, data),
    delete: (credId) => api.delete(`/api/admin/credentials/${credId}`),
    getDetail: (credId) => api.get(`/api/admin/credentials/${credId}/detail`),
    export: () => api.get('/api/admin/credentials/export'),
    getDuplicates: () => api.get('/api/admin/credential-duplicates'),
    deleteDuplicates: () => api.delete('/api/admin/credential-duplicates'),
    verifyAll: () => api.post('/api/manage/credentials/verify-all'),
    startAll: () => api.post('/api/manage/credentials/start-all'),
    deleteInactive: () => api.delete('/api/manage/credentials/inactive'),
    getTaskStatus: (taskId) => api.get(`/api/manage/credentials/task-status/${taskId}`),
  },

  // 日志管理
  logs: {
    getAll: (params) => api.get('/api/admin/logs', { params }),
    getDetail: (logId) => api.get(`/api/manage/logs/${logId}`),
  },

  // 统计
  stats: {
    getGlobal: () => api.get('/api/manage/stats/global'),
  },

  // 设置
  settings: {
    updateDefaultQuota: (quota) => api.post('/api/admin/settings/default-quota', { quota }),
    batchQuota: (quota) => api.post('/api/admin/settings/batch-quota', { quota }),
  },
};

export default adminApi;
