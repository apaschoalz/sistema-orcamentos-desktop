import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

function Clientes() {
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [termo, setTermo] = useState('');
    const [exportando, setExportando] = useState(false);
    const [mensagem, setMensagem] = useState(null);

    useEffect(() => {
        loadClientes();
    }, [syncVersion]);

    const loadClientes = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getClientes();
                setClientes(data);
            }
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!termo.trim()) {
            loadClientes();
            return;
        }

        setLoading(true);
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.searchClientes(termo);
                setClientes(data);
            }
        } catch (error) {
            console.error('Erro na busca:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleExportCSV = async () => {
        setExportando(true);
        setMensagem(null);
        try {
            const result = await window.electronAPI.exportClientesCSV();
            if (result.success) {
                setMensagem({ tipo: 'sucesso', texto: `✅ ${result.total} clientes exportados com sucesso!` });
            } else if (!result.cancelled) {
                setMensagem({ tipo: 'erro', texto: `❌ Erro: ${result.error}` });
            }
        } catch (err) {
            setMensagem({ tipo: 'erro', texto: `❌ Erro inesperado: ${err.message}` });
        } finally {
            setExportando(false);
            setTimeout(() => setMensagem(null), 5000);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Clientes</h1>
                    <p className="page-subtitle">Base de clientes cadastrados</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportCSV}
                        disabled={exportando}
                        title="Exportar clientes com orçamentos para CSV"
                    >
                        <i className="fas fa-file-export"></i> {exportando ? 'Exportando...' : 'Exportar CSV'}
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/clientes/novo')}>
                        <i className="fas fa-plus"></i> Novo Cliente
                    </button>
                </div>
            </div>

            {mensagem && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    background: mensagem.tipo === 'sucesso' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: mensagem.tipo === 'sucesso' ? '#16a34a' : '#dc2626',
                    border: `1px solid ${mensagem.tipo === 'sucesso' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontWeight: 500
                }}>
                    {mensagem.texto}
                </div>
            )}

            {/* Campo de Busca */}
            <div className="card">
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="search-box" style={{ flex: 1, maxWidth: 'none' }}>
                        <i className="fas fa-search"></i>
                        <input
                            type="text"
                            value={termo}
                            onChange={(e) => setTermo(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="form-input"
                            placeholder="Buscar por nome, CPF/CNPJ, email ou telefone..."
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSearch}>
                        <i className="fas fa-search"></i>
                        Buscar
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setTermo(''); loadClientes(); }}>
                        <i className="fas fa-times"></i>
                        Limpar
                    </button>
                </div>
            </div>

            {/* Lista */}
            <div className="card">
                {clientes.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-users"></i>
                        <h3>Nenhum cliente encontrado</h3>
                        <p>Os clientes são cadastrados automaticamente ao criar orçamentos</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>CPF/CNPJ</th>
                                    <th>Email</th>
                                    <th>Telefone</th>
                                    <th>Cidade</th>
                                    <th>Cadastro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientes.map((cliente) => (
                                    <tr key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ cursor: 'pointer' }} className="clickable-row">
                                        <td><strong>{cliente.nome}</strong></td>
                                        <td>{cliente.cpf_cnpj || '-'}</td>
                                        <td>{cliente.email || '-'}</td>
                                        <td>{cliente.telefone || '-'}</td>
                                        <td>{cliente.cidade || '-'}</td>
                                        <td>{formatDate(cliente.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Clientes;
