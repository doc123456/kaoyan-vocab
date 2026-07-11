import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AuthPage from '../pages/AuthPage';
import { supabase } from '../utils/supabase';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-gray-500">正在连接你的学习账户…</div>;
  }

  return session ? <>{children}</> : <AuthPage />;
}
