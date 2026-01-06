import { AlertTriangle, BarChart2, Check, Copy, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../api';
import { Button } from '../../components/common/Button';
import { Card, CardHeader } from '../../components/common/Card';
import { Table } from '../../components/common/Table';
import { copyToClipboard } from '../../utils/clipboard';

export default function GlobalStatsTab() {
  const [overview, setOverview] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const [byModel, setByModel] = useState([]);
  const [byUser, setByUser] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  // 报错统计相关状态
  const [errorStats, setErrorStats] = useState(null);
  const [errorPage, setErrorPage] = useState(1);
  const [errorLoading, setErrorLoading] = useState(false);
  const [expandedCodes, setExpandedCodes] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    setLoading(true);
    try {
        const results = await Promise.allSettled([
        api.get('/api/manage/stats/overview'),
        api.get('/api/manage/stats/global'),
        api.get(`/api/manage/stats/by-model?days=${days}`),
        api.get(`/api/manage/stats/by-user?days=${days}`),
        api.get(`/api/manage/stats/daily?days=${days}`),
        ]);

        if (results[0].status === 'fulfilled') setOverview(results[0].value.data);
        if (results[1].status === 'fulfilled') setGlobalStats(results[1].value.data);
        if (results[2].status === 'fulfilled') setByModel(results[2].value.data.models || []);
        if (results[3].status === 'fulfilled') setByUser(results[3].value.data.users || []);
        if (results[4].status === 'fulfilled') setDaily(results[4].value.data.daily || []);
    } catch (err) {
        console.error("Failed to fetch stats", err);
    } finally {
        setLoading(false);
    }
  };

  const poolModeLabel = {
    private: '🔒 私有模式',
    tier3_shared: '⚡ 3.0共享',
    full_shared: '🍲 大锅饭',
  };

  const fetchErrorStats = async (page = 1) => {
    setErrorLoading(true);
    try {
      const res = await api.get(`/api/manage/stats/errors?page=${page}&page_size=50`);
      setErrorStats(res.data);
      setErrorPage(page);
    } catch (err) {
      console.error('获取报错统计失败', err);
    } finally {
      setErrorLoading(false);
    }
  };

  const fetchLogDetail = async (logId) => {
    try {
      const res = await api.get(`/api/manage/logs/${logId}`);
      setSelectedLog(res.data);
    } catch (err) {
      console.error('获取日志详情失败', err);
    }
  };

  const toggleExpand = (code) => {
    setExpandedCodes(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleCopy = async (text) => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusCodeColor = (code) => {
    if (code >= 500) return 'text-red-400 bg-red-500/10 border border-red-500/20';
    if (code === 429) return 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
    if (code >= 400) return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20';
    return 'text-gray-400 bg-gray-500/10 border border-gray-500/20';
  };

  // 表格列定义
  const errorColumns = [
    { key: 'created_at', label: '时间', render: val => <span className="text-dark-400 text-xs">{new Date(val).toLocaleString()}</span> },
    { key: 'username', label: '用户', render: val => <span className="text-primary-400 text-sm">{val}</span> },
    { key: 'model', label: '模型', render: val => <span className="text-cyan-400 font-mono text-xs">{val}</span> },
    { key: 'status_code', label: '状态码', render: val => <span className={`px-2 py-0.5 rounded text-xs ${getStatusCodeColor(val)}`}>{val}</span> },
    { key: 'cd_seconds', label: 'CD', render: val => <span className="text-orange-400 text-xs">{val ? `${val}s` : '-'}</span> },
    {
      key: 'actions',
      label: '操作',
      render: (_, row) => (
        <Button size="sm" variant="ghost" onClick={() => fetchLogDetail(row.id)} className="!py-1 !px-2 text-xs">
          详情
        </Button>
      )
    }
  ];

  if (loading) {
    return (
       <div className="flex items-center justify-center text-dark-400 py-12">
        <RefreshCw className="animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 顶部工具栏 */}
      <div className="flex justify-end">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-dark-800 text-dark-200 border border-dark-700 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <option value={7}>最近 7 天</option>
          <option value={14}>最近 14 天</option>
          <option value={30}>最近 30 天</option>
        </select>
      </div>

      {/* 全站实时统计 Card */}
      {globalStats && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              全站实时概览
            </h2>
            <span className="px-3 py-1 bg-primary-500/10 border border-primary-500/20 text-primary-300 rounded-full text-xs font-medium">
              {poolModeLabel[globalStats.pool_mode] || globalStats.pool_mode}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <StatsMetric label="最近1小时请求" value={globalStats.requests.last_hour} color="text-yellow-400" />
             <StatsMetric label="今日请求" value={globalStats.requests.today} color="text-blue-400" />
             <StatsMetric label="24h活跃用户" value={globalStats.users.active_24h} color="text-emerald-400" />
             <StatsMetric label="3.0 凭证数" value={globalStats.credentials.tier_3} color="text-primary-400" />
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5 text-sm text-dark-400">
             <span>用户总数: <span className="text-dark-200">{globalStats.user_counts?.total ?? 0}</span></span>
             <span className="text-dark-700">|</span>
             <span>凭证: <span className="text-emerald-400">{globalStats.credentials.active}</span> Active / {globalStats.credentials.total} Total</span>
             <span className="text-dark-700">|</span>
             <span>公共池: <span className="text-primary-400">{globalStats.credentials.public}</span></span>
          </div>
        </Card>
      )}

      {/* 历史概览 Grid */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <OverviewCard title="今日请求" value={overview.requests.today} gradient="from-blue-600/20 to-blue-900/20" border="border-blue-500/20" textColor="text-blue-400" />
           <OverviewCard title="本周请求" value={overview.requests.week} gradient="from-emerald-600/20 to-emerald-900/20" border="border-emerald-500/20" textColor="text-emerald-400" />
           <OverviewCard title="本月请求" value={overview.requests.month} gradient="from-primary-600/20 to-primary-900/20" border="border-primary-500/20" textColor="text-primary-400" />
           <OverviewCard title="活跃凭证" value={`${overview.credentials.active}/${overview.credentials.total}`} gradient="from-orange-600/20 to-orange-900/20" border="border-orange-500/20" textColor="text-orange-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 按模型统计 */}
        <Card>
          <CardHeader icon={BarChart2}>模型使用排行</CardHeader>
          <div className="space-y-4">
             {byModel.map((item, idx) => (
                <ProgressBar key={idx} label={item.model} value={item.count} max={byModel[0]?.count || 1} color="bg-blue-500" />
             ))}
             {byModel.length === 0 && <p className="text-dark-400 text-center py-4">暂无数据</p>}
          </div>
        </Card>

        {/* 按用户统计 */}
        <Card>
          <CardHeader icon={BarChart2}>用户使用排行 (Top 20)</CardHeader>
           <div className="space-y-4">
             {byUser.map((item, idx) => (
                <ProgressBar key={idx} label={item.username} value={item.count} max={byUser[0]?.count || 1} color="bg-emerald-500" />
             ))}
             {byUser.length === 0 && <p className="text-dark-400 text-center py-4">暂无数据</p>}
          </div>
        </Card>
      </div>

       {/* 每日趋势 Chart */}
      <Card>
        <CardHeader icon={BarChart2}>每日请求趋势</CardHeader>
        <div className="h-64 flex items-end gap-2 pt-4 px-2">
           {daily.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-dark-400">暂无数据</div>
           ) : (
              daily.map((item, idx) => {
                 const maxCount = Math.max(...daily.map(d => d.count));
                 const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                 return (
                    <div key={idx} className="flex-1 flex flex-col justify-end group relative h-full">
                       <div 
                          className="w-full bg-primary-500/40 hover:bg-primary-500 rounded-t-lg transition-all duration-300 relative"
                          style={{ height: `${Math.max(height, 2)}%` }}
                       >
                         {/* Tooltip */}
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-dark-800 border border-dark-700 px-3 py-1.5 rounded-lg text-xs shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            <div className="font-bold text-white">{item.count} 请求</div>
                            <div className="text-dark-400">{item.date}</div>
                         </div>
                       </div>
                    </div>
                 )
              })
           )}
        </div>
        <div className="flex justify-between mt-4 text-xs text-dark-400 border-t border-white/5 pt-2">
            <span>{daily[0]?.date}</span>
            <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </Card>

      {/* 报错统计 */}
      <Card padding={false} className="overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
           <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="text-yellow-500" size={20} />
              今日报错统计
           </h3>
           <Button size="sm" variant="secondary" onClick={() => fetchErrorStats(1)} loading={errorLoading} icon={RefreshCw}>
              {errorStats ? '刷新' : '加载'}
           </Button>
        </div>

        {errorStats && (
           <div className="p-6 border-b border-white/5 bg-dark-900/30">
              <h4 className="text-sm font-medium text-dark-300 mb-3">错误类型分布</h4>
              <div className="flex flex-wrap gap-2">
                 {errorStats.error_by_code?.map((item, idx) => (
                    <button 
                      key={idx}
                      onClick={() => toggleExpand(item.status_code)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                         expandedCodes[item.status_code] ? 'bg-dark-700 border-dark-600' : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                      }`}
                    >
                       <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getStatusCodeColor(item.status_code)}`}>
                          {item.status_code}
                       </span>
                       <span className="text-sm text-dark-200">{item.count} 次</span>
                    </button>
                 ))}
              </div>
           </div>
        )}

        {errorStats ? (
           <>
             <Table 
                columns={errorColumns}
                data={errorStats.errors || []}
                emptyMessage="暂无报错记录"
             />
             {errorStats.total_pages > 1 && (
                <div className="p-4 border-t border-white/5 flex items-center justify-center gap-4">
                   <Button size="sm" variant="secondary" onClick={() => fetchErrorStats(errorPage - 1)} disabled={errorPage <= 1 || errorLoading}>上一页</Button>
                   <span className="text-sm text-dark-400">{errorPage} / {errorStats.total_pages}</span>
                   <Button size="sm" variant="secondary" onClick={() => fetchErrorStats(errorPage + 1)} disabled={errorPage >= errorStats.total_pages || errorLoading}>下一页</Button>
                </div>
             )}
           </>
        ) : !errorLoading && (
           <div className="p-12 text-center text-dark-400">
              点击刷新按钮加载详细数据
           </div>
        )}
      </Card>

      {/* 日志详情 Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
           <div className="bg-bg-card border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
              <div className="sticky top-0 bg-bg-card/95 backdrop-blur border-b border-white/5 p-5 flex items-center justify-between z-10">
                 <h3 className="text-lg font-semibold">请求详情</h3>
                 <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <X size={20} className="text-dark-400" />
                 </button>
              </div>

              <div className="p-6 space-y-6">
                 {/* 基本信息 Grid */}
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailItem label="时间" value={new Date(selectedLog.created_at).toLocaleString()} />
                    <DetailItem label="状态">
                       <span className={`px-2 py-0.5 rounded text-xs ${getStatusCodeColor(selectedLog.status_code)}`}>
                          {selectedLog.status_code}
                       </span>
                    </DetailItem>
                    <DetailItem label="耗时" value={`${selectedLog.latency_ms?.toFixed(0)} ms`} />
                    <DetailItem label="用户" value={selectedLog.username} />
                    <DetailItem label="模型" value={selectedLog.model} valueClass="text-cyan-400 font-mono" />
                    <DetailItem label="IP" value={selectedLog.client_ip} valueClass="font-mono" />
                 </div>

                 {/* Code Blocks */}
                 <CodeBlock label="Request Path" content={selectedLog.endpoint} onCopy={() => handleCopy(selectedLog.endpoint)} copied={copied} />
                 
                 {selectedLog.error_message && (
                    <CodeBlock label="Error Message" content={selectedLog.error_message} isError onCopy={() => handleCopy(selectedLog.error_message)} copied={copied} />
                 )}
                 
                 {selectedLog.request_body && (
                    <CodeBlock label="Request Body" content={selectedLog.request_body} isJson onCopy={() => handleCopy(selectedLog.request_body)} copied={copied} />
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// 辅助组件
function StatsMetric({ label, value, color }) {
   return (
      <div className="bg-dark-900/50 rounded-xl p-4 border border-white/5">
         <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
         <div className="text-xs text-dark-400 uppercase tracking-wide">{label}</div>
      </div>
   );
}

function OverviewCard({ title, value, gradient, border, textColor }) {
   return (
      <div className={`bg-gradient-to-br ${gradient} border ${border} rounded-2xl p-6`}>
         <h3 className={`text-sm font-medium ${textColor} mb-2 opacity-80`}>{title}</h3>
         <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>
   );
}

function ProgressBar({ label, value, max, color }) {
   const percent = Math.min(100, (value / max) * 100);
   return (
      <div className="flex items-center gap-4">
         <span className="text-sm text-dark-300 w-32 truncate text-right">{label}</span>
         <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
         </div>
         <span className="text-sm font-medium text-dark-100 w-16 tabular-nums text-right">{value}</span>
      </div>
   );
}

function DetailItem({ label, value, valueClass = 'text-dark-100', children }) {
   return (
      <div className="bg-dark-900/50 p-3 rounded-lg border border-white/5">
         <div className="text-xs text-dark-500 mb-1">{label}</div>
         <div className={`text-sm ${valueClass} truncate`}>{children || value || '-'}</div>
      </div>
   );
}

function CodeBlock({ label, content, isError, isJson, onCopy, copied }) {
   let displayContent = content;
   if (isJson) {
      try {
         displayContent = JSON.stringify(JSON.parse(content), null, 2);
      } catch (e) {}
   }

   return (
      <div className={`rounded-xl border ${isError ? 'bg-red-900/10 border-red-500/20' : 'bg-dark-950 border-dark-800'} overflow-hidden`}>
         <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <span className={`text-xs font-medium ${isError ? 'text-red-400' : 'text-dark-400'}`}>{label}</span>
            <button onClick={onCopy} className="text-dark-500 hover:text-white transition-colors">
               {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
         </div>
         <div className="p-4 overflow-x-auto">
            <pre className={`text-xs font-mono whitespace-pre-wrap ${isError ? 'text-red-300' : 'text-dark-300'}`}>
               {displayContent}
            </pre>
         </div>
      </div>
   );
}