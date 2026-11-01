export interface Student {
  id: string;
  roll_no: string;
  name: string;
  department: string | null;
}

export interface EventItem {
  id: string;
  name: string;
  event_date: string | null;
  points: number;
  published_at: string | null;
}

export interface Attendance {
  id: string;
  event_id: string;
  student_id: string;
}

export type Role = 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export type View =
  | { page: 'students' }
  | { page: 'events' }
  | { page: 'event'; eventId: string }
  | { page: 'points' }
  | { page: 'master' };
