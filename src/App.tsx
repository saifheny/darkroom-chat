/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Welcome } from './pages/Welcome';
import { Dashboard } from './pages/Dashboard';
import { Room } from './pages/Room';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-neutral-500">Loading...</div>;
  }
  
  if (!profile) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-black text-neutral-200 selection:bg-neutral-800">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
