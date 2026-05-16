import React, { useState } from 'react';

function Backup() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleExport = async () => {
        setLoading(true);
        setMessage('');
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.exportBackup();
                if (result && result.success) {
                    setMessage('✅ Backup exportado com sucesso!');
                } else if (result === null) {
                    setMessage('❌ Operação cancelada');
                } else {
                    setMessage('❌ Erro ao exportar: ' + (result?.error || 'Erro desconhecido'));
                }
            }
        } catch (error) {
            setMessage('❌ Erro: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!window.confirm('Isso irá substituir todos os dados atuais pelo backup. Deseja continuar?')) {
            return;
        }

        setLoading(true);
        setMessage('');
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.importBackup();
                if (result && result.success) {
                    setMessage('✅ Backup importado com sucesso! Reinicie o aplicativo.');
                } else if (result === null) {
                    setMessage('❌ Operação cancelada');
                } else {
                    setMessage('❌ Erro ao importar: ' + (result?.error || 'Erro desconhecido'));
                }
            }
        } catch (error) {
            setMessage('❌ Erro: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Backup & Restauração</h1>
                    <p className="page-subtitle">Exporte e importe dados do sistema</p>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {/* Exportar */}
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px'
                    }}>
                        <i className="fas fa-download" style={{ fontSize: '2rem', color: 'white' }}></i>
                    </div>
                    <h3 style={{ marginBottom: '12px' }}>Exportar Backup</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Salve uma cópia completa do banco de dados para restaurar depois ou transferir para outro computador.
                    </p>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleExport}
                        disabled={loading}
                    >
                        <i className="fas fa-download"></i>
                        {loading ? 'Exportando...' : 'Exportar Backup'}
                    </button>
                </div>

                {/* Importar */}
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--secondary) 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px'
                    }}>
                        <i className="fas fa-upload" style={{ fontSize: '2rem', color: 'white' }}></i>
                    </div>
                    <h3 style={{ marginBottom: '12px' }}>Importar Backup</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Restaure dados a partir de um arquivo de backup. <strong style={{ color: 'var(--warning)' }}>Isso substituirá todos os dados atuais!</strong>
                    </p>
                    <button
                        className="btn btn-success btn-lg"
                        onClick={handleImport}
                        disabled={loading}
                    >
                        <i className="fas fa-upload"></i>
                        {loading ? 'Importando...' : 'Importar Backup'}
                    </button>
                </div>
            </div>

            {/* Mensagem */}
            {message && (
                <div className="card" style={{
                    padding: '20px',
                    borderLeft: message.includes('✅') ? '4px solid var(--secondary)' : '4px solid var(--danger)'
                }}>
                    <p style={{ fontSize: '1.1rem', margin: 0 }}>{message}</p>
                </div>
            )}

            {/* Informações */}
            <div className="card">
                <h3 style={{ marginBottom: '16px' }}>
                    <i className="fas fa-info-circle" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
                    Informações sobre Backup
                </h3>
                <ul style={{ color: 'var(--text-muted)', lineHeight: '2' }}>
                    <li>O backup contém todos os orçamentos, clientes e configurações</li>
                    <li>Recomendamos fazer backup regularmente</li>
                    <li>Para sincronizar entre computadores, exporte o backup e importe na outra máquina</li>
                    <li>Os PDFs gerados são salvos localmente e não são incluídos no backup</li>
                </ul>
            </div>
        </div>
    );
}

export default Backup;
