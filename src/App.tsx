/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User, View } from './types';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);

  // Persistence (Optional but helpful for dev)
  useEffect(() => {
    const savedUser = localStorage.getItem('eng_portal_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('eng_portal_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('eng_portal_user');
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-screen flex flex-col"
        >
          {view === 'login' && (
            <div className="flex-1 flex items-center justify-center p-4">
              <Login setView={setView} setUser={setUser} />
            </div>
          )}
          
          {view === 'register' && (
            <div className="flex-1 flex items-center justify-center p-4">
              <Register setView={setView} />
            </div>
          )}

          {view === 'dashboard' && user && (
            <Dashboard user={user} setView={setView} setUser={setUser} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Decoration */}
      {(view === 'login' || view === 'register') && (
        <footer className="py-8 text-center text-slate-400 text-xs uppercase tracking-[0.2em]">
          Engineering Portal &copy; {new Date().getFullYear()} • Secure Signature Verification
        </footer>
      )}
    </div>
  );
}
