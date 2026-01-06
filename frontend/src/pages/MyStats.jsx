import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function MyStats() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard?tab=stats', { replace: true });
  }, [navigate]);

  return null;
}
