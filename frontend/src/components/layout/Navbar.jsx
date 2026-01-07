import { ArrowLeft, Cat } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * 通用导航栏组件
 */
export function Navbar({
  title = 'Catie开心版',
  subtitle,
  backTo,
  backLabel = '返回',
  rightContent,
  showLogo = true,
  connected = false,
}) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-bg-main/80 backdrop-blur-md border-b border-white/5 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {showLogo && (
              <div className="p-1.5 bg-primary-500/10 rounded-lg">
                <Cat className="w-6 h-6 text-primary-400" />
              </div>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-bold text-dark-50 tracking-tight">
                {title}
              </span>
              {subtitle && (
                <span className="text-xs font-medium text-primary-300 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-full">
                  {subtitle}
                </span>
              )}
            </div>
            {connected && (
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                  Live
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {rightContent}
            {backTo && (
              <Link
                to={backTo}
                className="group flex items-center gap-2 text-sm font-medium text-dark-400 hover:text-dark-50 transition-colors"
              >
                <div className="p-1 rounded-md group-hover:bg-dark-800 transition-colors">
                  <ArrowLeft size={18} />
                </div>
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;