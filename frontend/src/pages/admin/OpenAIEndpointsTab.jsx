import { Plus, Save, Trash2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api'

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

  useEffect(() => {
    fetchEndpoints()
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
        </ul>
      </div>
    </div>
  )
}
