import type { Account } from './types'

/** 標準勘定科目。コードは本アプリ内の識別子（決算書の行との対応は第7段階で定義） */
export const SYSTEM_ACCOUNTS: Account[] = [
  // 資産
  { code: '101', name: '現金', category: 'asset', isSystem: true },
  { code: '102', name: '普通預金', category: 'asset', isSystem: true },
  { code: '110', name: '売掛金', category: 'asset', isSystem: true },
  { code: '120', name: '前払金', category: 'asset', isSystem: true },
  { code: '150', name: '工具器具備品', category: 'asset', isSystem: true },
  { code: '151', name: '車両運搬具', category: 'asset', isSystem: true },
  { code: '152', name: '建物附属設備', category: 'asset', isSystem: true },
  { code: '153', name: 'ソフトウェア', category: 'asset', isSystem: true },
  { code: '190', name: '事業主貸', category: 'asset', isSystem: true },
  // 負債
  { code: '201', name: '買掛金', category: 'liability', isSystem: true },
  { code: '202', name: '未払金', category: 'liability', isSystem: true },
  { code: '203', name: '預り金', category: 'liability', isSystem: true },
  { code: '204', name: '借入金', category: 'liability', isSystem: true },
  // 純資産（資本）
  { code: '290', name: '事業主借', category: 'equity', isSystem: true },
  { code: '300', name: '元入金', category: 'equity', isSystem: true },
  // 収益
  { code: '400', name: '売上高', category: 'revenue', isSystem: true },
  { code: '410', name: '雑収入', category: 'revenue', isSystem: true },
  // 費用
  { code: '500', name: '仕入高', category: 'expense', isSystem: true },
  { code: '510', name: '租税公課', category: 'expense', isSystem: true },
  { code: '511', name: '荷造運賃', category: 'expense', isSystem: true },
  { code: '512', name: '水道光熱費', category: 'expense', isSystem: true },
  { code: '513', name: '旅費交通費', category: 'expense', isSystem: true },
  { code: '514', name: '通信費', category: 'expense', isSystem: true },
  { code: '515', name: '広告宣伝費', category: 'expense', isSystem: true },
  { code: '516', name: '接待交際費', category: 'expense', isSystem: true },
  { code: '517', name: '損害保険料', category: 'expense', isSystem: true },
  { code: '518', name: '修繕費', category: 'expense', isSystem: true },
  { code: '519', name: '消耗品費', category: 'expense', isSystem: true },
  { code: '520', name: '減価償却費', category: 'expense', isSystem: true },
  { code: '521', name: '福利厚生費', category: 'expense', isSystem: true },
  { code: '522', name: '給料賃金', category: 'expense', isSystem: true },
  { code: '523', name: '外注工賃', category: 'expense', isSystem: true },
  { code: '524', name: '利子割引料', category: 'expense', isSystem: true },
  { code: '525', name: '地代家賃', category: 'expense', isSystem: true },
  { code: '526', name: '貸倒金', category: 'expense', isSystem: true },
  { code: '527', name: '支払手数料', category: 'expense', isSystem: true },
  { code: '528', name: '新聞図書費', category: 'expense', isSystem: true },
  { code: '529', name: '会議費', category: 'expense', isSystem: true },
  { code: '530', name: '研修費', category: 'expense', isSystem: true },
  { code: '531', name: '車両費', category: 'expense', isSystem: true },
  { code: '599', name: '雑費', category: 'expense', isSystem: true },
]

export const ACCOUNT = {
  cash: '101',
  bank: '102',
  receivable: '110',
  ownerDrawing: '190',
  payable: '202',
  ownerContribution: '290',
  sales: '400',
  depreciation: '520',
} as const

/** 売上の入金先として選べる科目 */
export const DEPOSIT_ACCOUNTS = ['102', '101']
/** 経費の支払方法として選べる科目 */
export const PAYMENT_ACCOUNTS = ['102', '101', '290', '202']
export const PAYMENT_LABELS: Record<string, string> = {
  '101': '現金（事業用）',
  '102': '普通預金（事業用口座）',
  '290': '個人のお金・個人カードで支払った（事業主借）',
  '202': '未払い（後日支払う）',
}
export const SALES_ACCOUNTS = ['400', '410']
export const FIXED_ASSET_ACCOUNTS = ['150', '151', '152', '153']

/** 借方が増加側の区分か */
export function isDebitNormal(category: Account['category']): boolean {
  return category === 'asset' || category === 'expense'
}

export function accountMap(accounts: Account[]): Map<string, Account> {
  return new Map(accounts.map((a) => [a.code, a]))
}
