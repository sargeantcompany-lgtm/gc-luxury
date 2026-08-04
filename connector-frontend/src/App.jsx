import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BuyerProvider, useBuyer } from './context/BuyerContext';
import Layout from './components/Layout';
import Join from './pages/Join';
import Brief from './pages/Brief';
import Home from './pages/Home';
import Agents from './pages/Agents';

function RequireBuyer({ children }) {
  const { buyer, loading } = useBuyer();
  if (loading) return <div className="page"><p className="loading">Loading…</p></div>;
  if (!buyer) return <Navigate to="/" replace />;
  return children;
}

function JoinOrRedirect() {
  const { buyer, loading } = useBuyer();
  if (loading) return <div className="page"><p className="loading">Loading…</p></div>;
  if (buyer) return <Navigate to="/home" replace />;
  return <Join />;
}

export default function App() {
  return (
    <BuyerProvider>
      <BrowserRouter basename="/connector">
        <Layout>
          <Routes>
            <Route path="/" element={<JoinOrRedirect />} />
            <Route path="/brief" element={<RequireBuyer><Brief /></RequireBuyer>} />
            <Route path="/home" element={<RequireBuyer><Home /></RequireBuyer>} />
            <Route path="/agents" element={<RequireBuyer><Agents /></RequireBuyer>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </BuyerProvider>
  );
}
