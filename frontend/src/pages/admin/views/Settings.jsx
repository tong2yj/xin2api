import { useState } from 'react';
import SystemSettingsTab from '../SystemSettingsTab';
import OpenAIEndpointsTab from '../OpenAIEndpointsTab';
import { Settings as SettingsIcon, Globe } from 'lucide-react';
import { Button } from '../../../components/common/Button';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('system');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">系统设置</h2>
        <p className="text-dark-400">配置系统参数和外部服务</p>
      </div>

      {/* Internal Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        <Button
          variant="ghost"
          onClick={() => setActiveTab('system')}
          className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none transition-colors flex items-center gap-2 ${
            activeTab === 'system' 
              ? 'border-primary-500 text-primary-400 bg-white/5' 
              : 'border-transparent text-dark-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <SettingsIcon size={16} />
          系统配置
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab('openai')}
          className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none transition-colors flex items-center gap-2 ${
            activeTab === 'openai' 
              ? 'border-primary-500 text-primary-400 bg-white/5' 
              : 'border-transparent text-dark-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe size={16} />
          OpenAI 端点
        </Button>
      </div>

      <div className="pt-4">
        {activeTab === 'system' ? <SystemSettingsTab /> : <OpenAIEndpointsTab />}
      </div>
    </div>
  );
}