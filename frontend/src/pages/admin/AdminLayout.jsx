import {
  LayoutDashboard,
  Users,
  Server,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  ChevronRight,
  Home
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';

export function AdminLayout({ children, activeTab, onTabChange }) {
  const { logout, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'stats', label: '概览', icon: LayoutDashboard },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'endpoints', label: 'OpenAI端点', icon: Server },
    { id: 'logs', label: '日志与监控', icon: ScrollText },
    { id: 'errors', label: '错误统计', icon: ScrollText },
    { id: 'settings', label: '系统设置', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex font-sans text-dark-50">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-dark-900 border-r border-white/5
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo / Header */}
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">
              A
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">管理后台</h1>
              <p className="text-xs text-dark-400">Gemini CLI Proxy</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                    ${isActive 
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' 
                      : 'text-dark-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <Icon size={20} className={isActive ? 'text-white' : 'text-dark-400 group-hover:text-white transition-colors'} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto opacity-50" />}
                </button>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-white/5 bg-dark-900/50">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-dark-800 border border-white/10 flex items-center justify-center text-dark-300 font-medium">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-dark-400 truncate">管理员</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Mobile Header */}
        <header className="lg:hidden h-16 border-b border-white/5 flex items-center justify-between px-4 bg-dark-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-dark-400 hover:text-white"
            >
              <Menu size={24} />
            </button>
            <span className="font-bold">管理后台</span>
          </div>
          {/* Mobile Top Right Buttons */}
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="!p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                icon={Home}
              />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="!p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              icon={LogOut}
              onClick={logout}
            />
          </div>
        </header>

        {/* Desktop Top Right Buttons */}
        <div className="hidden lg:flex items-center justify-end gap-3 px-8 py-4 border-b border-white/5 bg-dark-900/50">
          <span className="text-sm text-dark-400 mr-2">{user?.username}</span>
          <Link to="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
              icon={Home}
            >
              返回主页
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            icon={LogOut}
            onClick={logout}
          >
            退出登录
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-dark-950 scroll-smooth">
          <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
