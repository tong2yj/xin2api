import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Announcement from './components/Announcement';
import { FullPageLoading } from './components/common/Loading';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// 页面导入
import Admin from './pages/admin/index';
import Dashboard from './pages/dashboard/index';
import Login from './pages/Login';
import OAuth from './pages/OAuth';
import Register from './pages/Register';

// 保留旧的导出以保持兼容性
export { AuthContext, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageLoading />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !user.is_admin) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/oauth"
        element={
          <ProtectedRoute>
            <OAuth />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Announcement />
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;