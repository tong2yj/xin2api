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
  const [batchSaving, setBatchSaving] = useState(false);  // 批量设置配额的独立 loading 状态
  const [message, setMessage] = useState(null);

  // 批量设置配额状态
  const [batchQuota, setBatchQuota] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: () => {} });

  // 模型过滤配置状态
  const [modelFilterConfig, setModelFilterConfig] = useState({
    mode: 'disabled',
    model_tier_limit: '2.5,3',
    enable_claude_models: true,
    enable_thinking_models: true,
    enable_search_models: true,
    enabled_models: []
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [modelFilterLoading, setModelFilterLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
    fetchModelFilterConfig();
    fetchAvailableModels();
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

  const fetchModelFilterConfig = async () => {
    try {
      const res = await api.get('/api/admin/model-filter-config');
      setModelFilterConfig(res.data);
    } catch (err) {
      console.error(err);
      toast.error('加载模型过滤配置失败');
    } finally {
      setModelFilterLoading(false);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const res = await api.get('/api/admin/available-models');
      setAvailableModels(res.data.models || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('allow_registration', config.allow_registration ?? true);
      formData.append('require_approval', config.require_approval ?? false);
      formData.append('default_daily_quota', config.default_daily_quota ?? 100);
      formData.append('credential_reward_quota', config.credential_reward_quota ?? 1500);
      formData.append('announcement_enabled', config.announcement_enabled ?? false);
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
        setBatchSaving(true);  // 使用独立的 loading 状态
        try {
          await api.post('/api/admin/settings/batch-quota', { quota: parseInt(batchQuota) });
          toast.success('批量更新成功');
          setBatchQuota('');
        } catch (err) {
          toast.error('批量更新失败: ' + (err.response?.data?.detail || err.message));
        } finally {
          setBatchSaving(false);
        }
      },
    });
  };

  const handleSaveModelFilter = async () => {
    try {
      await api.post('/api/admin/model-filter-config', modelFilterConfig);
      toast.success('模型过滤配置已更新');
    } catch (err) {
      toast.error('保存失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const toggleModelInWhitelist = (modelId) => {
    setModelFilterConfig(prev => ({
      ...prev,
      enabled_models: prev.enabled_models.includes(modelId)
        ? prev.enabled_models.filter(m => m !== modelId)
        : [...prev.enabled_models, modelId]
    }));
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

          {/* 用户审核 */}
          <SettingToggle
            label="新用户需要审核"
            desc="开启后新注册用户需要管理员审核通过才能使用服务"
            checked={config?.require_approval || false}
            onChange={(v) => setConfig({ ...config, require_approval: v })}
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
                disabled={!batchQuota || batchSaving}
                loading={batchSaving}
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

      {/* 模型访问控制 */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-dark-50 mb-2">🎯 模型访问控制</h2>
            <p className="text-dark-400 text-sm">配置所有用户可见和可使用的模型列表</p>
          </div>

          {modelFilterLoading ? (
            <div className="text-center py-8 text-dark-400">加载中...</div>
          ) : (
            <>
              {/* 过滤模式选择 */}
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-3">过滤模式</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-dark-700 hover:border-dark-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="filter-mode"
                      value="disabled"
                      checked={modelFilterConfig.mode === 'disabled'}
                      onChange={(e) => setModelFilterConfig({ ...modelFilterConfig, mode: e.target.value })}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium text-dark-100">不过滤 (默认)</div>
                      <div className="text-xs text-dark-400">显示所有可用模型</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-dark-700 hover:border-dark-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="filter-mode"
                      value="rules"
                      checked={modelFilterConfig.mode === 'rules'}
                      onChange={(e) => setModelFilterConfig({ ...modelFilterConfig, mode: e.target.value })}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium text-dark-100">规则过滤</div>
                      <div className="text-xs text-dark-400">根据模型类型和功能过滤</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-dark-700 hover:border-dark-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="filter-mode"
                      value="whitelist"
                      checked={modelFilterConfig.mode === 'whitelist'}
                      onChange={(e) => setModelFilterConfig({ ...modelFilterConfig, mode: e.target.value })}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium text-dark-100">白名单模式</div>
                      <div className="text-xs text-dark-400">精确指定可用模型列表</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 规则过滤配置 */}
              {modelFilterConfig.mode === 'rules' && (
                <div className="bg-dark-800/30 rounded-xl p-5 border border-white/5 space-y-4 animate-fade-in">
                  <h3 className="font-semibold text-dark-50 mb-3">过滤规则</h3>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">允许的模型层级</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modelFilterConfig.model_tier_limit.includes('2.5')}
                          onChange={(e) => {
                            const tiers = modelFilterConfig.model_tier_limit.split(',');
                            const newTiers = e.target.checked
                              ? [...new Set([...tiers, '2.5'])]
                              : tiers.filter(t => t !== '2.5');
                            setModelFilterConfig({ ...modelFilterConfig, model_tier_limit: newTiers.join(',') });
                          }}
                          className="rounded text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-dark-300">Gemini 2.5</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modelFilterConfig.model_tier_limit.includes('3')}
                          onChange={(e) => {
                            const tiers = modelFilterConfig.model_tier_limit.split(',');
                            const newTiers = e.target.checked
                              ? [...new Set([...tiers, '3'])]
                              : tiers.filter(t => t !== '3');
                            setModelFilterConfig({ ...modelFilterConfig, model_tier_limit: newTiers.join(',') });
                          }}
                          className="rounded text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-dark-300">Gemini 3.0</span>
                      </label>
                    </div>
                  </div>

                  <SettingToggle
                    label="启用 Claude 模型"
                    desc="允许用户访问 Claude 系列模型"
                    checked={modelFilterConfig.enable_claude_models}
                    onChange={(v) => setModelFilterConfig({ ...modelFilterConfig, enable_claude_models: v })}
                  />

                  <SettingToggle
                    label="启用 Thinking 后缀模型"
                    desc="允许使用带 -thinking、-maxthinking、-nothinking 后缀的模型"
                    checked={modelFilterConfig.enable_thinking_models}
                    onChange={(v) => setModelFilterConfig({ ...modelFilterConfig, enable_thinking_models: v })}
                  />

                  <SettingToggle
                    label="启用 Search 后缀模型"
                    desc="允许使用带 -search 后缀的搜索增强模型"
                    checked={modelFilterConfig.enable_search_models}
                    onChange={(v) => setModelFilterConfig({ ...modelFilterConfig, enable_search_models: v })}
                  />
                </div>
              )}

              {/* 白名单模式配置 */}
              {modelFilterConfig.mode === 'whitelist' && (
                <div className="bg-dark-800/30 rounded-xl p-5 border border-white/5 animate-fade-in">
                  <h3 className="font-semibold text-dark-50 mb-3">选择可用模型</h3>
                  <p className="text-dark-400 text-sm mb-4">已选择 {modelFilterConfig.enabled_models.length} 个模型</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                    {availableModels.map(model => (
                      <label
                        key={model}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-700/30 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={modelFilterConfig.enabled_models.includes(model)}
                          onChange={() => toggleModelInWhitelist(model)}
                          className="rounded text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-dark-300 text-sm font-mono">{model}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 保存按钮 */}
              <Button
                onClick={handleSaveModelFilter}
                className="w-full"
                icon={Save}
              >
                保存模型过滤配置
              </Button>
            </>
          )}
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