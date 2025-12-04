import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedEmail = window.localStorage.getItem('ngUserEmail') ?? '';
    const storedName = window.localStorage.getItem('ngUserName') ?? '';
    setEmail(storedEmail);
    setName(storedName);
  }, []);

  const saveAndGo = (nextEmail: string, nextName: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ngUserEmail', nextEmail);
      window.localStorage.setItem('ngUserName', nextName);
      window.dispatchEvent(new Event('ngUserChanged'));
    }
    navigate('/');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      alert('请输入邮箱');
      return;
    }
    saveAndGo(email.trim(), name.trim());
  };

  return (
    <div className="page">
      <section className="section">
        <h1 className="page-title">Fake Login</h1>
        <p className="card-body">
          这里只是前端切换「当前用户」，方便你以屋主 / 邻居视角测试。
        </p>
      </section>

      <section className="section">
        <form className="card form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>邮箱（必填）</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-row">
            <label>名称（可选）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="显示用的名字"
            />
          </div>

          <button type="submit" className="btn-primary">
            使用这个身份
          </button>
        </form>
      </section>

      <section className="section">
        <h2 className="section-title">快速切换</h2>
        <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              saveAndGo('owner@neighborguard.local', 'Default Owner')
            }
          >
            默认屋主
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              saveAndGo('neighbor1@example.com', 'Neighbor A')
            }
          >
            邻居 A
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              saveAndGo('neighbor2@example.com', 'Neighbor B')
            }
          >
            邻居 B
          </button>
        </div>
      </section>
    </div>
  );
}

