import { useCallback, useState } from 'react';
import { credentialsApi } from '../api/credentials';
import { useToast } from '../contexts/ToastContext';
import { downloadJson } from '../utils/clipboard';

/**
 * 凭证管理 Hook
 */
export function useCredentials() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [quotaData, setQuotaData] = useState(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const toast = useToast();

  // 获取凭证列表
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await credentialsApi.getMyCredentials();
      setCredentials(res.data);
      return res.data;
    } catch (err) {
      toast.error('获取凭证失败');
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 上传凭证
  const upload = useCallback(
    async (formData) => {
      try {
        const res = await credentialsApi.upload(formData);
        toast.success(
          `上传完成: 成功 ${res.data.uploaded_count}/${res.data.total_count} 个`
        );
        await fetch();
        return true;
      } catch (err) {
        toast.error(err.response?.data?.detail || '上传失败');
        return false;
      }
    },
    [fetch, toast]
  );

  // 检测凭证
  const verify = useCallback(
    async (id, email) => {
      setVerifyingId(id);
      try {
        const res = await credentialsApi.verify(id);
        setVerifyResult({ ...res.data, email });
        await fetch();
        return res.data;
      } catch (err) {
        setVerifyResult({
          error: err.response?.data?.detail || err.message,
          is_valid: false,
          email,
        });
        return null;
      } finally {
        setVerifyingId(null);
      }
    },
    [fetch]
  );

  // 导出凭证
  const exportCred = useCallback(
    async (id, email) => {
      try {
        const res = await credentialsApi.export(id);
        downloadJson(res.data, `credential_${email || id}.json`);
        toast.success('凭证已导出');
      } catch (err) {
        toast.error('导出失败: ' + (err.response?.data?.detail || err.message));
      }
    },
    [toast]
  );

  // 删除凭证
  const remove = useCallback(
    async (id) => {
      try {
        await credentialsApi.delete(id);
        toast.success('删除成功');
        await fetch();
        return true;
      } catch (err) {
        toast.error('删除失败');
        return false;
      }
    },
    [fetch, toast]
  );

  // 批量删除失效凭证
  const removeInactive = useCallback(async () => {
    try {
      const res = await credentialsApi.deleteInactiveBatch();
      toast.success(res.data.message);
      await fetch();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || '删除失败');
      return false;
    }
  }, [fetch, toast]);

  // 切换启用状态
  const toggleActive = useCallback(
    async (id, currentActive) => {
      try {
        await credentialsApi.update(id, { is_active: !currentActive });
        await fetch();
        return true;
      } catch (err) {
        toast.error('操作失败');
        return false;
      }
    },
    [fetch, toast]
  );

  // 切换公开状态
  const togglePublic = useCallback(
    async (id, currentPublic) => {
      try {
        await credentialsApi.update(id, { is_public: !currentPublic });
        await fetch();
        return true;
      } catch (err) {
        toast.error('操作失败');
        return false;
      }
    },
    [fetch, toast]
  );

  // 获取配额
  const fetchQuota = useCallback(
    async (id) => {
      setLoadingQuota(true);
      try {
        const res = await credentialsApi.getQuota(id);
        setQuotaData(res.data);
        return res.data;
      } catch (err) {
        toast.error('获取配额失败');
        return null;
      } finally {
        setLoadingQuota(false);
      }
    },
    [toast]
  );

  // 关闭配额弹窗
  const closeQuotaModal = useCallback(() => {
    setQuotaData(null);
  }, []);

  // 关闭检测结果弹窗
  const closeVerifyResult = useCallback(() => {
    setVerifyResult(null);
  }, []);

  return {
    credentials,
    loading,
    verifyingId,
    quotaData,
    loadingQuota,
    verifyResult,
    fetch,
    upload,
    verify,
    exportCred,
    remove,
    removeInactive,
    toggleActive,
    togglePublic,
    fetchQuota,
    closeQuotaModal,
    closeVerifyResult,
    hasInactive: credentials.some((c) => !c.is_active),
  };
}

export default useCredentials;
