import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

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
                // Filtrar apenas vendas com fluxo iniciado e não concluído (opcional)
                // O usuário pediu "todos os fluxos ... para verificar"
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

    // Função para calcular dias passados
    const getDaysSince = (dateStr) => {
        if (!dateStr) return 0;
        const start = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Lógica de Alertas
    const checkAlert = (tipo, etapa, dataInicio) => {
        if (!etapa || !dataInicio) return null; // Sem dados suficientes

        const days = getDaysSince(dataInicio);
        let limit = null;

        if (tipo === 'Cortina') {
            if (etapa === 'Pedir para a fábrica' || etapa === 'Aguardando entrega da fábrica') limit = 7; // "Apos pedido enviado"
            // Nota: Se "Pedir para a fábrica" significa que AINDA NÃO ENVIOU, o alerta seria "está parado no pedido".
            // Se for "Aguardando fábrica", já enviou.
            // O user disse: "Apos o pedido enviado para fabrica [...] passar de 7 dias" -> Etapa deve ser 'Aguardando entrega da fábrica' ?
            // Mas o fluxo definido em VendaDetalhes é: 'Pedir para a fábrica' -> 'Tecido no estoque' (Opa, parece que faltou 'Aguardando' no array de Cortina em VendaDetalhes ou ele pula direto)
            // Checando VendaDetalhes array: ['Pedir para a fábrica', 'Tecido no estoque', 'Enviado a costureira', 'No estoque (Separação)', 'No estoque (Instalação)', 'Instalado']
            // Entendo que 'Pedir para a fábrica' é o estado inicial de "A fazer". Se ficar muito tempo ali, é alerta? O user disse "Apos pedido enviado".
            // Vou considerar o primeiro estado como "Em processo de pedido/envio".

            if (etapa === 'Tecido no estoque') limit = 2;
            if (etapa === 'Enviado a costureira') limit = 4;
            if (etapa === 'No estoque (Separação)') limit = 2; // "No estoque separacao"
            if (etapa === 'No estoque (Instalação)') limit = 2; // "No estoque instalacao"
        }

        if (tipo === 'Persiana') {
            if (etapa === 'Aguardando fábrica') limit = 7; // "Apos pedido enviado"
            if (etapa === 'No estoque (Instalação)') limit = 2;
        }

        if (limit !== null && days > limit) {
            return { type: 'danger', msg: `${days} dias (Limite: ${limit})` };
        }
        return null; // Sem alerta
    };

    // Helper para extrair info da etapa (lidando com JSON novo, legado e Ambos)
    const getEtapaInfo = (venda) => {
        let etapas = []; // Array de sub-etapas para exibir

        try {
            let parsed = null;
            if (venda.etapa_atual && venda.etapa_atual.startsWith('{')) {
                try {
                    parsed = JSON.parse(venda.etapa_atual);
                } catch (err) {
                    // Se falhar o parse, trata como string normal
                    parsed = { etapa: venda.etapa_atual, data_inicio: venda.updated_at };
                }
            } else {
                // Legado String (ou se não for JSON válido iniciada com {)
                parsed = { etapa: venda.etapa_atual, data_inicio: venda.updated_at };
            }

            if (venda.tipo_fluxo === 'Ambos') {
                // O fluxo 'Ambos' sempre espera um objeto com keys 'persiana' e 'cortina'
                // Se parsed foi criado via fallback (string), ele não tem esses keys.
                // Mas se veio de JSON.parse, deveria ter.

                // Safety check: se parsed não tem estrutura esperada, fallback
                // Safety check: se parsed não tem estrutura esperada, fallback
                if (!parsed.persiana && !parsed.cortina) {
                    // Caso estranho onde tipo é Ambos mas dado é string simples?
                    let valFallback = parsed.etapa || venda.etapa_atual;
                    if (typeof valFallback === 'object') {
                        valFallback = valFallback.etapa || JSON.stringify(valFallback);
                    }
                    etapas.push({ label: 'Ambos', val: valFallback, alert: null });
                    return etapas;
                }

                // Normaliza propriedades
                // parsed.persiana pode ser string (formato antigo) ou objeto {etapa, data}
                const extractData = (item) => {
                    if (!item) return { val: '-', data: venda.updated_at };
                    if (typeof item === 'string') return { val: item, data: venda.updated_at };

                    // Helper para extrair segurança
                    let etapaVal = item.etapa || '-';
                    if (typeof etapaVal === 'object') {
                        if (etapaVal.etapa && typeof etapaVal.etapa === 'string') {
                            etapaVal = etapaVal.etapa;
                        } else {
                            etapaVal = JSON.stringify(etapaVal);
                        }
                    }

                    return { val: etapaVal, data: item.data_inicio || venda.updated_at };
                };

                const pData = extractData(parsed.persiana);
                const cData = extractData(parsed.cortina);

                // checkAlert espera a etapa como string para comparar
                const alertP = checkAlert('Persiana', pData.val, pData.data);
                const alertC = checkAlert('Cortina', cData.val, cData.data);

                etapas.push({
                    label: 'Persiana',
                    val: pData.val,
                    alert: alertP
                });
                etapas.push({
                    label: 'Cortina',
                    val: cData.val,
                    alert: alertC
                });

            } else {
                // Fluxo Único
                // parsed pode ser: 
                // 1. { etapa: "...", data_inicio: "..." } (Novo ou Fallback)
                // 2. "String pura" (se o JSON.parse retornou uma string, o que é raro com startsWith('{') check, mas possível se for "{...}" string??)

                let etapaVal = '';
                let dataVal = venda.updated_at;

                if (typeof parsed === 'object' && parsed !== null) {
                    etapaVal = parsed.etapa || '';
                    if (parsed.data_inicio) dataVal = parsed.data_inicio;
                } else if (typeof parsed === 'string') {
                    etapaVal = parsed;
                }

                // Se etapaVal for objeto (casos bizarros), força string
                if (typeof etapaVal === 'object') etapaVal = JSON.stringify(etapaVal);

                const alert = checkAlert(venda.tipo_fluxo, etapaVal, dataVal);

                etapas.push({
                    label: venda.tipo_fluxo,
                    val: etapaVal,
                    alert: alert
                });
            }
        } catch (e) {
            console.error("Erro no parse de etapas:", e);
            // Fallback total
            etapas.push({ label: venda.tipo_fluxo, val: typeof venda.etapa_atual === 'string' ? venda.etapa_atual : 'Erro', alert: null });
        }

        return etapas;
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Status do Pedido</h1>
                    <p className="page-subtitle">Acompanhamento e alertas de produção</p>
                </div>
            </div>

            <div className="card">
                {vendas.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-check-circle"></i>
                        <h3>Tudo em ordem!</h3>
                        <p>Não há pedidos em andamento no momento.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Pedido</th>
                                    <th>Cliente</th>
                                    <th>Data Venda</th>
                                    <th>Fluxo</th>
                                    <th>Etapa Atual / Alertas</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendas.map(v => {
                                    const etapasInfo = getEtapaInfo(v);

                                    return (
                                        <tr key={v.id} className="clickable-row">
                                            <td><strong>{v.numero}</strong></td>
                                            <td>{v.cliente_nome || '-'}</td>
                                            <td>{formatDate(v.data_venda)}</td>
                                            <td>{v.tipo_fluxo}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                    {etapasInfo.map((info, idx) => (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                                            {v.tipo_fluxo === 'Ambos' && <strong style={{ fontSize: '0.8rem' }}>{info.label}:</strong>}
                                                            <span>{info.val}</span>
                                                            {info.alert && (
                                                                <span className="badge badge-danger" style={{ backgroundColor: '#ff4444', color: 'white', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                                                    <i className="fas fa-exclamation-triangle"></i> {info.alert.msg}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
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
                )}
            </div>
        </div>
    );
}

export default StatusPedido;
