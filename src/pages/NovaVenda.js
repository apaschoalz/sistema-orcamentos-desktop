import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function NovaVenda() {
    const navigate = useNavigate();
    const { orcamentoId, id } = useParams(); // id para edição, orcamentoId para nova venda de orçamento
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [clientes, setClientes] = useState([]);
    const [orcamentosCliente, setOrcamentosCliente] = useState([]);

    const [venda, setVenda] = useState({
        numero: '',
        cliente_id: '',
        orcamento_id: '',
        data_venda: new Date().toISOString().split('T')[0],
        valor: 0,
        custo: 0,
        costureira: 0,
        instalacao: 0,
        outros_custos: 0,
        lucro: 0,
        observacoes: '',
        valor_entrada: 0,
        falta_pagar: 0,
        desconto: 0,
        subtotal: 0
    });

    useEffect(() => {
        loadInitialData();
    }, [id, orcamentoId]); // Recarregar se IDs mudarem

    useEffect(() => {
        if (venda.cliente_id) {
            loadOrcamentosDoCliente(venda.cliente_id);
        } else {
            setOrcamentosCliente([]);
        }
    }, [venda.cliente_id]);

    // Removed useEffect for calculations to avoid input locking issues

    const loadInitialData = async () => {
        setLoading(true);
        try {
            if (window.electronAPI) {
                // Carregar clientes
                const clientesData = await window.electronAPI.getClientes();
                setClientes(clientesData);

                if (isEditing) {
                    // Carregar venda existente
                    const dadosVenda = await window.electronAPI.getVendaById(id);
                    if (dadosVenda) {
                        const valor = dadosVenda.valor || 0;
                        const desconto = dadosVenda.desconto || 0;
                        const subtotal = valor + desconto;

                        setVenda({
                            ...dadosVenda,
                            // Garantir que valores nulos venham zerados
                            valor: valor,
                            custo: dadosVenda.custo || 0,
                            costureira: dadosVenda.costureira || 0,
                            instalacao: dadosVenda.instalacao || 0,
                            outros_custos: dadosVenda.outros_custos || 0,
                            lucro: dadosVenda.lucro || 0,
                            valor_entrada: dadosVenda.valor_entrada || 0,
                            falta_pagar: dadosVenda.falta_pagar || 0,
                            desconto: desconto,
                            subtotal: subtotal
                        });
                        // Carregar orçamentos deste cliente
                        if (dadosVenda.cliente_id) {
                            loadOrcamentosDoCliente(dadosVenda.cliente_id);
                        }
                    }
                } else {
                    // Nova Venda
                    const num = await window.electronAPI.getNextNumeroVenda();
                    setVenda(prev => ({ ...prev, numero: num }));

                    // Se houver orcamentoId na URL
                    if (orcamentoId) {
                        // Check if sale exists for this budget
                        const existingSale = await window.electronAPI.getVendaByOrcamentoId(orcamentoId);
                        if (existingSale) {
                            alert(`O Orçamento ${existingSale.orcamento_numero} já possui uma venda registrada (Venda ${existingSale.numero}).\n\nRedirecionando para a venda existente.`);
                            navigate(`/vendas/${existingSale.id}`);
                            return;
                        }

                        const orc = await window.electronAPI.getOrcamentoById(orcamentoId);
                        if (orc) {
                            setVenda(prev => ({
                                ...prev,
                                cliente_id: orc.cliente_id,
                                orcamento_id: orc.id,
                                valor: orc.valor_total || 0,
                                subtotal: orc.valor_total || 0,
                                desconto: 0
                            }));
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadOrcamentosDoCliente = async (clienteId) => {
        try {
            if (window.electronAPI) {
                const orcs = await window.electronAPI.getOrcamentosByCliente(clienteId);
                setOrcamentosCliente(orcs);
            }
        } catch (error) {
            console.error('Erro ao carregar orçamentos:', error);
        }
    };



    const handleChange = (e) => {
        const { name, value } = e.target;

        setVenda(prev => {
            const next = { ...prev, [name]: value };

            // Lógica de Desconto e Subtotal
            if (name === 'desconto') {
                const desc = parseFloat(value) || 0;
                const sub = parseFloat(prev.subtotal) || 0;
                next.valor = sub - desc;
            } else if (name === 'subtotal') {
                const sub = parseFloat(value) || 0;
                const desc = parseFloat(prev.desconto) || 0;
                next.valor = sub - desc;
            } else if (name === 'valor') {
                // Se editar o valor final direto, ajusta o subtotal (mantém desconto fixo)
                // OU ajusta o desconto?
                // Vamos ajustar o subtotal para manter coerência simples
                const val = parseFloat(value) || 0;
                const desc = parseFloat(prev.desconto) || 0;
                next.subtotal = val + desc;
            }

            // Recalcular campos financeiros automaticamente
            const valor = parseFloat(next.valor) || 0;
            const custo = parseFloat(next.custo) || 0;
            const costureira = parseFloat(next.costureira) || 0;
            const instalacao = parseFloat(next.instalacao) || 0;
            const outros = parseFloat(next.outros_custos) || 0;
            const entrada = parseFloat(next.valor_entrada) || 0;

            const totalCustos = custo + costureira + instalacao + outros;
            next.lucro = valor - totalCustos;
            next.falta_pagar = valor - entrada;

            return next;
        });
    };

    const handleSave = async () => {
        if (!venda.cliente_id) {
            alert('Selecione um cliente.');
            return;
        }

        if (!venda.orcamento_id) {
            alert('Você deve atribuir um orçamento vinculado à venda. Campo obrigatório.');
            return;
        }

        // Final check for duplicates before saving (especially for manual selection)
        if (venda.orcamento_id && window.electronAPI) {
            try {
                const existingSale = await window.electronAPI.getVendaByOrcamentoId(venda.orcamento_id);
                // If exists and it's NOT the current sale we are editing
                if (existingSale && existingSale.id !== id) {
                    alert(`O Orçamento ${existingSale.orcamento_numero} já possui uma venda registrada (Venda ${existingSale.numero}).\n\nNão é possível criar duplicatas.`);

                    const confirm = window.confirm('Deseja abrir a venda existente?');
                    if (confirm) {
                        navigate(`/vendas/${existingSale.id}`);
                    }
                    return;
                }
            } catch (err) {
                console.error("Erro ao verificar duplicidade no salvamento:", err);
                // Fallthrough? Or block? Better block to be safe or alert error.
                alert("Erro ao verificar duplicidade de venda. Tente novamente.");
                return;
            }
        }

        setSaving(true);
        try {
            if (window.electronAPI) {
                if (isEditing) {
                    await window.electronAPI.updateVenda(id, venda);
                    alert('Venda atualizada com sucesso!');
                    navigate(`/vendas/${id}`); // Voltar para detalhes
                } else {
                    await window.electronAPI.createVenda(venda);
                    alert('Venda registrada com sucesso!');
                    navigate('/vendas');
                }
            }
        } catch (error) {
            console.error('Erro ao salvar venda:', error);
            alert('Erro ao salvar venda: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            if (window.electronAPI) {
                await window.electronAPI.deleteVenda(id);
                alert('Venda excluída com sucesso!');
                navigate('/vendas');
            }
        } catch (error) {
            console.error('Erro ao excluir venda:', error);
            alert('Erro ao excluir venda: ' + error.message);
        }
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
                    <h1 className="page-title">{isEditing ? 'Editar Venda' : 'Nova Venda'}</h1>
                    <p className="page-subtitle">
                        {venda.numero && <span style={{ color: 'var(--primary-light)', fontWeight: '600' }}>{venda.numero}</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/vendas')}>
                        <i className="fas fa-arrow-left"></i>
                        Voltar
                    </button>
                    {isEditing && (
                        <button className="btn btn-danger" onClick={handleDelete} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none' }}>
                            <i className="fas fa-trash"></i>
                            Excluir
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <i className="fas fa-save"></i>
                        {saving ? 'Registrar Venda' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Dados da Venda</h2>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Cliente *</label>
                        <select
                            name="cliente_id"
                            value={venda.cliente_id}
                            onChange={handleChange}
                            className="form-input form-select"
                            disabled={!!orcamentoId} // Bloquear se veio de um orçamento específico? Talvez melhor não, deixa flexível.
                        >
                            <option value="">Selecione um cliente...</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Orçamento Vinculado *</label>
                        <select
                            name="orcamento_id"
                            value={venda.orcamento_id}
                            onChange={async (e) => {
                                const orcId = e.target.value;

                                // Check if budget already has a sale
                                if (orcId && window.electronAPI) {
                                    try {
                                        const existingSale = await window.electronAPI.getVendaByOrcamentoId(orcId);
                                        // If exists and it's not the current sale we are editing
                                        if (existingSale && existingSale.id !== id) {
                                            const confirm = window.confirm(
                                                `O Orçamento ${existingSale.orcamento_numero} já possui uma venda registrada (Venda ${existingSale.numero}).\n\n` +
                                                `Deseja abrir a venda existente?`
                                            );

                                            if (confirm) {
                                                navigate(`/vendas/${existingSale.id}`);
                                            }
                                            return;
                                        }
                                    } catch (err) {
                                        console.error("Erro ao verificar venda existente:", err);
                                    }
                                }

                                const orc = orcamentosCliente.find(o => o.id === orcId);
                                const val = orc ? (orc.valor_total || 0) : 0;
                                setVenda(prev => {
                                    const next = {
                                        ...prev,
                                        orcamento_id: orcId,
                                        valor: val, // Reseta valor ao do orçamento
                                        subtotal: val,
                                        desconto: 0
                                    };
                                    // Recalc lucro
                                    const totalCustos = (parseFloat(next.custo) || 0) + (parseFloat(next.costureira) || 0) + (parseFloat(next.instalacao) || 0) + (parseFloat(next.outros_custos) || 0);
                                    next.lucro = next.valor - totalCustos;
                                    next.falta_pagar = next.valor - (parseFloat(next.valor_entrada) || 0);
                                    return next;
                                });
                            }}
                            className="form-input form-select"
                            disabled={!venda.cliente_id}
                        >
                            <option value="">Selecione o orçamento do cliente...</option>
                            {orcamentosCliente.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.numero} - {new Date(o.created_at).toLocaleDateString()} - R$ {o.valor_total?.toFixed(2)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Data da Venda</label>
                        <input
                            type="date"
                            name="data_venda"
                            value={venda.data_venda}
                            onChange={handleChange}
                            className="form-input"
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Financeiro & Lucro</h2>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Valor Bruto (Subtotal)</label>
                        <input
                            type="number"
                            name="subtotal"
                            value={venda.subtotal}
                            onChange={handleChange}
                            className="form-input"
                            step="0.01"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Desconto (R$)</label>
                        <input
                            type="number"
                            name="desconto"
                            value={venda.desconto}
                            onChange={handleChange}
                            className="form-input"
                            step="0.01"
                            style={{ borderColor: venda.desconto > 0 ? '#ffc107' : '' }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Valor Líquido (Total)</label>
                        <input
                            type="number"
                            name="valor"
                            value={venda.valor}
                            onChange={handleChange}
                            className="form-input"
                            step="0.01"
                            style={{ fontWeight: 'bold' }}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Lucro Estimado</label>
                        <div className="form-input" style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold', color: venda.lucro >= 0 ? 'green' : 'red' }}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.lucro)}
                        </div>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Valor de Entrada (R$)</label>
                        <input
                            type="number"
                            name="valor_entrada"
                            value={venda.valor_entrada}
                            onChange={handleChange}
                            className="form-input"
                            step="0.01"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Falta Pagar</label>
                        <div className="form-input" style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold', color: venda.falta_pagar > 0.01 ? '#dc3545' : 'green' }}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.falta_pagar)}
                        </div>
                    </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', marginTop: '20px', marginBottom: '10px', color: 'var(--text-muted)' }}>Custos</h3>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Custo Geral/Material</label>
                        <input
                            type="number"
                            name="custo"
                            value={venda.custo}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Costureira</label>
                        <input
                            type="number"
                            name="costureira"
                            value={venda.costureira}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Instalação</label>
                        <input
                            type="number"
                            name="instalacao"
                            value={venda.instalacao}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Outros Custos</label>
                        <input
                            type="number"
                            name="outros_custos"
                            value={venda.outros_custos}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="form-group">
                    <label className="form-label">Observações</label>
                    <textarea
                        name="observacoes"
                        value={venda.observacoes}
                        onChange={handleChange}
                        className="form-input form-textarea"
                        placeholder="Detalhes adicionais sobre a venda..."
                    />
                </div>
            </div>
        </div>
    );
}

export default NovaVenda;
