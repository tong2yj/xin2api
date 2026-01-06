import {
  BarChart2,
  CheckCircle,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { formatDate } from '../../utils/format';

/**
 * 凭证卡片组件
 */
export function CredentialCard({
  credential,
  onVerify,
  onExport,
  onDelete,
  onToggleActive,
  onTogglePublic,
  onViewQuota,
  verifying = false,
  loadingQuota = false,
  forceDonate = false,
  lockDonate = false,
}) {
  const cred = credential;

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        cred.is_active
          ? 'bg-dark-800 border-dark-600'
          : 'bg-dark-900 border-dark-700 opacity-60'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex-1 min-w-0">
          {/* 凭证名称 */}
          <div className="text-gray-400 italic mb-2 truncate">
            {cred.email || cred.name}
          </div>

          {/* 状态标签行 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* 凭证类型标签 */}
            {cred.credential_type === 'oauth_antigravity' && (
              <span className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded font-medium">
                🚀 Antigravity
              </span>
            )}
            {cred.credential_type === 'oauth' && (
              <span className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded font-medium">
                🤖 Gemini
              </span>
            )}

            {/* 启用状态 */}
            {cred.is_active ? (
              <span className="text-xs px-2.5 py-1 bg-green-600 text-white rounded font-medium">
                有效
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-red-600 text-white rounded font-medium">
                ❌ 已失效
              </span>
            )}

            {/* Pro 标签 */}
            {cred.account_type === 'pro' && (
              <span className="text-xs px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded font-medium">
                ⭐ Pro
              </span>
            )}

            {/* 模型等级 */}
            {cred.model_tier === '3' ? (
              <span className="text-xs px-2.5 py-1 bg-purple-500/20 text-purple-400 rounded font-medium">
                3.0可用
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-gray-600/50 text-gray-400 rounded font-medium">
                2.5
              </span>
            )}

            {/* 捐赠状态 */}
            {cred.is_public && !forceDonate && (
              <span className="text-xs px-2.5 py-1 border border-purple-500 text-purple-400 rounded font-medium">
                已公开
              </span>
            )}
          </div>

          {/* CD 状态行 */}
          {(cred.cd_flash > 0 || cred.cd_pro > 0 || cred.cd_30 > 0) && (
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {cred.cd_flash > 0 && (
                <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                  Flash CD: {cred.cd_flash}s
                </span>
              )}
              {cred.cd_pro > 0 && (
                <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                  Pro CD: {cred.cd_pro}s
                </span>
              )}
              {cred.cd_30 > 0 && (
                <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded">
                  3.0 CD: {cred.cd_30}s
                </span>
              )}
            </div>
          )}

          {/* 信息行 */}
          <div className="text-xs text-gray-500">
            最后成功: {formatDate(cred.last_used_at) || '从未使用'}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 配额 */}
          {onViewQuota && (
            <button
              onClick={() => onViewQuota(cred.id)}
              disabled={loadingQuota}
              className="px-3 py-1.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-1"
              title="查看配额"
            >
              <BarChart2 size={12} />
              配额
            </button>
          )}

          {/* 检测 */}
          {onVerify && (
            <button
              onClick={() => onVerify(cred.id, cred.email || cred.name)}
              disabled={verifying}
              className="px-3 py-1.5 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center gap-1"
            >
              {verifying ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <CheckCircle size={12} />
              )}
              检测
            </button>
          )}

          {/* 导出 */}
          {onExport && (
            <button
              onClick={() => onExport(cred.id, cred.email)}
              className="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1"
            >
              <Download size={12} />
              导出
            </button>
          )}

          {/* 启用/禁用 */}
          {onToggleActive && (
            <button
              onClick={() => onToggleActive(cred.id, cred.is_active)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                cred.is_active
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {cred.is_active ? '禁用' : '启用'}
            </button>
          )}

          {/* 捐赠/取消捐赠 */}
          {onTogglePublic &&
            !forceDonate &&
            !(lockDonate && cred.is_public && cred.is_active) && (
              <button
                onClick={() => onTogglePublic(cred.id, cred.is_public)}
                disabled={!cred.is_public && !cred.is_active}
                title={
                  !cred.is_public && !cred.is_active
                    ? '请先检测凭证有效后再设为公开'
                    : ''
                }
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  cred.is_public
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : !cred.is_active
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {cred.is_public ? '取消公开' : '设为公开'}
              </button>
            )}

          {/* 删除 */}
          {onDelete && (
            <button
              onClick={() => onDelete(cred.id)}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CredentialCard;
