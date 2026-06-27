export type UserRole = 'patient' | 'provider' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  organization_id?: string
  created_at: string
}

export interface Organization {
  id: string
  name: string
  type: string
  address?: string
  phone?: string
  created_at: string
}

export interface PatientProviderLink {
  id: string
  patient_id: string
  provider_id: string
  organization_id: string
  status: 'pending' | 'active' | 'revoked'
  created_at: string
}

export type VitalType = 'weight' | 'systolic' | 'diastolic' | 'temperature' | 'spo2' | 'pulse'

export interface Vital {
  id: string
  user_id: string
  type: VitalType
  value: number
  unit: string
  measured_at: string
  note?: string
  device_source?: string
  created_at: string
}

export type LifeRecordType = 'meal' | 'medication' | 'steps' | 'event' | 'photo'

export interface LifeRecord {
  id: string
  user_id: string
  type: LifeRecordType
  title: string
  description?: string
  value?: number
  unit?: string
  photo_url?: string
  recorded_at: string
  created_at: string
}

export interface GlucoseRecord {
  id: string
  user_id: string
  glucose?: number
  hba1c?: number
  insulin_type?: string
  insulin_units?: number
  timing: 'before_meal' | 'after_meal' | 'fasting' | 'bedtime' | 'other'
  measured_at: string
  note?: string
  created_at: string
}

export interface LabResult {
  id: string
  user_id: string
  institution_name: string
  test_name: string
  value: number
  unit: string
  reference_min?: number
  reference_max?: number
  tested_at: string
  note?: string
  created_at: string
}
