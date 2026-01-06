import {
  BarChart2,
  CheckCircle,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '../common/Button';
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
            {cred.credential_type === 'gemini_cli' && (
              <span className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded font-medium">
                🤖 GeminiCli
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
            <Button
              size="sm"
              variant="primary"
              onClick={() => onViewQuota(cred.id)}
              loading={loadingQuota}
              icon={BarChart2}
              className="!text-xs !py-1.5"
              title="查看配额"
            >
              配额
            </Button>
          )}

          {/* 检测 */}
          {onVerify && (
            <Button
              size="sm"
              variant="info"
              onClick={() => onVerify(cred.id, cred.email || cred.name)}
              disabled={verifying}
              loading={verifying}
              icon={CheckCircle}
              className="!text-xs !py-1.5"
            >
              检测
            </Button>
          )}

          {/* 导出 */}
          {onExport && (
            <Button
              size="sm"
              variant="blue"
              onClick={() => onExport(cred.id, cred.email)}
              icon={Download}
              className="!text-xs !py-1.5"
            >
              导出
            </Button>
          )}

          {/* 启用/禁用 */}
          {onToggleActive && (
            <Button
              size="sm"
              variant={cred.is_active ? 'warning' : 'success'}
              onClick={() => onToggleActive(cred.id, cred.is_active)}
              className="!text-xs !py-1.5"
            >
              {cred.is_active ? '禁用' : '启用'}
            </Button>
          )}

          {/* 捐赠/取消捐赠 */}
          {onTogglePublic &&
            !forceDonate &&
            !(lockDonate && cred.is_public && cred.is_active) && (
              <Button
                size="sm"
                variant={cred.is_public ? 'secondary' : (!cred.is_active ? 'secondary' : 'primary')}
                onClick={() => onTogglePublic(cred.id, cred.is_public)}
                disabled={!cred.is_public && !cred.is_active}
                title={
                  !cred.is_public && !cred.is_active
                    ? '请先检测凭证有效后再设为公开'
                    : ''
                }
                className={`!text-xs !py-1.5 ${
                  !cred.is_public && !cred.is_active ? '!cursor-not-allowed !text-gray-500 !bg-dark-700' : ''
                }`}
              >
                {cred.is_public ? '取消公开' : '设为公开'}
              </Button>
            )}

          {/* 删除 */}
          {onDelete && (
            <Button
              variant="ghost-danger"
              size="icon-sm"
              onClick={() => onDelete(cred.id)}
              title="删除"
              icon={Trash2}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default CredentialCard;
