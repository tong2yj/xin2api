import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../api/index';
import { useToast } from '../../contexts/ToastContext';

export default function ErrorsTab() {
  const toast = useToast();
  const [errorStats, setErrorStats] = useState({ by_code: {}, recent: [] });
  const [loading, setLoading] = useState(true);
  const [expandedErrors, setExpandedErrors] = useState({});

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/manage/stats/global');
      setErrorStats(res.data.errors || { by_code: {}, recent: [] });
    } catch (err) {
      toast.error('获取错误统计失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const toggleExpand = (code) => {
    setExpandedErrors((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const getErrorColor = (code) => {
    if (code === '429') return { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400' };
    if (code === '401' || code === '403') return { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' };
    if (code === '500') return { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400' };
    return { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400' };
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }

  const errorCodes = Object.keys(errorStats.by_code).sort((a, b) => {
    return errorStats.by_code[b].count - errorStats.by_code[a].count;
  });

  return (
    <div className="space-y-6">
      {/* 错误码统计 */}
      <div className="card">
        <h3 className="font-semibold mb-4">错误码统计</h3>
        {errorCodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无错误记录</div>
        ) : (
          <div className="space-y-3">
            {errorCodes.map((code) => {
              const data = errorStats.by_code[code];
              const colors = getErrorColor(code);
              const isExpanded = expandedErrors[code];

              return (
                <div key={code} className={`${colors.bg} border ${colors.border} rounded-lg overflow-hidden`}>
                  <button
                    onClick={() => toggleExpand(code)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-xl font-bold ${colors.text}`}>{code}</span>
                      <span className="text-gray-300">{data.message || '未知错误'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-semibold ${colors.text}`}>{data.count} 次</span>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>

                  {isExpanded && data.recent && data.recent.length > 0 && (
                    <div className="px-4 pb-4 border-t border-dark-600">
                      <div className="text-xs text-gray-400 mt-3 mb-2">最近发生</div>
                      <div className="space-y-2">
                        {data.recent.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-dark-800/50 rounded px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400">{item.username || '未知用户'}</span>
                              <span className="text-gray-500">→</span>
                              <span className="text-gray-300">{item.model || '未知模型'}</span>
                            </div>
                            <span className="text-gray-500 text-xs">
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 最近错误 */}
      <div className="card">
        <h3 className="font-semibold mb-4">最近错误</h3>
        {errorStats.recent?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无最近错误</div>
        ) : (
          <div className="space-y-2">
            {errorStats.recent?.slice(0, 20).map((error, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-dark-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      getErrorColor(String(error.error_code)).bg
                    } ${getErrorColor(String(error.error_code)).text}`}
                  >
                    {error.error_code}
                  </span>
                  <span className="text-gray-300">{error.username || '未知'}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{error.model}</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {new Date(error.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
