import { RefreshCw } from 'lucide-react';

/**
 * 加载状态组件
 */
export function Loading({ text = '加载中...', size = 'md', className = '' }) {
  const sizes = {
    sm: { icon: 16, text: 'text-sm' },
    md: { icon: 24, text: 'text-base' },
    lg: { icon: 32, text: 'text-lg' },
  };

  const { icon, text: textSize } = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col items-center justify-center py-8 text-gray-400 ${className}`}>
      <RefreshCw size={icon} className="animate-spin mb-2" />
      <span className={textSize}>{text}</span>
    </div>
  );
}

/**
 * 全屏加载
 */
export function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );
}

/**
 * 骨架屏
 */
export function Skeleton({ className = '', width, height }) {
  return (
    <div
      className={`bg-dark-700 animate-pulse rounded ${className}`}
      style={{ width, height }}
    />
  );
}

export default Loading;
