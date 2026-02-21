export interface User {
  id: string;
  matric_number: string;
  full_name: string;
  department: string;
  level: string;
  signature_data: string;
  password?: string;
  is_hoc: boolean;
  created_at?: string;
}

export type View = 'login' | 'register' | 'dashboard';

export interface Session {
  id: string;
  course_code: string;
  passcode: string;
  hoc_matric: string;
  target_level: string;
  is_active: boolean;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  session_id: string;
  student_matric: string;
  signature_data: string;
  created_at: string;
}
