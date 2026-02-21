import { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import SignaturePad from 'react-signature-canvas';
import { View } from '../types';

interface RegisterProps {
  setView: (view: View) => void;
}

const Register = ({ setView }: RegisterProps) => {
  const [formData, setFormData] = useState({
    matric: '', name: '', dept: '', level: '100L', password: '', secretCode: ''
  });
  const [loading, setLoading] = useState(false);
  const sigPad = useRef<SignaturePad>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sigPad.current || sigPad.current.isEmpty()) return alert("Please provide your signature.");

    setLoading(true);
    const signature = sigPad.current.getCanvas().toDataURL('image/png');

    // Check if the user is trying to be an HOC
    const isHocAttempt = formData.secretCode.trim().toUpperCase() === "ACCESS";

    const { error } = await supabase.from('users').insert([{
      matric_number: formData.matric.toUpperCase().trim(),
      full_name: formData.name,
      department: formData.dept,
      level: formData.level,
      password: formData.password,
      signature_data: signature,
      is_hoc: isHocAttempt
    }]);

    setLoading(false);

    if (!error) {
      alert(isHocAttempt ? "HOC Registration Successful!" : "Student Registration Successful!");
      setView('login');
    } else {
      alert("Registration Error: " + error.message);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">Engineering Portal Registration</h2>
      <form onSubmit={handleRegister}>
        <input 
          className="input-field"
          placeholder="Matric Number (e.g. ENG/20/001)" 
          required 
          onChange={e => setFormData({...formData, matric: e.target.value})} 
        />
        <input 
          className="input-field"
          placeholder="Full Name" 
          required 
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
        <input 
          className="input-field"
          type="password"
          placeholder="Create Password" 
          required 
          onChange={e => setFormData({...formData, password: e.target.value})} 
        />
        
        <select 
          className="input-field"
          required 
          onChange={e => setFormData({...formData, dept: e.target.value})}
        >
          <option value="">-- Select Department --</option>
          <option value="Mechanical Engineering">Mechanical Engineering</option>
          <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering</option>
          <option value="Civil Engineering">Civil Engineering</option>
          <option value="Computer Engineering">Computer Engineering</option>
          <option value="Chemical Engineering">Chemical Engineering</option>
          <option value="Petroleum Engineering">Petroleum Engineering</option>
          <option value="Mechatronics Engineering">Mechatronics Engineering</option>
        </select>

        <select 
          className="input-field"
          onChange={e => setFormData({...formData, level: e.target.value})}
        >
          <option value="100L">100 Level</option>
          <option value="200L">200 Level</option>
          <option value="300L">300 Level</option>
          <option value="400L">400 Level</option>
          <option value="500L">500 Level</option>
        </select>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">HOC Secret Code (Optional)</label>
          <input 
            className="input-field border-amber-300 focus:ring-amber-500 focus:border-amber-500"
            placeholder="Enter code for HOC access" 
            type="password"
            onChange={e => setFormData({...formData, secretCode: e.target.value})} 
          />
        </div>

        <div className="sig-container">
          <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Draw Signature Below:</p>
          <SignaturePad 
            ref={sigPad} 
            canvasProps={{ 
              className: 'sigCanvas w-full h-32 bg-white rounded cursor-crosshair' 
            }} 
          />
          <button 
            type="button" 
            onClick={() => sigPad.current?.clear()}
            className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 font-medium"
          >
            Clear Signature
          </button>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Processing...' : 'Register Account'}
        </button>
      </form>
      
      <p className="text-center mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <button onClick={() => setView('login')} className="text-indigo-600 font-semibold hover:underline">
          Login here
        </button>
      </p>
    </div>
  );
};

export default Register;
