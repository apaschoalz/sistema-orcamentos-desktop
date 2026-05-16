import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NovoOrcamento from './pages/NovoOrcamento';
import Buscar from './pages/Buscar';
import Orcamentos from './pages/Orcamentos';
import Clientes from './pages/Clientes';
import ClienteDetalhes from './pages/ClienteDetalhes';
import VendaDetalhes from './pages/VendaDetalhes';
import Vendas from './pages/Vendas';
import NovaVenda from './pages/NovaVenda';
import Configuracoes from './pages/Configuracoes';
import Backup from './pages/Backup';
import ProtectedRoute from './components/ProtectedRoute';
import NovoCliente from './pages/NovoCliente';
import StatusPedido from './pages/StatusPedido';
import Fornecedores from './pages/Fornecedores';
import Custos from './pages/Custos';
import Balanco from './pages/Balanco';

function App() {
    const location = useLocation();

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="Entre Tramas" className="sidebar-logo-img" />
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-home"></i>
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink to="/novo" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-plus-circle"></i>
                        <span>Novo Orçamento</span>
                    </NavLink>

                    <NavLink to="/buscar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-search"></i>
                        <span>Buscar</span>
                    </NavLink>

                    <NavLink to="/orcamentos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-file-invoice-dollar"></i>
                        <span>Orçamentos</span>
                    </NavLink>

                    <NavLink to="/vendas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-chart-line"></i>
                        <span>Vendas</span>
                    </NavLink>

                    <NavLink to="/status-pedido" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-tasks"></i>
                        <span>Status do Pedido</span>
                    </NavLink>

                    <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-users"></i>
                        <span>Clientes</span>
                    </NavLink>

                    <NavLink to="/fornecedores" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-truck"></i>
                        <span>Fornecedores</span>
                    </NavLink>

                    <NavLink to="/custos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-money-bill-wave"></i>
                        <span>Custos</span>
                    </NavLink>

                    <NavLink to="/balanco" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-chart-pie"></i>
                        <span>Balanço</span>
                    </NavLink>

                    <div style={{ height: '20px' }}></div>

                    <NavLink to="/backup" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-database"></i>
                        <span>Backup</span>
                    </NavLink>

                    <NavLink to="/config" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <i className="fas fa-cog"></i>
                        <span>Configurações</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        v1.1.0 | © 2024 Entre Tramas
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/novo" element={<NovoOrcamento />} />
                    <Route path="/editar/:id" element={<NovoOrcamento />} />
                    <Route path="/buscar" element={<Buscar />} />
                    <Route path="/orcamentos" element={<Orcamentos />} />
                    <Route path="/orcamentos/editar/:id" element={<NovoOrcamento />} />
                    <Route path="/status-pedido" element={<StatusPedido />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/clientes/novo" element={<NovoCliente />} />
                    <Route path="/clientes/:id" element={<ClienteDetalhes />} />
                    <Route path="/fornecedores" element={<Fornecedores />} />
                    <Route path="/custos" element={<Custos />} />
                    <Route path="/balanco" element={<Balanco />} />
                    <Route path="/vendas" element={<Vendas />} />
                    <Route path="/vendas/:id" element={<VendaDetalhes />} />
                    <Route path="/vendas/editar/:id" element={<NovaVenda />} />
                    <Route path="/vendas/nova" element={<NovaVenda />} />
                    <Route path="/vendas/nova/:orcamentoId" element={<NovaVenda />} />
                    <Route path="/backup" element={
                        <ProtectedRoute>
                            <Backup />
                        </ProtectedRoute>
                    } />
                    <Route path="/config" element={
                        <ProtectedRoute>
                            <Configuracoes />
                        </ProtectedRoute>
                    } />
                </Routes>
            </main>
        </div>
    );
}

export default App;
