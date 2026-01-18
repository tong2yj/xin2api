import { Plus, Save, Trash2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api'
import adminApi from '../../api/admin'

export default function OpenAIEndpointsTab() {
  const [endpoints, setEndpoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    api_key: '',
    base_url: '',
    is_active: true,
    priority: 0
  })
  const [gcliStats, setGcliStats] = useState(null)
  const [antigravityStats, setAntigravityStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [bridgeEnabled, setBridgeEnabled] = useState(true)
  const [bridgeToggling, setBridgeToggling] = useState(false)

  useEffect(() => {
    fetchEndpoints()
    fetchGcliStats()
    fetchAntigravityStats()
    fetchBridgeConfig()
  }, [])

  const fetchEndpoints = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/manage/openai-endpoints')
      setEndpoints(res.data)
    } catch (err) {
      setMessage({ type: 'error', text: '获取端点列表失败' })
    } finally {
      setLoading(false)
    }
  }

  const fetchGcliStats = async () => {
    try {
      const res = await adminApi.endpoints.gcli.getStats()
      setGcliStats(res.data)
    } catch (err) {
      console.error('获取 GeminiCLI 统计失败', err)
      setGcliStats({ enabled: false })
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchAntigravityStats = async () => {
    try {
      const res = await adminApi.endpoints.antigravity.getStats()
      setAntigravityStats(res.data)
    } catch (err) {
      console.error('获取 Antigravity 统计失败', err)
      setAntigravityStats({ enabled: false })
    }
  }

  const fetchBridgeConfig = async () => {
    try {
      const res = await adminApi.config.get()
      setBridgeEnabled(res.data.enable_gcli2api_bridge)
    } catch (err) {
      console.error('获取桥接配置失败', err)
    }
  }

  const toggleBridge = async () => {
    setBridgeToggling(true)
    try {
      const formData = new FormData()
      formData.append('enable_gcli2api_bridge', !bridgeEnabled)

      await adminApi.config.update(formData)
      setBridgeEnabled(!bridgeEnabled)
      setMessage({ type: 'success', text: `桥接反代已${!bridgeEnabled ? '启用' : '禁用'}` })

      // 刷新统计数据
      fetchGcliStats()
      fetchAntigravityStats()
    } catch (err) {
      setMessage({ type: 'error', text: '切换失败: ' + (err.response?.data?.detail || err.message) })
    } finally {
      setBridgeToggling(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)

    try {
      const data = new FormData()
      data.append('name', formData.name)
      data.append('api_key', formData.api_key)
      data.append('base_url', formData.base_url)
      data.append('is_active', formData.is_active)
      data.append('priority', formData.priority)

      if (editingId) {
        await api.put(`/api/manage/openai-endpoints/${editingId}`, data)
        setMessage({ type: 'success', text: '端点更新成功！' })
      } else {
        await api.post('/api/manage/openai-endpoints', data)
        setMessage({ type: 'success', text: '端点添加成功！' })
      }

      setShowAddForm(false)
      setEditingId(null)
      setFormData({ name: '', api_key: '', base_url: '', is_active: true, priority: 0 })
      fetchEndpoints()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '操作失败' })
    }
  }

  const handleEdit = (endpoint) => {
    setFormData({
      name: endpoint.name,
      api_key: endpoint.api_key,
      base_url: endpoint.base_url,
      is_active: endpoint.is_active,
      priority: endpoint.priority
    })
    setEditingId(endpoint.id)
    setShowAddForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个端点吗？')) return

    try {
      await api.delete(`/api/manage/openai-endpoints/${id}`)
      setMessage({ type: 'success', text: '端点删除成功！' })
      fetchEndpoints()
    } catch (err) {
      setMessage({ type: 'error', text: '删除失败' })
    }
  }

  const cancelEdit = () => {
    setShowAddForm(false)
    setEditingId(null)
    setFormData({ name: '', api_key: '', base_url: '', is_active: true, priority: 0 })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-dark-400">
        <RefreshCw className="animate-spin mr-2" /> 加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 桥接反代控制区域 */}
      {!statsLoading && (gcliStats?.enabled || antigravityStats?.enabled || !bridgeEnabled) && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${bridgeEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <div>
                <h3 className="text-lg font-semibold text-white">桥接反代服务</h3>
                <p className="text-dark-400 text-sm">控制 GeminiCLI 和 Antigravity 端点的启用状态</p>
              </div>
            </div>
            <button
              onClick={toggleBridge}
              disabled={bridgeToggling}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                bridgeEnabled
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              } ${bridgeToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {bridgeToggling ? '切换中...' : bridgeEnabled ? '已启用' : '已禁用'}
            </button>
          </div>
        </div>
      )}

      {/* 桥接端点统计卡片 */}
      {!statsLoading && bridgeEnabled && (gcliStats?.enabled || antigravityStats?.enabled) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* GeminiCLI 卡片 */}
          {gcliStats?.enabled && (
            <EndpointStatCard
              name="GeminiCLI"
              stats={gcliStats}
              icon="🔮"
              color="blue"
            />
          )}

          {/* Antigravity 卡片 */}
          {antigravityStats?.enabled && (
            <EndpointStatCard
              name="Antigravity"
              stats={antigravityStats}
              icon="🚀"
              color="purple"
            />
          )}
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-white">
            {editingId ? '编辑端点' : '添加新端点'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-dark-200">端点名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：DeepSeek、通义千问"
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-dark-200">API Key</label>
              <input
                type="text"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-dark-200">Base URL</label>
              <input
                type="url"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder="https://api.example.com/v1"
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-dark-200">优先级</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-dark-500 text-sm mt-1">数字越大优先级越高</p>
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer text-dark-200 select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2 w-4 h-4 rounded border-dark-600 bg-dark-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span>启用此端点</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {editingId ? '保存修改' : '添加端点'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 添加按钮 */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full mb-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} />
          添加新端点
        </button>
      )}

      {/* 端点列表 */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">
          已配置端点 ({endpoints.length})
        </h2>

        {endpoints.length === 0 ? (
          <div className="text-center text-dark-500 py-12">
            暂无配置的 OpenAI 端点
          </div>
        ) : (
          <div className="space-y-4">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="bg-dark-900/50 border border-dark-700 rounded-lg p-4 flex items-start justify-between group hover:border-dark-500 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{endpoint.name}</h3>
                    {endpoint.is_active ? (
                      <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs rounded border border-green-600/30">启用</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-600/20 text-gray-400 text-xs rounded border border-gray-600/30">禁用</span>
                    )}
                    <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-600/30">
                      优先级: {endpoint.priority}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="text-dark-400">
                      <span className="text-dark-500">Base URL:</span>{' '}
                      <span className="font-mono text-dark-300">{endpoint.base_url}</span>
                    </p>
                    <p className="text-dark-400">
                      <span className="text-dark-500">API Key:</span>{' '}
                      <span className="font-mono text-dark-300">{endpoint.api_key.substring(0, 10)}...</span>
                    </p>
                    <p className="text-dark-400">
                      <span className="text-dark-500">请求统计:</span>{' '}
                      总计 <span className="text-white">{endpoint.total_requests}</span> 次，失败 <span className="text-red-400">{endpoint.failed_requests}</span> 次
                    </p>
                    {endpoint.last_used_at && (
                      <p className="text-dark-400">
                        <span className="text-dark-500">最后使用:</span>{' '}
                        {new Date(endpoint.last_used_at).toLocaleString()}
                      </p>
                    )}
                    {endpoint.last_error && (
                      <p className="text-red-400 text-xs mt-2 bg-red-900/10 p-2 rounded border border-red-900/20">
                        <span className="font-semibold">最后错误:</span> {endpoint.last_error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(endpoint)}
                    className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 rounded-lg text-sm transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(endpoint.id)}
                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/30 rounded-lg text-sm transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="mt-6 bg-blue-900/10 border border-blue-500/20 rounded-lg p-4">
        <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">💡 使用说明</h4>
        <ul className="text-blue-200/80 text-sm space-y-1 ml-1">
          <li>• 添加的 OpenAI 兼容端点将用于反代给用户使用</li>
          <li>• 优先级高的端点会优先被选择使用</li>
          <li>• 禁用的端点不会被使用</li>
          <li>• 支持任何 OpenAI 兼容格式的 API（如 DeepSeek、通义千问等）</li>
          <li>• 桥接反代开关控制 GeminiCLI 和 Antigravity 端点，不影响凭证上传功能</li>
        </ul>
      </div>
    </div>
  )
}

// 端点统计卡片组件
function EndpointStatCard({ name, stats, icon, color }) {
  if (!stats) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <div className="flex items-center justify-center text-dark-400">
          <RefreshCw className="animate-spin mr-2" size={20} /> 加载中...
        </div>
      </div>
    )
  }

  const colorClasses = {
    blue: {
      border: 'border-blue-600/30',
      bg: 'bg-blue-600/10',
      text: 'text-blue-400',
      hover: 'hover:border-blue-500/50'
    },
    purple: {
      border: 'border-purple-600/30',
      bg: 'bg-purple-600/10',
      text: 'text-purple-400',
      hover: 'hover:border-purple-500/50'
    },
    green: {
      border: 'border-green-600/30',
      bg: 'bg-green-600/10',
      text: 'text-green-400',
      hover: 'hover:border-green-500/50'
    }
  }

  const colors = colorClasses[color] || colorClasses.blue

  return (
    <div className={`bg-dark-800 border ${colors.border} ${colors.bg} rounded-xl p-6 ${colors.hover} transition-colors`}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className="text-xl font-semibold text-white">{name}</h3>
            <p className="text-dark-400 text-sm">桥接端点</p>
          </div>
        </div>
        {/* 健康状态指示器 */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-400 text-sm">运行中</span>
        </div>
      </div>

      {/* 统计数据 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 今日请求 */}
        <div className="bg-dark-900/50 rounded-lg p-3">
          <p className="text-dark-500 text-xs mb-1">今日请求</p>
          <p className="text-2xl font-bold text-white">{stats.total_requests || 0}</p>
          <p className="text-dark-400 text-xs mt-1">
            最近1小时: <span className={colors.text}>{stats.last_hour_requests || 0}</span>
          </p>
        </div>

        {/* 失败次数 */}
        <div className="bg-dark-900/50 rounded-lg p-3">
          <p className="text-dark-500 text-xs mb-1">失败次数</p>
          <p className="text-2xl font-bold text-red-400">{stats.failed_requests || 0}</p>
          <p className="text-dark-400 text-xs mt-1">
            成功率: <span className="text-green-400">{stats.success_rate || 0}%</span>
          </p>
        </div>

        {/* 可用凭证 */}
        <div className="bg-dark-900/50 rounded-lg p-3">
          <p className="text-dark-500 text-xs mb-1">可用凭证</p>
          <p className="text-2xl font-bold text-green-400">{stats.active_credentials || 0}</p>
          <p className="text-dark-400 text-xs mt-1">
            总计: <span className="text-white">{stats.total_credentials || 0}</span>
          </p>
        </div>

        {/* 禁用凭证 */}
        <div className="bg-dark-900/50 rounded-lg p-3">
          <p className="text-dark-500 text-xs mb-1">禁用凭证</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.disabled_credentials || 0}</p>
          <p className="text-dark-400 text-xs mt-1">
            需要关注
          </p>
        </div>
      </div>

      {/* 凭证预览 */}
      {stats.credentials && stats.credentials.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-700">
          <p className="text-dark-500 text-xs mb-2">最近凭证状态</p>
          <div className="space-y-1">
            {stats.credentials.slice(0, 3).map((cred, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-dark-400 truncate flex-1">
                  {cred.user_email || cred.filename}
                </span>
                <span className={`ml-2 px-2 py-0.5 rounded ${cred.disabled ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                  {cred.disabled ? '禁用' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
