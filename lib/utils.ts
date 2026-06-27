import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export const VITAL_LABELS: Record<string, { label: string; unit: string; color: string }> = {
  weight:      { label: '体重',        unit: 'kg',   color: '#4f86c6' },
  systolic:    { label: '収縮期血圧',  unit: 'mmHg', color: '#e05c5c' },
  diastolic:   { label: '拡張期血圧',  unit: 'mmHg', color: '#f0a04b' },
  pulse:       { label: '脈拍',        unit: 'bpm',  color: '#7dc97d' },
  temperature: { label: '体温',        unit: '°C',   color: '#c97dbe' },
  spo2:        { label: '酸素飽和度',  unit: '%',    color: '#5bc0c0' },
}
