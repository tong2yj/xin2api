import { LogOut, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from './Navbar';
import { Button } from '../common/Button';

/**
 * 页面布局组件
 */
export function PageLayout({
  children,
  subtitle,
  backTo = '/dashboard',
  backLabel = '返回',
  showAdminLinks = false,
  maxWidth = '4xl', // 4xl, 7xl, full
  connected = false,
}) {
  const { user, logout } = useAuth();

  const maxWidthClass = {
    '4xl': 'max-w-4xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }[maxWidth] || 'max-w-4xl';

  const rightContent = (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="text-dark-300 text-sm hidden sm:inline font-medium">
        {user?.username}
      </span>
      <Button
        variant="danger"
        size="sm"
        onClick={logout}
        className="!rounded-lg !py-1.5 !px-3"
      >
        <LogOut size={14} className="mr-1.5" />
        <span className="hidden sm:inline">退出</span>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-main relative selection:bg-primary-500/30 selection:text-primary-200">
      {/* 背景光斑 (Blob) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-900/10 rounded-[100%] blur-[100px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[400px] bg-blue-900/5 rounded-[100%] blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          subtitle={subtitle}
          backTo={backTo}
          backLabel={backLabel}
          rightContent={rightContent}
          connected={connected}
        />

        {/* 管理员链接栏 */}
        {showAdminLinks && user?.is_admin && (
          <div className="bg-bg-main/95 border-b border-white/5 backdrop-blur-sm sticky top-16 z-40">
            <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8`}>
              <div className="flex items-center gap-1 py-2 overflow-x-auto no-scrollbar">
                <AdminLink to="/admin" icon={Settings} label="管理后台" />
              </div>
            </div>
          </div>
        )}

        <main className={`${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 animate-fade-in`}>
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-dark-400 hover:text-primary-300 hover:bg-white/5 transition-all whitespace-nowrap"
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export default PageLayout;