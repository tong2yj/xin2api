import {
  Activity,
  AlertTriangle,
  Globe,
  Key,
  RefreshCw,
  ScrollText,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '../../components/common/Button';
import { PageLayout } from '../../components/layout/PageLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import CredentialsTab from './CredentialsTab';
import ErrorsTab from './ErrorsTab';
import GlobalStatsTab from './GlobalStatsTab';
import LogsTab from './LogsTab';
import OpenAIEndpointsTab from './OpenAIEndpointsTab';
import SettingsTab from './SettingsTab';
import SystemSettingsTab from './SystemSettingsTab';
import UsersTab from './UsersTab';

const TABS = [
  { id: 'stats', label: '全局统计', icon: Activity },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'credentials', label: '凭证池', icon: Key },
  { id: 'logs', label: '使用日志', icon: ScrollText },
  { id: 'errors', label: '报错统计', icon: AlertTriangle },
  { id: 'endpoints', label: 'OpenAI端点', icon: Globe },
  { id: 'quota', label: '配额管理', icon: SettingsIcon },
  { id: 'system', label: '系统设置', icon: SettingsIcon },
];

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [refreshKey, setRefreshKey] = useState(0);

  // WebSocket 实时更新
  const handleWsMessage = useCallback((data) => {
    // 触发刷新
    if (['user_update', 'credential_update', 'log_update'].includes(data.type)) {
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'stats':
        return <GlobalStatsTab key={refreshKey} />;
      case 'users':
        return <UsersTab key={refreshKey} />;
      case 'credentials':
        return <CredentialsTab key={refreshKey} />;
      case 'logs':
        return <LogsTab key={refreshKey} />;
      case 'errors':
        return <ErrorsTab key={refreshKey} />;
      case 'endpoints':
        return <OpenAIEndpointsTab key={refreshKey} />;
      case 'quota':
        return <SettingsTab key={refreshKey} />;
      case 'system':
        return <SystemSettingsTab key={refreshKey} />;
      default:
        return null;
    }
  };

  const rightContent = (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleRefresh}
      icon={RefreshCw}
    >
      刷新
    </Button>
  );

  return (
    <PageLayout
      maxWidth="7xl"
      subtitle="管理后台"
      backTo="/dashboard"
      connected={connected}
      rightContent={rightContent}
    >
      {/* Tab 导航 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap border ${
              activeTab === t.id
                ? 'bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-500/20'
                : 'bg-dark-800 text-dark-400 border-transparent hover:text-dark-100 hover:bg-dark-700'
            }`}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 内容容器 */}
      <div className="animate-fade-in">
        {renderTab()}
      </div>
    </PageLayout>
  );
}