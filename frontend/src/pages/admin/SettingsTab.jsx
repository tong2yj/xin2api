import { useState } from 'react';
import api from '../../api/index';
import { ConfirmModal } from '../../components/modals/Modal';
import { useToast } from '../../contexts/ToastContext';

export default function SettingsTab() {
  const toast = useToast();
  const [defaultQuota, setDefaultQuota] = useState(100);
  const [batchQuota, setBatchQuota] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  const updateDefaultQuota = async () => {
    try {
      await api.post('/api/admin/settings/default-quota', { quota: defaultQuota });
      toast.success('默认配额已更新');
    } catch (err) {
      toast.error('配额更新失败');
    }
  };

  const applyQuotaToAll = () => {
    if (!batchQuota) return;
    setConfirmModal({
      open: true,
      title: '批量设置配额',
      message: `确定将所有用户配额设为 ${batchQuota} 次/天？`,
      onConfirm: async () => {
        try {
          await api.post('/api/admin/settings/batch-quota', { quota: parseInt(batchQuota) });
          toast.success('批量更新成功');
        } catch (err) {
          toast.error('批量更新失败');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 默认配额设置 */}
      <div className="card">
        <h3 className="font-semibold mb-4">默认配额设置</h3>
        <p className="text-gray-400 text-sm mb-4">新注册用户的默认每日调用配额</p>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={defaultQuota}
            onChange={(e) => setDefaultQuota(parseInt(e.target.value) || 0)}
            className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white w-32"
          />
          <span className="text-gray-400">次/天</span>
          <button onClick={updateDefaultQuota} className="btn btn-primary">
            保存
          </button>
        </div>
      </div>

      {/* 批量设置配额 */}
      <div className="card">
        <h3 className="font-semibold mb-4">批量设置配额</h3>
        <p className="text-gray-400 text-sm mb-4">将所有用户的配额统一设置为指定值</p>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={batchQuota}
            onChange={(e) => setBatchQuota(e.target.value)}
            placeholder="输入配额值"
            className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white w-32 placeholder-gray-500"
          />
          <span className="text-gray-400">次/天</span>
          <button
            onClick={applyQuotaToAll}
            disabled={!batchQuota}
            className="btn bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
          >
            应用到所有用户
          </button>
        </div>
        <p className="text-amber-400/70 text-xs mt-3">⚠️ 此操作将覆盖所有用户的现有配额设置</p>
      </div>

      {/* 系统配置说明 */}
      <div className="card">
        <h3 className="font-semibold mb-4">配额说明</h3>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              <strong className="text-cyan-400">Flash 配额</strong>: 用于 gemini-2.5-flash 模型
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-orange-400">•</span>
            <span>
              <strong className="text-orange-400">2.5 Pro 配额</strong>: 用于 gemini-2.5-pro 模型
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-pink-400">•</span>
            <span>
              <strong className="text-pink-400">3.0 配额</strong>: 用于 gemini-3.0 系列模型
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>配额设为 0 表示使用系统默认值</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>配额每日 UTC 0:00 重置</span>
          </div>
        </div>
      </div>

      {/* 确认弹窗 */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}
