import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Boxes, Eye, EyeOff, Fingerprint, Mail, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/Forms/FormElements';
import api from '../../services/api';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import { isPasskeySupported, loginWithPasskey } from '../../utils/passkey';
import GoogleSignInButton from '../../components/GoogleSignInButton';

export default function Login() {
  const { login, completeMfaLogin, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', otp: '' });
  const [submitting, setSubmitting] = useState(false);
  const [mfaState, setMfaState] = useState(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [devInfo, setDevInfo] = useState(null);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const fp = getDeviceFingerprint();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        const { data } = await api.post('/auth/forgot-password', { email: form.email });
        if (data.data?.devResetLink) {
          setDevInfo({ type: 'reset', link: data.data.devResetLink });
          toast.success('Reset link generated (dev mode)');
        } else {
          toast.success('Reset link sent if email exists');
          setMode('login');
        }
      } else if (mode === 'magic') {
        const { data } = await api.post('/auth/magic-link/request', { email: form.email });
        if (data.data?.devMagicLink) {
          setDevInfo({ type: 'magic', link: data.data.devMagicLink });
          toast.success('Magic link generated (dev mode)');
        } else {
          toast.success('Magic link sent if email exists');
        }
      } else if (mode === 'mfa') {
        await completeMfaLogin(mfaState.userId, form.otp, {
          trustDevice,
          deviceFingerprint: fp,
          deviceName: navigator.userAgent.slice(0, 50),
        });
        toast.success('Verified!');
        navigate('/dashboard', { replace: true });
      } else if (mode === 'signup') {
        await api.post('/auth/signup', form);
        const result = await login(form.email.trim(), form.password, { deviceFingerprint: fp });
        if (result?.mfaRequired) {
          setMfaState(result);
          setMode('mfa');
          if (result.devOtp) setDevInfo({ type: 'otp', code: result.devOtp });
        } else {
          toast.success('Account created!');
          navigate('/dashboard', { replace: true });
        }
      } else {
        const result = await login(form.email.trim(), form.password, {
          deviceFingerprint: fp,
          trustDevice,
          deviceName: navigator.userAgent.slice(0, 50),
        });
        if (result?.mfaRequired) {
          setMfaState(result);
          setMode('mfa');
          if (result.devOtp) setDevInfo({ type: 'otp', code: result.devOtp });
          toast(result.devOtp ? 'Use the verification code shown below' : 'OTP sent to your email', { icon: '🛡️' });
        } else {
          toast.success('Welcome back!');
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setSubmitting(true);
    try {
      if (!(await isPasskeySupported())) {
        toast.error('WebAuthn is not supported in this browser. Use Chrome or Edge on Windows.');
        return;
      }
      if (!form.email.trim()) {
        toast.error('Enter your email address first, then click Sign in with Passkey');
        return;
      }
      const result = await loginWithPasskey(api, form.email);
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      toast.success('Signed in with Windows Hello!');
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Passkey login failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = useCallback((data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    toast.success('Signed in with Google!');
    window.location.href = '/dashboard';
  }, []);

  const handleGoogleError = useCallback((message) => {
    toast.error(message);
  }, []);

  const titles = { login: 'Sign In', signup: 'Create Account', forgot: 'Reset Password', magic: 'Magic Link', mfa: 'Verify Identity' };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-br from-primary-600 to-primary-900 lg:flex lg:flex-col lg:justify-center lg:p-12">
        <Boxes className="mb-6 h-16 w-16 text-white" />
        <h1 className="text-4xl font-bold text-white">AssetFlow</h1>
        <p className="mt-4 text-lg text-primary-100">Enterprise Asset & Resource Management with AI-powered insights and adaptive security.</p>
        <ul className="mt-8 space-y-3 text-primary-100">
          <li>• Adaptive MFA & passkey authentication</li>
          <li>• AI recommendations & predictive analytics</li>
          <li>• Digital twin asset profiles</li>
          <li>• Real-time dashboard & security alerts</li>
        </ul>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-2xl font-bold">{titles[mode]}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {mode === 'mfa' ? 'Enter the verification code' : mode === 'magic' ? 'We will email you a secure one-time link' : 'Secure enterprise access'}
          </p>

          {devInfo && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Development mode — email not configured</p>
              {devInfo.type === 'otp' && (
                <p className="mt-2">Your verification code: <span className="text-xl font-bold tracking-widest">{devInfo.code}</span></p>
              )}
              {(devInfo.type === 'magic' || devInfo.type === 'reset') && (
                <a href={devInfo.link} className="mt-2 block break-all text-primary-600 underline">{devInfo.link}</a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="First Name" name="firstName" value={form.firstName} onChange={handleChange} required />
                  <Input label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} required />
                </div>
                <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
              </>
            )}
            {mode !== 'mfa' && <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} required />}
            {mode === 'mfa' && <Input label="Verification Code" name="otp" value={form.otp} onChange={handleChange} required />}
            {(mode === 'login' || mode === 'signup') && (
              <div className="relative">
                <Input label="Password" name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-8 text-gray-400">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
            {mode === 'login' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
                Trust this device (reduce MFA prompts)
              </label>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Please wait...' : mode === 'mfa' ? 'Verify' : mode === 'magic' ? 'Send Magic Link' : mode === 'forgot' ? 'Send Reset Link' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-500 dark:bg-gray-950">or continue with</span></div>
              </div>
              <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
              {mode === 'login' && (
                <>
                  <Button type="button" variant="secondary" className="w-full" onClick={handlePasskeyLogin} disabled={submitting}>
                    <Fingerprint className="h-4 w-4" /> Sign in with Passkey (Windows Hello)
                  </Button>
                  <p className="text-center text-xs text-gray-500">Enter your email above, then use Windows Hello PIN or fingerprint</p>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('magic')}>
                    <Mail className="h-4 w-4" /> Magic Link Login
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === 'login' && <button onClick={() => setMode('forgot')} className="text-primary-600 hover:underline">Forgot password?</button>}
            {mode !== 'login' && mode !== 'signup' && (
              <button onClick={() => setMode('login')} className="text-primary-600 hover:underline">Back to login</button>
            )}
            {(mode === 'login' || mode === 'signup') && (
              <p>
                {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="font-medium text-primary-600 hover:underline">
                  {mode === 'signup' ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            )}
          </div>

          {mode === 'login' && (
            <div className="mt-8 rounded-lg bg-gray-50 p-4 text-xs text-gray-500 dark:bg-gray-800">
              <p className="flex items-center gap-1 font-medium"><Shield className="h-3 w-3" /> Demo Accounts:</p>
              <p>admin@assetflow.com / Admin@123</p>
              <p>employee@assetflow.com / Employee@123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
