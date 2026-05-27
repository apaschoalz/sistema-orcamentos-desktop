import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSyncVersion } from '../SyncContext';

function VendaDetalhes() {
    const { id } = useParams();
    const navigate = useNavigate();
    const syncVersion = useSyncVersion();
    const [venda, setVenda] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        loadVenda();
    }, [id, syncVersion]);

    const loadVenda = async () => {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getVendaById(id);
                setVenda(data);
                setHasUnsavedChanges(false);
            }
        } catch (error) {
            console.error('Erro ao carregar venda:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        if (typeof dateStr !== 'string') return '-';
        if (dateStr.includes('T')) {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        }
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        if (typeof dateStr !== 'string') return '-';
        let dateToParse = dateStr;
        if (!dateStr.includes('T') && !dateStr.includes('Z')) {
            dateToParse = dateStr.replace(' ', 'T') + 'Z';
        }
        const date = new Date(dateToParse);
        if (isNaN(date.getTime())) return '-';
        return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR').slice(0, 5)}`;
    };

    // --- Lógica de Workflow ---

    const getFlowSteps = (tipo) => {
        if (tipo === 'Persiana') {
            return [
                'Pedir para a fábrica',
                'Aguardando fábrica',
                'No estoque (Instalação)',
                'Instalado'
            ];
        } else if (tipo === 'Cortina') {
            return [
                'Pedir para a fábrica',
                'Tecido no estoque',
                'Enviado a costureira',
                'No estoque (Separação)',
                'No estoque (Instalação)',
                'Instalado'
            ];
        } else if (tipo === 'Papel de Parede') {
            return [
                'Pedir para a fábrica',
                'Aguardando entrega da fábrica',
                'No estoque (aguardando instalação)',
                'Instalado'
            ];
        } else if (tipo === 'Tapete') {
            return [
                'Pedir para a fábrica',
                'Aguardando entrega da fábrica',
                'No estoque (aguardando entrega)',
                'Entregue'
            ];
        } else {
            return ['Em andamento', 'Concluído'];
        }
    };

    // Helper para obter o estado atual normalizado
    // Retorna string (fluxo simples) ou objeto { persiana: {etapa, data}, cortina: {etapa, data} }
    const getEtapaState = () => {
        if (!venda || !venda.etapa_atual) return null;

        // Tenta fazer parse do JSON (Novo formato e formato Ambos antigo)
        try {
            const parsed = JSON.parse(venda.etapa_atual);

            // Normalização para quando era apenas string dentro do JSON (Ambos antigo)
            if (venda.tipo_fluxo === 'Ambos') {
                if (typeof parsed.persiana === 'string') {
                    parsed.persiana = { etapa: parsed.persiana, data_inicio: venda.updated_at };
                }
                if (typeof parsed.cortina === 'string') {
                    parsed.cortina = { etapa: parsed.cortina, data_inicio: venda.updated_at };
                }
                return parsed;
            } else {
                // Fluxo único salvo como JSON (Novo formato)
                return parsed;
            }
        } catch (e) {
            // Se falhar o parse, é o formato legado (String pura)
            // Converte para o novo formato em tempo de execução para o UI funcionar
            return {
                etapa: venda.etapa_atual,
                data_inicio: venda.updated_at // Usa a última atualização da venda como aproximação
            };
        }
    };

    const getStepIndex = (tipo, etapa) => {
        const steps = getFlowSteps(tipo);
        return steps.indexOf(etapa);
    };

    const calculateProgress = (tipo, etapa) => {
        const steps = getFlowSteps(tipo);
        const currentIndex = getStepIndex(tipo, etapa);
        if (currentIndex === -1) return 0;
        return (currentIndex / (steps.length - 1)) * 100;
    };

    const updateWorkflowLocal = (tipoFluxo, etapaOuState, subTipo = null) => {
        if (!venda) return;

        let updates = { ...venda };
        const nowStr = new Date().toISOString();

        // Helper para construir objeto de etapa com data
        const createEtapaObj = (nomeEtapa) => ({
            etapa: nomeEtapa,
            data_inicio: nowStr // Salva quando esta etapa COMEÇOU
        });

        // Inicializando "Ambos"
        if (tipoFluxo === 'Ambos' && !subTipo && typeof etapaOuState === 'object') {
            // Converter objeto simples {persiana: 'Etapa', ...} para estrutura completa
            const normalizedState = {
                persiana: createEtapaObj(etapaOuState.persiana),
                cortina: createEtapaObj(etapaOuState.cortina)
            };
            updates.tipo_fluxo = 'Ambos';
            updates.etapa_atual = JSON.stringify(normalizedState);
        }
        // Atualizando sub-fluxo de "Ambos"
        else if (venda.tipo_fluxo === 'Ambos' && subTipo) {
            const currentState = getEtapaState(); // Recupera estado atual (já normalizado)

            // Preserva o estado do outro sub-tipo e atualiza apenas o alvo
            const newState = {
                ...currentState,
                [subTipo.toLowerCase()]: {
                    ...currentState[subTipo.toLowerCase()], // Mantém instalador se houver
                    etapa: etapaOuState,
                    data_inicio: nowStr // Reseta a data para AGORA pois mudou de etapa
                }
            };
            updates.etapa_atual = JSON.stringify(newState);
        }
        // Fluxo normal (Cortina, Persiana, etc - Único)
        else {
            updates.tipo_fluxo = tipoFluxo;
            // Salva como JSON para manter consistência e guardar a data
            updates.etapa_atual = JSON.stringify(createEtapaObj(etapaOuState));
        }

        // Reiniciar
        if (tipoFluxo === null) {
            updates = {
                ...venda,
                tipo_fluxo: null,
                etapa_atual: null,
                nome_costureira: null,
                nome_instalador: null
            };
        }

        setVenda(updates);
        setHasUnsavedChanges(true);
    };

    const saveWorkflowChanges = async () => {
        await updateVenda(venda);
        setHasUnsavedChanges(false);
    };

    const avancarEtapa = (tipoFluxo, dadosEtapa, subTipo = null) => {
        const steps = getFlowSteps(tipoFluxo);
        // Extrair nome da etapa (se for objeto ou string)
        const etapaAtualNome = (typeof dadosEtapa === 'object' && dadosEtapa.etapa) ? dadosEtapa.etapa : dadosEtapa;

        const currentIndex = getStepIndex(tipoFluxo, etapaAtualNome);
        if (currentIndex < steps.length - 1) {
            const nextStep = steps[currentIndex + 1];
            if (venda.tipo_fluxo === 'Ambos') {
                updateWorkflowLocal('Ambos', nextStep, subTipo);
            } else {
                updateWorkflowLocal(tipoFluxo, nextStep);
            }
        }
    };

    const retrocederEtapa = (tipoFluxo, dadosEtapa, subTipo = null) => {
        const steps = getFlowSteps(tipoFluxo);
        const etapaAtualNome = (typeof dadosEtapa === 'object' && dadosEtapa.etapa) ? dadosEtapa.etapa : dadosEtapa;

        const currentIndex = getStepIndex(tipoFluxo, etapaAtualNome);
        if (currentIndex > 0) {
            const prevStep = steps[currentIndex - 1];
            if (venda.tipo_fluxo === 'Ambos') {
                updateWorkflowLocal('Ambos', prevStep, subTipo);
            } else {
                updateWorkflowLocal(tipoFluxo, prevStep);
            }
        }
    };

    const updateVenda = async (novosDados) => {
        try {
            if (window.electronAPI) {
                const updated = await window.electronAPI.updateVenda(venda.id, novosDados);
                if (updated) {
                    setVenda(updated);
                }
            }
        } catch (error) {
            console.error('Erro ao atualizar venda:', error);
            alert('Erro ao atualizar status.');
        }
    };

    const updateVendaField = (field, value) => {
        setVenda({ ...venda, [field]: value });
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Helper para atualizar instalador no fluxo "Ambos"
    const updateInstaladorLocal = (subTipo, nome) => {
        if (!venda || venda.tipo_fluxo !== 'Ambos') return;

        const currentState = getEtapaState();
        const newState = {
            ...currentState,
            [subTipo.toLowerCase()]: {
                ...currentState[subTipo.toLowerCase()],
                instalador: nome
            }
        };

        let updates = { ...venda };
        updates.etapa_atual = JSON.stringify(newState);
        setVenda(updates);
        setHasUnsavedChanges(true);
    };

    const isEtapaInstalacao = (tipo, etapa) => {
        if (tipo === 'Persiana') return etapa === 'No estoque (Instalação)';
        if (tipo === 'Cortina') return etapa === 'No estoque (Instalação)';
        if (tipo === 'Papel de Parede') return etapa === 'No estoque (aguardando instalação)';
        return false;
    };

    // --- Componente de Stepper Reutilizável ---
    const renderStepper = (tipo, dadosEtapa, subTipo = null) => {
        const steps = getFlowSteps(tipo);

        // Resolver Nome, Data e Instalador
        let etapaNome, etapaData, instaladorNome;

        if (subTipo) {
            // Fluxo Ambos (objeto)
            etapaNome = dadosEtapa?.etapa;
            etapaData = dadosEtapa?.updated_at;
            instaladorNome = dadosEtapa?.instalador;
        } else {
            // Fluxo Simples (string)
            // Fix para erro #31: dadosEtapa pode ser um objeto {etapa, data_inicio} vindo do getEtapaState
            if (typeof dadosEtapa === 'object' && dadosEtapa !== null) {
                etapaNome = dadosEtapa.etapa || JSON.stringify(dadosEtapa);
            } else {
                etapaNome = dadosEtapa;
            }
            etapaData = venda.updated_at;
            instaladorNome = venda.nome_instalador;
        }

        const progress = calculateProgress(tipo, etapaNome);
        const showInstaladorInput = isEtapaInstalacao(tipo, etapaNome);
        const costureiraNome = venda.nome_costureira;

        return (
            <div className="stepper-wrapper" style={{ marginBottom: '40px' }}>
                {subTipo ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: 'var(--primary)' }}>Fluxo {tipo}</h4>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            {tipo === 'Cortina' && costureiraNome && (
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    <i className="fas fa-cut"></i> {costureiraNome}
                                </span>
                            )}
                            {instaladorNome && (
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    <i className="fas fa-tools"></i> {instaladorNome}
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    // Se for fluxo único, não precisa de título extra se já tem no card, mas o instalador pode aparecer aqui também
                    <div style={{ marginBottom: '20px', textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        {tipo === 'Cortina' && costureiraNome && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginRight: '15px' }}>
                                <i className="fas fa-cut"></i> <strong>Costureira:</strong> {costureiraNome}
                            </span>
                        )}
                        {instaladorNome && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                <i className="fas fa-tools"></i> <strong>Instalador:</strong> {instaladorNome}
                            </span>
                        )}
                    </div>
                )}

                <div className="stepper-container" style={{ margin: '30px 0', display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                    {/* Linha de progresso */}
                    <div style={{
                        position: 'absolute', top: '15px', left: '0', right: '0', height: '2px', backgroundColor: '#e0e0e0', zIndex: 0
                    }}>
                        <div style={{
                            height: '100%', backgroundColor: 'var(--primary)', width: `${progress}%`, transition: 'width 0.3s ease'
                        }}></div>
                    </div>

                    {steps.map((step, index) => {
                        const isCompleted = getStepIndex(tipo, etapaNome) >= index;
                        const isCurrent = etapaNome === step;

                        return (
                            <div key={index} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                                <div
                                    onClick={() => {
                                        if (venda.tipo_fluxo === 'Ambos') {
                                            updateWorkflowLocal('Ambos', step, subTipo);
                                        } else {
                                            updateWorkflowLocal(tipo, step);
                                        }
                                    }}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        backgroundColor: isCompleted ? 'var(--primary)' : '#fff',
                                        border: `2px solid ${isCompleted ? 'var(--primary)' : '#e0e0e0'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: isCompleted ? '#fff' : '#999',
                                        fontWeight: 'bold', cursor: 'pointer', marginBottom: '8px',
                                        transition: 'all 0.2s',
                                        boxShadow: isCurrent ? '0 0 0 4px rgba(71, 140, 207, 0.2)' : 'none'
                                    }}
                                >
                                    {isCompleted && !isCurrent ? <i className="fas fa-check" style={{ fontSize: '12px' }}></i> : index + 1}
                                </div>
                                <span style={{ textAlign: 'center', fontSize: '12px', color: isCurrent ? 'var(--primary)' : (isCompleted ? 'var(--text-color)' : 'var(--text-muted)'), fontWeight: isCurrent ? 'bold' : 'normal' }}>
                                    {step}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Controles do Stepper */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h4 style={{ margin: '0 0 5px 0' }}>Etapa Atual: <span style={{ color: 'var(--primary' }}>{etapaNome}</span></h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Atualizado em: {formatDateTime(etapaData)}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={() => retrocederEtapa(tipo, dadosEtapa, subTipo)} disabled={getStepIndex(tipo, etapaNome) === 0}>
                                <i className="fas fa-chevron-left"></i> Voltar
                            </button>
                            <button className="btn btn-success" onClick={() => avancarEtapa(tipo, dadosEtapa, subTipo)} disabled={getStepIndex(tipo, etapaNome) === steps.length - 1} style={{ backgroundColor: '#4CAF50', border: 'none', color: 'white' }}>
                                Avançar <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    {/* Input de Instalador (específico ou global) */}
                    {showInstaladorInput && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                            <label className="form-label" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                <i className="fas fa-tools" style={{ marginRight: '8px' }}></i> Quem será o instalador?
                            </label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Digite o nome do instalador..."
                                    value={instaladorNome || ''}
                                    onChange={(e) => {
                                        if (subTipo) {
                                            updateInstaladorLocal(subTipo, e.target.value);
                                        } else {
                                            updateVendaField('nome_instalador', e.target.value);
                                            setHasUnsavedChanges(true);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Helper para determinar se deve mostrar o input da costureira
    const shouldShowCostureira = () => {
        const estado = getEtapaState();
        if (venda.tipo_fluxo === 'Cortina' && (estado.etapa || estado) === 'Enviado a costureira') return true;
        if (venda.tipo_fluxo === 'Ambos' && estado.cortina && estado.cortina.etapa === 'Enviado a costureira') return true;
        return false;
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (!venda) return <div className="empty-state"><h3>Venda não encontrada</h3><button className="btn btn-primary" onClick={() => navigate('/vendas')}>Voltar</button></div>;

    // Estado Atual
    const etapaState = getEtapaState();

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Detalhes da Venda</h1>
                    <p className="page-subtitle">
                        <span style={{ color: 'var(--primary-light)', fontWeight: '600' }}>{venda.numero}</span>{' - '}{formatDate(venda.data_venda)}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/vendas')}><i className="fas fa-arrow-left"></i> Voltar</button>
                    <button className="btn btn-primary" onClick={() => navigate(`/vendas/editar/${id}`)}><i className="fas fa-edit"></i> Editar</button>
                </div>
            </div>

            <div className="card">
                <div className="card-header"><h2 className="card-title">Informações Gerais</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <p><strong>Cliente:</strong> {venda.cliente_nome || '-'}</p>
                        <p>
                            <strong>Orçamento Vinculado:</strong>{' '}
                            {venda.orcamento_numero ? (
                                <span
                                    style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                                    onClick={() => navigate(`/orcamentos/editar/${venda.orcamento_id}`)}
                                >
                                    #{venda.orcamento_numero}
                                </span>
                            ) : 'Nenhum'}
                        </p>
                    </div>
                    <div><p><strong>Data da Venda:</strong> {formatDate(venda.data_venda)}</p></div>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <p><strong>Observações:</strong></p>
                    <p style={{ backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '4px', marginTop: '5px', whiteSpace: 'pre-wrap' }}>{venda.observacoes || 'Nenhuma observação registrada.'}</p>
                </div>
            </div>

            {/* Acompanhamento do Pedido (Workflow) */}
            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="card-title">
                        <i className="fas fa-truck-loading" style={{ marginRight: '10px', color: 'var(--primary)' }}></i> Acompanhamento do Pedido
                    </h2>
                    {venda.tipo_fluxo && (
                        <span className="badge" style={{ backgroundColor: 'var(--secondary)', color: 'white', fontSize: '0.9rem' }}>
                            Fluxo: {venda.tipo_fluxo}
                        </span>
                    )}
                </div>

                {!venda.tipo_fluxo ? (
                    <div style={{ textAlign: 'center', padding: '30px' }}>
                        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>Selecione o tipo de produto para iniciar o acompanhamento:</p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" style={{ minWidth: '150px' }} onClick={() => updateWorkflowLocal('Persiana', 'Pedir para a fábrica')}>
                                <i className="fas fa-blinds" style={{ marginRight: '8px' }}></i> Persiana
                            </button>
                            <button className="btn btn-primary" style={{ minWidth: '150px' }} onClick={() => updateWorkflowLocal('Cortina', 'Pedir para a fábrica')}>
                                <i className="fas fa-scroll" style={{ marginRight: '8px' }}></i> Cortina
                            </button>
                            <button className="btn btn-primary" style={{ minWidth: '150px' }} onClick={() => updateWorkflowLocal('Papel de Parede', 'Pedir para a fábrica')}>
                                <i className="fas fa-scroll" style={{ marginRight: '8px' }}></i> Papel de Parede
                            </button>
                            <button className="btn btn-primary" style={{ minWidth: '150px' }} onClick={() => updateWorkflowLocal('Tapete', 'Pedir para a fábrica')}>
                                <i className="fas fa-rug" style={{ marginRight: '8px' }}></i> Tapete
                            </button>
                            <button className="btn btn-primary" style={{ minWidth: '150px' }} onClick={() => updateWorkflowLocal('Ambos', { persiana: 'Pedir para a fábrica', cortina: 'Pedir para a fábrica' })}>
                                <i className="fas fa-layer-group" style={{ marginRight: '8px' }}></i> Ambos
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Renderizar Steppers */}
                        {venda.tipo_fluxo === 'Ambos' ? (
                            <>
                                {renderStepper('Persiana', etapaState.persiana, 'Persiana')}
                                {renderStepper('Cortina', etapaState.cortina, 'Cortina')}
                            </>
                        ) : (
                            renderStepper(venda.tipo_fluxo, etapaState)
                        )}

                        {/* Campo Costureira */}
                        {shouldShowCostureira() && (
                            <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                                <label className="form-label" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                    <i className="fas fa-cut" style={{ marginRight: '8px' }}></i> Quem é a costureira responsável?
                                </label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="text" className="form-input" placeholder="Digite o nome da costureira..." value={venda.nome_costureira || ''} onChange={(e) => { updateVendaField('nome_costureira', e.target.value); setHasUnsavedChanges(true); }} />
                                </div>
                            </div>
                        )}

                        {/* Botão de Salvar Alterações */}
                        {hasUnsavedChanges && (
                            <div style={{ marginTop: '20px', textAlign: 'center', backgroundColor: '#fff3cd', padding: '15px', borderRadius: '5px', border: '1px solid #ffeeba' }}>
                                <span style={{ marginRight: '15px', color: '#856404', fontWeight: 'bold' }}>
                                    <i className="fas fa-exclamation-triangle"></i> Você tem alterações não salvas.
                                </span>
                                <button className="btn btn-primary" onClick={saveWorkflowChanges} style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                    <i className="fas fa-save"></i> Salvar Alterações
                                </button>
                            </div>
                        )}



                        <div style={{ marginTop: '30px', textAlign: 'right' }}>
                            <button className="btn-text" style={{ color: 'var(--danger)', fontSize: '0.8rem', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { if (window.confirm('Tem certeza que deseja reiniciar o fluxo?')) { updateWorkflowLocal(null, null); } }}>
                                Alterar Tipo de Produto / Reiniciar Fluxo
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header"><h2 className="card-title">Financeiro</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text-muted)' }}>Custos Detalhados</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}><span>Geral/Material:</span><span>{formatCurrency(venda.custo)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}><span>Costureira:</span><span>{formatCurrency(venda.costureira)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}><span>Instalação:</span><span>{formatCurrency(venda.instalacao)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}><span>Outros:</span><span>{formatCurrency(venda.outros_custos)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontWeight: 'bold' }}><span>Total Custos:</span><span>{formatCurrency((venda.custo || 0) + (venda.costureira || 0) + (venda.instalacao || 0) + (venda.outros_custos || 0))}</span></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', paddingLeft: '40px', borderLeft: '1px solid #eee' }}>
                        <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>VALOR TOTAL</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)' }}>{formatCurrency(venda.valor)}</span>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>ENTRADA</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>{formatCurrency(venda.valor_entrada)}</span>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>FALTA PAGAR</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: venda.falta_pagar > 0.01 ? '#dc3545' : '#28a745' }}>{formatCurrency(venda.falta_pagar)}</span>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #eee' }}>
                            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)' }}>LUCRO LÍQUIDO</span>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4CAF50' }}>{formatCurrency(venda.lucro)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VendaDetalhes;
