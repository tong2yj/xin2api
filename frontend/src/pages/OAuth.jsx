import {
  Check,
  ExternalLink,
  Info,
  Key,
  RefreshCw,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../App';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { PageLayout } from '../components/layout/PageLayout';

export default function OAuth() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isDonate, setIsDonate] = useState(true);
  const [forceDonate, setForceDonate] = useState(false);
  const [forAntigravity, setForAntigravity] = useState(false);
  
  // 引导流程状态
  const [showGuide, setShowGuide] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);

  // 获取强制捐赠配置
  useEffect(() => {
    api.get('/api/manage/public-config').then((res) => {
      if (res.data.force_donate) {
        setForceDonate(true);
        setIsDonate(true);
      }
    }).catch(() => {});
  }, []);

  // 倒计时效果
  useEffect(() => {
    if (showGuide && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [showGuide, countdown]);

  const getAuthUrl = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.get('/api/oauth/auth-url', {
        params: {
          get_all_projects: false,
          for_antigravity: forAntigravity,
        },
      });
      setAuthUrl(res.data.auth_url);
      setShowGuide(true);
      setCountdown(8);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '获取认证链接失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuizAnswer = (correct) => {
    if (correct) {
      setQuizPassed(true);
      setShowQuiz(false);
      if (authUrl) {
        window.open(authUrl, '_blank');
      }
    } else {
      setMessage({ type: 'error', text: '❌ 答案错误，请仔细阅读操作指引！' });
    }
  };

  const handleGuideConfirm = () => {
    setShowGuide(false);
    setShowQuiz(true);
  };

  const submitCallbackUrl = async () => {
    if (!callbackUrl.trim()) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/api/oauth/from-callback-url', {
        callback_url: callbackUrl,
        is_public: isDonate,
        for_antigravity: forAntigravity,
      });
      const donateText = res.data.is_public ? '（已上传到公共池 🎉）' : '（私有凭证）';
      const typeText = forAntigravity ? ' [Antigravity]' : ' [Gemini]';
      setMessage({
        type: 'success',
        text: `凭证获取成功！邮箱: ${res.data.email}${typeText} ${donateText}`,
      });
      setCallbackUrl('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorText = typeof detail === 'string' ? detail : JSON.stringify(detail) || '获取凭证失败';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout
      maxWidth="4xl"
      backTo="/dashboard?tab=credentials"
      backLabel="返回凭证管理"
      subtitle="OAuth认证"
    >
      {/* 操作指引弹窗 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-dark-900 rounded-2xl max-w-md w-full p-8 border border-dark-700 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <Info size={24} />
                操作指引
              </h3>
              <button onClick={() => setShowGuide(false)} className="text-dark-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 text-dark-300 text-sm leading-relaxed">
              <p>接下来将跳转到 <strong className="text-white">Google 登录界面</strong>，请完成登录和授权。</p>
              
              <div className="bg-dark-950 p-4 rounded-xl border border-white/5">
                <p className="mb-2">授权后，浏览器会打开一个以 <span className="text-primary-400 font-mono">localhost</span> 开头的页面。</p>
                <p className="text-red-400 font-bold flex items-center gap-2">
                   ⚠️ 该页面显示“无法访问”是正常现象
                </p>
              </div>
              
              <p className="text-amber-300 font-medium">
                您需要做的：<span className="text-white">完整复制那个无法访问页面的网址</span>，然后回到这里粘贴。
              </p>
            </div>
            
            <Button
              onClick={handleGuideConfirm}
              disabled={countdown > 0}
              className="w-full mt-8"
              variant={countdown > 0 ? 'secondary' : 'primary'}
            >
              {countdown > 0 ? `请仔细阅读... (${countdown})` : '我已了解，继续'}
            </Button>
          </div>
        </div>
      )}

      {/* 快速问答弹窗 */}
      {showQuiz && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-dark-900 rounded-2xl max-w-md w-full p-8 border border-primary-500/30 shadow-2xl animate-slide-up">
            <h3 className="text-xl font-bold text-primary-400 mb-6 flex items-center gap-2">
               📝 操作确认
            </h3>

            <p className="text-dark-200 mb-8 font-medium">
              当你完成登录 Google 账号后，发现浏览器打开了一个无法访问的页面，你应该怎么做？
            </p>

            <button
              onClick={() => handleQuizAnswer(true)}
              className="w-full p-4 text-left rounded-xl border-2 border-primary-500 bg-primary-500/10 hover:bg-primary-500/20 text-white transition-all font-medium group"
            >
              <div className="flex items-center gap-3">
                 <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs">
                    <Check size={14} />
                 </div>
                 完整复制该网页链接并回到此页面粘贴
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 消息提示 */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-fade-in ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <Info size={20} />}
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* 凭证类型选择 */}
        <Card>
          <h2 className="text-lg font-semibold text-dark-50 mb-4">选择凭证类型</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setForAntigravity(false)}
              className={`p-5 rounded-xl border transition-all text-left group ${
                !forAntigravity
                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                  : 'border-dark-700 bg-dark-800/50 hover:bg-dark-800 hover:border-dark-600'
              }`}
            >
              <div className={`text-lg font-bold mb-2 transition-colors ${!forAntigravity ? 'text-blue-400' : 'text-dark-300 group-hover:text-dark-100'}`}>
                 🤖 Gemini API
              </div>
              <div className="text-sm text-dark-400">用于 Gemini 官方 API</div>
            </button>
            <button
              onClick={() => setForAntigravity(true)}
              className={`p-5 rounded-xl border transition-all text-left group ${
                forAntigravity
                  ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                  : 'border-dark-700 bg-dark-800/50 hover:bg-dark-800 hover:border-dark-600'
              }`}
            >
              <div className={`text-lg font-bold mb-2 transition-colors ${forAntigravity ? 'text-purple-400' : 'text-dark-300 group-hover:text-dark-100'}`}>
                 🚀 Antigravity
              </div>
              <div className="text-sm text-dark-400">用于 Antigravity 反代</div>
            </button>
          </div>
        </Card>

        {/* 步骤 1 */}
        <Card className="relative overflow-hidden">
           <div className="absolute top-0 right-0 p-3 opacity-5">
              <span className="text-9xl font-bold font-mono">1</span>
           </div>
          <h2 className="text-lg font-semibold text-dark-50 mb-6 flex items-center gap-3 relative z-10">
            <span className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 text-sm font-bold flex items-center justify-center border border-blue-500/30">1</span>
            登录并授权
          </h2>
          
          <Button
            onClick={getAuthUrl}
            disabled={loading}
            className="w-full py-4 text-lg"
            icon={loading ? RefreshCw : ExternalLink}
            loading={loading}
          >
            登录 Google 账号
          </Button>
          
          {quizPassed && (
            <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
              <Check size={16} />
              已通过验证，认证页面已在新窗口打开
            </div>
          )}
        </Card>

        {/* 步骤 2 */}
        <Card className="relative overflow-hidden">
           <div className="absolute top-0 right-0 p-3 opacity-5">
              <span className="text-9xl font-bold font-mono">2</span>
           </div>
          <h2 className="text-lg font-semibold text-dark-50 mb-6 flex items-center gap-3 relative z-10">
            <span className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold flex items-center justify-center border border-primary-500/30">2</span>
            粘贴回调 URL
          </h2>
          
          <div className="bg-dark-950 p-4 rounded-xl border border-white/5 mb-4 relative z-10">
             <p className="text-dark-400 text-sm leading-relaxed">
               请将浏览器地址栏中显示的那个<span className="text-red-400 mx-1">无法访问</span>页面的完整网址复制下来，并粘贴到下方。
             </p>
          </div>
          
          <input
            type="text"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            placeholder="在此处粘贴完整网址 (http://localhost:...)"
            className="w-full px-5 py-3 bg-dark-800/50 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all relative z-10"
          />
        </Card>

        {/* 步骤 3 */}
        <Card className="relative overflow-hidden">
           <div className="absolute top-0 right-0 p-3 opacity-5">
              <span className="text-9xl font-bold font-mono">3</span>
           </div>
          <h2 className="text-lg font-semibold text-dark-50 mb-6 flex items-center gap-3 relative z-10">
            <span className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 text-sm font-bold flex items-center justify-center border border-emerald-500/30">3</span>
            提交并生成凭证
          </h2>
          
          {/* 捐赠选项 */}
          {!forceDonate && (
            <label className="flex items-start gap-4 p-4 mb-6 bg-primary-500/5 border border-primary-500/20 rounded-xl cursor-pointer hover:bg-primary-500/10 transition-colors relative z-10 group">
              <input
                type="checkbox"
                checked={isDonate}
                onChange={(e) => setIsDonate(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-dark-600 bg-dark-800 text-primary-600 focus:ring-primary-500 focus:ring-offset-dark-900 accent-primary-500"
              />
              <div>
                <div className="text-primary-300 font-medium group-hover:text-primary-200 transition-colors">🎁 上传到公共池（推荐）</div>
                <p className="text-dark-400 text-sm mt-1">
                  上传后可使用所有公共凭证，还能获得额度奖励！
                </p>
              </div>
            </label>
          )}

          <Button
            onClick={submitCallbackUrl}
            disabled={submitting || !callbackUrl.trim()}
            variant="success"
            className="w-full py-4 text-lg relative z-10"
            icon={Key}
            loading={submitting}
          >
            提交并生成凭证
          </Button>
        </Card>
      </div>
    </PageLayout>
  );
}