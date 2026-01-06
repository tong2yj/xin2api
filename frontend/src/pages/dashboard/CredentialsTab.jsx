import { ExternalLink, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { CredentialList } from '../../components/credentials/CredentialList';
import { QuotaInfoModal } from '../../components/modals/QuotaInfoModal';
import { VerifyResultModal } from '../../components/modals/VerifyResultModal';
import { useCredentials } from '../../hooks/useCredentials';

export default function CredentialsTab({ forceDonate = false }) {
  const {
    credentials,
    loading,
    verifyingId,
    quotaData,
    loadingQuota,
    verifyResult,
    fetch,
    verify,
    exportCred,
    remove,
    removeInactive,
    toggleActive,
    togglePublic,
    fetchQuota,
    closeQuotaModal,
    closeVerifyResult,
    hasInactive,
  } = useCredentials();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleDelete = async (id) => {
    if (!confirm('确定删除此凭证？')) return;
    await remove(id);
  };

  const handleDeleteInactive = async () => {
    if (!confirm('确定要删除所有失效凭证吗？')) return;
    await removeInactive();
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-dark-50 flex items-center gap-2">
            我的凭证
            <span className="text-sm font-normal text-dark-400 bg-dark-800 px-2 py-0.5 rounded-full">
              {credentials.length}
            </span>
          </h2>
          <p className="text-dark-400 text-sm mt-1">
            管理所有的 Gemini 和 Antigravity 账号
          </p>
        </div>
        
        <div className="flex gap-2">
          {hasInactive && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteInactive}
              icon={Trash2}
            >
              清理失效
            </Button>
          )}
          <Link to="/credentials">
            <Button variant="success" size="sm" icon={Upload}>
              上传
            </Button>
          </Link>
          <Link to="/oauth">
            <Button variant="primary" size="sm" icon={ExternalLink}>
              获取新凭证
            </Button>
          </Link>
        </div>
      </div>

      <CredentialList
        credentials={credentials}
        loading={loading}
        onVerify={verify}
        onExport={exportCred}
        onDelete={handleDelete}
        onToggleActive={toggleActive}
        onTogglePublic={togglePublic}
        onViewQuota={fetchQuota}
        verifyingId={verifyingId}
        loadingQuota={loadingQuota}
        forceDonate={forceDonate}
      />

      {/* 大锅饭规则提示 */}
      {!forceDonate && (
        <div className="mt-6 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="text-amber-500 mt-0.5" size={20} />
          <div>
            <div className="text-amber-400 font-medium mb-1">大锅饭共享机制</div>
            <div className="text-amber-500/70 text-sm">
              捐赠（公开）您的凭证后，您将获得访问公共池所有高额度凭证的权限。这是一种互惠互利的机制。
            </div>
          </div>
        </div>
      )}

      {/* 配额弹窗 */}
      <QuotaInfoModal data={quotaData} onClose={closeQuotaModal} />

      {/* 检测结果弹窗 */}
      <VerifyResultModal data={verifyResult} onClose={closeVerifyResult} />
    </>
  );
}