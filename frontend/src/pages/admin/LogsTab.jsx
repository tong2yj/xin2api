import { Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../api/index';
import { Pagination } from '../../components/common/Pagination';
import { useToast } from '../../contexts/ToastContext';

const LOGS_PER_PAGE = 50;

export default function LogsTab() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 筛选条件
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 日志详情弹窗
  const [detailModal, setDetailModal] = useState({ open: false, data: null, loading: false });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', LOGS_PER_PAGE);
      params.append('page', page);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (search) params.append('username', search);
      if (status !== 'all') params.append('status', status);

      const res = await api.get(`/api/admin/logs?${params.toString()}`);
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setTotalPages(res.data.pages);
    } catch (err) {
      toast.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, status, startDate, endDate]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const viewLogDetail = async (logId) => {
    setDetailModal({ open: true, data: null, loading: true });
    try {
      const res = await api.get(`/api/admin/logs/${logId}/detail`);
      setDetailModal({ open: true, data: res.data, loading: false });
    } catch (err) {
      setDetailModal({ open: false, data: null, loading: false });
      toast.error('获取日志详情失败');
    }
  };

  return (
    <div className="space-y-4">
      {/* 筛选条件 */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="搜索用户名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 w-48"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white"
        >
          <option value="all">全部状态</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white"
        />
        <span className="text-gray-400">至</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white"
        />
        <span className="text-gray-400 text-sm">共 {total} 条记录</span>
      </div>

      {/* 日志表格 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>用户</th>
                <th>模型</th>
                <th>凭证</th>
                <th>状态</th>
                <th>耗时</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="text-sm">{log.username || '-'}</td>
                  <td className="text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        log.model?.includes('pro')
                          ? 'bg-orange-500/20 text-orange-400'
                          : log.model?.includes('flash')
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {log.model || '-'}
                    </span>
                  </td>
                  <td className="text-gray-400 text-xs max-w-[150px] truncate" title={log.credential_name}>
                    {log.credential_name || '-'}
                  </td>
                  <td>
                    {log.status === 'success' ? (
                      <span className="text-green-400 text-xs">成功</span>
                    ) : (
                      <span className="text-red-400 text-xs">{log.error_code || '失败'}</span>
                    )}
                  </td>
                  <td className="text-gray-400 text-xs">
                    {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                  </td>
                  <td>
                    <button
                      onClick={() => viewLogDetail(log.id)}
                      className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-blue-400"
                      title="查看详情"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* 日志详情弹窗 */}
      {detailModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-dark-600">
              <h3 className="text-lg font-semibold">日志详情</h3>
              <button
                onClick={() => setDetailModal({ open: false, data: null, loading: false })}
                className="p-2 hover:bg-dark-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {detailModal.loading ? (
                <div className="text-center py-8 text-gray-400">加载中...</div>
              ) : detailModal.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">用户:</span>{' '}
                      <span className="text-white">{detailModal.data.username}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">模型:</span>{' '}
                      <span className="text-white">{detailModal.data.model}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">状态:</span>{' '}
                      <span className={detailModal.data.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                        {detailModal.data.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">耗时:</span>{' '}
                      <span className="text-white">{detailModal.data.latency_ms}ms</span>
                    </div>
                  </div>
                  {detailModal.data.error_message && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="text-red-400 text-sm font-medium mb-1">错误信息</div>
                      <div className="text-red-300 text-sm">{detailModal.data.error_message}</div>
                    </div>
                  )}
                  {detailModal.data.request_preview && (
                    <div>
                      <div className="text-gray-400 text-sm mb-1">请求预览</div>
                      <pre className="p-3 bg-dark-900 rounded-lg text-xs text-gray-300 overflow-auto max-h-40">
                        {detailModal.data.request_preview}
                      </pre>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}