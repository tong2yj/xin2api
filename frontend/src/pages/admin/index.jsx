import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loading } from '../../components/common/Loading';
import { AdminLayout } from './AdminLayout';

// 懒加载 Tab 组件
const UsersTab = lazy(() => import('./UsersTab'));
const LogsTab = lazy(() => import('./LogsTab'));
const ErrorsTab = lazy(() => import('./ErrorsTab'));
const SystemSettingsTab = lazy(() => import('./SystemSettingsTab'));
const GlobalStatsTab = lazy(() => import('./GlobalStatsTab'));
const OpenAIEndpointsTab = lazy(() => import('./OpenAIEndpointsTab'));

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'stats';

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UsersTab />;
      case 'endpoints':
        return <OpenAIEndpointsTab />;
      case 'logs':
        return <LogsTab />;
      case 'errors':
        return <ErrorsTab />;
      case 'settings':
        return <SystemSettingsTab />;
      case 'stats':
      default:
        return <GlobalStatsTab />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={handleTabChange}>
      <Suspense fallback={<Loading />}>
        {renderContent()}
      </Suspense>
    </AdminLayout>
  );
}
