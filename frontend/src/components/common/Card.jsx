/**
 * 通用卡片组件
 */
export function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`
        bg-bg-card rounded-2xl
        ${padding ? 'p-6 sm:p-8' : ''}
        transition-all duration-300 ease-out
        sm:hover:-translate-y-1 sm:hover:shadow-2xl sm:hover:shadow-black/20
        border border-white/5
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * 卡片标题
 */
export function CardHeader({ children, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-dark-50 flex items-center gap-2.5">
        {Icon && <Icon className="w-5 h-5 text-primary-400" />}
        {children}
      </h3>
      {action}
    </div>
  );
}

export default Card;