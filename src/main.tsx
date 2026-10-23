import React from 'react';
import ReactDOM from 'react-dom/client';
import Portal from './Portal';
import './styles.css';
import HoseApp from './HoseApp';
import CommercialPortal from './CommercialPortal';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{(window.location.pathname.startsWith('/comercial') || document.documentElement.dataset.app === 'comercial') ? <CommercialPortal apiEnabled={document.documentElement.dataset.api !== 'disabled'} /> : window.location.pathname.startsWith('/financeiro') ? <Portal /> : <HoseApp />}</React.StrictMode>);
