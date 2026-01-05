import { ArrowLeft, Save, Settings as SettingsIcon, Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Settings() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await api.get('/api/manage/config')
      setConfig(res.data)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('allow_registration', config.allow_registration)
      formData.append('default_daily_quota', config.default_daily_quota ?? 100)
      formData.append('credential_reward_quota', config.credential_reward_quota ?? 1500)
      formData.append('base_rpm', config.base_rpm)
      formData.append('contributor_rpm', config.contributor_rpm)
      formData.append('error_retry_count', config.error_retry_count)
      formData.append('cd_flash', config.cd_flash ?? 0)
      formData.append('cd_pro', config.cd_pro ?? 4)
      formData.append('cd_30', config.cd_30 ?? 4)
      formData.append('force_donate', config.force_donate)
      formData.append('lock_donate', config.lock_donate)
      formData.append('announcement_enabled', config.announcement_enabled)
      formData.append('announcement_title', config.announcement_title || '')
      formData.append('announcement_content', config.announcement_content || '')
      formData.append('announcement_read_seconds', config.announcement_read_seconds || 5)
      
      await api.post('/api/manage/config', formData)
      setMessage({ type: 'success', text: '配置已保存！' })
      // 保存成功后滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败: ' + (err.response?.data?.detail || err.message) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="text-purple-400" />
            系统设置
          </h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            返回
          </button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-6 space-y-6">
          {/* 用户注册 */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">允许用户注册</h3>
              <p className="text-gray-400 text-sm">关闭后新用户无法注册账号</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.allow_registration || false}
                onChange={(e) => setConfig({ ...config, allow_registration: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* 默认每日配额 */}
          <div>
            <h3 className="font-semibold mb-2">默认每日配额 🎯</h3>
            <p className="text-gray-400 text-sm mb-3">新注册用户的默认每日请求次数配额</p>
            <input
              type="number"
              value={config?.default_daily_quota ?? ''}
              onChange={(e) => setConfig({ ...config, default_daily_quota: e.target.value === '' ? '' : parseInt(e.target.value) })}
              className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-gray-500 text-sm mt-2">
              💡 建议设置为 100-500 次/天
            </p>
          </div>

          {/* 凭证奖励配额 */}
          <div>
            <h3 className="font-semibold mb-2">凭证上传奖励配额 🎁</h3>
            <p className="text-gray-400 text-sm mb-3">用户每上传一个有效凭证获得的额外配额</p>
            <input
              type="number"
              value={config?.credential_reward_quota ?? ''}
              onChange={(e) => setConfig({ ...config, credential_reward_quota: e.target.value === '' ? '' : parseInt(e.target.value) })}
              className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-green-400 text-sm mt-2">
              💡 例如设置为 1500，上传1个凭证后总配额 = 默认配额 + 1500
            </p>
          </div>

          {/* 强制公开 */}
          <div className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3">
            <div>
              <h3 className="font-semibold">强制公开 🤝</h3>
              <p className="text-gray-400 text-sm">上传凭证时强制设为公开，不给选择</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.force_donate ?? false}
                onChange={(e) => setConfig({ ...config, force_donate: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {/* 锁定公开 */}
          <div className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3">
            <div>
              <h3 className="font-semibold">锁定公开 🔒</h3>
              <p className="text-gray-400 text-sm">有效凭证不允许取消公开（失效的可以取消）</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.lock_donate ?? false}
                onChange={(e) => setConfig({ ...config, lock_donate: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {/* 速率限制 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">基础速率限制 ⏱️</h3>
              <p className="text-gray-400 text-sm mb-3">未上传凭证用户的每分钟请求数</p>
              <input
                type="number"
                value={config?.base_rpm ?? ''}
                onChange={(e) => setConfig({ ...config, base_rpm: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-gray-500 text-sm mt-1">次/分钟</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">上传者速率限制 🚀</h3>
              <p className="text-gray-400 text-sm mb-3">上传凭证用户的每分钟请求数</p>
              <input
                type="number"
                value={config?.contributor_rpm ?? ''}
                onChange={(e) => setConfig({ ...config, contributor_rpm: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-gray-500 text-sm mt-1">次/分钟</p>
            </div>
          </div>

          {/* 错误重试 */}
          <div>
            <h3 className="font-semibold mb-2">报错切换凭证重试次数 🔄</h3>
            <p className="text-gray-400 text-sm mb-3">遇到 API 错误（如 404、500 等）时自动切换凭证重试的次数</p>
            <input
              type="number"
              min="0"
              max="10"
              value={config?.error_retry_count ?? ''}
              onChange={(e) => setConfig({ ...config, error_retry_count: e.target.value === '' ? '' : parseInt(e.target.value) })}
              className="w-32 bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-gray-500 text-sm mt-1">设为 0 则不重试，直接返回错误</p>
            <p className="text-blue-400 text-sm mt-2">
              💡 当凭证请求失败时，系统会自动尝试切换到其他可用凭证重试
            </p>
          </div>

          {/* CD 机制 */}
          <div>
            <h3 className="font-semibold mb-2">凭证冷却时间 (CD) ⏱️</h3>
            <p className="text-gray-400 text-sm mb-3">按模型组设置凭证冷却时间，避免同一凭证被频繁调用（0=无CD）</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Flash CD (秒)</label>
                <input
                  type="number"
                  min="0"
                  value={config?.cd_flash ?? 0}
                  onChange={(e) => setConfig({ ...config, cd_flash: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Pro CD (秒)</label>
                <input
                  type="number"
                  min="0"
                  value={config?.cd_pro ?? 4}
                  onChange={(e) => setConfig({ ...config, cd_pro: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">3.0 CD (秒)</label>
                <input
                  type="number"
                  min="0"
                  value={config?.cd_30 ?? 4}
                  onChange={(e) => setConfig({ ...config, cd_30: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              💡 同一凭证在 CD 期间内不会被同模型组再次选中，优先选择已冷却的凭证
            </p>
          </div>

          {/* 公告配置 */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold">📢 公告功能</h3>
                <p className="text-gray-400 text-sm">向所有用户显示重要通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.announcement_enabled || false}
                  onChange={(e) => setConfig({ ...config, announcement_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {config?.announcement_enabled && (
              <div className="space-y-4 bg-gray-700/30 rounded-lg p-4">
                <div>
                  <label className="block text-sm font-medium mb-2">公告标题</label>
                  <input
                    type="text"
                    value={config?.announcement_title || ''}
                    onChange={(e) => setConfig({ ...config, announcement_title: e.target.value })}
                    placeholder="例如：【重要通知】系统维护公告"
                    className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">公告内容</label>
                  <textarea
                    value={config?.announcement_content || ''}
                    onChange={(e) => setConfig({ ...config, announcement_content: e.target.value })}
                    placeholder="在这里输入公告内容，支持多行文本..."
                    rows={6}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">阅读等待时间（秒）</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={config?.announcement_read_seconds || 5}
                    onChange={(e) => setConfig({ ...config, announcement_read_seconds: parseInt(e.target.value) || 5 })}
                    className="w-32 bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">用户首次阅读需等待此时间才能关闭公告</p>
                </div>
              </div>
            )}
          </div>

          {/* 保存按钮 */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>

        {/* OpenAI 端点管理入口 */}
        <div className="mt-6 bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-blue-400 font-semibold mb-1 flex items-center gap-2">
                <Globe size={18} />
                OpenAI 端点管理
              </h4>
              <p className="text-blue-200/80 text-sm">
                配置 OpenAI 兼容的 API 端点（DeepSeek、通义千问等）用于反代给用户
              </p>
            </div>
            <button
              onClick={() => navigate('/openai-endpoints')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-sm"
            >
              管理端点
            </button>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-green-900/20 border border-green-600/30 rounded-lg p-4">
          <h4 className="text-green-400 font-semibold mb-2">💾 自动保存</h4>
          <p className="text-green-200/80 text-sm">
            配置会自动保存到数据库，重启服务后依然生效。
          </p>
        </div>
      </div>
    </div>
  )
}
