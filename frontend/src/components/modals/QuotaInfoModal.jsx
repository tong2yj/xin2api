import { BarChart2, X } from 'lucide-react';

/**
 * 配额信息弹窗
 */
export function QuotaInfoModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart2 className="text-indigo-400" />
              模型配额信息
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {data.email || data.credential_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-600 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 账号类型 */}
        <div className="px-4 pt-3">
          <span
            className={`text-xs px-2 py-1 rounded ${
              data.account_type === 'pro'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-gray-600/50 text-gray-400'
            }`}
          >
            {data.account_type === 'pro' ? '⭐ Pro 账号' : '普通账号'}
          </span>
        </div>

        {/* Flash 配额 */}
        {data.flash && (
          <QuotaBar
            label="2.5-flash 配额"
            color="cyan"
            percentage={data.flash.percentage}
            used={data.flash.used}
            limit={data.flash.limit}
            remaining={data.flash.remaining}
          />
        )}

        {/* 高级模型配额 */}
        {data.premium && (
          <QuotaBar
            label="2.5-pro / 3.0 配额"
            color="purple"
            percentage={data.premium.percentage}
            used={data.premium.used}
            limit={data.premium.limit}
            remaining={data.premium.remaining}
            note={data.premium.note}
          />
        )}

        {/* 各模型使用情况 */}
        <div className="p-4 overflow-y-auto max-h-[50vh] space-y-3">
          <div className="text-xs text-gray-500 mb-2">
            各模型使用情况（配额可能共享）
          </div>
          {data.models?.filter((m) => m.used > 0).length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              今日暂无使用记录
            </div>
          ) : (
            data.models
              ?.filter((m) => m.used > 0)
              .map((item) => (
                <div
                  key={item.model}
                  className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.model}</span>
                    {item.is_premium && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        高级
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-sm font-medium">
                    {item.used} 次
                  </span>
                </div>
              ))
          )}
        </div>

        {/* 提示 */}
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/30">
          <div className="text-xs text-amber-400/80">
            ⚠️ 此为本平台调用统计，不包含其他平台（如 AI Studio、CLI）的使用量
          </div>
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-dark-600 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            重置时间: {new Date(data.reset_time).toLocaleString()}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 配额进度条
 */
function QuotaBar({ label, color, percentage, used, limit, remaining, note }) {
  const getPercentageColor = (pct) => {
    if (pct > 50) return 'text-green-400';
    if (pct > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBarColor = (pct) => {
    if (pct > 50) return `bg-${color}-500`;
    if (pct > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-4 border-b border-dark-600">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className={`font-semibold text-${color}-400`}>{label}</span>
        <span className={`font-bold ${getPercentageColor(percentage)}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-3 bg-dark-600 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
        <span>
          已用 {used} / {limit}
        </span>
        <span>剩余 {remaining}</span>
      </div>
      {note && (
        <div className={`text-xs text-${color}-400/60 mt-1`}>{note}</div>
      )}
    </div>
  );
}

export default QuotaInfoModal;
