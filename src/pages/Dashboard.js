import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

function Dashboard() {
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();
    const [stats, setStats] = useState({
        total: 0,
        pendentes: 0,
        aprovados: 0,
        reprovados: 0,
        valorTotal: 0,
        valorAprovado: 0,
        ultimosOrcamentos: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, [syncVersion]);

    const loadStats = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getEstatisticas();
                setStats(data);
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        } finally {
            setLoading(false);
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
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Visão geral do sistema</p>
                </div>
                <Link to="/novo" className="btn btn-primary">
                    <i className="fas fa-plus"></i>
                    Novo Orçamento
                </Link>
            </div>

            {/* Cards de Estatísticas */}
            <div className="stats-grid">
                <div
                    className="stat-card primary"
                    onClick={() => navigate('/orcamentos')}
                    style={{ cursor: 'pointer' }}
                    title="Ver todos os orçamentos"
                >
                    <div className="stat-icon">
                        <i className="fas fa-file-invoice"></i>
                    </div>
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total de Orçamentos</div>
                </div>

                <div
                    className="stat-card warning"
                    onClick={() => navigate('/orcamentos?status=Pendente')}
                    style={{ cursor: 'pointer' }}
                    title="Ver orçamentos pendentes"
                >
                    <div className="stat-icon">
                        <i className="fas fa-clock"></i>
                    </div>
                    <div className="stat-value">{stats.pendentes}</div>
                    <div className="stat-label">Pendentes</div>
                </div>

                <div
                    className="stat-card success"
                    onClick={() => navigate('/orcamentos?status=Aprovado')}
                    style={{ cursor: 'pointer' }}
                    title="Ver orçamentos aprovados"
                >
                    <div className="stat-icon">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-value">{stats.aprovados}</div>
                    <div className="stat-label">Aprovados</div>
                </div>

                <div
                    className="stat-card danger"
                    onClick={() => navigate('/orcamentos?status=Reprovado')}
                    style={{ cursor: 'pointer' }}
                    title="Ver orçamentos reprovados"
                >
                    <div className="stat-icon">
                        <i className="fas fa-times-circle"></i>
                    </div>
                    <div className="stat-value">{stats.reprovados}</div>
                    <div className="stat-label">Reprovados</div>
                </div>
            </div>

            {/* Cards de Valor */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="stat-card primary">
                    <div className="stat-icon">
                        <i className="fas fa-dollar-sign"></i>
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                        {formatCurrency(stats.valorTotal)}
                    </div>
                    <div className="stat-label">Valor Total em Orçamentos</div>
                </div>

                <div className="stat-card success">
                    <div className="stat-icon">
                        <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                        {formatCurrency(stats.valorAprovado)}
                    </div>
                    <div className="stat-label">Valor Aprovado</div>
                </div>
            </div>

            {/* Últimos Orçamentos */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Últimos Orçamentos</h2>
                    <Link to="/orcamentos" className="btn btn-secondary btn-sm">
                        Ver Todos
                    </Link>
                </div>

                {stats.ultimosOrcamentos.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-file-invoice"></i>
                        <h3>Nenhum orçamento ainda</h3>
                        <p>Crie seu primeiro orçamento clicando no botão acima</p>
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
                                {stats.ultimosOrcamentos.map((orc) => (
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
                                                <Link to={`/editar/${orc.id}`} className="action-btn" title="Editar">
                                                    <i className="fas fa-edit"></i>
                                                </Link>
                                                {orc.pdf_path && (
                                                    <button
                                                        className="action-btn"
                                                        title="Ver PDF"
                                                        onClick={async () => {
                                                            if (window.electronAPI?.openPDF) {
                                                                await window.electronAPI.openPDF(orc.pdf_path);
                                                            }
                                                        }}
                                                        style={{ color: 'var(--danger)' }}
                                                    >
                                                        <i className="fas fa-file-pdf"></i>
                                                    </button>
                                                )}
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

export default Dashboard;
