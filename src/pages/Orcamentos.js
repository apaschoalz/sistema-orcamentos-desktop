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
    const [filtroPeriodo, setFiltroPeriodo] = useState('todos');
    const [periodoInicio, setPeriodoInicio] = useState('');
    const [periodoFim, setPeriodoFim] = useState('');

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

    const getToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    const checkPeriodoOrc = (dateStr) => {
        if (filtroPeriodo === 'todos') return true;
        if (!dateStr) return false;
        const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const todayStr = getToday();
        if (filtroPeriodo === 'hoje') return d === todayStr;
        if (filtroPeriodo === 'este_mes') return d.startsWith(todayStr.slice(0, 7));
        if (filtroPeriodo === 'este_ano') return d.startsWith(todayStr.slice(0, 4));
        if (filtroPeriodo === 'esta_semana') {
            const now = new Date(todayStr + 'T12:00:00');
            const day = now.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const mon = new Date(now); mon.setDate(now.getDate() + diff);
            const monStr = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
            return d >= monStr && d <= todayStr;
        }
        if (filtroPeriodo === 'ultimos_3_meses') {
            const d3m = new Date(todayStr + 'T12:00:00'); d3m.setMonth(d3m.getMonth() - 3);
            const d3mStr = `${d3m.getFullYear()}-${String(d3m.getMonth()+1).padStart(2,'0')}-${String(d3m.getDate()).padStart(2,'0')}`;
            return d >= d3mStr && d <= todayStr;
        }
        if (filtroPeriodo === 'personalizado') {
            if (periodoInicio && d < periodoInicio) return false;
            if (periodoFim && d > periodoFim) return false;
            return true;
        }
        return true;
    };

    const porStatus = filtroStatus
        ? orcamentos.filter(o => o.status === filtroStatus)
        : orcamentos;

    const porPeriodo = porStatus.filter(o => checkPeriodoOrc(o.created_at));

    const filteredOrcamentos = busca.trim()
        ? porPeriodo.filter(o => {
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
        : porPeriodo;

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

            {/* Filtros */}
            <div className="card" style={{ padding: '16px 22px', marginBottom: '16px' }}>
                {/* Busca */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <i className="fas fa-search" style={{ color: 'var(--text-muted)' }}></i>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Buscar por número, cliente, CPF, e-mail, endereço..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        style={{ flex: 1, marginBottom: 0 }}
                    />
                    {(busca || filtroStatus || filtroPeriodo !== 'todos') && (
                        <button className="btn btn-sm btn-secondary" onClick={() => { setBusca(''); setFiltroStatus(''); setSearchParams({}); setFiltroPeriodo('todos'); setPeriodoInicio(''); setPeriodoFim(''); }}>
                            <i className="fas fa-times"></i> Limpar tudo
                        </button>
                    )}
                </div>

                {/* Status */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem', whiteSpace: 'nowrap' }}>Status:</span>
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

                {/* Período */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem', whiteSpace: 'nowrap' }}>
                        <i className="fas fa-calendar-alt" style={{ marginRight: '5px' }}></i>Período:
                    </span>
                    {[
                        { key: 'hoje', label: 'Hoje' },
                        { key: 'esta_semana', label: 'Esta semana' },
                        { key: 'este_mes', label: 'Este mês' },
                        { key: 'ultimos_3_meses', label: 'Últimos 3 meses' },
                        { key: 'este_ano', label: 'Este ano' },
                        { key: 'todos', label: 'Todos' },
                        { key: 'personalizado', label: <><i className="fas fa-sliders-h"></i> Personalizado</> },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            className={`btn btn-sm ${filtroPeriodo === opt.key ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFiltroPeriodo(opt.key)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {filtroPeriodo === 'personalizado' && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>De:</label>
                        <input type="date" className="form-input" style={{ width: '160px', marginBottom: 0 }} value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Até:</label>
                        <input type="date" className="form-input" style={{ width: '160px', marginBottom: 0 }} value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
                        {(filtroPeriodo !== 'todos') && (
                            <button className="btn btn-sm btn-secondary" onClick={() => { setFiltroPeriodo('todos'); setPeriodoInicio(''); setPeriodoFim(''); }}>
                                <i className="fas fa-times"></i> Limpar
                            </button>
                        )}
                    </div>
                )}

                {(filtroPeriodo !== 'todos' || filtroStatus || busca) && (
                    <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {filteredOrcamentos.length} orçamento{filteredOrcamentos.length !== 1 ? 's' : ''}
                        {orcamentos.length !== filteredOrcamentos.length && ` de ${orcamentos.length}`}
                    </div>
                )}
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
