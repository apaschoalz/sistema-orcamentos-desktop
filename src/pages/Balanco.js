import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useSyncVersion } from '../SyncContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Balanco = () => {
    const syncVersion = useSyncVersion();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalVendas: 0,
        categorias: {
            'Persianas': 0,
            'Cortinas': 0,
            'Papel de Parede': 0,
            'Tapetes': 0,
            'Outros': 0
        },
        receitaTotal: 0,
        despesasTotal: 0
    });

    useEffect(() => {
        loadData();
    }, [syncVersion]);

    const loadData = async () => {
        try {
            setLoading(true);
            const orcamentos = await window.electronAPI.getOrcamentos();
            const vendas = await window.electronAPI.getVendas();
            const custos = await window.electronAPI.getCustos();

            // Calcular categorias
            // Precisamos dos itens dos orçamentos que viraram vendas
            // Venda tem orcamento_id. Vamos pegar os itens desses orçamentos.

            const categoriaCounts = {
                'Persianas': 0,
                'Cortinas': 0,
                'Papel de Parede': 0,
                'Tapetes': 0,
                'Outros': 0
            };

            const produtosMap = {};

            for (const venda of vendas) {
                if (!venda.orcamento_id) continue;
                const itens = await window.electronAPI.getItensOrcamento(venda.orcamento_id);

                itens.forEach(item => {
                    // Contagem de Categorias
                    let cat = item.categoria;
                    if (!cat) {
                        const desc = item.descricao.toLowerCase();
                        if (desc.includes('persiana') || desc.includes('rolô') || desc.includes('double vision')) cat = 'Persianas';
                        else if (desc.includes('cortina') || desc.includes('linho') || desc.includes('voil')) cat = 'Cortinas';
                        else if (desc.includes('papel') || desc.includes('parede')) cat = 'Papel de Parede';
                        else if (desc.includes('tapete')) cat = 'Tapetes';
                        else cat = 'Outros';
                    }

                    if (categoriaCounts[cat] !== undefined) {
                        categoriaCounts[cat] += (item.quantidade || 1);
                    } else {
                        categoriaCounts['Outros'] += (item.quantidade || 1);
                    }

                    // Detalhamento de Produtos (Agrupar por descrição)
                    const produtoNome = item.descricao || 'Item sem descrição';
                    if (!produtosMap[produtoNome]) {
                        produtosMap[produtoNome] = {
                            nome: produtoNome,
                            quantidade: 0,
                            valor: 0,
                            categoria: cat
                        };
                    }
                    produtosMap[produtoNome].quantidade += (parseFloat(item.quantidade) || 0);
                    produtosMap[produtoNome].valor += (parseFloat(item.valor_total) || 0);
                });
            }

            // Converter map para array e ordenar por valor
            const produtosLista = Object.values(produtosMap).sort((a, b) => b.valor - a.valor);

            const totalVendasValor = vendas.reduce((acc, v) => acc + (v.valor || 0), 0);
            const totalCustosValor = custos.reduce((acc, c) => acc + (c.valor || 0), 0);

            setStats({
                totalVendas: vendas.length,
                categorias: categoriaCounts,
                receitaTotal: totalVendasValor,
                despesasTotal: totalCustosValor,
                produtos: produtosLista // Novo estado
            });

        } catch (error) {
            console.error('Erro ao calcular balanço:', error);
        } finally {
            setLoading(false);
        }
    };

    const doughnutData = {
        labels: Object.keys(stats.categorias),
        datasets: [
            {
                data: Object.values(stats.categorias),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ],
                borderWidth: 1,
            },
        ],
    };

    const financeiroData = {
        labels: ['Receitas', 'Despesas', 'Saldo'],
        datasets: [
            {
                label: 'Financeiro (R$)',
                data: [
                    stats.receitaTotal,
                    stats.despesasTotal,
                    stats.receitaTotal - stats.despesasTotal
                ],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)'
                ],
            }
        ]
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    if (loading) return <div className="p-4">Carregando balanço...</div>;

    return (
        <div className="container-fluid p-4">
            <h2 className="mb-4"><i className="fas fa-chart-pie me-2"></i>Balanço Geral</h2>

            <div className="row g-4 mb-5">
                <div className="col-md-4">
                    <div className="card h-100 text-center border-0 shadow-sm bg-success text-white">
                        <div className="card-body">
                            <h5 className="card-title opacity-75">Receita Total de Vendas</h5>
                            <h2 className="display-6 fw-bold">{formatCurrency(stats.receitaTotal)}</h2>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card h-100 text-center border-0 shadow-sm bg-danger text-white">
                        <div className="card-body">
                            <h5 className="card-title opacity-75">Despesas Totais</h5>
                            <h2 className="display-6 fw-bold">{formatCurrency(stats.despesasTotal)}</h2>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card h-100 text-center border-0 shadow-sm bg-primary text-white">
                        <div className="card-body">
                            <h5 className="card-title opacity-75">Saldo Líquido</h5>
                            <h2 className="display-6 fw-bold">{formatCurrency(stats.receitaTotal - stats.despesasTotal)}</h2>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-5">
                <div className="col-md-6">
                    <div className="card h-100 shadow-sm">
                        <div className="card-header bg-white">
                            <h5 className="mb-0">Vendas por Categoria (Quantidade)</h5>
                        </div>
                        <div className="card-body d-flex justify-content-center">
                            <div style={{ maxWidth: '400px', width: '100%' }}>
                                <Doughnut data={doughnutData} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-6">
                    <div className="card h-100 shadow-sm">
                        <div className="card-header bg-white">
                            <h5 className="mb-0">Resumo Financeiro</h5>
                        </div>
                        <div className="card-body d-flex justify-content-center">
                            <div style={{ width: '100%' }}>
                                <Bar data={financeiroData} options={{ responsive: true }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nova Seção: Detalhamento de Produtos */}
            <div className="row g-4">
                <div className="col-12">
                    <div className="card shadow-sm">
                        <div className="card-header bg-white">
                            <h5 className="mb-0"><i className="fas fa-list-ol me-2"></i>Detalhamento de Produtos Vendidos</h5>
                        </div>
                        <div className="card-body">
                            {stats.produtos && stats.produtos.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Produto / Modelo</th>
                                                <th>Categoria</th>
                                                <th className="text-center">Qtd. Vendida</th>
                                                <th className="text-end">Valor Total (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.produtos.map((prod, index) => (
                                                <tr key={index}>
                                                    <td>{prod.nome}</td>
                                                    <td><span className="badge bg-light text-dark border">{prod.categoria || 'Outros'}</span></td>
                                                    <td className="text-center">{prod.quantidade}</td>
                                                    <td className="text-end fw-bold">{formatCurrency(prod.valor)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted text-center my-4">Nenhum dado de produto disponível.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Balanco;
