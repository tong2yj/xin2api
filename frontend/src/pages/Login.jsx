import { Cat, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../App';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { username, password });
      login(res.data.access_token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-main relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary-500/10 mb-6 border border-primary-500/20 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <Cat className="w-10 h-10 text-primary-400" />
          </div>
          <h1 className="text-4xl font-bold text-dark-50 tracking-tight">
            Catiecli
          </h1>
          <p className="text-dark-400 mt-3 text-lg">
            Gemini API 多用户代理服务
          </p>
        </div>

        {/* 登录卡片 */}
        <Card className="shadow-2xl shadow-black/50 backdrop-blur-sm bg-bg-card/80 border-white/5">
          <h2 className="text-xl font-semibold mb-8 text-center text-dark-100">
            欢迎回来
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2 ml-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3 bg-dark-800/50 border border-transparent rounded-xl text-dark-50 placeholder-dark-500 focus:bg-dark-800 focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 outline-none"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2 ml-1">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-dark-800/50 border border-transparent rounded-xl text-dark-50 placeholder-dark-500 focus:bg-dark-800 focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 outline-none pr-12"
                  placeholder="请输入密码"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 !text-dark-500 hover:!text-dark-300 rounded-lg"
                  icon={showPassword ? EyeOff : Eye}
                />
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full py-3.5 text-lg shadow-lg shadow-primary-500/20"
            >
              登录
            </Button>
          </form>

          <p className="text-center text-dark-400 mt-8 text-sm">
            还没有账号？{' '}
            <Link
              to="/register"
              className="text-primary-400 hover:text-primary-300 font-medium hover:underline underline-offset-4 transition-all"
            >
              立即注册
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}