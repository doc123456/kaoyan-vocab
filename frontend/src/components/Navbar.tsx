import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState('账户');
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path ? 'bg-primary-700' : '';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUsername(data.user?.user_metadata?.username || data.user?.email?.split('@')[0] || '账户');
    });
  }, []);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  const links = [
    ['/', '学习仪表盘'],
    ['/traditional', '记背模式'],
    ['/sentence', '辅助记忆模式'],
    ['/phrases', '词组练习'],
    ['/test', '测试模式'],
  ];

  return (
    <nav className="bg-primary-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="text-xl font-bold">考研英语背单词</Link>
          <div className="flex flex-wrap items-center gap-2">
            {links.map(([path, label]) => (
              <Link key={path} to={path} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-primary-700 ${isActive(path)}`}>
                {label}
              </Link>
            ))}
            <div className="relative ml-1" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen(open => !open)} className="flex items-center gap-2 rounded-full px-2 py-1.5 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-white/80" aria-expanded={menuOpen} aria-haspopup="menu">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold text-primary-700">{username.slice(0, 1).toUpperCase()}</span>
                <span className="max-w-28 truncate">{username}</span>
                <span aria-hidden="true" className="text-xs">▾</span>
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl bg-white py-1 text-gray-800 shadow-xl ring-1 ring-black/10">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-500">当前登录账号</p>
                    <p className="mt-1 truncate font-semibold">{username}</p>
                  </div>
                  <button role="menuitem" type="button" onClick={signOut} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">切换账号</button>
                  <button role="menuitem" type="button" onClick={signOut} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">退出登录</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
