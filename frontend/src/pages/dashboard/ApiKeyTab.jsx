import { Check, Copy, RefreshCcw, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../api/index';
import { Button } from '../../components/common/Button';
import { CardHeader } from '../../components/common/Card';
import { ConfirmModal } from '../../components/modals/Modal';
import { useToast } from '../../contexts/ToastContext';
import { copyToClipboard } from '../../utils/clipboard';

export default function ApiKeyTab({ userInfo }) {
  const toast = useToast();
  const [myKey, setMyKey] = useState(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyCopied, setKeyCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  const apiEndpoint = `${window.location.origin}/v1`;

  // 获取或创建 API Key
  const fetchOrCreateKey = async () => {
    setKeyLoading(true);
    try {
      const res = await api.get('/api/auth/api-keys');
      if (res.data.length > 0) {
        setMyKey(res.data[0]);
      } else {
        const createRes = await api.post('/api/auth/api-keys', { name: 'default' });
        setMyKey({ key: createRes.data.key, name: 'default' });
      }
    } catch (err) {
      toast.error('获取Key失败');
    } finally {
      setKeyLoading(false);
    }
  };

  useEffect(() => {
    fetchOrCreateKey();
  }, []);

  const copyKey = async () => {
    if (myKey?.key) {
      await copyToClipboard(myKey.key);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const regenerateKey = () => {
    if (!myKey?.id) return;
    setConfirmModal({
      open: true,
      title: '重置 API 密钥',
      message: '确定要重新生成 API 密钥吗？\n\n旧密钥将立即失效，所有使用旧密钥的应用都需要更新！',
      danger: true,
      onConfirm: async () => {
        setRegenerating(true);
        try {
          const res = await api.post(`/api/auth/api-keys/${myKey.id}/regenerate`);
          setMyKey({ ...myKey, key: res.data.key });
          toast.success('密钥已重新生成');
        } catch (err) {
          toast.error('重新生成失败');
        } finally {
          setRegenerating(false);
        }
      }
    });
  };

  if (keyLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-dark-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
        <p>正在加载密钥...</p>
      </div>
    );
  }

  if (!myKey) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-2">获取失败</div>
        <Button size="sm" onClick={fetchOrCreateKey}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <>
      <CardHeader icon={Terminal}>API 密钥配置</CardHeader>

      <div className="bg-dark-950/50 border border-dark-800 rounded-xl p-5 mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative group">
            <code className="block w-full bg-dark-900 border border-dark-800 px-4 py-3.5 rounded-lg text-primary-300 font-mono text-sm break-all shadow-inner">
              {myKey.key}
            </code>
            <div className="absolute top-0 right-0 h-full flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-xs text-dark-500 bg-dark-900 px-2 py-1 rounded">sk-...</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant={keyCopied ? 'success' : 'primary'}
              onClick={copyKey}
              className="flex-1"
              icon={keyCopied ? Check : Copy}
            >
              {keyCopied ? '已复制' : '复制密钥'}
            </Button>
            <Button
              variant="secondary"
              onClick={regenerateKey}
              disabled={regenerating}
              className="flex-1"
              icon={RefreshCcw}
              loading={regenerating}
            >
              重置密钥
            </Button>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="border-t border-white/5 pt-6">
        <h3 className="font-medium text-dark-200 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
          快速开始
        </h3>
        <div className="space-y-4 text-sm text-dark-400">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider font-semibold text-dark-500">API Endpoint</div>
            <code className="block bg-dark-900 border border-dark-800 px-3 py-2 rounded-lg text-dark-300 font-mono select-all">
              {apiEndpoint}
            </code>
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider font-semibold text-dark-500">客户端配置</div>
            <ol className="space-y-2 list-decimal list-inside marker:text-dark-600">
              <li>打开连接设置 <span className="text-dark-300">Chat Completion</span></li>
              <li>
                选择源 <span className="text-primary-400 font-medium">兼容OpenAI</span> 或{' '}
                <span className="text-primary-400 font-medium">Gemini反代</span>
              </li>
              <li>API Key 填写上方密钥</li>
              <li>
                模型填写 <span className="text-primary-300 font-mono bg-primary-500/10 px-1 rounded">gemini-3-pro-preview</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />
    </>
  );
}