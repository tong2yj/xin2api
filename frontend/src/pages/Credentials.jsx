import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Credentials() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard?tab=credentials', { replace: true });
  }, [navigate]);

  return null;
}