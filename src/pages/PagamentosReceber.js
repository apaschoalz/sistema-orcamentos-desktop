import React, { useState, useEffect, useMemo } from 'react';
import { useSyncVersion } from '../SyncContext';

const CATEGORIAS = [
    'Venda', 'Entrada', 'Parcela', 'Saldo', 'Comissão', 'Outros'
];

const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDate = (ds) => {
    if (!ds) return '—';
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
};

const FORM_EMPTY = {
    descricao: '', cliente_nome: '', cliente_id: '', venda_id: '',
    valor: '', data_vencimento: '', data_recebimento: '',
    status: 'Pendente', categoria: 'Venda', observacoes: ''
};

const PagamentosReceber = () => {
    const syncVersion = useSyncVersion();
    const [pagamentos, setPagamentos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(FORM_EMPTY);

    const today = getLocalDateStr();
    const mesAtual = today.slice(0, 7);

    useEffect(() => {
        loadData();
    }, [syncVersion]);

    const loadData = async () => {
        try {
            const [pags, clts] = await Promise.all([
                window.electronAPI.getPagamentosReceber(),
                window.electronAPI.getClientes()
            ]);
            setPagamentos(pags || []);
            setClientes(clts || []);
        } catch (e) {
            console.error('Erro ao carregar pagamentos a receber:', e);
        }
    };

    // ── Stats ─────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const doMes = pagamentos.filter(p => (p.data_vencimento || '').startsWith(mesAtual));
        const pendentes = pagamentos.filter(p => p.status === 'Pendente');
        const recebidos = pagamentos.filter(p => p.status === 'Recebido');
        const vencidos = pendentes.filter(p => p.data_vencimento && p.data_vencimento < today);
        const vencendoHoje = pendentes.filter(p => p.data_vencimento === today);
        return {
            totalMes: doMes.reduce((s, p) => s + (p.valor || 0), 0),
            totalPendente: pendentes.reduce((s, p) => s + (p.valor || 0), 0),
            totalRecebido: recebidos.reduce((s, p) => s + (p.valor || 0), 0),
            vencidos: vencidos.length,
            vencendoHoje: vencendoHoje.length,
        };
    }, [pagamentos, mesAtual, today]);

    // ── Filtered list ─────────────────────────────────────────────────────
    const pagamentosVisiveis = useMemo(() => {
        let r = [...pagamentos];
        if (filtroStatus !== 'todos') r = r.filter(p => p.status === filtroStatus);
        if (busca) {
            const b = busca.toLowerCase();
            r = r.filter(p =>
                p.descricao?.toLowerCase().includes(b) ||
                p.cliente_nome?.toLowerCase().includes(b) ||
                p.categoria?.toLowerCase().includes(b) ||
                p.observacoes?.toLowerCase().includes(b) ||
                fmt(p.valor).toLowerCase().includes(b)
            );
        }
        // Sort: vencidos e hoje primeiro, depois pendentes, depois recebidos
        return r.sort((a, b) => {
            const prioA = (a.status === 'Pendente' && a.data_vencimento <= today) ? 0 : a.status === 'Pendente' ? 1 : 2;
            const prioB = (b.status === 'Pendente' && b.data_vencimento <= today) ? 0 : b.status === 'Pendente' ? 1 : 2;
            if (prioA !== prioB) return prioA - prioB;
            return (a.data_vencimento || '').localeCompare(b.data_vencimento || '');
        });
    }, [pagamentos, filtroStatus, busca, today]);

    // ── Form handlers ─────────────────────────────────────────────────────
    const openForm = (pagamento = null) => {
        setForm(pagamento ? { ...pagamento } : FORM_EMPTY);
        setEditingId(pagamento ? pagamento.id : null);
        setShowForm(true);
        setTimeout(() => document.getElementById('pag-descricao')?.focus(), 50);
    };

    const closeForm = () => { setShowForm(false); setEditingId(null); };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setForm(prev => {
            const next = { ...prev, [name]: value };
            // Ao selecionar cliente, preencher o nome automaticamente
            if (name === 'cliente_id') {
                const cliente = clientes.find(c => c.id === value);
                next.cliente_nome = cliente ? cliente.nome : prev.cliente_nome;
            }
            // Ao marcar como Recebido, preencher data de recebimento
            if (name === 'status' && value === 'Recebido' && !prev.data_recebimento) {
                next.data_recebimento = today;
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, valor: parseFloat(form.valor) || 0 };
            if (editingId) {
                await window.electronAPI.updatePagamentoReceber(editingId, payload);
            } else {
                await window.electronAPI.createPagamentoReceber(payload);
            }
            closeForm();
            await loadData();
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este pagamento?')) return;
        try {
            await window.electronAPI.deletePagamentoReceber(id);
            await loadData();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    const handleMarcarRecebido = async (pagamento) => {
        try {
            await window.electronAPI.updatePagamentoReceber(pagamento.id, {
                ...pagamento,
                status: 'Recebido',
                data_recebimento: pagamento.data_recebimento || today
            });
            await loadData();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    const handleDesmarcarRecebido = async (pagamento) => {
        try {
            await window.electronAPI.updatePagamentoReceber(pagamento.id, {
                ...pagamento,
                status: 'Pendente',
                data_recebimento: ''
            });
            await loadData();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    // ── Row classification ────────────────────────────────────────────────
    const isVencendoHoje = (p) => p.data_vencimento === today && p.status === 'Pendente';
    const isVencido = (p) => p.data_vencimento && p.data_vencimento < today && p.status === 'Pendente';

    return (
        <div>
            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <i className="fas fa-hand-holding-usd" style={{ marginRight: '12px', color: 'var(--primary)' }}></i>
                        Pagamentos a Receber
                    </h1>
                    <p className="page-subtitle">Controle de recebimentos e contas a receber</p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm()}>
                    <i className="fas fa-plus"></i>
                    Novo Lançamento
                </button>
            </div>

            {/* ── Stats Cards ──────────────────────────────────────────── */}
            <div className="stats-grid" style={{ marginBottom: '28px' }}>
                <div className="stat-card primary">
                    <div className="stat-icon"><i className="fas fa-calendar-alt"></i></div>
                    <div className="stat-value">{fmt(stats.totalMes)}</div>
                    <div className="stat-label">Lançado este mês</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-icon"><i className="fas fa-clock"></i></div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{fmt(stats.totalPendente)}</div>
                    <div className="stat-label">Total Pendente</div>
                </div>
                <div className="stat-card success">
                    <div className="stat-icon"><i className="fas fa-check-circle"></i></div>
                    <div className="stat-value" style={{ color: 'var(--secondary)' }}>{fmt(stats.totalRecebido)}</div>
                    <div className="stat-label">Total Recebido</div>
                </div>
                <div className={`stat-card ${(stats.vencidos + stats.vencendoHoje) > 0 ? 'danger' : 'primary'}`}>
                    <div className="stat-icon"><i className="fas fa-exclamation-circle"></i></div>
                    <div className="stat-value" style={{
                        color: (stats.vencidos + stats.vencendoHoje) > 0 ? 'var(--danger)' : 'var(--text-muted)'
                    }}>
                        {stats.vencidos + stats.vencendoHoje}
                    </div>
                    <div className="stat-label">
                        {stats.vencendoHoje > 0
                            ? `${stats.vencendoHoje} vence hoje${stats.vencidos > 0 ? ` · ${stats.vencidos} atrasado${stats.vencidos > 1 ? 's' : ''}` : ''}`
                            : stats.vencidos > 0
                                ? `${stats.vencidos} atrasado${stats.vencidos > 1 ? 's' : ''}`
                                : 'Em dia'}
                    </div>
                </div>
            </div>

            {/* ── Alert banner ─────────────────────────────────────────── */}
            {stats.vencendoHoje > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(99,179,237,0.08) 100%)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    borderLeft: '4px solid var(--secondary)',
                    borderRadius: '14px',
                    padding: '14px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }} onClick={() => setFiltroStatus('Pendente')}>
                    <span style={{ fontSize: '1.4rem' }}>💰</span>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {stats.vencendoHoje} pagamento{stats.vencendoHoje > 1 ? 's' : ''} vence{stats.vencendoHoje > 1 ? 'm' : ''} hoje!
                        </div>
                        <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Clique para filtrar pendentes</div>
                    </div>
                </div>
            )}

            {/* ── Form ─────────────────────────────────────────────────── */}
            {showForm && (
                <div className="card" style={{ marginBottom: '24px', border: '2px solid var(--primary)' }}>
                    <div className="card-header">
                        <h2 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                                width: '34px', height: '34px', borderRadius: '10px',
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem'
                            }}>
                                <i className={`fas ${editingId ? 'fa-edit' : 'fa-plus'}`}></i>
                            </span>
                            {editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
                        </h2>
                        <button className="btn btn-secondary btn-sm" onClick={closeForm}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Row 1 */}
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label">Descrição *</label>
                                <input
                                    id="pag-descricao"
                                    type="text"
                                    className="form-input"
                                    name="descricao"
                                    value={form.descricao}
                                    onChange={handleInput}
                                    required
                                    placeholder="Ex: Saldo Venda #123, Parcela 2/3..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Categoria</label>
                                <select className="form-input form-select" name="categoria" value={form.categoria} onChange={handleInput}>
                                    {CATEGORIAS.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <select className="form-input form-select" name="cliente_id" value={form.cliente_id || ''} onChange={handleInput}>
                                    <option value="">Selecionar cliente...</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label">Valor (R$) *</label>
                                <input
                                    type="number" step="0.01" min="0"
                                    className="form-input"
                                    name="valor"
                                    value={form.valor}
                                    onChange={handleInput}
                                    required
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data de Vencimento</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    name="data_vencimento"
                                    value={form.data_vencimento}
                                    onChange={handleInput}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data de Recebimento</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    name="data_recebimento"
                                    value={form.data_recebimento}
                                    onChange={handleInput}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input form-select" name="status" value={form.status} onChange={handleInput}>
                                    <option value="Pendente">⏳ Pendente</option>
                                    <option value="Recebido">✅ Recebido</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Observações</label>
                            <textarea
                                className="form-input form-textarea"
                                name="observacoes"
                                value={form.observacoes}
                                onChange={handleInput}
                                rows="2"
                                style={{ minHeight: '72px' }}
                                placeholder="Informações adicionais..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <i className="fas fa-save"></i>
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Filters ──────────────────────────────────────────────── */}
            <div className="card" style={{ padding: '16px 22px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <i className="fas fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por descrição, cliente, categoria..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            style={{ paddingLeft: '42px', marginBottom: 0 }}
                        />
                    </div>
                    <select className="form-input form-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: '180px', marginBottom: 0 }}>
                        <option value="todos">Todos os status</option>
                        <option value="Pendente">⏳ Pendente</option>
                        <option value="Recebido">✅ Recebido</option>
                    </select>
                    {(busca || filtroStatus !== 'todos') && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setBusca(''); setFiltroStatus('todos'); }}>
                            <i className="fas fa-times"></i> Limpar
                        </button>
                    )}
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {pagamentosVisiveis.length} registro{pagamentosVisiveis.length !== 1 ? 's' : ''}
                    {pagamentos.length !== pagamentosVisiveis.length && ` de ${pagamentos.length}`}
                </div>
            </div>

            {/* ── Table ────────────────────────────────────────────────── */}
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                marginBottom: '24px',
                overflowX: 'auto',
                overflowY: 'hidden'
            }}>
                {pagamentos.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-hand-holding-usd"></i>
                        <h3>Nenhum lançamento registrado</h3>
                        <p>Clique em "Novo Lançamento" para controlar seus recebimentos.</p>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => openForm()}>
                            <i className="fas fa-plus"></i> Novo Lançamento
                        </button>
                    </div>
                ) : pagamentosVisiveis.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <h3>Nenhum resultado</h3>
                        <p>Tente outros termos ou remova os filtros.</p>
                    </div>
                ) : (
                    <table className="table" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '13%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th>Cliente</th>
                                <th>Categoria</th>
                                <th>Vencimento</th>
                                <th>Recebido em</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagamentosVisiveis.map(p => {
                                const hoje = isVencendoHoje(p);
                                const vencido = isVencido(p);
                                return (
                                    <tr key={p.id} style={{
                                        background: hoje
                                            ? 'rgba(16,185,129,0.06)'
                                            : vencido
                                                ? 'rgba(199,93,93,0.05)'
                                                : undefined
                                    }}>
                                        <td
                                            style={{ maxWidth: '220px', cursor: 'pointer' }}
                                            onClick={() => openForm(p)}
                                            title="Clique para editar"
                                        >
                                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {hoje && <span title="Vence hoje">🔔</span>}
                                                {vencido && <span title="Atrasado">⚠️</span>}
                                                <span style={{
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    color: 'var(--primary)', textDecoration: 'underline',
                                                    textDecorationStyle: 'dotted', textUnderlineOffset: '3px'
                                                }}>
                                                    {p.descricao}
                                                </span>
                                            </div>
                                            {p.observacoes && (
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.observacoes}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.cliente_nome || '—'}
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
                                                borderRadius: '20px', fontSize: '0.78rem', fontWeight: 500,
                                                background: 'rgba(16,185,129,0.10)', color: 'var(--secondary)'
                                            }}>
                                                {p.categoria || '—'}
                                            </span>
                                        </td>
                                        <td style={{
                                            fontWeight: (hoje || vencido) ? 600 : 400,
                                            color: vencido ? 'var(--danger)' : hoje ? 'var(--secondary)' : 'var(--text-muted)',
                                            fontSize: '0.88rem', whiteSpace: 'nowrap'
                                        }}>
                                            {fmtDate(p.data_vencimento)}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                                            {fmtDate(p.data_recebimento)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--secondary)' }}>
                                            {fmt(p.valor)}
                                        </td>
                                        <td>
                                            <span className={`badge ${p.status === 'Recebido' ? 'badge-approved' : 'badge-pending'}`}>
                                                {p.status === 'Recebido' ? (
                                                    <><i className="fas fa-check"></i> Recebido</>
                                                ) : (
                                                    <><i className="fas fa-clock"></i> Pendente</>
                                                )}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                {p.status === 'Pendente' ? (
                                                    <button
                                                        title="Marcar como Recebido"
                                                        onClick={() => handleMarcarRecebido(p)}
                                                        style={{
                                                            padding: '4px 8px', borderRadius: '7px',
                                                            border: '1px solid rgba(16,185,129,0.35)',
                                                            background: 'rgba(16,185,129,0.10)',
                                                            color: 'var(--secondary)', cursor: 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 600,
                                                            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        <i className="fas fa-check"></i> Recebido
                                                    </button>
                                                ) : (
                                                    <button
                                                        title="Desfazer recebimento"
                                                        onClick={() => handleDesmarcarRecebido(p)}
                                                        style={{
                                                            padding: '4px 8px', borderRadius: '7px',
                                                            border: '1px solid rgba(199,93,93,0.3)',
                                                            background: 'rgba(199,93,93,0.08)',
                                                            color: 'var(--danger)', cursor: 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 600,
                                                            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        <i className="fas fa-undo"></i> Desfazer
                                                    </button>
                                                )}
                                                <button
                                                    title="Editar"
                                                    onClick={() => openForm(p)}
                                                    style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'var(--bg-dark)', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    title="Excluir"
                                                    onClick={() => handleDelete(p.id)}
                                                    style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'var(--bg-dark)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PagamentosReceber;
