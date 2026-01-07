import { useState } from 'react';
import LogsTab from '../LogsTab';
import ErrorsTab from '../ErrorsTab';
import { ScrollText, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/common/Button';

export default function Logs() {
  const [activeTab, setActiveTab] = useState('logs');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">日志与监控</h2>
        <p className="text-dark-400">查看系统访问日志和错误分析</p>
      </div>

      <div className="flex gap-2 border-b border-white/5">
        <Button
          variant="ghost"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none transition-colors flex items-center gap-2 ${
            activeTab === 'logs' 
              ? 'border-primary-500 text-primary-400 bg-white/5' 
              : 'border-transparent text-dark-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ScrollText size={16} />
          访问日志
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none transition-colors flex items-center gap-2 ${
            activeTab === 'errors' 
              ? 'border-primary-500 text-primary-400 bg-white/5' 
              : 'border-transparent text-dark-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <AlertTriangle size={16} />
          错误分析
        </Button>
      </div>

      <div className="pt-4">
        {activeTab === 'logs' ? <LogsTab /> : <ErrorsTab />}
      </div>
    </div>
  );
}