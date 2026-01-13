import { z } from 'zod';

export enum UserRole {
  CLIENT = 'CLIENT',
  BARBER = 'BARBER',
  ADMIN = 'ADMIN'
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export enum WeekDay {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

// User Models
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string; // Opcional para responses
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
}

// Barber Models
export interface Barber {
  id: string;
  user_id: string;
  specialties?: string;
  commission_rate: number;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Relacionamentos
  user?: User;
}

export interface CreateBarberData {
  user_id: string;
  specialties?: string;
  commission_rate: number;
}

export interface UpdateBarberData {
  specialties?: string;
  commission_rate?: number;
  is_available?: boolean;
}

// Service Models
export interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateServiceData {
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
}

export interface UpdateServiceData {
  name?: string;
  description?: string;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
}

// Business Hours Models
export interface BusinessHours {
  id: string;
  day_of_week: WeekDay;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBusinessHoursData {
  day_of_week: WeekDay;
  start_time: string;
  end_time: string;
}

export interface UpdateBusinessHoursData {
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

// Barber Schedule Models
export interface BarberSchedule {
  id: string;
  barber_id: string;
  day_of_week: WeekDay;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Relacionamentos
  barber?: Barber;
}

export interface CreateBarberScheduleData {
  barber_id: string;
  day_of_week: WeekDay;
  start_time: string;
  end_time: string;
}

// Appointment Models
export interface Appointment {
  id: string;
  client_id: string;
  barber_id: string;
  service_id: string;
  appointment_date: Date;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  status: AppointmentStatus;
  total_price: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  
  // Relacionamentos
  client?: User;
  barber?: Barber;
  service?: Service;
}

export interface CreateAppointmentData {
  client_id: string;
  barber_id: string;
  service_id: string;
  appointment_date: string; // YYYY-MM-DD format
  start_time: string; // HH:MM format
  notes?: string;
}

export interface UpdateAppointmentData {
  appointment_date?: string;
  start_time?: string;
  status?: AppointmentStatus;
  notes?: string;
}

// Available Slot Models
export interface AvailableSlot {
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
  barber_name: string;
}

// JWT Payload Models
export interface JwtPayload {
  user_id: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  user_id: string;
  token_version?: number;
  iat?: number;
  exp?: number;
}

// API Response Models
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Dashboard Models
export interface DashboardStats {
  total_clients: number;
  total_barbers: number;
  total_services: number;
  today_appointments: number;
  weekly_revenue: number;
  monthly_revenue: number;
  pending_appointments: number;
  completed_appointments_today: number;
}

export interface RevenueByPeriod {
  date: string;
  total_revenue: number;
  appointment_count: number;
}

export interface BarberPerformance {
  barber_id: string;
  barber_name: string;
  appointment_count: number;
  total_revenue: number;
  avg_rating?: number;
}

export interface ServicePopularity {
  service_id: string;
  service_name: string;
  appointment_count: number;
  total_revenue: number;
  avg_duration: number;
}