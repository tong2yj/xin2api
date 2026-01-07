import GlobalStatsTab from '../GlobalStatsTab';

export default function Overview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">概览</h2>
        <p className="text-dark-400">系统运行状态监控</p>
      </div>
      <GlobalStatsTab />
    </div>
  );
}