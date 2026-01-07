import { Check, Key, Trash2, X, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '../../api/index';
import { Button } from '../../components/common/Button';
import { Pagination } from '../../components/common/Pagination';
import { ConfirmModal, InputModal, QuotaModal, AlertModal } from '../../components/modals/Modal';
import { useToast } from '../../contexts/ToastContext';

const USERS_PER_PAGE = 20;

export default function UsersTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ field: 'id', order: 'asc' });
  const [page, setPage] = useState(1);

  // 模态框状态
  const [quotaModal, setQuotaModal] = useState({ open: false, userId: null, defaultValues: {} });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false });
  const [inputModal, setInputModal] = useState({ open: false, title: '', label: '', defaultValue: '', onSubmit: null });
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });

  const showAlert = (title, message, type = 'info') => setAlertModal({ open: true, title, message, type });
  const showConfirm = (title, message, onConfirm, danger = false) => setConfirmModal({ open: true, title, message, onConfirm, danger });
  const showInput = (title, label, defaultValue, onSubmit) => setInputModal({ open: true, title, label, defaultValue, onSubmit });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data.users);
    } catch (err) {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 处理用户列表：搜索 -> 排序 -> 分页
  const processedUsers = useMemo(() => {
    let result = [...users];
    // 搜索
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.username?.toLowerCase().includes(s) ||
          String(u.id).includes(s)
      );
    }
    // 排序
    result.sort((a, b) => {
      let aVal = a[sort.field];
      let bVal = b[sort.field];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [users, search, sort]);

  const totalPages = Math.ceil(processedUsers.length / USERS_PER_PAGE);
  const paginatedUsers = processedUsers.slice(
    (page - 1) * USERS_PER_PAGE,
    page * USERS_PER_PAGE
  );

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  // 用户操作
  const toggleUserActive = async (userId, isActive) => {
    try {
      await api.put(`/api/admin/users/${userId}`, { is_active: !isActive });
      fetchUsers();
    } catch (err) {
      toast.error('用户状态更新失败');
    }
  };

  const toggleUserApproved = async (userId, isApproved) => {
    try {
      await api.put(`/api/admin/users/${userId}`, { is_approved: !isApproved });
      toast.success(isApproved ? '已取消审核' : '审核通过');
      fetchUsers();
    } catch (err) {
      toast.error('审核状态更新失败');
    }
  };

  const updateUserQuota = (userId, user) => {
    setQuotaModal({
      open: true,
      userId,
      defaultValues: {
        daily_quota: user.daily_quota || 0,
      },
    });
  };

  const handleQuotaSubmit = async (values) => {
    try {
      await api.put(`/api/admin/users/${quotaModal.userId}`, values);
      fetchUsers();
      toast.success('配额已更新');
    } catch (err) {
      toast.error('配额更新失败');
    }
  };

  const deleteUser = (userId) => {
    showConfirm(
      '删除用户',
      '确定删除此用户？此操作不可恢复！\n\n注意：将同时删除该用户的所有凭证！',
      async () => {
        try {
          await api.delete(`/api/admin/users/${userId}`);
          fetchUsers();
          toast.success('用户已删除');
        } catch (err) {
          toast.error(err.response?.data?.detail || '删除用户失败');
        }
      },
      true
    );
  };

  const resetUserPassword = (userId, username) => {
    showInput('重置密码', `为用户 ${username} 设置新密码`, '', async (newPassword) => {
      if (!newPassword || newPassword.length < 6) {
        toast.error('密码长度至少6位');
        return;
      }
      try {
        await api.put(`/api/admin/users/${userId}/password`, { new_password: newPassword });
        toast.success(`用户 ${username} 的密码已重置`);
      } catch (err) {
        toast.error(err.response?.data?.detail || '密码重置失败');
      }
    });
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 搜索和工具栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-800/20 p-4 rounded-xl border border-white/5">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="搜索用户名..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-4 pr-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-primary-500/50 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-dark-400">
            <span className="px-2 py-1 bg-dark-800 rounded-md border border-white/5">
              共 <span className="text-primary-400 font-bold">{processedUsers.length}</span> 个用户
            </span>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="!py-1 !px-2 h-auto text-[10px]">
                重置筛选
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 这里可以放置未来的全局操作，如导出用户列表 */}
          <Button variant="secondary" size="sm" onClick={fetchUsers} icon={RefreshCw}>
            刷新列表
          </Button>
        </div>
      </div>

      {/* 用户表格 */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th
                className="cursor-pointer hover:text-purple-400"
                onClick={() => handleSort('id')}
              >
                ID {sort.field === 'id' && (sort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer hover:text-purple-400"
                onClick={() => handleSort('username')}
              >
                用户名 {sort.field === 'username' && (sort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer hover:text-purple-400"
                onClick={() => handleSort('daily_quota')}
              >
                配额 {sort.field === 'daily_quota' && (sort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer hover:text-purple-400"
                onClick={() => handleSort('today_usage')}
              >
                今日使用 {sort.field === 'today_usage' && (sort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer hover:text-purple-400"
                onClick={() => handleSort('credential_count')}
              >
                凭证数 {sort.field === 'credential_count' && (sort.order === 'asc' ? '↑' : '↓')}
              </th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((u) => (
              <tr key={u.id}>
                <td className="text-gray-400">{u.id}</td>
                <td>
                  {u.username}
                  {u.is_admin && (
                    <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                      管理员
                    </span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => updateUserQuota(u.id, u)}
                    className="text-purple-400 hover:underline"
                  >
                    {u.daily_quota}
                  </button>
                </td>
                <td>{u.today_usage}</td>
                <td className={u.credential_count > 0 ? 'text-green-400' : 'text-gray-500'}>
                  {u.credential_count || 0}
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className={u.is_active ? 'text-green-400' : 'text-red-400'}>
                      {u.is_active ? '活跃' : '禁用'}
                    </span>
                    {!u.is_admin && (
                      <span className={u.is_approved ? 'text-blue-400 text-xs' : 'text-yellow-400 text-xs'}>
                        {u.is_approved ? '已审核' : '待审核'}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    {!u.is_admin && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleUserApproved(u.id, u.is_approved)}
                        className={u.is_approved ? '!text-yellow-400 hover:!bg-yellow-500/10' : '!text-blue-400 hover:!bg-blue-500/10'}
                        title={u.is_approved ? '取消审核' : '审核通过'}
                        icon={u.is_approved ? UserX : UserCheck}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleUserActive(u.id, u.is_active)}
                      className={u.is_active ? '!text-red-400 hover:!bg-red-500/10' : '!text-green-400 hover:!bg-green-500/10'}
                      title={u.is_active ? '禁用' : '启用'}
                      icon={u.is_active ? X : Check}
                    />
                    <Button
                      variant="ghost-primary"
                      size="icon-sm"
                      onClick={() => resetUserPassword(u.id, u.username)}
                      title="重置密码"
                      icon={Key}
                    />
                    <Button
                      variant="ghost-danger"
                      size="icon-sm"
                      onClick={() => deleteUser(u.id)}
                      title="删除"
                      icon={Trash2}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* 模态框 */}
      <QuotaModal
        isOpen={quotaModal.open}
        onClose={() => setQuotaModal({ open: false, userId: null, defaultValues: {} })}
        onSubmit={handleQuotaSubmit}
        title="设置用户配额"
        defaultValues={quotaModal.defaultValues}
      />

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />

      <InputModal
        isOpen={inputModal.open}
        onClose={() => setInputModal({ ...inputModal, open: false })}
        onSubmit={inputModal.onSubmit}
        title={inputModal.title}
        label={inputModal.label}
        defaultValue={inputModal.defaultValue}
        type="password"
      />

      <AlertModal
        isOpen={alertModal.open}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
