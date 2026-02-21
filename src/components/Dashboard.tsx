import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, View, Session } from '../types';
import { LogOut, User as UserIcon, BookOpen, CheckCircle, Users, FileText, Play, Square, Hash, Share2, Download, Search, Key } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DashboardProps {
  user: User;
  setView: (view: View) => void;
  setUser: (user: User | null) => void;
}

const Dashboard = ({ user, setView, setUser }: DashboardProps) => {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isStopped, setIsStopped] = useState(true);
  const [attendees, setAttendees] = useState<{name: string, matric: string, sig: string}[]>([]);
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (user.is_hoc) {
      fetchStudents();
      checkActiveSession();
    }
  }, [user.is_hoc, user.level]);

  useEffect(() => {
    if (activeSession) {
      fetchAttendees(activeSession.id);
    } else {
      setAttendees([]);
    }
  }, [activeSession]);

  const fetchAttendees = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        signature_data,
        users (full_name, matric_number)
      `)
      .eq('session_id', sessionId);
    
    if (data) {
      const formatted = data.map((log: any) => ({
        name: log.users?.full_name || 'Unknown',
        matric: log.users?.matric_number || 'Unknown',
        sig: log.signature_data
      }));
      setAttendees(formatted);
    }
  };

  const checkActiveSession = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('hoc_matric', user.matric_number)
      .eq('is_active', true)
      .maybeSingle();
    
    if (data) {
      setActiveSession(data);
      setIsStopped(false);
    }
  };

  const startSession = async () => {
    if (!courseCode) return alert("Enter Course Code");
    
    setLoading(true);
    // Generate random 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: session, error } = await supabase
      .from('sessions')
      .insert([{ 
        course_code: courseCode.toUpperCase(), 
        passcode: pin, 
        hoc_matric: user.matric_number, 
        target_level: user.level,
        is_active: true 
      }])
      .select().single();

    if (session) {
      // AUTO-ADD HOC: Ensures you are #1 on the list
      await supabase.from('attendance_logs').insert([{
        session_id: session.id,
        student_matric: user.matric_number,
        signature_data: user.signature_data
      }]);
      
      setActiveSession(session);
      setIsStopped(false);
      setCourseCode('');
    } else {
      alert("Error starting session: " + error?.message);
    }
    setLoading(false);
  };

  const stopSession = async () => {
    if (!activeSession) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', activeSession.id);

    if (!error) {
      setIsStopped(true);
    } else {
      alert("Error stopping session: " + error.message);
    }
    setLoading(false);
  };

  const shareSession = () => {
    if (!activeSession) return;
    const link = `${window.location.origin}/join?pin=${activeSession.passcode}`;
    const message = `*${user.department.toUpperCase()}*\nCourse: ${activeSession.course_code}\nPIN: ${activeSession.passcode}\nSign here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
  };

  const downloadPDF = () => {
    if (!activeSession) return;
    const doc = new jsPDF();
    
    doc.text(`${user.department.toUpperCase()} ATTENDANCE`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Course: ${activeSession.course_code} | Level: ${user.level}`, 14, 25);

    // Use the imported autoTable function directly
    autoTable(doc, {
      startY: 30,
      head: [['S/N', 'Full Name', 'Matric Number', 'Signature']],
      body: attendees.map((a, i) => [i + 1, a.name.toUpperCase(), a.matric, '']),
      didDrawCell: (data) => {
        if (data.column.index === 3 && data.cell.section === 'body') {
          const student = attendees[data.row.index];
          if (student.sig) {
            doc.addImage(student.sig, 'PNG', data.cell.x + 2, data.cell.y + 2, 20, 10);
          }
        }
      },
      columnStyles: { 3: { cellWidth: 30, minCellHeight: 15 } }
    });

    // This triggers an automatic download on mobile and desktop
    doc.save(`${activeSession.course_code}_Attendance.pdf`);
  };

  const joinSession = async () => {
    if (!pin || pin.length !== 6) return alert("Please enter a valid 6-digit PIN");
    
    setLoading(true);
    // 1. Fetch the session and its target level
    const { data: session, error } = await supabase
      .from('sessions')
      .select('id, target_level, is_active')
      .eq('passcode', pin)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      setLoading(false);
      return alert("Invalid PIN or Session Inactive");
    }

    // 2. LEVEL CHECK: Does the student level match the HOC's session level?
    if (session.target_level !== user.level) {
      setLoading(false);
      return alert(`Access Denied! This session is only for ${session.target_level} students.`);
    }

    // 3. DUPLICATE CHECK: Has the student already signed?
    const { data: alreadySigned } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', session.id)
      .eq('student_matric', user.matric_number)
      .maybeSingle();

    if (alreadySigned) {
      setLoading(false);
      return alert("You have already signed for this class!");
    }

    // 4. Proceed to sign attendance if level matches...
    const { error: logError } = await supabase.from('attendance_logs').insert([{
      session_id: session.id,
      student_matric: user.matric_number,
      signature_data: user.signature_data
    }]);

    setLoading(false);
    if (!logError) {
      alert("Attendance Signed Successfully!");
      setPin('');
    } else {
      alert("Error signing attendance: " + logError.message);
    }
  };

  const handleLevelChange = async (newLevel: string) => {
    const { error } = await supabase
      .from('users')
      .update({ level: newLevel })
      .eq('matric_number', user.matric_number);

    if (!error) {
      setUser({ ...user, level: newLevel });
      alert(`Profile updated to ${newLevel}`);
    } else {
      alert("Error updating level: " + error.message);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('level', user.level)
      .eq('department', user.department)
      .order('full_name', { ascending: true });
    
    if (data) setStudents(data);
    setLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar/Header */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <BookOpen className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-xl text-slate-800 hidden sm:block">EngPortal</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800">{user.full_name}</p>
            <p className="text-xs text-slate-500 uppercase tracking-tighter">{user.is_hoc ? 'HOC' : 'Student'} • {user.matric_number}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <UserIcon className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">{user.full_name}</h2>
                <p className="text-indigo-600 font-medium text-sm mb-4">{user.matric_number}</p>
                
                <div className="w-full space-y-3 text-left">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-xs text-slate-400 uppercase font-bold">Department</p>
                    <p className="text-sm text-slate-700 font-medium">{user.department}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-xs text-slate-400 uppercase font-bold">Level</p>
                    <p className="text-sm text-slate-700 font-medium">{user.level}</p>
                  </div>
                </div>

                <div className="mt-6 w-full">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2 text-left">Digital Signature</p>
                  <div className="border border-slate-100 rounded-lg p-2 bg-slate-50">
                    <img src={user.signature_data} alt="Signature" className="max-h-20 mx-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-2 space-y-6">
            {user.is_hoc ? (
              <>
                {/* HOC Welcome & Level Switcher */}
                <div className="bg-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-2xl font-bold">HOC Portal: {user.full_name.split(' ')[0]}</h3>
                      <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Managing Level:</span>
                        <select 
                          value={user.level} 
                          onChange={(e) => handleLevelChange(e.target.value)}
                          className="bg-transparent text-sm font-black outline-none cursor-pointer"
                        >
                          {['100L', '200L', '300L', '400L', '500L'].map(lvl => (
                            <option key={lvl} value={lvl} className="text-slate-800">{lvl}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-indigo-100 mb-6">You are currently managing attendance for {user.level} {user.department}. All sessions you start will be locked to this level.</p>
                  </div>
                  <Users className="absolute -right-10 -bottom-10 w-48 h-48 text-indigo-500 opacity-20" />
                </div>

                {/* Session Controls & Live Attendance */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Play className="text-indigo-600 w-5 h-5" />
                    <h3 className="text-lg font-bold text-slate-800">Attendance Session</h3>
                  </div>

                  {!activeSession ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text"
                        placeholder="Enter Course Code (e.g. GEE 201)"
                        className="input-field mb-0 flex-1"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                      />
                      <button 
                        onClick={startSession}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        Start Session
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100">
                            <Hash className="text-indigo-600 w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs text-indigo-400 uppercase font-bold tracking-wider">
                              {isStopped ? 'Session Ended' : 'Active Session'}
                            </p>
                            <h4 className="text-xl font-black text-indigo-900">{activeSession.course_code}</h4>
                          </div>
                        </div>

                        {!isStopped && (
                          <div className="flex flex-col items-center">
                            <p className="text-xs text-indigo-400 uppercase font-bold tracking-wider mb-1">Passcode</p>
                            <div className="bg-white px-6 py-2 rounded-xl border-2 border-indigo-200 text-2xl font-mono font-black text-indigo-600 tracking-widest shadow-inner">
                              {activeSession.passcode}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {!isStopped && (
                            <button 
                              onClick={shareSession}
                              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
                            >
                              <Share2 className="w-4 h-4" />
                              Share to WhatsApp
                            </button>
                          )}
                          <button 
                            onClick={downloadPDF}
                            disabled={attendees.length === 0}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                          >
                            <Download className="w-4 h-4" />
                            Export PDF Report ({attendees.length})
                          </button>
                          {!isStopped && (
                            <button 
                              onClick={stopSession}
                              disabled={loading}
                              className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                            >
                              <Square className="w-4 h-4 fill-current" />
                              Stop Session
                            </button>
                          )}
                          {isStopped && (
                            <button 
                              onClick={() => setActiveSession(null)}
                              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              Start New Session
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Live Attendance Table */}
                      <div className="border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-slate-800">Live Attendance: {activeSession.course_code}</h3>
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                            {attendees.length} Signed
                          </span>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase">S/N</th>
                                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase">Full Name</th>
                                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase">Matric Number</th>
                                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase text-right">Signature</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {attendees.map((student, index) => (
                                <tr key={student.matric} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 text-sm text-slate-500">{index + 1}</td>
                                  <td className="py-3 text-sm font-bold text-slate-800">{student.name.toUpperCase()}</td>
                                  <td className="py-3 text-sm text-slate-600 font-mono">{student.matric}</td>
                                  <td className="py-3 text-right">
                                    <img src={student.sig} alt="signature" className="h-6 ml-auto opacity-80" />
                                  </td>
                                </tr>
                              ))}
                              {attendees.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-slate-400 italic text-sm">Waiting for students to sign...</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Users className="text-indigo-600 w-5 h-5" />
                      <h3 className="text-lg font-bold text-slate-800">{user.level} {user.department} - Student List</h3>
                    </div>
                    <button 
                      onClick={fetchStudents}
                      className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors"
                    >
                      Refresh List
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-3 text-xs font-bold text-slate-400 uppercase">Student</th>
                            <th className="pb-3 text-xs font-bold text-slate-400 uppercase">Matric</th>
                            <th className="pb-3 text-xs font-bold text-slate-400 uppercase">Level</th>
                            <th className="pb-3 text-xs font-bold text-slate-400 uppercase text-right">Signature</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {students.map((student) => (
                            <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4">
                                <p className="text-sm font-bold text-slate-800">{student.full_name}</p>
                                <p className="text-xs text-slate-500">{student.department}</p>
                              </td>
                              <td className="py-4 text-sm text-slate-600 font-mono">{student.matric_number}</td>
                              <td className="py-4">
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full">
                                  {student.level}
                                </span>
                              </td>
                              <td className="py-4 text-right">
                                <img src={student.signature_data} alt="Sig" className="h-8 ml-auto opacity-70" />
                              </td>
                            </tr>
                          ))}
                          {students.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-10 text-center text-slate-400 italic">No students registered yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Join Session Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Key className="text-indigo-600 w-5 h-5" />
                    <h3 className="text-lg font-bold text-slate-800">Sign Attendance</h3>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit PIN"
                      className="input-field mb-0 flex-1 text-center tracking-[0.5em] font-mono font-bold text-xl"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    />
                    <button 
                      onClick={joinSession}
                      disabled={loading || pin.length < 6}
                      className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? 'Signing...' : 'Sign Now'}
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400 text-center uppercase font-bold tracking-widest">
                    Ask your HOC for the session PIN
                  </p>
                </div>

                <div className="bg-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-2xl font-bold">Welcome back, {user.full_name.split(' ')[0]}!</h3>
                      <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Level:</span>
                        <select 
                          value={user.level} 
                          onChange={(e) => handleLevelChange(e.target.value)}
                          className="bg-transparent text-sm font-black outline-none cursor-pointer"
                        >
                          {['100L', '200L', '300L', '400L', '500L'].map(lvl => (
                            <option key={lvl} value={lvl} className="text-slate-800">{lvl}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-indigo-100 mb-6">Your engineering portal is active. You can now access course materials and sign attendance.</p>
                    <button className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-bold hover:bg-indigo-50 transition-colors">
                      View Courses
                    </button>
                  </div>
                  <BookOpen className="absolute -right-10 -bottom-10 w-48 h-48 text-indigo-500 opacity-20" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="bg-emerald-100 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                      <CheckCircle className="text-emerald-600 w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">Attendance Status</h4>
                    <p className="text-sm text-slate-500 mb-4">You have signed 85% of your classes this semester.</p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[85%]"></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="bg-amber-100 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                      <FileText className="text-amber-600 w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">Pending Assignments</h4>
                    <p className="text-sm text-slate-500">You have 2 upcoming deadlines this week.</p>
                    <button className="mt-4 text-xs font-bold text-amber-600 hover:underline">View Details →</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
