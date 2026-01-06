import { RefreshCw } from 'lucide-react';

/**
 * 通用按钮组件
 */
export function Button({
  children,
  variant = 'primary', // primary, secondary, danger, success, warning, ghost
  size = 'md', // sm, md, lg
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const variants = {
    // Primary: Violet, inner shadow for depth, glow on hover
    primary: 'bg-primary-600 hover:bg-primary-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-primary-500',
    // Secondary: Dark Zinc
    secondary: 'bg-dark-800 hover:bg-dark-700 text-dark-100 border border-dark-700/50',
    // Danger: Red
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-sm',
    // Success: Emerald
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
    // Warning: Amber
    warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm',
    // Info: Cyan (Used for Verify)
    info: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm',
    // Blue: Blue (Used for Export/OAuth)
    blue: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm',
    // Ghost: Transparent
    ghost: 'bg-transparent hover:bg-dark-800 text-dark-400 hover:text-dark-100',
    // Ghost Variations
    'ghost-primary': 'bg-transparent hover:bg-primary-500/10 text-dark-400 hover:text-primary-400',
    'ghost-danger': 'bg-transparent hover:bg-red-500/10 text-dark-400 hover:text-red-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5',
    lg: 'px-8 py-3.5 text-lg',
    icon: 'p-2 aspect-square',
    'icon-sm': 'p-1.5 aspect-square',
  };

  return (
    <button
      className={`
        relative overflow-hidden
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        rounded-xl font-medium transition-all duration-300 ease-out
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
        active:scale-[0.98]
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <RefreshCw size={size === 'sm' ? 14 : 18} className="animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'sm' || size === 'icon-sm' ? 14 : 18} />
      ) : null}
      {children && <span className="relative z-10 flex items-center gap-2">{children}</span>}
    </button>
  );
}

export default Button;