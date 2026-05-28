import React from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (ds) => {
    if (!ds) return '—';
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
};

const BoletoAlertModal = ({ boletos, onClose, onMarcarPago }) => {
    if (!boletos || boletos.length === 0) return null;

    const total = boletos.reduce((s, b) => s + (b.valor || 0), 0);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(44,40,36,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '22px',
                border: '2px solid rgba(232,184,74,0.45)',
                maxWidth: '580px',
                width: '100%',
                maxHeight: '82vh',
                overflow: 'hidden',
                boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                display: 'flex',
                flexDirection: 'column',
            }}>

                {/* Header */}
                <div style={{
                    padding: '24px 28px',
                    borderBottom: '1px solid var(--border)',
                    background: 'linear-gradient(135deg, rgba(232,184,74,0.12) 0%, rgba(199,93,93,0.06) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px'
                }}>
                    <div style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '16px',
                        background: 'rgba(232,184,74,0.18)',
                        border: '2px solid rgba(232,184,74,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.7rem',
                        flexShrink: 0,
                        animation: 'pulse 2s infinite'
                    }}>
                        🔔
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)', lineHeight: 1.2 }}>
                            Boletos para Pagar Hoje
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                            {boletos.length} boleto{boletos.length > 1 ? 's' : ''} com vencimento hoje
                            {' • '}
                            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(total)}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            border: '1px solid var(--border)', background: 'var(--bg-card-hover)',
                            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Boletos list */}
                <div style={{
                    overflowY: 'auto',
                    padding: '20px 28px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {boletos.map((b) => (
                        <div key={b.id} style={{
                            background: '#FFFFFF',
                            borderRadius: '14px',
                            border: '1px solid var(--border)',
                            borderLeft: '4px solid var(--warning)',
                            padding: '16px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="fas fa-barcode" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}></i>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.descricao}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    {b.fornecedor && (
                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <i className="fas fa-building" style={{ fontSize: '0.72rem' }}></i>
                                            {b.fornecedor}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <i className="fas fa-calendar-day" style={{ fontSize: '0.72rem' }}></i>
                                        Vence: {fmtDate(b.data_vencimento)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--danger)' }}>
                                    {fmt(b.valor)}
                                </div>
                                <button
                                    onClick={() => onMarcarPago(b.id)}
                                    style={{
                                        padding: '7px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, var(--secondary) 0%, #b08a28 100%)',
                                        color: 'white',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 2px 8px rgba(201,169,98,0.3)'
                                    }}
                                >
                                    <i className="fas fa-check"></i>
                                    Marcar Pago
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 28px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-card-hover)'
                }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Total: <strong style={{ color: 'var(--danger)', fontSize: '1rem' }}>{fmt(total)}</strong>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 28px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BoletoAlertModal;
