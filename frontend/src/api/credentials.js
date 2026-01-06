import api from './index';

// 凭证相关 API
export const credentialsApi = {
  // 获取我的凭证列表
  getMyCredentials: () =>
    api.get('/api/auth/credentials'),

  // 上传凭证
  upload: (formData) =>
    api.post('/api/auth/credentials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 10分钟超时
    }),

  // 更新凭证状态
  update: (id, params) =>
    api.patch(`/api/auth/credentials/${id}`, null, { params }),

  // 删除凭证
  delete: (id) =>
    api.delete(`/api/auth/credentials/${id}`),

  // 批量删除失效凭证
  deleteInactiveBatch: () =>
    api.delete('/api/auth/credentials/inactive/batch'),

  // 导出凭证
  export: (id) =>
    api.get(`/api/auth/credentials/${id}/export`),

  // 检测凭证
  verify: (id) =>
    api.post(`/api/auth/credentials/${id}/verify`),

  // 获取凭证配额
  getQuota: (id) =>
    api.get(`/api/manage/credentials/${id}/quota`),
};

export default credentialsApi;
