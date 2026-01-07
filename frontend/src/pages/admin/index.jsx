import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import UsersTab from './UsersTab';
import CredentialsTab from './CredentialsTab';
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
      case 'credentials':
        return <CredentialsTab />;
      case 'logs':
        return <LogsTab />;
      case 'errors':
        return <ErrorsTab />;
      case 'settings':
        return <SystemSettingsTab />;
      case 'endpoints':
        return <OpenAIEndpointsTab />;
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
