import React, { FormEvent, useState } from 'react';
import { supabase, usernameToLoginEmail, validateUsername } from '../utils/supabase';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const normalizedUsername = username.trim().toLowerCase();

    if (!validateUsername(normalizedUsername)) {
      setMessage('用户名请使用 3–32 位英文字母、数字或下划线。');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setMessage('两次输入的密码不一致。');
      return;
    }

    setBusy(true);
    const email = usernameToLoginEmail(normalizedUsername);
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: normalizedUsername, recovery_info: recoveryInfo.trim() } },
        });
    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === 'register') {
      setMessage('注册成功，正在进入你的学习空间…');
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 grid place-items-center p-5">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-indigo-100/70">
        <p className="text-sm font-semibold tracking-wide text-indigo-600">考研英语 · 云端学习</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{mode === 'login' ? '欢迎回来' : '创建学习账户'}</h1>
        <p className="mt-2 text-sm text-gray-500">学习进度会安全地同步到你的账号。</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            用户名
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="例如 fangmoran" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            密码
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="输入密码" />
          </label>
          {mode === 'register' && <>
            <label className="block text-sm font-medium text-gray-700">
              确认密码
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="再次输入密码" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              找回辅助信息 <span className="font-normal text-gray-400">（可不填）</span>
              <textarea value={recoveryInfo} onChange={e => setRecoveryInfo(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="如常用昵称、提示问题的答案等" />
            </label>
          </>}
          {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并开始学习'}
          </button>
        </form>

        <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="mt-5 w-full text-sm font-medium text-indigo-600 hover:text-indigo-800">
          {mode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}
        </button>
      </section>
    </main>
  );
}
