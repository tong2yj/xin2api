import {
  Check,
  Download,
  ExternalLink,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
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

  const showAlert = (title, message, type = 'info') => setAlertModal({ open: true, title, message, type });
  const showConfirm = (title, message, onConfirm, danger = false) => setConfirmModal({ open: true, title, message, onConfirm, danger });

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/credentials');
      setCredentials(Array.isArray(res.data?.credentials) ? res.data.credentials : []);
    } catch (err) {
      toast.error('获取凭证列表失败');
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  // CD 实时倒计时
  useEffect(() => {
    if (!Array.isArray(credentials)) return;
    
    const hasCD = credentials.some((c) => (c.cd_flash || 0) > 0 || (c.cd_pro || 0) > 0 || (c.cd_30 || 0) > 0);
    if (!hasCD) return;

    const timer = setInterval(() => {
      setCredentials((prev) => {
        if (!Array.isArray(prev)) return [];
        return prev.map((c) => ({
          ...c,
          cd_flash: Math.max(0, (c.cd_flash || 0) - 1),
          cd_pro: Math.max(0, (c.cd_pro || 0) - 1),
          cd_30: Math.max(0, (c.cd_30 || 0) - 1),
        }));
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [credentials?.length]);

  const safeCredentials = Array.isArray(credentials) ? credentials : [];
  const totalPages = Math.ceil(safeCredentials.length / CREDS_PER_PAGE);
  const paginatedCreds = safeCredentials.slice(
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

  if (loading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 操作工具栏 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* 左侧：批量维护组 - Mobile Scrollable */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar w-full md:w-auto">
            <Button
              variant="info"
              size="sm"
              onClick={verifyAllCredentials}
              loading={verifyingAll}
              icon={Check}
              className="whitespace-nowrap"
            >
              一键检测
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={startAllCredentials}
              loading={startingAll}
              icon={RefreshCw}
              className="whitespace-nowrap"
            >
              一键启动
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={checkDuplicates}
              icon={Eye}
              className="whitespace-nowrap"
            >
              重复检测
            </Button>
          </div>

          {/* 右侧：数据与认证组 - Mobile Scrollable */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar w-full md:w-auto md:justify-end">
            <Link to="/oauth">
              <Button variant="primary" size="sm" icon={ExternalLink} className="whitespace-nowrap">
                OAuth 认证
              </Button>
            </Link>
            <Button
              variant="blue"
              size="sm"
              onClick={exportAllCredentials}
              icon={Download}
              className="whitespace-nowrap"
            >
              导出
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteInactiveCredentials}
              icon={Trash2}
              className="whitespace-nowrap"
            >
              清理无效
            </Button>
          </div>
        </div>

        {/* 检测结果摘要 (紧凑版) */}
        {verifyResult && (
          <div className="bg-dark-800/50 border border-dark-600/50 rounded-xl px-4 py-2 flex items-center gap-6 text-sm">
            <span className="text-gray-400 font-medium">检测完成:</span>
            <div className="flex items-center gap-4">
              <span className="text-green-400">✅ 有效 {verifyResult.valid}</span>
              <span className="text-red-400">❌ 无效 {verifyResult.invalid}</span>
              <span className="text-purple-400">⭐ Tier3 {verifyResult.tier3}</span>
              <span className="text-gray-500">总计 {verifyResult.total}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setVerifyResult(null)} className="ml-auto !p-1 h-auto">
              <X size={14} />
            </Button>
          </div>
        )}
      </div>

      {/* 手动添加凭证 (折叠式或紧凑式) */}
      <div className="bg-dark-800/30 border border-white/5 rounded-xl p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="text-sm font-medium text-dark-300 whitespace-nowrap mr-2">快速添加:</div>
          <input
            type="text"
            value={newCredName}
            onChange={(e) => setNewCredName(e.target.value)}
            placeholder="凭证名称"
            className="w-full md:w-48 px-3 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-primary-500/50 outline-none"
          />
          <input
            type="text"
            value={newCredKey}
            onChange={(e) => setNewCredKey(e.target.value)}
            placeholder="Gemini API Key"
            className="flex-1 px-3 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-primary-500/50 outline-none"
          />
          <Button
            onClick={addCredential}
            disabled={!newCredName.trim() || !newCredKey.trim()}
            variant="primary"
            size="sm"
            icon={Plus}
          >
            添加
          </Button>
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
                        : c.credential_type === 'gemini_cli'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {c.credential_type === 'oauth_antigravity'
                      ? 'Antigravity'
                      : c.credential_type === 'gemini_cli'
                      ? 'GeminiCli'
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => viewCredentialDetail(c.id)}
                      className="!text-dark-400 hover:!text-primary-400"
                      title="查看详情"
                      icon={Eye}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleCredActive(c.id, c.is_active)}
                      className={c.is_active ? '!text-red-400 hover:!bg-red-500/10' : '!text-green-400 hover:!bg-green-500/10'}
                      title={c.is_active ? '禁用' : '启用'}
                      icon={c.is_active ? X : Check}
                    />
                    <Button
                      variant="ghost-danger"
                      size="icon-sm"
                      onClick={() => deleteCredential(c.id)}
                      title="删除"
                      icon={Trash2}
                    />
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
