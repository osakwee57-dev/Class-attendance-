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
  const [showReset, setShowReset] = useState(false);
  const [resetData, setResetData] = useState({ matric: '', password: '' });

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

  const requestPasswordReset = async () => {
    if (!resetData.matric || !resetData.password) {
      alert("Please fill in both your Matric Number and the new Password you want.");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('password_requests')
      .insert([
        { 
          student_matric: resetData.matric.toUpperCase().trim(), 
          requested_password: resetData.password, 
          status: 'pending' 
        }
      ]);
    setLoading(false);

    if (error) {
      console.error("Error sending request:", error.message);
      alert("Could not send request. Please try again.");
    } else {
      alert("Reset request sent to Admin! Please wait for approval.");
      setShowReset(false);
      setResetData({ matric: '', password: '' });
    }
  };

  return (
    <div className="auth-card">
      <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">Engineering Portal Login</h2>
      
      {!showReset ? (
        <>
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

          <div className="text-center mt-4">
            <button 
              onClick={() => setShowReset(true)}
              className="text-xs text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Forgot Password?
            </button>
          </div>
        </>
      ) : (
        <div className="reset-container space-y-4">
          <div className="text-center mb-4">
            <h4 className="font-bold text-slate-700">Forgot Password?</h4>
            <p className="text-xs text-slate-500">Enter your Matric Number and the password you would like to use.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Matric Number</label>
            <input 
              className="input-field"
              type="text" 
              placeholder="e.g. ENG/20/001" 
              value={resetData.matric}
              onChange={e => setResetData({...resetData, matric: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Desired New Password</label>
            <input 
              className="input-field"
              type="password" 
              placeholder="Desired New Password" 
              value={resetData.password}
              onChange={e => setResetData({...resetData, password: e.target.value})}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              onClick={requestPasswordReset}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Sending...' : 'Send Request to Admin'}
            </button>
            <button 
              onClick={() => setShowReset(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}

      <p className="text-center mt-6 text-sm text-slate-600">
        Don't have an account?{' '}
        <button onClick={() => setView('register')} className="text-indigo-600 font-semibold hover:underline">
          Register here
        </button>
      </p>
    </div>
  );
};

export default Login;
