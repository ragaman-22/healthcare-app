import clsx from 'clsx'
import type { ReactNode } from 'react'
import { formatYen } from '@/lib/format'
import type { ReturnRow, TaxReturnData } from '@/lib/returns/tax-return'

const STATUS = {
  checked: { label: '確認済み（対応範囲内）', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  draft: { label: '下書き（確認が必要な事項があります）', cls: 'border-amber-300 bg-amber-50 text-amber-900' },
  unsupported: { label: '対象外の項目があるため完成できません', cls: 'border-red-300 bg-red-50 text-red-900' },
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4 print:rounded-none print:border-slate-400 print:p-2">
      <h2 className="mb-2 border-b border-slate-200 pb-1 text-sm font-bold">{title}</h2>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: ReturnRow[] }) {
  return (
    <dl className="num text-sm print:text-xs">
      {rows.map((r, i) => (
        <div key={i} className={clsx('flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0', r.strong && 'font-bold')}>
          <dt>
            {r.label}
            {r.note && <span className="block text-[11px] font-normal text-slate-500">{r.note}</span>}
          </dt>
          <dd className="shrink-0">{formatYen(r.amount)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 決算書・確定申告書に転記する金額（正式な様式ではない） */
export function ReturnDocument({ data, saved }: { data: TaxReturnData; saved?: { version: number; createdAt: string } }) {
  const s = data.statements
  const formName = data.formType === 'blue' ? '青色申告決算書（一般用）' : '収支内訳書（一般用）'
  const st = STATUS[data.status]
  const bs = s.balanceSheet

  return (
    <div className="space-y-4 print:space-y-2">
      <div className={clsx('rounded-2xl border p-3 text-sm print:rounded-none', st.cls)}>
        <p className="font-bold">{st.label}</p>
        <p className="mt-1 text-xs leading-relaxed">
          {data.year}年分・{formName}と所得税の確定申告書に転記する金額です。正式な様式ではありません。
          {!data.final && ' 年の途中のため、これまでに登録した金額による途中の計算です。'}
          {data.status !== 'checked' && ' このまま提出用として使わないでください。'}
        </p>
        <p className="mt-1 text-[11px]">
          計算日 {data.calculatedOn}・税務ルール {data.ruleVersion}
          {saved && `・保存版 第${saved.version}版（${new Date(saved.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}）`}
        </p>
      </div>

      {data.checks.filter((c) => c.level !== 'info').length > 0 && (
        <Section title="確認事項">
          <ul className="space-y-1 text-xs leading-relaxed">
            {data.checks
              .filter((c) => c.level !== 'info')
              .map((c, i) => (
                <li key={i} className={clsx(c.level === 'unsupported' && 'font-semibold text-red-700', c.level === 'error' && 'text-amber-800')}>
                  {{ unsupported: '【対象外】', error: '【要対応】', warning: '【確認】', info: '' }[c.level]}
                  {c.message}
                </li>
              ))}
          </ul>
        </Section>
      )}

      <Section title={`${formName}: 損益計算書`}>
        <dl className="num text-sm print:text-xs">
          {s.revenue.map((l) => (
            <Line key={l.label} label={l.label} value={l.amount} />
          ))}
          {s.purchases > 0 && <Line label="仕入金額（売上原価・棚卸は未対応）" value={s.purchases} />}
          <p className="mt-2 text-xs font-semibold text-slate-500">経費</p>
          {s.expenses.map((l, i) => (
            <Line key={i} label={l.custom ? `${l.label}（空欄の行に記入）` : l.label} value={l.amount} muted={l.amount === 0} />
          ))}
          <Line label="経費の計" value={s.totalExpenses} strong />
          <Line label={data.formType === 'blue' ? '青色申告特別控除前の所得金額' : '差引金額（所得金額）'} value={s.profit} strong />
          {data.formType === 'blue' && (
            <>
              <Line label="青色申告特別控除額" value={s.blueDeduction} />
              <Line label="所得金額" value={s.income} strong />
            </>
          )}
        </dl>
      </Section>

      <Section title="月別の売上（収入）金額・仕入金額">
        <table className="num w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium">月</th>
              <th className="text-right font-medium">売上（収入）</th>
              <th className="text-right font-medium">仕入</th>
            </tr>
          </thead>
          <tbody>
            {s.monthly.map((m) => (
              <tr key={m.month} className="border-t border-slate-100">
                <td className="py-1">{m.month}月</td>
                <td className="py-1 text-right">{m.sales.toLocaleString('ja-JP')}</td>
                <td className="py-1 text-right">{m.purchases.toLocaleString('ja-JP')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {s.depreciation.length > 0 && (
        <Section title="減価償却費の計算">
          <div className="overflow-x-auto">
            <table className="num w-full min-w-[34rem] text-[11px]">
              <thead>
                <tr className="text-slate-500">
                  {['資産', '取得年月', '取得価額', '方法', '耐用年数', '償却率', '本年の償却期間', '本年分の償却費', '事業専用割合', '必要経費算入額', '未償却残高'].map((h) => (
                    <th key={h} className="px-1 text-right font-medium first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.depreciation.map((d, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-1 py-1">{d.name}</td>
                    <td className="px-1 py-1 text-right">{d.acquired}</td>
                    <td className="px-1 py-1 text-right">{d.cost.toLocaleString('ja-JP')}</td>
                    <td className="px-1 py-1 text-right">{d.method}</td>
                    <td className="px-1 py-1 text-right">{d.usefulLife}年</td>
                    <td className="px-1 py-1 text-right">{d.rate.toFixed(3)}</td>
                    <td className="px-1 py-1 text-right">{d.months}/12</td>
                    <td className="px-1 py-1 text-right">{d.amount.toLocaleString('ja-JP')}</td>
                    <td className="px-1 py-1 text-right">{d.businessRatio}%</td>
                    <td className="px-1 py-1 text-right">{d.businessAmount.toLocaleString('ja-JP')}</td>
                    <td className="px-1 py-1 text-right">{d.bookValue.toLocaleString('ja-JP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {bs && (
        <Section title="貸借対照表（資産負債調）">
          <table className="num w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium">科目</th>
                <th className="text-right font-medium">1月1日（期首）</th>
                <th className="text-right font-medium">12月31日（期末）</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={3} className="pt-2 font-semibold">資産の部</td></tr>
              {bs.assets.map((r) => (
                <BsRow key={r.account.code} label={r.account.name} opening={r.opening} closing={r.closing} />
              ))}
              <BsRow label="資産の合計" opening={bs.totalAssets.opening} closing={bs.totalAssets.closing} strong />
              <tr><td colSpan={3} className="pt-2 font-semibold">負債・資本の部</td></tr>
              {[...bs.liabilities, ...bs.equity].map((r) => (
                <BsRow key={r.account.code} label={r.account.name} opening={r.opening} closing={r.closing} />
              ))}
              <BsRow label="青色申告特別控除前の所得金額" opening={null} closing={bs.profit} />
              <BsRow label="負債・資本の合計" opening={bs.totalLiabilitiesAndEquity.opening} closing={bs.totalLiabilitiesAndEquity.closing} strong />
            </tbody>
          </table>
        </Section>
      )}

      <Section title="確定申告書 第一表: 収入金額等">
        <Rows rows={data.page1.revenue} />
      </Section>
      <Section title="確定申告書 第一表: 所得金額等">
        <Rows rows={data.page1.income} />
      </Section>
      <Section title="確定申告書 第一表: 所得から差し引かれる金額">
        <Rows rows={data.page1.deductions} />
      </Section>
      <Section title="確定申告書 第一表: 税金の計算">
        <Rows rows={data.page1.tax} />
      </Section>

      <Section title="確定申告書 第二表">
        <p className="mb-1 text-xs font-semibold text-slate-500">所得の内訳（所得税及び復興特別所得税の源泉徴収税額）</p>
        {data.page2.withholding.length === 0 ? (
          <p className="text-xs text-slate-500">源泉徴収された所得はありません。</p>
        ) : (
          <table className="num mb-3 w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium">種目</th>
                <th className="text-left font-medium">支払者</th>
                <th className="text-right font-medium">収入金額</th>
                <th className="text-right font-medium">源泉徴収税額</th>
              </tr>
            </thead>
            <tbody>
              {data.page2.withholding.map((w, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1">{w.kind}</td>
                  <td className="py-1">{w.payer}</td>
                  <td className="py-1 text-right">{w.revenue.toLocaleString('ja-JP')}</td>
                  <td className="py-1 text-right">{w.withholdingTax.toLocaleString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.page2.socialInsurance.length > 0 && (
          <>
            <p className="mb-1 text-xs font-semibold text-slate-500">社会保険料控除</p>
            <Rows rows={data.page2.socialInsurance.map((x) => ({ label: x.kind, amount: x.amount }))} />
          </>
        )}
        {data.page2.insurance.length > 0 && (
          <>
            <p className="mb-1 mt-2 text-xs font-semibold text-slate-500">保険料・掛金の控除</p>
            <Rows rows={data.page2.insurance} />
          </>
        )}
        {data.page2.family.length > 0 && (
          <>
            <p className="mb-1 mt-2 text-xs font-semibold text-slate-500">配偶者や親族に関する事項（氏名・個人番号はご自身で記入）</p>
            <ul className="text-xs">
              {data.page2.family.map((f, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 py-1">
                  <span>
                    {f.relation}（{f.birthDate ?? '生年月日未入力'}）
                  </span>
                  <span>{f.category}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-2 text-xs">住民税: 給与・公的年金等以外の所得に係る住民税の徴収方法 — {data.page2.residentTax}</p>
      </Section>

      {data.checks.some((c) => c.level === 'info') && (
        <Section title="補足">
          <ul className="list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-slate-600">
            {data.checks
              .filter((c) => c.level === 'info')
              .map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Line({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={clsx('flex justify-between gap-3 border-b border-slate-100 py-1', strong && 'font-bold', muted && 'text-slate-400')}>
      <dt>{label}</dt>
      <dd>{formatYen(value)}</dd>
    </div>
  )
}

function BsRow({ label, opening, closing, strong }: { label: string; opening: number | null; closing: number; strong?: boolean }) {
  return (
    <tr className={clsx('border-t border-slate-100', strong && 'font-bold')}>
      <td className="py-1">{label}</td>
      <td className="py-1 text-right">{opening === null ? '' : opening.toLocaleString('ja-JP')}</td>
      <td className="py-1 text-right">{closing.toLocaleString('ja-JP')}</td>
    </tr>
  )
}
