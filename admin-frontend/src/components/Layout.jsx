import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastProvider } from './Toast';

export default function Layout() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="main-area">
          <Outlet />
        </div>
      </div>
    </ToastProvider>
  );
}
