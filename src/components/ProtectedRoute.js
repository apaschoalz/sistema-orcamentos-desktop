import React, { useState, useEffect } from 'react';

const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);
    const [passwordSet, setPasswordSet] = useState(true);

    useEffect(() => {
        window.electronAPI.isAdminPasswordSet?.().then(set => setPasswordSet(set));
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setChecking(true);
        try {
            const ok = await window.electronAPI.checkAdminPassword(password);
            if (ok) {
                setIsAuthenticated(true);
                setError('');
            } else {
                setError('Senha incorreta');
            }
        } catch (err) {
            setError('Erro ao verificar senha');
        } finally {
            setChecking(false);
        }
    };

    if (isAuthenticated) {
        return children;
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            minHeight: '60vh',
            padding: '20px'
        }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px' }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    color: '#ffc107',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    margin: '0 auto 20px'
                }}>
                    <i className="fas fa-lock"></i>
                </div>

                <h2 style={{ marginBottom: '10px' }}>Acesso Restrito</h2>

                {!passwordSet ? (
                    <p style={{ color: 'var(--warning)', marginBottom: '24px', fontSize: '0.9rem' }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                        Nenhuma senha configurada. Clique em <strong>Acessar</strong> e defina uma senha em <strong>Configurações → Segurança</strong>.
                    </p>
                ) : (
                    <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
                        Esta área contém configurações sensíveis. Por favor, digite a senha de administrador.
                    </p>
                )}

                <form onSubmit={handleLogin}>
                    {passwordSet && (
                        <div className="form-group">
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                disabled={checking}
                            />
                        </div>
                    )}

                    {error && (
                        <div style={{ color: 'var(--danger)', marginBottom: '15px', fontSize: '0.9rem' }}>
                            <i className="fas fa-exclamation-circle"></i> {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={checking}>
                        {checking ? 'Verificando...' : 'Acessar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProtectedRoute;
