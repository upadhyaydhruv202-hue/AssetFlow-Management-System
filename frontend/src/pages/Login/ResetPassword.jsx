import { useState } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button, Input } from '../../components/Forms/FormElements';
import { useAuth } from '../../context/AuthContext';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;
  if (!token) return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password reset successful');
      window.location.href = '/login';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-2xl font-bold">Reset Password</h2>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Saving...' : 'Reset Password'}</Button>
        </form>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary-600 hover:underline">Back to login</Link>
      </div>
    </div>
  );
}
