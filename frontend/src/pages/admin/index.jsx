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
import SystemSettingsTab from './SystemSettingsTab';
import UsersTab from './UsersTab';

export default function Admin() {
  const { user } = useAuth();
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

  const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
      <div className="p-2 bg-primary-500/10 rounded-lg text-primary-400">
        <Icon size={20} />
      </div>
      <h2 className="text-xl font-bold text-dark-50">{title}</h2>
    </div>
  );

  return (
    <PageLayout
      maxWidth="7xl"
      subtitle="管理后台"
      backTo="/dashboard"
      connected={connected}
      rightContent={rightContent}
    >
      <div className="space-y-8 animate-fade-in">
        {/* 全局统计 */}
        <section>
          <SectionHeader icon={Activity} title="全局统计" />
          <GlobalStatsTab key={`stats-${refreshKey}`} />
        </section>

        {/* 系统设置 */}
        <section>
          <SectionHeader icon={SettingsIcon} title="系统设置" />
          <div className="space-y-6">
             <SystemSettingsTab key={`system-${refreshKey}`} />
          </div>
        </section>

        {/* 凭证管理 */}
        <section>
           <SectionHeader icon={Key} title="凭证池" />
           <CredentialsTab key={`credentials-${refreshKey}`} />
        </section>

        {/* 用户管理 */}
        <section>
          <SectionHeader icon={Users} title="用户管理" />
          <UsersTab key={`users-${refreshKey}`} />
        </section>

        {/* OpenAI 端点 */}
        <section>
          <SectionHeader icon={Globe} title="OpenAI 端点" />
          <OpenAIEndpointsTab key={`endpoints-${refreshKey}`} />
        </section>

        {/* 报错统计 */}
        <section>
          <SectionHeader icon={AlertTriangle} title="报错统计" />
          <ErrorsTab key={`errors-${refreshKey}`} />
        </section>
        
        {/* 使用日志 */}
        <section>
          <SectionHeader icon={ScrollText} title="使用日志" />
          <LogsTab key={`logs-${refreshKey}`} />
        </section>
      </div>
    </PageLayout>
  );
}