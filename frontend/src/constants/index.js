// 常量定义

// 凭证类型
export const CREDENTIAL_TYPES = {
  GEMINI_CLI: 'gemini_cli',
  OAUTH_ANTIGRAVITY: 'oauth_antigravity',
};

// 模型等级
export const MODEL_TIERS = {
  TIER_25: '2.5',
  TIER_30: '3',
};

// 账号类型
export const ACCOUNT_TYPES = {
  FREE: 'free',
  PRO: 'pro',
};

// Tab 配置
export const ADMIN_TABS = [
  { id: 'users', label: '用户管理', icon: 'Users' },
  { id: 'credentials', label: '凭证池', icon: 'Key' },
  { id: 'logs', label: '使用日志', icon: 'ScrollText' },
  { id: 'errors', label: '报错统计', icon: 'AlertTriangle' },
  { id: 'settings', label: '配额设置', icon: 'Settings' },
];

// 分页配置
export const PAGINATION = {
  USERS_PER_PAGE: 20,
  CREDENTIALS_PER_PAGE: 20,
  LOGS_PER_PAGE: 50,
};

// 错误码颜色映射
export const ERROR_CODE_COLORS = {
  429: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400' },
  401: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' },
  403: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' },
  500: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400' },
  default: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400' },
};
