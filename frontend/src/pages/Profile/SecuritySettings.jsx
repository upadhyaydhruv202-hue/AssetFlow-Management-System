import { useEffect, useState } from 'react';
import { Fingerprint, Monitor, Shield, Trash2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { PageHeader, Button } from '../../components/Forms/FormElements';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { registerPasskey as registerWebAuthnPasskey, isPasskeySupported, hasPlatformAuthenticator } from '../../utils/passkey';

export default function SecuritySettings() {
  const { user, hasRole } = useAuth();
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [passkeys, setPasskeys] = useState([]);
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  const load = () => {
    api.get('/auth/devices').then(({ data }) => setDevices(data.data));
    api.get('/auth/security-events').then(({ data }) => setEvents(data.data));
    api.get('/auth/passkeys').then(({ data }) => setPasskeys(data.data));
    if (hasRole('ADMIN')) {
      api.get('/security/domains').then(({ data }) => setDomains(data.data));
      api.get('/security/email/status').then(({ data }) => setEmailStatus(data.data)).catch(() => {});
    }
  };

  useEffect(() => { load(); }, [hasRole]);

  const revokeDevice = async (id) => {
    await api.delete(`/auth/devices/${id}`);
    toast.success('Device revoked');
    load();
  };

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
    try {
      if (!(await isPasskeySupported())) {
        toast.error('WebAuthn is not supported in this browser. Use Chrome or Edge on Windows.');
        return;
      }
      const hasPlatform = await hasPlatformAuthenticator();
      if (!hasPlatform) {
        toast('Windows Hello was not detected, but trying registration anyway...', { icon: 'ℹ️' });
      }
      await registerWebAuthnPasskey(api);
      toast.success('Passkey registered with Windows Hello');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to register passkey');
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const removePasskey = async (id) => {
    await api.delete(`/auth/passkey/${id}`);
    toast.success('Passkey removed');
    load();
  };

  const addDomain = async () => {
    await api.post('/security/domains', { domain: newDomain });
    setNewDomain('');
    toast.success('Domain added');
    load();
  };

  const sendTestEmail = async () => {
    try {
      const { data } = await api.post('/security/email/test', { email: user.email });
      toast.success(`Test email sent to ${data.data.sentTo}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test email');
    }
  };

  return (
    <div>
      <PageHeader title="Security Settings" subtitle="Manage devices, passkeys, and authentication" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold"><Fingerprint className="h-5 w-5" /> Passkeys (Windows Hello)</h3>
            <Button size="sm" onClick={handleRegisterPasskey} disabled={registeringPasskey}>
              {registeringPasskey ? 'Waiting for Windows Hello...' : 'Register Passkey'}
            </Button>
          </div>
          <p className="mb-3 text-xs text-gray-500">Register a passkey on this Windows PC using PIN or fingerprint. Phone passkeys are not used.</p>
          {passkeys.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">No Windows Hello passkey yet</p>
              <p className="mt-1">Click <strong>Register Passkey</strong> above. Windows Hello will ask for your PIN or fingerprint. After that, you can sign in from the login page using the same email.</p>
            </div>
          ) : passkeys.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-2 text-sm dark:border-gray-700">
              <div>
                <p className="font-medium">{p.deviceName || 'Passkey'}</p>
                <p className="text-xs text-gray-500">Added {format(new Date(p.createdAt), 'MMM d, yyyy')}</p>
              </div>
              <button onClick={() => removePasskey(p.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Monitor className="h-5 w-5" /> Trusted Devices</h3>
          {devices.length === 0 ? <p className="text-sm text-gray-500">No trusted devices</p> : devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between border-b py-2 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium">{d.deviceName}</p>
                <p className="text-xs text-gray-500">{d.browser?.slice(0, 40)} · {d.country}</p>
              </div>
              <button onClick={() => revokeDevice(d.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Shield className="h-5 w-5" /> Security Events</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {events.map((e) => (
              <div key={e.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-sm dark:bg-gray-800">
                <span className="font-medium">{e.type.replace(/_/g, ' ')}</span>
                <span className="text-gray-500">{format(new Date(e.createdAt), 'MMM d HH:mm')} · {e.country}</span>
              </div>
            ))}
          </div>
        </div>

        {hasRole('ADMIN') && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold"><Mail className="h-5 w-5" /> Email (SMTP)</h3>
                <Button size="sm" onClick={sendTestEmail} disabled={!emailStatus?.configured}>Send Test Email</Button>
              </div>
              {emailStatus ? (
                <div className={`rounded-lg p-3 text-sm ${emailStatus.configured ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
                  {emailStatus.configured ? '✓ ' : '⚠ '}{emailStatus.message}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Checking email configuration...</p>
              )}
              {!emailStatus?.configured && (
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium">To enable real emails, edit <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">backend/.env</code>:</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-800">{`SMTP_USER=your-email@gmail.com\nSMTP_PASS=your-app-password\nSMTP_FROM=AssetFlow <your-email@gmail.com>`}</pre>
                  <p className="mt-2">Gmail: create an App Password at <a href="https://myaccount.google.com/apppasswords" className="text-primary-600 underline" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a></p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
              <h3 className="mb-4 font-semibold">Allowed Company Domains</h3>
            <div className="mb-3 flex gap-2">
              <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="company.com" className="flex-1 rounded-lg border px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
              <Button onClick={addDomain}>Add Domain</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {domains.map((d) => (
                <span key={d.id} className="rounded-full bg-primary-100 px-3 py-1 text-sm dark:bg-primary-900">{d.domain}</span>
              ))}
              {domains.length === 0 && <p className="text-sm text-gray-500">No restrictions — all domains allowed</p>}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
