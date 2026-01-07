import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import Overview from './views/Overview';
import Users from './views/Users';
import Credentials from './views/Credentials';
import Logs from './views/Logs';
import Settings from './views/Settings';

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <Users />;
      case 'credentials':
        return <Credentials />;
      case 'logs':
        return <Logs />;
      case 'settings':
        return <Settings />;
      case 'overview':
      default:
        return <Overview />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderContent()}
    </AdminLayout>
  );
}
