import { ExternalLink, RefreshCw, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import CredentialCard from './CredentialCard';
import { Button } from '../common/Button';

/**
 * 凭证列表组件
 */
export function CredentialList({
  credentials,
  loading = false,
  onVerify,
  onExport,
  onDelete,
  onToggleActive,
  onTogglePublic,
  onViewQuota,
  verifyingId = null,
  loadingQuota = false,
  forceDonate = false,
  lockDonate = false,
  emptyMessage = '暂无凭证',
  emptyAction = null,
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-dark-400">
        <RefreshCw className="animate-spin mb-3 text-primary-500" size={24} />
        <p className="font-medium">加载凭证中...</p>
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-dark-700 rounded-2xl bg-dark-900/30">
        <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
          <Shield size={32} className="text-dark-500" />
        </div>
        <p className="text-dark-300 font-medium text-lg mb-2">{emptyMessage}</p>
        
        {emptyAction ? (
          emptyAction
        ) : (
          <div className="text-center">
            <p className="text-dark-500 text-sm mb-4">
              您可以上传现有的 JSON 文件，或者通过 OAuth 获取新凭证
            </p>
            <Link to="/oauth">
              <Button variant="primary" size="sm" icon={ExternalLink}>
                去获取凭证
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 animate-fade-in">
      {credentials.map((cred) => (
        <CredentialCard
          key={cred.id}
          credential={cred}
          onVerify={onVerify}
          onExport={onExport}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
          onTogglePublic={onTogglePublic}
          onViewQuota={onViewQuota}
          verifying={verifyingId === cred.id}
          loadingQuota={loadingQuota}
          forceDonate={forceDonate}
          lockDonate={lockDonate}
        />
      ))}
    </div>
  );
}

export default CredentialList;