/**
 * データベース・ストレージのエラーは、内部の情報（テーブル名・制約名など）を利用者に見せず、
 * サーバーのログにだけ残す。
 */
export function dbError(context: string, err: { message: string } | null | undefined): string {
  console.error(`[${context}]`, err?.message ?? 'unknown error')
  return '保存に失敗しました。時間をおいてもう一度お試しください。'
}
