import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { userStorageKey } from '../../services/storageShim';

export const profileStorageKey = (userId) => userStorageKey('user-profile', userId);

export default function AuthView({ onDone }) {
  const [tab, setTab] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    const profile = { displayName: name.trim(), email: email.trim() || null, joinedAt: Date.now() };
    try { await window.storage.set(profileStorageKey('demo'), JSON.stringify(profile)); } catch (e) { }
    onDone(profile);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><div className="logo-badge">한</div> Korean <span>Study</span></div>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'register' ? 'on' : ''}`} onClick={() => setTab('register')}>Đăng ký</button>
          <button className={`auth-tab ${tab === 'login' ? 'on' : ''}`} onClick={() => setTab('login')}>Đăng nhập</button>
        </div>

        <label className="auth-label">Tên hiển thị</label>
        <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bạn muốn hiển thị trong app" />

        <label className="auth-label">Email {tab === 'login' && '(không bắt buộc trong bản demo)'}</label>
        <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />

        <label className="auth-label">Mật khẩu</label>
        <input className="auth-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />

        <button className="auth-submit" onClick={submit} disabled={!name.trim()}>
          {tab === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>

        <div className="auth-note">
          <AlertTriangle size={13} color="#E8912E" />
          Đây là bản demo chạy hoàn toàn trên trình duyệt, chưa có máy chủ xác thực thật — email/mật khẩu không được kiểm tra hay lưu trữ an toàn. Chỉ <b>tên hiển thị</b> được dùng để cá nhân hoá và đăng bài ở mục Cộng đồng.
        </div>
      </div>
    </div>
  );
}
