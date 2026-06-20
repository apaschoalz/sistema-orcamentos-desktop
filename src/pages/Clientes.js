import React, { useState, useEffect, useMemo } from 'react';
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
    const [ordenacao, setOrdenacao] = useState('nome_asc');

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

    const clientesOrdenados = useMemo(() => {
        const lista = [...clientes];
        switch (ordenacao) {
            case 'nome_asc':  return lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
            case 'nome_desc': return lista.sort((a, b) => (b.nome || '').localeCompare(a.nome || '', 'pt-BR'));
            case 'data_desc': return lista.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            case 'data_asc':  return lista.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            case 'valor_desc': return lista.sort((a, b) => (b.total_orcamentos || 0) - (a.total_orcamentos || 0));
            case 'valor_asc':  return lista.sort((a, b) => (a.total_orcamentos || 0) - (b.total_orcamentos || 0));
            default: return lista;
        }
    }, [clientes, ordenacao]);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const SORT_OPTS = [
        { key: 'nome_asc',   label: 'A → Z',        icon: 'fa-sort-alpha-down' },
        { key: 'nome_desc',  label: 'Z → A',        icon: 'fa-sort-alpha-up' },
        { key: 'data_desc',  label: 'Mais recente', icon: 'fa-sort-amount-down' },
        { key: 'data_asc',   label: 'Mais antigo',  icon: 'fa-sort-amount-up' },
        { key: 'valor_desc', label: 'Maior valor',  icon: 'fa-sort-numeric-down' },
        { key: 'valor_asc',  label: 'Menor valor',  icon: 'fa-sort-numeric-up' },
    ];

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

            {/* Campo de Busca + Ordenação */}
            <div className="card">
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
                        <i className="fas fa-sort" style={{ marginRight: '4px' }}></i>Ordenar:
                    </span>
                    {SORT_OPTS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setOrdenacao(opt.key)}
                            style={{
                                padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--border)',
                                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                background: ordenacao === opt.key ? 'var(--primary)' : 'var(--bg-card)',
                                color: ordenacao === opt.key ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.15s'
                            }}
                        >
                            <i className={`fas ${opt.icon}`} style={{ marginRight: '5px' }}></i>{opt.label}
                        </button>
                    ))}
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
                                {clientesOrdenados.map((cliente) => (
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
