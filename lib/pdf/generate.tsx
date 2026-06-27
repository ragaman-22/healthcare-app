import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { Vital, GlucoseRecord, LabResult } from '@/types'
import { VITAL_LABELS } from '@/lib/utils'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 10, color: '#666', marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8, marginTop: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 },
  table: { width: '100%' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: 6, borderRadius: 4 },
  tableRow: { flexDirection: 'row', padding: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  col1: { width: '35%' },
  col2: { width: '30%' },
  col3: { width: '35%' },
  headerText: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  cellText: { fontSize: 9, color: '#374151' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#9ca3af' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontSize: 8 },
})

interface ReportProps {
  userName: string
  period: string
  vitals: Vital[]
  glucoseRecords: GlucoseRecord[]
  labResults: LabResult[]
}

const TIMING_LABELS: Record<string, string> = {
  fasting: '空腹時', before_meal: '食前', after_meal: '食後', bedtime: '就寝前', other: 'その他'
}

export function HealthReport({ userName, period, vitals, glucoseRecords, labResults }: ReportProps) {
  const grouped: Record<string, Vital[]> = {}
  vitals.forEach(v => {
    if (!grouped[v.type]) grouped[v.type] = []
    grouped[v.type].push(v)
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>HealthLink 健康記録レポート</Text>
        <Text style={styles.subtitle}>{userName} | 期間: {period} | 出力日: {new Date().toLocaleDateString('ja-JP')}</Text>

        {/* Vitals */}
        {Object.entries(grouped).map(([type, records]) => (
          <View key={type}>
            <Text style={styles.sectionTitle}>{VITAL_LABELS[type]?.label ?? type}（{VITAL_LABELS[type]?.unit}）</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col1, styles.headerText]}>測定日時</Text>
                <Text style={[styles.col2, styles.headerText]}>値</Text>
                <Text style={[styles.col3, styles.headerText]}>メモ</Text>
              </View>
              {records.slice(0, 20).map(r => (
                <View key={r.id} style={styles.tableRow}>
                  <Text style={[styles.col1, styles.cellText]}>{new Date(r.measured_at).toLocaleString('ja-JP')}</Text>
                  <Text style={[styles.col2, styles.cellText]}>{r.value} {r.unit}</Text>
                  <Text style={[styles.col3, styles.cellText]}>{r.note ?? '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Glucose */}
        {glucoseRecords.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>血糖値・HbA1c・インスリン</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col1, styles.headerText]}>測定日時</Text>
                <Text style={[styles.col2, styles.headerText]}>血糖値 / HbA1c</Text>
                <Text style={[styles.col3, styles.headerText]}>タイミング / インスリン</Text>
              </View>
              {glucoseRecords.slice(0, 20).map(r => (
                <View key={r.id} style={styles.tableRow}>
                  <Text style={[styles.col1, styles.cellText]}>{new Date(r.measured_at).toLocaleString('ja-JP')}</Text>
                  <Text style={[styles.col2, styles.cellText]}>
                    {r.glucose ? `${r.glucose} mg/dL` : ''}{r.hba1c ? ` / ${r.hba1c}%` : ''}
                  </Text>
                  <Text style={[styles.col3, styles.cellText]}>
                    {TIMING_LABELS[r.timing]}{r.insulin_units ? ` / ${r.insulin_type ?? 'インスリン'} ${r.insulin_units}単位` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Lab Results */}
        {labResults.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>検査結果</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col1, styles.headerText]}>検査日 / 医療機関</Text>
                <Text style={[styles.col2, styles.headerText]}>項目</Text>
                <Text style={[styles.col3, styles.headerText]}>値 / 基準値</Text>
              </View>
              {labResults.slice(0, 20).map(r => (
                <View key={r.id} style={styles.tableRow}>
                  <Text style={[styles.col1, styles.cellText]}>{new Date(r.tested_at).toLocaleDateString('ja-JP')}{'\n'}{r.institution_name}</Text>
                  <Text style={[styles.col2, styles.cellText]}>{r.test_name}</Text>
                  <Text style={[styles.col3, styles.cellText]}>
                    {r.value} {r.unit}
                    {(r.reference_min || r.reference_max) ? `\n基準: ${r.reference_min ?? '-'} ～ ${r.reference_max ?? '-'}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer}>HealthLink - パーソナルヘルスレコード管理システム</Text>
      </Page>
    </Document>
  )
}
