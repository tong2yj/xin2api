import { BarChart2, Key, Shield, User, AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/index';
import { Card } from '../../components/common/Card';
import { PageLayout } from '../../components/layout/PageLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import ApiKeyTab from './ApiKeyTab';
import CredentialsTab from './CredentialsTab';
import StatsTab from './StatsTab';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userInfo, setUserInfo] = useState(null);
  const [oauthMessage, setOauthMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('credentials');
  const [forceDonate, setForceDonate] = useState(false);
  const [rpmConfig, setRpmConfig] = useState({ base: 5, contributor: 10 });

  // Fetch configs
  useEffect(() => {
    api.get('/api/manage/public-config').then((res) => {
      setForceDonate(res.data.force_donate || false);
      setRpmConfig({
        base: res.data.base_rpm || 5,
        contributor: res.data.contributor_rpm || 10,
      });
    }).catch(() => {});
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (oauth === 'success') {
      setOauthMessage({ type: 'success', text: '🎉 凭证上传成功！' });
      setSearchParams({});
    } else if (oauth === 'error') {
      const msg = searchParams.get('msg') || '未知错误';
      setOauthMessage({ type: 'error', text: `凭证获取失败: ${msg}` });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // WebSocket updates
  const handleWsMessage = useCallback((data) => {
    if (data.type === 'stats_update' || data.type === 'log_update') {
      api.get('/api/auth/me').then((res) => setUserInfo(res.data)).catch(() => {});
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  useEffect(() => {
    api.get('/api/auth/me').then((res) => setUserInfo(res.data)).catch(() => {});
  }, []);

  // Handle URL params for tabs
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'credentials') setActiveTab('credentials');
    else if (tab === 'apikey') setActiveTab('apikey');
    else if (tab === 'stats') setActiveTab('stats');
  }, [searchParams]);

  const sidebarItems = [
    {
      id: 'credentials',
      label: '凭证管理',
      icon: Shield,
      desc: '管理您的账号凭证',
    },
    {
      id: 'apikey',
      label: 'API 密钥',
      icon: Key,
      desc: '连接 API 的访问密钥',
    },
    {
      id: 'stats',
      label: '个人统计',
      icon: BarChart2,
      desc: '查看您的调用数据',
    },
  ];

  return (
    <PageLayout
      maxWidth="7xl"
      connected={connected}
      showAdminLinks
      subtitle="控制台"
    >
      {/* OAuth Message */}
      {oauthMessage && (
        <div className="mb-8 animate-fade-in">
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              oauthMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <span className="font-medium">{oauthMessage.text}</span>
            <button
              onClick={() => setOauthMessage(null)}
              className="text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Account Not Approved Warning */}
      {userInfo && !userInfo.is_approved && !user?.is_admin && (
        <div className="mb-8 animate-fade-in">
          <div className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/20 text-yellow-400 flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium mb-1">账号未激活</div>
              <div className="text-sm text-yellow-400/80">
                您的账号正在等待管理员审核，审核通过后即可使用 API 服务。请耐心等待。
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 md:gap-8 items-start">
        {/* Sidebar / Mobile Nav */}
        <div className={`sticky ${user?.is_admin ? 'top-[7.5rem]' : 'top-16'} md:top-24 z-40 bg-bg-main/95 backdrop-blur md:bg-transparent -mx-4 px-4 py-2 md:p-0 md:mx-0 border-b border-white/5 md:border-none space-y-2`}>
          {/* User Profile Mini Card (Hidden on Mobile, or compacted) */}
          <div className="hidden md:flex bg-bg-card rounded-2xl p-4 border border-white/5 mb-6 items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-dark-50 truncate">
                {user?.username}
              </div>
              <div className="text-xs text-dark-400 truncate">
                {user?.is_admin ? '管理员' : '普通用户'}
              </div>
            </div>
          </div>

          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              // Common classes
              const baseClasses = `
                flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-full md:rounded-xl 
                transition-all duration-200 whitespace-nowrap text-sm font-medium
              `;
              const activeClasses = `
                bg-primary-600 text-white shadow-lg shadow-primary-500/20
              `;
              const inactiveClasses = `
                text-dark-400 hover:text-dark-50 hover:bg-white/5 bg-dark-800/50 md:bg-transparent border border-white/5 md:border-transparent
              `;

              if (item.link) {
                return (
                  <a
                    key={item.id}
                    href={item.link}
                    className={`${baseClasses} ${inactiveClasses}`}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </a>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} group text-left`}
                >
                  <item.icon
                    size={18}
                    className={isActive ? 'text-white' : 'group-hover:text-primary-400 transition-colors'}
                  />
                  <div>
                    <span>{item.label}</span>
                    {/* Desc hidden on mobile, shown on desktop only if active (or always? design choice) - keeping hidden for cleaner pill look on mobile */}
                    {isActive && (
                      <div className="hidden md:block text-[10px] opacity-80 font-normal mt-0.5">
                        {item.desc}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="min-w-0 animate-fade-in">
          {activeTab === 'credentials' && (
            <div className="space-y-6">
              <CredentialsTab forceDonate={forceDonate} />
            </div>
          )}

          {activeTab === 'apikey' && (
            <Card className="animate-slide-up">
              <ApiKeyTab userInfo={userInfo} rpmConfig={rpmConfig} />
            </Card>
          )}

          {activeTab === 'stats' && (
             <div className="space-y-6 animate-slide-up">
               <StatsTab />
             </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}