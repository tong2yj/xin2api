import { CheckCircle, RefreshCw, X } from 'lucide-react';

/**
 * 凭证检测结果弹窗
 */
export function VerifyResultModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl w-full max-w-md overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {data.is_project_id_refresh ? (
              <RefreshCw
                className={data.is_valid ? 'text-green-400' : 'text-red-400'}
              />
            ) : (
              <CheckCircle
                className={data.is_valid ? 'text-green-400' : 'text-red-400'}
              />
            )}
            {data.is_project_id_refresh ? '刷新项目ID结果' : '凭证检测结果'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 邮箱 */}
          <div className="text-gray-400 text-sm">{data.email}</div>

          {/* 状态 */}
          <div className="flex items-center gap-3">
            <span className="text-gray-400">状态</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.is_valid
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {data.is_project_id_refresh
                ? data.is_valid
                  ? '✅ 刷新成功'
                  : '❌ 刷新失败'
                : data.is_valid
                ? '✅ 有效'
                : '❌ 无效'}
            </span>
          </div>

          {/* 项目ID信息（刷新项目ID时显示） */}
          {data.is_project_id_refresh && data.project_id && (
            <div className="flex items-center gap-3">
              <span className="text-gray-400">项目ID</span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-500/20 text-orange-400">
                {data.project_id}
              </span>
            </div>
          )}

          {data.is_project_id_refresh &&
            data.old_project_id &&
            data.is_valid && (
              <div className="flex items-center gap-3">
                <span className="text-gray-400">旧ID</span>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-600/50 text-gray-300 line-through">
                  {data.old_project_id}
                </span>
              </div>
            )}

          {/* 模型等级 */}
          {data.model_tier && (
            <div className="flex items-center gap-3">
              <span className="text-gray-400">模型等级</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  data.model_tier === '3'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-gray-600/50 text-gray-300'
                }`}
              >
                {data.model_tier === '3' ? '🚀 3.0 可用' : '2.5'}
              </span>
            </div>
          )}

          {/* 账号类型 */}
          {data.account_type && (
            <div className="flex items-center gap-3">
              <span className="text-gray-400">账号类型</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  data.account_type === 'pro'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-600/50 text-gray-300'
                }`}
              >
                {data.account_type === 'pro' ? '⭐ Pro (2TB存储)' : '普通账号'}
              </span>
            </div>
          )}

          {/* 错误信息 */}
          {data.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {data.error}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-dark-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerifyResultModal;
