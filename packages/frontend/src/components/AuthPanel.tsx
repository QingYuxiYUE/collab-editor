import React, { useCallback, useState } from 'react';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LoginOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { LoginInput, RegisterInput } from '../hooks/useAuth';

type AuthMode = 'login' | 'register';

interface AuthPanelProps {
  onLogin(input: LoginInput): Promise<void>;
  onRegister(input: RegisterInput): Promise<void>;
}

const AuthPanel: React.FC<AuthPanelProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegistering = mode === 'register';

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError('');
      setSubmitting(true);

      try {
        if (isRegistering) {
          if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
          }

          await onRegister({ name, email, password });
        } else {
          await onLogin({ email, password, remember });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
      } finally {
        setSubmitting(false);
      }
    },
    [
      confirmPassword,
      email,
      isRegistering,
      name,
      onLogin,
      onRegister,
      password,
      remember,
    ],
  );

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-panel__brand">
          <div className="app-header__logo">C</div>
          <div>
            <h1 id="auth-title">协同编辑器</h1>
            <p>登录后进入文档空间</p>
          </div>
        </div>

        <div className="auth-mode" role="tablist" aria-label="认证模式">
          <button
            type="button"
            className={`auth-mode__button ${mode === 'login' ? 'auth-mode__button--active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={`auth-mode__button ${mode === 'register' ? 'auth-mode__button--active' : ''}`}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistering && (
            <label className="auth-field">
              <span>昵称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={24}
                required
              />
            </label>
          )}

          <label className="auth-field">
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>密码</span>
            <span className="auth-password-control">
              <input
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
              <button
                className="auth-password-control__button"
                type="button"
                onClick={() => setPasswordVisible((current) => !current)}
                aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                title={passwordVisible ? '隐藏密码' : '显示密码'}
              >
                {passwordVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </button>
            </span>
          </label>

          {isRegistering && (
            <label className="auth-field">
              <span>确认密码</span>
              <span className="auth-password-control">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  className="auth-password-control__button"
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}
                  aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                  title={passwordVisible ? '隐藏密码' : '显示密码'}
                >
                  {passwordVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </span>
            </label>
          )}

          {!isRegistering && (
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>记住我，下次自动登录</span>
            </label>
          )}

          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {isRegistering ? <UserAddOutlined /> : <LoginOutlined />}
            {submitting ? '处理中...' : isRegistering ? '创建账号' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default AuthPanel;
