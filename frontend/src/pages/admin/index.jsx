import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import UsersTab from './UsersTab';
import LogsTab from './LogsTab';
import ErrorsTab from './ErrorsTab';
import SystemSettingsTab from './SystemSettingsTab';
import GlobalStatsTab from './GlobalStatsTab';
import OpenAIEndpointsTab from './OpenAIEndpointsTab';

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
      {renderContent()}
    </AdminLayout>
  );
}
