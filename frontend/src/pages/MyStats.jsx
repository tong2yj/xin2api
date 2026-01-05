import { ArrowLeft, BarChart2, Cat, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function MyStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyStats()
  }, [])

  const fetchMyStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/api/auth/my-stats')
      setStats(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || '获取统计失败')
    } finally {
      setLoading(false)
    }
  }

  // 状态码颜色
  const getStatusCodeColor = (code) => {
    if (code >= 500) return 'text-red-400 bg-red-500/20'
    if (code === 429) return 'text-orange-400 bg-orange-500/20'
    if (code >= 400) return 'text-yellow-400 bg-yellow-500/20'
    return 'text-green-400 bg-green-500/20'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white flex items-center gap-2">
          <RefreshCw className="animate-spin" />
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 导航栏 */}
      <nav className="bg-dark-900 border-b border-dark-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cat className="w-8 h-8 text-purple-400" />
            <span className="text-xl font-bold">Catiecli</span>
            <span className="text-sm text-gray-500 bg-dark-700 px-2 py-0.5 rounded">个人统计</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchMyStats}
              className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm flex items-center gap-2"
            >
              <RefreshCw size={16} />
              刷新
            </button>
            <Link to="/dashboard" className="text-gray-400 hover:text-white flex items-center gap-2">
              <ArrowLeft size={20} />
              返回
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* 配额概览 */}
            <div className="bg-gray-800 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <BarChart2 className="text-blue-400" />
                今日配额使用情况
              </h2>

              {/* 总配额显示 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-xl">
                  <h3 className="text-sm text-blue-200 mb-2">总配额</h3>
                  <p className="text-4xl font-bold">{stats.total_quota.toLocaleString()}</p>
                  <p className="text-sm text-blue-200 mt-2">
                    凭证: {stats.credentials_count} 个
                    {stats.cred_30_count > 0 && ` (含 ${stats.cred_30_count} 个 3.0)`}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-xl">
                  <h3 className="text-sm text-green-200 mb-2">今日已使用</h3>
                  <p className="text-4xl font-bold">{stats.today_usage.toLocaleString()}</p>
                  <p className="text-sm text-green-200 mt-2">
                    剩余: {(stats.total_quota - stats.today_usage).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* 进度条 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">使用进度</span>
                  <span className="text-white font-medium">
                    {stats.total_quota > 0
                      ? ((stats.today_usage / stats.total_quota) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (stats.today_usage / stats.total_quota) > 0.8
                        ? 'bg-red-500'
                        : (stats.today_usage / stats.total_quota) > 0.5
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (stats.today_usage / stats.total_quota) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {/* 配额明细 */}
              <div className="bg-gray-700/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-3">配额明细</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="bg-cyan-600/20 border border-cyan-600/30 rounded-lg p-3 text-center">
                    <div className="text-cyan-400 font-bold text-lg">{stats.quota_breakdown.flash.toLocaleString()}</div>
                    <div className="text-cyan-300 text-xs mt-1">Flash</div>
                  </div>
                  <div className="bg-orange-600/20 border border-orange-600/30 rounded-lg p-3 text-center">
                    <div className="text-orange-400 font-bold text-lg">{stats.quota_breakdown.pro_25.toLocaleString()}</div>
                    <div className="text-orange-300 text-xs mt-1">2.5 Pro</div>
                  </div>
                  <div className="bg-pink-600/20 border border-pink-600/30 rounded-lg p-3 text-center">
                    <div className="text-pink-400 font-bold text-lg">{stats.quota_breakdown.tier_3.toLocaleString()}</div>
                    <div className="text-pink-300 text-xs mt-1">3.0</div>
                  </div>
                  <div className="bg-purple-600/20 border border-purple-600/30 rounded-lg p-3 text-center">
                    <div className="text-purple-400 font-bold text-lg">{stats.quota_breakdown.daily.toLocaleString()}</div>
                    <div className="text-purple-300 text-xs mt-1">每日额度</div>
                  </div>
                  <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-3 text-center">
                    <div className="text-yellow-400 font-bold text-lg">{stats.quota_breakdown.bonus.toLocaleString()}</div>
                    <div className="text-yellow-300 text-xs mt-1">奖励额度</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 今日调用日志 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">
                今日调用日志 ({stats.today_logs.length} 条)
              </h2>

              {stats.today_logs.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  今日暂无调用记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="pb-3 pr-4">时间</th>
                        <th className="pb-3 pr-4">模型</th>
                        <th className="pb-3 pr-4">接口</th>
                        <th className="pb-3 pr-4">状态</th>
                        <th className="pb-3 pr-4">耗时</th>
                        <th className="pb-3 pr-4">Token</th>
                        <th className="pb-3">凭证</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.today_logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-3 pr-4 text-gray-400">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-3 pr-4 text-cyan-400 font-mono text-xs">
                            {log.model || '-'}
                          </td>
                          <td className="py-3 pr-4 text-gray-300 text-xs max-w-xs truncate">
                            {log.endpoint || '-'}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusCodeColor(log.status_code)}`}>
                              {log.status_code}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400">
                            {log.latency_ms ? `${log.latency_ms.toFixed(0)}ms` : '-'}
                          </td>
                          <td className="py-3 pr-4 text-gray-400">
                            {log.tokens_input || log.tokens_output
                              ? `${log.tokens_input || 0}/${log.tokens_output || 0}`
                              : '-'}
                          </td>
                          <td className="py-3 text-purple-400 text-xs truncate max-w-xs">
                            {log.credential_email || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
