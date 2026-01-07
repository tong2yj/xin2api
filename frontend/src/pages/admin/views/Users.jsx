import UsersTab from '../UsersTab';

export default function Users() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">用户管理</h2>
        <p className="text-dark-400">管理系统用户、配额和权限</p>
      </div>
      <UsersTab />
    </div>
  );
}