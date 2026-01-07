import { BarChart2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../api';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Table } from '../../components/common/Table';

export default function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyStats();
  }, []);

  const fetchMyStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/auth/my-stats');
      setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || '获取统计失败');
    } finally {
      setLoading(false);
    }
  };

  // 状态码颜色 Badge 组件
  const StatusCodeBadge = ({ code }) => {
    let colorClass = 'bg-gray-500/20 text-gray-400';
    if (code >= 500) colorClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
    else if (code === 429) colorClass = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    else if (code >= 400) colorClass = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    else if (code >= 200) colorClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${colorClass}`}>
        {code}
      </span>
    );
  };

  // API 来源 Badge 组件
  const ApiSourceBadge = ({ source }) => {
    const config = {
      'OpenAI': 'bg-green-500/20 text-green-400',
      'GeminiCLI': 'bg-blue-500/20 text-blue-400',
      'Antigravity': 'bg-purple-500/20 text-purple-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config[source] || 'bg-gray-500/20 text-gray-400'}`}>
        {source || '-'}
      </span>
    );
  };

  const columns = [
    {
      key: 'created_at',
      label: '时间',
      render: (val) => <span className="text-dark-400 text-xs">{new Date(val).toLocaleTimeString()}</span>,
    },
    {
      key: 'model',
      label: '模型',
      render: (val) => <span className="text-primary-400 font-mono text-xs">{val || '-'}</span>,
    },
    {
      key: 'api_source',
      label: '来源',
      render: (val) => <ApiSourceBadge source={val} />,
    },
    {
      key: 'status_code',
      label: '状态',
      render: (val) => <StatusCodeBadge code={val} />,
    },
    {
      key: 'latency_ms',
      label: '耗时',
      render: (val) => <span className="text-dark-400 text-xs">{val ? `${val.toFixed(1)}s` : '-'}</span>,
    },
    {
      key: 'tokens',
      label: 'Token',
      render: (_, row) => (
        <span className="text-dark-400 text-xs font-mono">
          {row.tokens_input || 0} / {row.tokens_output || 0}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-dark-50">个人统计</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={fetchMyStats}
          loading={loading}
          icon={RefreshCw}
        >
          刷新
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="flex flex-col items-center justify-center py-24 text-dark-400">
          <RefreshCw className="animate-spin mb-3 text-primary-500" size={24} />
          <p>加载统计数据...</p>
        </div>
      ) : stats ? (
        <div className="space-y-6 animate-fade-in">
          {/* 配额概览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 总配额 */}
            <Card className="relative overflow-hidden border-0 !bg-gradient-to-br from-blue-600/20 to-blue-900/20 border-blue-500/10">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BarChart2 size={100} />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-medium text-blue-300 mb-1">总配额</h3>
                <div className="text-4xl font-bold text-white mb-4 tracking-tight">
                  {stats.total_quota.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-200/70">
                  <span className="bg-blue-500/20 px-2 py-0.5 rounded text-xs">
                    凭证: {stats.credentials_count}
                  </span>
                  {stats.cred_30_count > 0 && (
                    <span className="bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded text-xs">
                      含 {stats.cred_30_count} 个 3.0
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* 今日使用 */}
            <Card className="relative overflow-hidden border-0 !bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border-emerald-500/10">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BarChart2 size={100} />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-medium text-emerald-300 mb-1">今日已使用</h3>
                <div className="text-4xl font-bold text-white mb-4 tracking-tight">
                  {stats.today_usage.toLocaleString()}
                </div>
                <div className="text-sm text-emerald-200/70">
                  剩余可用: <span className="font-mono font-medium">{(stats.total_quota - stats.today_usage).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* 进度条 Card */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-300 text-sm font-medium">每日配额使用率</span>
              <span className={`text-sm font-bold ${
                (stats.today_usage / stats.total_quota) > 0.8 ? 'text-red-400' : 'text-primary-400'
              }`}>
                {stats.total_quota > 0
                  ? ((stats.today_usage / stats.total_quota) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="h-3 bg-dark-800 rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  (stats.today_usage / stats.total_quota) > 0.8
                    ? 'bg-red-500'
                    : (stats.today_usage / stats.total_quota) > 0.5
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, (stats.today_usage / stats.total_quota) * 100)}%`
                }}
              />
            </div>
          </Card>

          {/* 表格 */}
          <Card padding={false} className="overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-lg font-semibold text-dark-50">今日调用日志</h3>
              <p className="text-sm text-dark-400 mt-1">仅展示最近的调用记录</p>
            </div>
            <Table
              columns={columns}
              data={stats.today_logs}
              emptyMessage="今日暂无调用记录"
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
