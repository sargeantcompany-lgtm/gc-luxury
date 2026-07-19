import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Pipeline from './pages/Pipeline';
import Campaigns from './pages/Campaigns';
import Templates from './pages/Templates';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="templates" element={<Templates />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
