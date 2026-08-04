import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BuyerProvider, useBuyer } from './context/BuyerContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Join from './pages/Join';
import Login from './pages/Login';
import Brief from './pages/Brief';
import Home from './pages/Home';
import Agents from './pages/Agents';
import AdminGate from './pages/admin/AdminGate';
import AdminListings from './pages/admin/AdminListings';
import AdminTopFive from './pages/admin/AdminTopFive';
import AdminValuations from './pages/admin/AdminValuations';
import AdminBuyers from './pages/admin/AdminBuyers';
import AdminBuyerDetail from './pages/admin/AdminBuyerDetail';
import AdminAgents from './pages/admin/AdminAgents';

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

function LoginOrRedirect() {
  const { buyer, loading } = useBuyer();
  if (loading) return <div className="page"><p className="loading">Loading…</p></div>;
  if (buyer) return <Navigate to="/home" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BuyerProvider>
      <BrowserRouter basename="/connector">
        <Routes>
          <Route path="/" element={<Layout><JoinOrRedirect /></Layout>} />
          <Route path="/login" element={<Layout><LoginOrRedirect /></Layout>} />
          <Route path="/brief" element={<Layout><RequireBuyer><Brief /></RequireBuyer></Layout>} />
          <Route path="/home" element={<Layout><RequireBuyer><Home /></RequireBuyer></Layout>} />
          <Route path="/agents" element={<Layout><RequireBuyer><Agents /></RequireBuyer></Layout>} />

          <Route path="/admin" element={<AdminGate><AdminLayout><Navigate to="/admin/listings" replace /></AdminLayout></AdminGate>} />
          <Route path="/admin/listings" element={<AdminGate><AdminLayout><AdminListings /></AdminLayout></AdminGate>} />
          <Route path="/admin/top-five" element={<AdminGate><AdminLayout><AdminTopFive /></AdminLayout></AdminGate>} />
          <Route path="/admin/valuations" element={<AdminGate><AdminLayout><AdminValuations /></AdminLayout></AdminGate>} />
          <Route path="/admin/buyers" element={<AdminGate><AdminLayout><AdminBuyers /></AdminLayout></AdminGate>} />
          <Route path="/admin/buyers/:id" element={<AdminGate><AdminLayout><AdminBuyerDetail /></AdminLayout></AdminGate>} />
          <Route path="/admin/agents" element={<AdminGate><AdminLayout><AdminAgents /></AdminLayout></AdminGate>} />
        </Routes>
      </BrowserRouter>
    </BuyerProvider>
  );
}
