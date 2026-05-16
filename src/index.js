import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { SyncProvider } from './SyncContext';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <HashRouter>
            <SyncProvider>
                <App />
            </SyncProvider>
        </HashRouter>
    </React.StrictMode>
);
