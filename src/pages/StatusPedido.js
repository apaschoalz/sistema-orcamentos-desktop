import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

// Etapa final por tipo de fluxo
const ETAPA_FINAL = {
    'Persiana': 'Instalado',
    'Cortina': 'Instalado',
    'Papel de Parede': 'Instalado',
    'Tapete': 'Entregue',
    'default': 'Concluído'
};

function StatusPedido() {
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();
    const [vendas, setVendas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVendas();
    }, [syncVersion]);

    const loadVendas = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getVendas();
                const vendasComFluxo = data.filter(v => v.tipo_fluxo && v.etapa_atual);
                setVendas(vendasComFluxo);
            }
        } catch (error) {
            console.error('Erro ao carregar vendas:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const getDaysSince = (dateStr) => {
        if (!dateStr) return 0;
        const start = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const checkAlert = (tipo, etapa, dataInicio) => {
        if (!etapa || !dataInicio) return null;
        const days = getDaysSince(dataInicio);
        let limit = null;

        if (tipo === 'Cortina') {
            if (etapa === 'Pedir para a fábrica' || etapa === 'Aguardando entrega da fábrica') limit = 7;
            if (etapa === 'Tecido no estoque') limit = 2;
            if (etapa === 'Enviado a costureira') limit = 4;
            if (etapa === 'No estoque (Separação)') limit = 2;
            if (etapa === 'No estoque (Instalação)') limit = 2;
        }
        if (tipo === 'Persiana') {
            if (etapa === 'Aguardando fábrica') limit = 7;
            if (etapa === 'No estoque (Instalação)') limit = 2;
        }

        if (limit !== null && days > limit) {
            return { type: 'danger', msg: `${days} dias (Limite: ${limit})` };
        }
        return null;
    };

    // Extrai etapa como string de campo etapa_atual (JSON ou string legacy)
    const extractEtapaStr = (etapaAtual) => {
        if (!etapaAtual) return '';
        if (etapaAtual.startsWith('{')) {
            try {
                const parsed = JSON.parse(etapaAtual);
                return parsed.etapa || '';
            } catch { return etapaAtual; }
        }
        return etapaAtual;
    };

    // Verifica se venda está concluída (etapa final atingida)
    const isConcluido = (venda) => {
        if (!venda.etapa_atual) return false;

        if (venda.tipo_fluxo === 'Ambos') {
            try {
                const state = JSON.parse(venda.etapa_atual);
                const pEtapa = typeof state.persiana === 'string' ? state.persiana : (state.persiana?.etapa || '');
                const cEtapa = typeof state.cortina === 'string' ? state.cortina : (state.cortina?.etapa || '');
                return pEtapa === 'Instalado' && cEtapa === 'Instalado';
            } catch { return false; }
        }

        const finalStep = ETAPA_FINAL[venda.tipo_fluxo] || ETAPA_FINAL['default'];
        const etapaStr = extractEtapaStr(venda.etapa_atual);
        return etapaStr === finalStep;
    };

    const getEtapaInfo = (venda) => {
        let etapas = [];

        try {
            let parsed = null;
            if (venda.etapa_atual && venda.etapa_atual.startsWith('{')) {
                try {
                    parsed = JSON.parse(venda.etapa_atual);
                } catch (err) {
                    parsed = { etapa: venda.etapa_atual, data_inicio: venda.updated_at };
                }
            } else {
                parsed = { etapa: venda.etapa_atual, data_inicio: venda.updated_at };
            }

            if (venda.tipo_fluxo === 'Ambos') {
                if (!parsed.persiana && !parsed.cortina) {
                    let valFallback = parsed.etapa || venda.etapa_atual;
                    if (typeof valFallback === 'object') {
                        valFallback = valFallback.etapa || JSON.stringify(valFallback);
                    }
                    etapas.push({ label: 'Ambos', val: valFallback, alert: null });
                    return etapas;
                }

                const extractData = (item) => {
                    if (!item) return { val: '-', data: venda.updated_at };
                    if (typeof item === 'string') return { val: item, data: venda.updated_at };
                    let etapaVal = item.etapa || '-';
                    if (typeof etapaVal === 'object') {
                        etapaVal = etapaVal.etapa && typeof etapaVal.etapa === 'string' ? etapaVal.etapa : JSON.stringify(etapaVal);
                    }
                    return { val: etapaVal, data: item.data_inicio || venda.updated_at };
                };

                const pData = extractData(parsed.persiana);
                const cData = extractData(parsed.cortina);
                etapas.push({ label: 'Persiana', val: pData.val, alert: checkAlert('Persiana', pData.val, pData.data) });
                etapas.push({ label: 'Cortina', val: cData.val, alert: checkAlert('Cortina', cData.val, cData.data) });
            } else {
                let etapaVal = '';
                let dataVal = venda.updated_at;

                if (typeof parsed === 'object' && parsed !== null) {
                    etapaVal = parsed.etapa || '';
                    if (parsed.data_inicio) dataVal = parsed.data_inicio;
                } else if (typeof parsed === 'string') {
                    etapaVal = parsed;
                }

                if (typeof etapaVal === 'object') etapaVal = JSON.stringify(etapaVal);

                etapas.push({
                    label: venda.tipo_fluxo,
                    val: etapaVal,
                    alert: checkAlert(venda.tipo_fluxo, etapaVal, dataVal)
                });
            }
        } catch (e) {
            etapas.push({ label: venda.tipo_fluxo, val: typeof venda.etapa_atual === 'string' ? venda.etapa_atual : 'Erro', alert: null });
        }

        return etapas;
    };

    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    // ── Agrupar em Pendentes e Concluídos
    const pendentes = vendas.filter(v => !isConcluido(v));
    const concluidos = vendas.filter(v => isConcluido(v));

    const renderTabela = (lista, tipo) => {
        if (lista.length === 0) {
            return (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {tipo === 'pendente' ? 'Nenhum pedido pendente.' : 'Nenhum pedido concluído.'}
                </div>
            );
        }

        return (
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Pedido</th>
                            <th>Cliente</th>
                            <th>Data Venda</th>
                            <th>Fluxo</th>
                            <th>Etapa Atual / Alertas</th>
                            <th>Pgto.</th>
                            <th>Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lista.map(v => {
                            const etapasInfo = getEtapaInfo(v);
                            const faltaPagar = v.falta_pagar || 0;
                            const isPago = faltaPagar <= 0.01;
                            return (
                                <tr key={v.id} className="clickable-row">
                                    <td><strong>{v.numero}</strong></td>
                                    <td>{v.cliente_nome || '-'}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(v.data_venda)}</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px',
                                            borderRadius: '12px',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            background: 'rgba(139,115,85,0.12)',
                                            color: 'var(--primary)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {v.tipo_fluxo}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            {etapasInfo.map((info, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                                                    {v.tipo_fluxo === 'Ambos' && (
                                                        <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '56px' }}>{info.label}:</strong>
                                                    )}
                                                    <span style={{ whiteSpace: 'nowrap' }}>{info.val}</span>
                                                    {info.alert && (
                                                        <span style={{
                                                            padding: '3px 8px',
                                                            borderRadius: '10px',
                                                            background: 'rgba(199,93,93,0.15)',
                                                            color: 'var(--danger)',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            <i className="fas fa-exclamation-triangle"></i> {info.alert.msg}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {isPago ? (
                                            <span className="badge badge-approved">
                                                <i className="fas fa-check"></i> Pago
                                            </span>
                                        ) : (
                                            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span className="badge badge-pending">
                                                    <i className="fas fa-clock"></i> Pendente
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600, paddingLeft: '2px' }}>
                                                    {fmt(faltaPagar)}
                                                </span>
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/vendas/${v.id}`)}>
                                            Abrir
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <i className="fas fa-tasks" style={{ marginRight: '12px', color: 'var(--primary)' }}></i>
                        Status do Pedido
                    </h1>
                    <p className="page-subtitle">Acompanhamento e alertas de produção</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''} · {concluidos.length} concluído{concluidos.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {vendas.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <i className="fas fa-check-circle"></i>
                        <h3>Tudo em ordem!</h3>
                        <p>Não há pedidos em andamento no momento.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Seção PENDENTE ─────────────────────────────────── */}
                    <div style={{ marginBottom: '28px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '12px',
                            padding: '10px 16px',
                            background: 'rgba(232,184,74,0.10)',
                            borderRadius: '12px',
                            border: '1px solid rgba(232,184,74,0.30)',
                            borderLeft: '4px solid var(--warning)',
                        }}>
                            <i className="fas fa-clock" style={{ color: 'var(--warning)', fontSize: '1rem' }}></i>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                                Pendente
                            </span>
                            <span style={{
                                marginLeft: '4px',
                                padding: '2px 10px',
                                borderRadius: '20px',
                                background: 'rgba(232,184,74,0.20)',
                                color: '#a07820',
                                fontSize: '0.8rem',
                                fontWeight: 700
                            }}>
                                {pendentes.length}
                            </span>
                        </div>
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            {renderTabela(pendentes, 'pendente')}
                        </div>
                    </div>

                    {/* ── Seção PAGO / CONCLUÍDO ─────────────────────────── */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '12px',
                            padding: '10px 16px',
                            background: 'rgba(16,185,129,0.08)',
                            borderRadius: '12px',
                            border: '1px solid rgba(16,185,129,0.25)',
                            borderLeft: '4px solid var(--secondary)',
                        }}>
                            <i className="fas fa-check-circle" style={{ color: 'var(--secondary)', fontSize: '1rem' }}></i>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                                Concluído / Instalado
                            </span>
                            <span style={{
                                marginLeft: '4px',
                                padding: '2px 10px',
                                borderRadius: '20px',
                                background: 'rgba(16,185,129,0.15)',
                                color: 'var(--secondary)',
                                fontSize: '0.8rem',
                                fontWeight: 700
                            }}>
                                {concluidos.length}
                            </span>
                        </div>
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            {renderTabela(concluidos, 'concluido')}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default StatusPedido;
