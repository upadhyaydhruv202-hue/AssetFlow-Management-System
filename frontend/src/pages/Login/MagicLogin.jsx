import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function MagicLogin() {
  const [params] = useSearchParams();
  const { magicLinkLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      toast.error('Invalid magic link');
      navigate('/login');
      return;
    }
    magicLinkLogin(token)
      .then(() => {
        toast.success('Signed in via magic link!');
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        toast.error('Magic link expired or invalid');
        navigate('/login');
      });
  }, [params, magicLinkLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}
