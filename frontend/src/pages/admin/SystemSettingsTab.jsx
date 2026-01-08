import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../api';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ConfirmModal } from '../../components/modals/Modal';
import { useToast } from '../../contexts/ToastContext';

export default function SystemSettingsTab() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // 批量设置配额状态
  const [batchQuota, setBatchQuota] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/api/manage/config');
      setConfig(res.data);
    } catch (err) {
      console.error(err);
      toast.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('allow_registration', config.allow_registration);
      formData.append('default_daily_quota', config.default_daily_quota ?? 100);
      formData.append('credential_reward_quota', config.credential_reward_quota ?? 1500);
      formData.append('cd_flash', config.cd_flash ?? 0);
      formData.append('cd_pro', config.cd_pro ?? 4);
      formData.append('cd_30', config.cd_30 ?? 4);
      formData.append('announcement_enabled', config.announcement_enabled);
      formData.append('announcement_title', config.announcement_title || '');
      formData.append('announcement_content', config.announcement_content || '');
      formData.append('announcement_read_seconds', config.announcement_read_seconds || 5);

      await api.post('/api/manage/config', formData);
      setMessage({ type: 'success', text: '配置已保存！' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setSaving(false);
    }
  };

  const applyQuotaToAll = () => {
    if (!batchQuota) return;
    setConfirmModal({
      open: true,
      title: '批量设置配额',
      message: `确定将所有用户配额设为 ${batchQuota} 次/天？此操作将覆盖所有用户的现有配额设置。`,
      onConfirm: async () => {
        setSaving(true); 
        try {
          await api.post('/api/admin/settings/batch-quota', { quota: parseInt(batchQuota) });
          toast.success('批量更新成功');
          setBatchQuota('');
        } catch (err) {
          toast.error('批量更新失败: ' + (err.response?.data?.detail || err.message));
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center text-dark-400 py-12">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {message.text}
        </div>
      )}

      <Card>
        <div className="space-y-8">
          {/* 用户注册 */}
          <SettingToggle
            label="允许用户注册"
            desc="关闭后新用户无法注册账号"
            checked={config?.allow_registration || false}
            onChange={(v) => setConfig({ ...config, allow_registration: v })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 默认每日配额 */}
            <SettingInput
              label="默认每日配额 🎯"
              desc="新注册用户的默认每日请求次数配额"
              value={config?.default_daily_quota ?? ''}
              onChange={(v) => setConfig({ ...config, default_daily_quota: v === '' ? '' : parseInt(v) })}
              type="number"
              hint="建议设置为 100-500 次/天"
            />

            {/* 凭证奖励配额 */}
            <SettingInput
              label="凭证上传奖励配额 🎁"
              desc="用户每上传一个有效凭证获得的额外配额"
              value={config?.credential_reward_quota ?? ''}
              onChange={(v) => setConfig({ ...config, credential_reward_quota: v === '' ? '' : parseInt(v) })}
              type="number"
              hint="例如 1500，上传1个凭证后总配额 = 默认 + 1500"
              hintColor="text-emerald-400"
            />
          </div>

          {/* 批量设置配额 */}
          <div className="bg-dark-800/30 rounded-xl p-5 border border-white/5">
            <h3 className="font-semibold text-dark-50 mb-2">批量设置配额 ⚡</h3>
            <p className="text-dark-400 text-sm mb-4">将所有用户的配额统一设置为指定值（谨慎操作）</p>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={batchQuota}
                onChange={(e) => setBatchQuota(e.target.value)}
                placeholder="输入配额值"
                className="w-32 bg-dark-950 border border-dark-700 rounded-lg px-4 py-2 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-dark-400 text-sm">次/天</span>
              <Button
                onClick={applyQuotaToAll}
                disabled={!batchQuota}
                loading={saving}
                variant="secondary"
                size="sm"
              >
                应用到所有用户
              </Button>
            </div>
            <p className="text-amber-400/70 text-xs mt-2 flex items-center gap-1">
              <span className="text-amber-500">⚠️</span> 此操作将覆盖所有用户的现有配额设置
            </p>
          </div>

          {/* CD 机制 */}
          <div className="bg-dark-800/30 rounded-xl p-5 border border-white/5">
            <h3 className="font-semibold text-dark-50 mb-2">凭证冷却时间 (CD) ⏱️</h3>
            <p className="text-dark-400 text-sm mb-4">按模型组设置凭证冷却时间（0=无CD）</p>
            <div className="grid grid-cols-3 gap-4">
              <CDInput label="Flash CD" value={config?.cd_flash} onChange={v => setConfig({...config, cd_flash: v})} color="cyan" />
              <CDInput label="Pro CD" value={config?.cd_pro} onChange={v => setConfig({...config, cd_pro: v})} color="orange" />
              <CDInput label="3.0 CD" value={config?.cd_30} onChange={v => setConfig({...config, cd_30: v})} color="pink" />
            </div>
            <p className="text-amber-400/70 text-xs mt-3 flex items-center gap-1">
              <span className="text-amber-500">ℹ️</span> 注意：凭证由 gcli2api 管理，CD 机制已不再使用，保留仅为兼容性
            </p>
          </div>

          {/* 公告功能 */}
          <div className="pt-6 border-t border-white/5">
            <SettingToggle
              label="📢 启用系统公告"
              desc="向所有用户显示重要通知"
              checked={config?.announcement_enabled || false}
              onChange={(v) => setConfig({ ...config, announcement_enabled: v })}
            />

            {config?.announcement_enabled && (
              <div className="mt-4 space-y-4 bg-dark-800/30 rounded-xl p-5 border border-white/5 animate-fade-in">
                <SettingInput
                  label="公告标题"
                  value={config?.announcement_title || ''}
                  onChange={(v) => setConfig({ ...config, announcement_title: v })}
                  placeholder="例如：【重要通知】系统维护公告"
                />
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">公告内容</label>
                  <textarea
                    value={config?.announcement_content || ''}
                    onChange={(e) => setConfig({ ...config, announcement_content: e.target.value })}
                    placeholder="在这里输入公告内容..."
                    rows={4}
                    className="w-full bg-dark-950 border border-dark-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <SettingInput
                  label="阅读等待时间 (秒)"
                  value={config?.announcement_read_seconds || 5}
                  onChange={(v) => setConfig({ ...config, announcement_read_seconds: parseInt(v) || 5 })}
                  type="number"
                  hint="用户首次阅读需等待此时间才能关闭"
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 保存按钮 */}
      <div className="sticky bottom-6 z-20">
        <Button
          onClick={handleSave}
          loading={saving}
          className="w-full py-3 shadow-xl shadow-black/20"
          icon={Save}
        >
          保存配置
        </Button>
      </div>

      {/* 确认弹窗 */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={true}
      />
    </div>
  );
}

// 辅助组件
function SettingToggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h3 className="font-semibold text-dark-50">{label}</h3>
        <p className="text-dark-400 text-sm">{desc}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}

function SettingInput({ label, desc, value, onChange, type = "text", hint, hintColor = "text-dark-500", suffix, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-200 mb-1">{label}</label>
      {desc && <p className="text-dark-400 text-xs mb-2">{desc}</p>}
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-dark-950 border border-dark-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {suffix && <span className="text-dark-400 text-sm whitespace-nowrap">{suffix}</span>}
      </div>
      {hint && <p className={`text-xs mt-1.5 ${hintColor}`}>{hint}</p>}
    </div>
  );
}

function CDInput({ label, value, onChange, color }) {
  const colors = {
    cyan: 'focus:ring-cyan-500',
    orange: 'focus:ring-orange-500',
    pink: 'focus:ring-pink-500',
  };
  
  return (
    <div>
      <label className="text-xs text-dark-400 mb-1 block">{label} (秒)</label>
      <input
        type="number"
        min="0"
        value={value ?? 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
        className={`w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 ${colors[color] || 'focus:ring-primary-500'}`}
      />
    </div>
  );
}