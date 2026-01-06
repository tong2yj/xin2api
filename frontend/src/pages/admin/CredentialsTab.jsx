import {
  Check,
  Download,
  ExternalLink,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/index';
import { Pagination } from '../../components/common/Pagination';
import { ConfirmModal, AlertModal } from '../../components/modals/Modal';
import { useToast } from '../../contexts/ToastContext';

const CREDS_PER_PAGE = 20;

export default function CredentialsTab() {
  const toast = useToast();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 添加凭证表单
  const [newCredName, setNewCredName] = useState('');
  const [newCredKey, setNewCredKey] = useState('');

  // 批量操作状态
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [startingAll, setStartingAll] = useState(false);

  // 模态框
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false });
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });
  const [credDetailModal, setCredDetailModal] = useState({ open: false, data: null, loading: false });
  const [duplicateModal, setDuplicateModal] = useState({ open: false, data: null, loading: false });

  // 上传凭证状态
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPublic, setUploadPublic] = useState(true);

  const showAlert = (title, message, type = 'info') => setAlertModal({ open: true, title, message, type });
  const showConfirm = (title, message, onConfirm, danger = false) => setConfirmModal({ open: true, title, message, onConfirm, danger });

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/credentials');
      setCredentials(res.data.credentials);
    } catch (err) {
      toast.error('获取凭证列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  // CD 实时倒计时
  useEffect(() => {
    const hasCD = credentials.some((c) => c.cd_flash > 0 || c.cd_pro > 0 || c.cd_30 > 0);
    if (!hasCD) return;

    const timer = setInterval(() => {
      setCredentials((prev) =>
        prev.map((c) => ({
          ...c,
          cd_flash: Math.max(0, (c.cd_flash || 0) - 1),
          cd_pro: Math.max(0, (c.cd_pro || 0) - 1),
          cd_30: Math.max(0, (c.cd_30 || 0) - 1),
        }))
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [credentials.length]);

  const totalPages = Math.ceil(credentials.length / CREDS_PER_PAGE);
  const paginatedCreds = credentials.slice(
    (page - 1) * CREDS_PER_PAGE,
    page * CREDS_PER_PAGE
  );

  // 凭证操作
  const addCredential = async () => {
    if (!newCredName.trim() || !newCredKey.trim()) return;
    try {
      await api.post('/api/admin/credentials', { name: newCredName, api_key: newCredKey });
      setNewCredName('');
      setNewCredKey('');
      fetchCredentials();
      toast.success('凭证添加成功');
    } catch (err) {
      toast.error('凭证添加失败');
    }
  };

  const toggleCredActive = async (credId, isActive) => {
    try {
      await api.put(`/api/admin/credentials/${credId}`, { is_active: !isActive });
      fetchCredentials();
    } catch (err) {
      toast.error('凭证状态更新失败');
    }
  };

  const deleteCredential = (credId) => {
    showConfirm('删除凭证', '确定删除此凭证？此操作不可恢复！', async () => {
      try {
        await api.delete(`/api/admin/credentials/${credId}`);
        const currentPageCreds = credentials.slice((page - 1) * CREDS_PER_PAGE, page * CREDS_PER_PAGE);
        if (currentPageCreds.length <= 1 && page > 1) {
          setPage(page - 1);
        }
        fetchCredentials();
        toast.success('凭证已删除');
      } catch (err) {
        toast.error('凭证删除失败');
      }
    }, true);
  };

  const pollTaskStatus = async (taskId, type) => {
    const poll = async () => {
      try {
        const res = await api.get(`/api/manage/credentials/task-status/${taskId}`);
        if (res.data.status === 'done') {
          fetchCredentials();
          if (type === 'verify') {
            setVerifyingAll(false);
            setVerifyResult(res.data);
            toast.success(`检测完成: 有效${res.data.valid} 无效${res.data.invalid}`);
          } else {
            setStartingAll(false);
            toast.success(`启动完成: 成功${res.data.success} 失败${res.data.failed}`);
          }
        } else {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        setTimeout(poll, 3000);
      }
    };
    poll();
  };

  const verifyAllCredentials = () => {
    showConfirm('检测凭证', '确定要检测所有凭证？', async () => {
      setVerifyingAll(true);
      setVerifyResult(null);
      try {
        const res = await api.post('/api/manage/credentials/verify-all');
        toast.info(`正在检测 ${res.data.total} 个凭证...`);
        pollTaskStatus(res.data.task_id, 'verify');
      } catch (err) {
        setVerifyingAll(false);
        toast.error(err.response?.data?.detail || err.message);
      }
    });
  };

  const startAllCredentials = () => {
    showConfirm('启动凭证', '确定要刷新所有凭证的Token？', async () => {
      setStartingAll(true);
      try {
        const res = await api.post('/api/manage/credentials/start-all');
        toast.info(`正在刷新 ${res.data.total} 个凭证...`);
        pollTaskStatus(res.data.task_id, 'start');
      } catch (err) {
        setStartingAll(false);
        toast.error(err.response?.data?.detail || err.message);
      }
    });
  };

  const exportAllCredentials = async () => {
    try {
      const res = await api.get('/api/admin/credentials/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_credentials_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('凭证已导出');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  const deleteInactiveCredentials = async () => {
    showConfirm('清理无效凭证', '确定要删除所有无效凭证吗？', async () => {
      try {
        const res = await api.delete('/api/manage/credentials/inactive');
        toast.success(res.data.message);
        setPage(1);
        fetchCredentials();
      } catch (err) {
        toast.error(err.response?.data?.detail || err.message);
      }
    }, true);
  };

  const viewCredentialDetail = async (credId) => {
    setCredDetailModal({ open: true, data: null, loading: true });
    try {
      const res = await api.get(`/api/admin/credentials/${credId}/detail`);
      setCredDetailModal({ open: true, data: res.data, loading: false });
    } catch (err) {
      setCredDetailModal({ open: false, data: null, loading: false });
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  const checkDuplicates = async () => {
    setDuplicateModal({ open: true, data: null, loading: true });
    try {
      const res = await api.get('/api/admin/credential-duplicates');
      setDuplicateModal({ open: true, data: res.data, loading: false });
    } catch (err) {
      setDuplicateModal({ open: false, data: null, loading: false });
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  const deleteDuplicates = async () => {
    if (!confirm(`确定要删除 ${duplicateModal.data?.duplicate_count || 0} 个重复凭证？`)) return;
    setDuplicateModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.delete('/api/admin/credential-duplicates');
      toast.success(res.data.message);
      setDuplicateModal({ open: false, data: null, loading: false });
      fetchCredentials();
    } catch (err) {
      setDuplicateModal((prev) => ({ ...prev, loading: false }));
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  const uploadCredentials = async () =\u003e {
    if (uploadFiles.length === 0) {
      toast.error('请选择要上传的文件');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      uploadFiles.forEach(file =\u003e formData.append('files', file));
      formData.append('is_public', uploadPublic);

      const res = await api.post('/api/auth/credentials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(`上传完成: 成功 ${res.data.uploaded_count}/${res.data.total_count} 个`);
      setUploadFiles([]);
      // 清空文件选择
      const input = document.getElementById('admin-cred-file-input');
      if (input) input.value = '';
      fetchCredentials();
    } catch (err) {
      toast.error(err.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) =\u003e {
    const files = Array.from(e.target.files);
    setUploadFiles((prev) =\u003e [...prev, ...files]);
  };

  const removeFile = (index) =\u003e {
    setUploadFiles((prev) =\u003e prev.filter((_, i) =\u003e i !== index));
  };

  const clearFiles = () =\u003e {
    setUploadFiles([]);
    const input = document.getElementById('admin-cred-file-input');
    if (input) input.value = '';
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 操作卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-4">
          <div className="font-medium text-purple-400 mb-1">🔐 OAuth 认证</div>
          <p className="text-sm text-gray-400 mb-3">通过 Google OAuth 获取凭证</p>
          <Link to="/oauth" className="btn btn-primary flex items-center gap-2 w-full justify-center">
            <ExternalLink size={16} />
            去认证
          </Link>
        </div>

        <div className="bg-cyan-600/20 border border-cyan-500/30 rounded-xl p-4">
          <div className="font-medium text-cyan-400 mb-1">🔍 一键检测</div>
          <p className="text-sm text-gray-400 mb-3">检测所有凭证有效性</p>
          <button
            onClick={verifyAllCredentials}
            disabled={verifyingAll}
            className="btn bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2 disabled:opacity-50 w-full justify-center"
          >
            {verifyingAll ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
            {verifyingAll ? '检测中...' : '开始检测'}
          </button>
        </div>

        <div className="bg-orange-600/20 border border-orange-500/30 rounded-xl p-4">
          <div className="font-medium text-orange-400 mb-1">🚀 一键启动</div>
          <p className="text-sm text-gray-400 mb-3">刷新所有凭证Token</p>
          <button
            onClick={startAllCredentials}
            disabled={startingAll}
            className="btn bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-2 disabled:opacity-50 w-full justify-center"
          >
            {startingAll ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {startingAll ? '启动中...' : '一键启动'}
          </button>
        </div>

        <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-4">
          <div className="font-medium text-green-400 mb-1">📦 导出凭证</div>
          <p className="text-sm text-gray-400 mb-3">导出所有凭证为JSON</p>
          <button
            onClick={exportAllCredentials}
            className="btn bg-green-600 hover:bg-green-500 text-white flex items-center gap-2 w-full justify-center"
          >
            <Download size={16} />
            导出全部
          </button>
        </div>

        <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-4">
          <div className="font-medium text-red-400 mb-1">🗑️ 清理无效</div>
          <p className="text-sm text-gray-400 mb-3">删除所有无效凭证</p>
          <button
            onClick={deleteInactiveCredentials}
            className="btn bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 w-full justify-center"
          >
            <Trash2 size={16} />
            一键清理
          </button>
        </div>

        <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="font-medium text-yellow-400 mb-1">🔍 重复检测</div>
          <p className="text-sm text-gray-400 mb-3">检测重复的凭证</p>
          <button
            onClick={checkDuplicates}
            className="btn bg-yellow-600 hover:bg-yellow-500 text-white flex items-center gap-2 w-full justify-center"
          >
            <Eye size={16} />
            开始检测
          </button>
        </div>
      </div>

      {/* 检测结果 */}
      {verifyResult && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <span className="text-gray-400">检测完成:</span>
            <span className="text-green-400">✅ 有效 {verifyResult.valid}</span>
            <span className="text-red-400">❌ 无效 {verifyResult.invalid}</span>
            <span className="text-purple-400">⭐ Tier3 {verifyResult.tier3}</span>
            <span className="text-gray-500">总计 {verifyResult.total}</span>
          </div>
        </div>
      )}

      {/* 上传凭证文件 */}
      \u003cdiv className=\"card\"\u003e
        \u003ch3 className=\"font-medium mb-3 flex items-center gap-2\"\u003e
          \u003cUpload size={18} className=\"text-green-400\" /\u003e
          上传凭证文件
        \u003c/h3\u003e
        \u003cdiv className=\"space-y-3\"\u003e
          {/* 文件选择 */}
          \u003cdiv className=\"flex flex-col md:flex-row gap-3\"\u003e
            \u003cinput
              type=\"file\"
              accept=\".json,.zip\"
              multiple
              onChange={handleFileChange}
              className=\"hidden\"
              id=\"admin-cred-file-input\"
            /\u003e
            \u003clabel
              htmlFor=\"admin-cred-file-input\"
              className=\"px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-300 hover:border-green-500 cursor-pointer flex items-center justify-center gap-2\"
            \u003e
              \u003cUpload size={16} /\u003e
              选择文件 (JSON/ZIP)
            \u003c/label\u003e

            {/* 公开选项 */}
            \u003clabel className=\"flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg cursor-pointer hover:border-purple-500\"\u003e
              \u003cinput
                type=\"checkbox\"
                checked={uploadPublic}
                onChange={(e) =\u003e setUploadPublic(e.target.checked)}
                className=\"w-4 h-4\"
              /\u003e
              \u003cspan className=\"text-gray-300\"\u003e设为公开\u003c/span\u003e
            \u003c/label\u003e

            {/* 上传按钮 */}
            \u003cbutton
              onClick={uploadCredentials}
              disabled={uploading || uploadFiles.length === 0}
              className=\"px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 justify-center\"
            \u003e
              {uploading ? (
                \u003c\u003e
                  \u003cRefreshCw size={16} className=\"animate-spin\" /\u003e
                  上传中...
                \u003c/\u003e
              ) : (
                \u003c\u003e
                  \u003cUpload size={16} /\u003e
                  上传 {uploadFiles.length \u003e 0 \u0026\u0026 `(${uploadFiles.length})`}
                \u003c/\u003e
              )}
            \u003c/button\u003e
          \u003c/div\u003e

          {/* 已选文件列表 */}
          {uploadFiles.length \u003e 0 \u0026\u0026 (
            \u003cdiv className=\"bg-dark-800 rounded-lg p-3 space-y-2\"\u003e
              \u003cdiv className=\"flex items-center justify-between mb-2\"\u003e
                \u003cspan className=\"text-xs text-gray-400\"\u003e已选择 {uploadFiles.length} 个文件\u003c/span\u003e
                \u003cbutton
                  onClick={clearFiles}
                  className=\"text-xs text-red-400 hover:text-red-300\"
                \u003e
                  清空全部
                \u003c/button\u003e
              \u003c/div\u003e
              {uploadFiles.map((file, idx) =\u003e (
                \u003cdiv
                  key={idx}
                  className=\"flex items-center justify-between text-sm bg-dark-700 rounded px-3 py-2\"
                \u003e
                  \u003cspan className=\"truncate text-gray-300\"\u003e{file.name}\u003c/span\u003e
                  \u003cbutton
                    onClick={() =\u003e removeFile(idx)}
                    className=\"text-red-400 hover:text-red-300 ml-2\"
                  \u003e
                    ✕
                  \u003c/button\u003e
                \u003c/div\u003e
              ))}
            \u003c/div\u003e
          )}
        \u003c/div\u003e
      \u003c/div\u003e

      {/* 手动添加凭证 */}
      <div className="card">
        <h3 className="font-medium mb-3">手动添加凭证</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={newCredName}
            onChange={(e) => setNewCredName(e.target.value)}
            placeholder="凭证名称"
            className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500"
          />
          <input
            type="text"
            value={newCredKey}
            onChange={(e) => setNewCredKey(e.target.value)}
            placeholder="Gemini API Key"
            className="flex-1 px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500"
          />
          <button
            onClick={addCredential}
            disabled={!newCredName.trim() || !newCredKey.trim()}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} />
            添加
          </button>
        </div>
      </div>

      {/* 凭证表格 */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称/邮箱</th>
              <th>类型</th>
              <th>所有者</th>
              <th>状态</th>
              <th>CD</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCreds.map((c) => (
              <tr key={c.id}>
                <td className="text-gray-400">{c.id}</td>
                <td className="max-w-[200px] truncate" title={c.email || c.name}>
                  {c.email || c.name}
                </td>
                <td>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      c.credential_type === 'oauth_antigravity'
                        ? 'bg-purple-500/20 text-purple-400'
                        : c.credential_type === 'oauth'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {c.credential_type === 'oauth_antigravity'
                      ? 'Antigravity'
                      : c.credential_type === 'oauth'
                      ? 'OAuth'
                      : 'API Key'}
                  </span>
                </td>
                <td className="text-gray-400 text-sm">{c.owner_name || '-'}</td>
                <td>
                  <div className="flex items-center gap-1">
                    {c.is_active ? (
                      <span className="text-green-400 text-xs">有效</span>
                    ) : (
                      <span className="text-red-400 text-xs">无效</span>
                    )}
                    {c.model_tier === '3' && (
                      <span className="text-purple-400 text-xs">3.0</span>
                    )}
                  </div>
                </td>
                <td className="text-xs">
                  {(c.cd_flash > 0 || c.cd_pro > 0 || c.cd_30 > 0) ? (
                    <div className="flex flex-col gap-0.5">
                      {c.cd_flash > 0 && <span className="text-cyan-400">F:{c.cd_flash}s</span>}
                      {c.cd_pro > 0 && <span className="text-orange-400">P:{c.cd_pro}s</span>}
                      {c.cd_30 > 0 && <span className="text-pink-400">3:{c.cd_30}s</span>}
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => viewCredentialDetail(c.id)}
                      className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-blue-400"
                      title="查看详情"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => toggleCredActive(c.id, c.is_active)}
                      className={`p-1.5 rounded hover:bg-dark-700 ${
                        c.is_active ? 'text-red-400' : 'text-green-400'
                      }`}
                      title={c.is_active ? '禁用' : '启用'}
                    >
                      {c.is_active ? <X size={16} /> : <Check size={16} />}
                    </button>
                    <button
                      onClick={() => deleteCredential(c.id)}
                      className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* 模态框 */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />

      <AlertModal
        isOpen={alertModal.open}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* 凭证详情弹窗 */}
      {credDetailModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-dark-600">
              <h3 className="text-lg font-semibold">凭证详情</h3>
              <button
                onClick={() => setCredDetailModal({ open: false, data: null, loading: false })}
                className="p-2 hover:bg-dark-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {credDetailModal.loading ? (
                <div className="text-center py-8 text-gray-400">加载中...</div>
              ) : credDetailModal.data ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap break-all">
                  {JSON.stringify(credDetailModal.data, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 重复凭证弹窗 */}
      {duplicateModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-dark-600">
              <h3 className="text-lg font-semibold">重复凭证检测</h3>
              <button
                onClick={() => setDuplicateModal({ open: false, data: null, loading: false })}
                className="p-2 hover:bg-dark-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {duplicateModal.loading ? (
                <div className="text-center py-8 text-gray-400">检测中...</div>
              ) : duplicateModal.data ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">
                      {duplicateModal.data.duplicate_count}
                    </div>
                    <div className="text-gray-400">个重复凭证</div>
                  </div>
                  {duplicateModal.data.duplicate_count > 0 && (
                    <button
                      onClick={deleteDuplicates}
                      className="w-full btn bg-red-600 hover:bg-red-500 text-white"
                    >
                      删除所有重复凭证
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
