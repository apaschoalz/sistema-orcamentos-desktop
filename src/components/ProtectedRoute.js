import React, { useState } from 'react';

const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const correctPassword = process.env.REACT_APP_ADMIN_PASSWORD || 'Carpisatkl12v*#';

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === correctPassword) {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('Senha incorreta');
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
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
                    Esta área contém configurações sensíveis. Por favor, digite a senha de administrador.
                </p>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{ color: 'var(--danger)', marginBottom: '15px', fontSize: '0.9rem' }}>
                            <i className="fas fa-exclamation-circle"></i> {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Acessar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProtectedRoute;
