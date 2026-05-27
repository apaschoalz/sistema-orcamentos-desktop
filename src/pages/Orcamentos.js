import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

function Orcamentos() {
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();
    const [searchParams, setSearchParams] = useSearchParams();
    const [orcamentos, setOrcamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState(searchParams.get('status') || '');
    const [busca, setBusca] = useState('');

    useEffect(() => {
        loadOrcamentos();
    }, [syncVersion]);

    // Sincronizar filtro com URL
    useEffect(() => {
        const statusFromUrl = searchParams.get('status') || '';
        if (statusFromUrl !== filtroStatus) {
            setFiltroStatus(statusFromUrl);
        }
    }, [searchParams]);

    const loadOrcamentos = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getOrcamentos();
                setOrcamentos(data);
            }
        } catch (error) {
            console.error('Erro ao carregar orçamentos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
            try {
                if (window.electronAPI) {
                    await window.electronAPI.deleteOrcamento(id);
                    loadOrcamentos();
                }
            } catch (error) {
                console.error('Erro ao excluir:', error);
            }
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const badges = {
            'Pendente': 'badge-pending',
            'Aprovado': 'badge-approved',
            'Reprovado': 'badge-rejected'
        };
        return badges[status] || 'badge-pending';
    };

    const porStatus = filtroStatus
        ? orcamentos.filter(o => o.status === filtroStatus)
        : orcamentos;

    const filteredOrcamentos = busca.trim()
        ? porStatus.filter(o => {
            const q = busca.toLowerCase();
            return (
                (o.numero             || '').toLowerCase().includes(q) ||
                (o.cliente_nome       || '').toLowerCase().includes(q) ||
                (o.cliente_cpf_cnpj   || '').toLowerCase().includes(q) ||
                (o.cliente_email      || '').toLowerCase().includes(q) ||
                (o.cliente_endereco   || '').toLowerCase().includes(q) ||
                (o.cliente_bairro     || '').toLowerCase().includes(q) ||
                (o.cliente_cidade     || '').toLowerCase().includes(q)
            );
        })
        : porStatus;

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
                    <h1 className="page-title">Orçamentos</h1>
                    <p className="page-subtitle">Todos os orçamentos cadastrados</p>
                </div>
                <Link to="/novo" className="btn btn-primary">
                    <i className="fas fa-plus"></i>
                    Novo Orçamento
                </Link>
            </div>

            {/* Busca */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-search" style={{ color: 'var(--text-muted)' }}></i>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Buscar por número, cliente, CPF, e-mail, endereço..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    {busca && (
                        <button className="btn btn-sm btn-secondary" onClick={() => setBusca('')}>
                            <i className="fas fa-times"></i> Limpar
                        </button>
                    )}
                </div>
                {busca && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {filteredOrcamentos.length} resultado(s) encontrado(s)
                    </p>
                )}
            </div>

            {/* Filtros */}
            <div className="card">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Filtrar por status:</span>
                    <button
                        className={`btn btn-sm ${!filtroStatus ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setFiltroStatus(''); setSearchParams({}); }}
                    >
                        Todos
                    </button>
                    <button
                        className={`btn btn-sm ${filtroStatus === 'Pendente' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setFiltroStatus('Pendente'); setSearchParams({ status: 'Pendente' }); }}
                    >
                        <i className="fas fa-clock"></i> Pendentes
                    </button>
                    <button
                        className={`btn btn-sm ${filtroStatus === 'Aprovado' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setFiltroStatus('Aprovado'); setSearchParams({ status: 'Aprovado' }); }}
                    >
                        <i className="fas fa-check"></i> Aprovados
                    </button>
                    <button
                        className={`btn btn-sm ${filtroStatus === 'Reprovado' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setFiltroStatus('Reprovado'); setSearchParams({ status: 'Reprovado' }); }}
                    >
                        <i className="fas fa-times"></i> Reprovados
                    </button>
                </div>
            </div>

            {/* Lista */}
            <div className="card">
                {orcamentos.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-file-invoice"></i>
                        <h3>Nenhum orçamento cadastrado</h3>
                        <p>Crie seu primeiro orçamento clicando no botão acima</p>
                    </div>
                ) : filteredOrcamentos.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <h3>Nenhum orçamento encontrado</h3>
                        <p>Tente outro termo de busca ou filtro.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Número</th>
                                    <th>Cliente</th>
                                    <th>Data</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrcamentos.map((orc) => (
                                    <tr key={orc.id}>
                                        <td><strong>{orc.numero}</strong></td>
                                        <td>{orc.cliente_nome || 'N/A'}</td>
                                        <td>{formatDate(orc.created_at)}</td>
                                        <td>{formatCurrency(orc.valor_total)}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(orc.status)}`}>
                                                {orc.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="actions">
                                                <button
                                                    className="action-btn"
                                                    title="Gerar Venda"
                                                    onClick={() => navigate(`/vendas/nova/${orc.id}`)}
                                                    style={{ color: 'var(--success)' }}
                                                >
                                                    <i className="fas fa-dollar-sign"></i>
                                                </button>
                                                <Link to={`/editar/${orc.id}`} className="action-btn" title="Editar">
                                                    <i className="fas fa-edit"></i>
                                                </Link>
                                                <button
                                                    className="action-btn"
                                                    title="Gerar/Ver PDF"
                                                    onClick={async () => {
                                                        if (window.electronAPI?.generatePDF) {
                                                            // Sempre gera novo PDF para pegar atualizações
                                                            const result = await window.electronAPI.generatePDF(orc.id);
                                                            if (result.success) {
                                                                await window.electronAPI.openPDF(result.path);
                                                                loadOrcamentos();
                                                            } else {
                                                                alert('Erro ao gerar PDF: ' + result.error);
                                                            }
                                                        }
                                                    }}
                                                    style={{ color: 'var(--danger)' }}
                                                >
                                                    <i className="fas fa-file-pdf"></i>
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    title="Excluir"
                                                    onClick={() => handleDelete(orc.id)}
                                                    style={{ color: 'var(--danger)' }}
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
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

export default Orcamentos;
