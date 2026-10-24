import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { DEFAULT_LOCAL_SETTINGS } from '@/lib/domain/profile'
import { LocalForm } from './local-form'

export const metadata: Metadata = { title: '自治体の設定｜おかねと税金ノート' }

export default async function LocalSettingsPage() {
  const { profile } = await requireBooksContext()
  return (
    <div>
      <PageHeader title="お住まいの自治体の設定" sub={`${profile.prefecture}${profile.city}`} back="/schedule" />
      <LocalForm
        local={{ ...DEFAULT_LOCAL_SETTINGS, ...profile.localSettings }}
        nhiRates={profile.nhiRates}
        nhiMembers={profile.nhiMembers ?? 1}
        nhiEnrolled={profile.nhiEnrolled !== 'no'}
        city={profile.city}
      />
    </div>
  )
}
