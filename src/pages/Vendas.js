import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

function Vendas() {
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();
    const [vendas, setVendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');

    // Estados para o gráfico
    const [showChartModal, setShowChartModal] = useState(false);
    const [chartType, setChartType] = useState('vendas'); // 'vendas' ou 'lucro'
    const [periodo, setPeriodo] = useState('mensal'); // mensal, trimestral, semestral, anual, personalizado
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        loadVendas();
    }, [syncVersion]);

    useEffect(() => {
        if (showChartModal) {
            processChartData();
        }
    }, [showChartModal, periodo, chartType, vendas, customStart, customEnd]);

    const loadVendas = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getVendas();
                setVendas(data);
            }
        } catch (error) {
            console.error('Erro ao carregar vendas:', error);
        } finally {
            setLoading(false);
        }
    };

    const processChartData = () => {
        if (!vendas.length) return;

        let filteredVendas = [...vendas];

        // Filtragem por período
        if (periodo === 'personalizado') {
            if (customStart && customEnd) {
                const start = new Date(customStart + 'T00:00:00');
                const end = new Date(customEnd + 'T23:59:59');
                filteredVendas = filteredVendas.filter(v => {
                    const d = new Date(v.data_venda + 'T12:00:00');
                    return d >= start && d <= end;
                });
            }
        } else {
            // Lógica simples para os outros períodos: Filtra os últimos X meses
            // Nota: O código anterior não filtrava de fato, apenas agrupava tudo.
            // Para manter consistência com o comportamento anterior (mostrar tudo agrupado), 
            // não vou adicionar filtragem de data explícita para os presets, 
            // assumindo que o usuário quer ver todo o histórico agrupado daquela forma.
            // Se fosse para filtrar "Últimos 12 meses", deveria ser feito aqui.
        }

        // Agrupar dados
        const groups = {};

        filteredVendas.forEach(venda => {
            const date = new Date(venda.data_venda + 'T12:00:00'); // Compensar timezone simples
            let key = '';

            // Lógica de Agrupamento
            if (periodo === 'mensal' || periodo === 'personalizado') {
                // Personalizado também agrupa por mês por padrão
                key = `${date.getMonth() + 1}/${date.getFullYear()}`;
            } else if (periodo === 'trimestral') {
                const tri = Math.ceil((date.getMonth() + 1) / 3);
                key = `T${tri}/${date.getFullYear()}`;
            } else if (periodo === 'semestral') {
                const sem = Math.ceil((date.getMonth() + 1) / 6);
                key = `S${sem}/${date.getFullYear()}`;
            } else {
                key = `${date.getFullYear()}`;
            }

            if (!groups[key]) groups[key] = 0;
            groups[key] += chartType === 'vendas' ? (venda.valor || 0) : (venda.lucro || 0);
        });

        const dataPoints = Object.keys(groups).map(key => ({
            label: key,
            value: groups[key]
        }));

        // Ordenar
        dataPoints.sort((a, b) => {
            const partsA = a.label.split('/');
            const partsB = b.label.split('/');
            if (partsA.length > 1) { // MM/YYYY ou TX/YYYY
                // Tratamento especial para T/S se necessário, mas o split funciona se for numérico
                // Se for T1/2024, partsA[0] é T1.
                if (partsA[0].startsWith('T') || partsA[0].startsWith('S')) {
                    const numA = parseInt(partsA[0].substring(1));
                    const numB = parseInt(partsB[0].substring(1));
                    const yearA = parseInt(partsA[1]);
                    const yearB = parseInt(partsB[1]);
                    if (yearA !== yearB) return yearA - yearB;
                    return numA - numB;
                }
                const dateA = new Date(partsA[1], partsA[0] - 1);
                const dateB = new Date(partsB[1], partsB[0] - 1);
                return dateA - dateB;
            }
            return parseInt(a.label) - parseInt(b.label);
        });

        setChartData(dataPoints);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        // Correção de timezone para datas YYYY-MM-DD
        if (typeof dateStr === 'string' && !dateStr.includes('T') && dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    // Filtro de busca
    const vendasFiltradas = busca.trim()
        ? vendas.filter(v => {
            const q = busca.toLowerCase();
            return (
                (v.cliente_nome    || '').toLowerCase().includes(q) ||
                (v.cliente_cpf_cnpj|| '').toLowerCase().includes(q) ||
                (v.cliente_email   || '').toLowerCase().includes(q) ||
                (v.cliente_endereco|| '').toLowerCase().includes(q) ||
                (v.cliente_bairro  || '').toLowerCase().includes(q) ||
                (v.cliente_cidade  || '').toLowerCase().includes(q) ||
                (v.numero          || '').toLowerCase().includes(q) ||
                (v.orcamento_numero|| '').toLowerCase().includes(q)
            );
        })
        : vendas;

    // Calcular totais
    const totalVendas = vendas.reduce((acc, v) => acc + (v.valor || 0), 0);
    const totalLucro = vendas.reduce((acc, v) => acc + (v.lucro || 0), 0);

    // Novo Gráfico de Barras (Alinhado à Esquerda e Dinâmico)
    const renderChart = () => {
        if (!chartData.length) return <p style={{ textAlign: 'center', marginTop: '20px' }}>Sem dados para o período selecionado.</p>;

        const maxValue = Math.max(...chartData.map(d => d.value)) * 1.1 || 100;
        const height = 300;
        const padding = 40;

        // Configuração de Barras Fixas
        const barWidth = 60;
        const barGap = 30;

        // Largura dinâmica: se houver muitas barras, expande. Se poucas, mantém mínimo de 800 (ou ajusta).
        // 800px é a largura do container visível (modal max-width 800).
        // A SVG deve crescer para permitir scroll.
        const contentWidth = padding * 2 + chartData.length * (barWidth + barGap);
        const width = Math.max(800, contentWidth);

        const chartHeight = height - (padding * 2);

        // Cor baseada no tipo
        const barColor = chartType === 'vendas' ? '#4CAF50' : '#2196F3';

        return (
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #eee',
                color: '#333',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '500' }}>
                        {chartType === 'vendas' ? 'Evolução de Vendas' : 'Evolução do Lucro'}
                    </h3>
                </div>

                <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'flex-start' }}> {/* Align start for left-to-right flow */}
                    <svg width={width} height={height} style={{ backgroundColor: '#fff' }}>

                        {/* Barras - Alinhamento Esquerda */}
                        {chartData.map((d, i) => {
                            const valueHeight = (d.value / maxValue || 0) * chartHeight;

                            // Posição X: Padding Left + Índice * (Largura + Espaço)
                            const x = padding + (i * (barWidth + barGap));
                            const y = height - padding - valueHeight;

                            return (
                                <g key={i}>
                                    {/* Barra */}
                                    <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={valueHeight}
                                        fill={barColor}
                                        rx="4" // Rounded corners top
                                        ry="4"
                                    />

                                    {/* Labels Eixo X */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={height - 15}
                                        textAnchor="middle"
                                        fill="#666"
                                        fontSize="11"
                                        fontFamily="sans-serif"
                                    >
                                        {d.label}
                                    </text>

                                    {/* Valor acima da barra */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={y - 5}
                                        textAnchor="middle"
                                        fill="#333"
                                        fontSize="10"
                                        fontWeight="bold"
                                    >
                                        {d.value > 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
                                    </text>
                                </g>
                            );
                        })}

                    </svg>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Vendas</h1>
                    <p className="page-subtitle">Registro de vendas realizadas</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/vendas/nova')}>
                    <i className="fas fa-plus"></i>
                    Nova Venda
                </button>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div
                    className="stat-card clickable"
                    onClick={() => { setChartType('vendas'); setShowChartModal(true); }}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}>
                        <i className="fas fa-dollar-sign"></i>
                    </div>
                    <div className="stat-info">
                        <h3>Total em Vendas</h3>
                        <p>{formatCurrency(totalVendas)}</p>
                        <small style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Clique para ver evolução</small>
                    </div>
                </div>
                <div
                    className="stat-card clickable"
                    onClick={() => { setChartType('lucro'); setShowChartModal(true); }}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#2196F3' }}>
                        <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="stat-info">
                        <h3>Lucro Total</h3>
                        <p>{formatCurrency(totalLucro)}</p>
                        <small style={{ color: 'var(--secondary)', fontSize: '0.8rem' }}>Clique para ver evolução</small>
                    </div>
                </div>
            </div>

            {/* Busca */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-search" style={{ color: 'var(--text-muted)' }}></i>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Buscar por cliente, CPF, e-mail, endereço, código..."
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
                        {vendasFiltradas.length} resultado(s) encontrado(s)
                    </p>
                )}
            </div>

            <div className="card">
                {vendas.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-shopping-cart"></i>
                        <h3>Nenhuma venda registrada</h3>
                        <p>Registre uma nova venda ou converta um orçamento aprovado.</p>
                    </div>
                ) : vendasFiltradas.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <h3>Nenhuma venda encontrada</h3>
                        <p>Tente outro termo de busca.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Cód. Venda</th>
                                    <th>Cliente</th>
                                    <th>Orçamento</th>
                                    <th>Valor Total</th>
                                    <th>Lucro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendasFiltradas.map((venda) => (
                                    <tr
                                        key={venda.id}
                                        className="clickable-row"
                                        onClick={() => navigate(`/vendas/${venda.id}`)}
                                        style={{ cursor: 'pointer' }}
                                        title="Ver detalhes da venda"
                                    >
                                        <td>{formatDate(venda.data_venda)}</td>
                                        <td><strong>{venda.numero}</strong></td>
                                        <td>{venda.cliente_nome || '-'}</td>
                                        <td>{venda.orcamento_numero ? `#${venda.orcamento_numero}` : '-'}</td>
                                        <td>{formatCurrency(venda.valor)}</td>
                                        <td style={{ color: '#4CAF50', fontWeight: 'bold' }}>{formatCurrency(venda.lucro)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Gráfico */}
            {showChartModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', margin: '20px' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="card-title">
                                Evolução de {chartType === 'vendas' ? 'Vendas' : 'Lucro'}
                            </h2>
                            <button className="btn-icon" onClick={() => setShowChartModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <button className={`btn btn-sm ${periodo === 'mensal' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriodo('mensal')}>Mensal</button>
                                <button className={`btn btn-sm ${periodo === 'trimestral' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriodo('trimestral')}>Trimestral</button>
                                <button className={`btn btn-sm ${periodo === 'semestral' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriodo('semestral')}>Semestral</button>
                                <button className={`btn btn-sm ${periodo === 'anual' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriodo('anual')}>Anual</button>
                                <button className={`btn btn-sm ${periodo === 'personalizado' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriodo('personalizado')}>Personalizado</button>
                            </div>

                            {periodo === 'personalizado' && (
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ marginRight: '5px', fontSize: '0.9rem' }}>De:</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            style={{ padding: '5px' }}
                                            value={customStart}
                                            onChange={(e) => setCustomStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ marginRight: '5px', fontSize: '0.9rem' }}>Até:</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            style={{ padding: '5px' }}
                                            value={customEnd}
                                            onChange={(e) => setCustomEnd(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {renderChart()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Vendas;
