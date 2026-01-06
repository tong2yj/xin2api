import { BarChart2, Key, Shield, User } from 'lucide-react';
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

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 items-start">
        {/* Sidebar */}
        <div className="sticky top-24 space-y-2">
          {/* User Profile Mini Card */}
          <div className="bg-bg-card rounded-2xl p-4 border border-white/5 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-dark-50 truncate">
                {user?.discord_name || user?.username}
              </div>
              <div className="text-xs text-dark-400 truncate">
                {user?.is_admin ? '管理员' : '普通用户'}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              if (item.link) {
                return (
                  <a
                    key={item.id}
                    href={item.link}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-dark-400 hover:text-dark-50 hover:bg-white/5"
                  >
                    <item.icon size={18} />
                    <div className="text-sm font-medium">{item.label}</div>
                  </a>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left group ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                      : 'text-dark-400 hover:text-dark-50 hover:bg-white/5'
                  }`}
                >
                  <item.icon
                    size={18}
                    className={isActive ? 'text-white' : 'group-hover:text-primary-400 transition-colors'}
                  />
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    {isActive && (
                      <div className="text-[10px] opacity-80 font-normal">
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