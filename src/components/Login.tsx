import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, View } from '../types';

interface LoginProps {
  setView: (view: View) => void;
  setUser: (user: User) => void;
}

const Login = ({ setView, setUser }: LoginProps) => {
  const [creds, setCreds] = useState({ matric: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('matric_number', creds.matric.toUpperCase().trim())
      .eq('password', creds.password)
      .single();

    setLoading(false);

    if (data) {
      setUser(data);
      setView('dashboard');
    } else {
      alert("Invalid Matric Number or Password.");
    }
  };

  return (
    <div className="auth-card">
      <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">Engineering Portal Login</h2>
      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">Matric Number</label>
          <input 
            className="input-field"
            placeholder="e.g. ENG/20/001" 
            required 
            value={creds.matric}
            onChange={e => setCreds({...creds, matric: e.target.value})} 
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
          <input 
            className="input-field"
            type="password"
            placeholder="Enter your password" 
            required 
            value={creds.password}
            onChange={e => setCreds({...creds, password: e.target.value})} 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Logging in...' : 'Access Portal'}
        </button>
      </form>

      <p className="text-center mt-4 text-sm text-slate-600">
        Don't have an account?{' '}
        <button onClick={() => setView('register')} className="text-indigo-600 font-semibold hover:underline">
          Register here
        </button>
      </p>
    </div>
  );
};

export default Login;
