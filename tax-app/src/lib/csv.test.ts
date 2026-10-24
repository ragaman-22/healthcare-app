import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('CSV', () => {
  it('数式として解釈される文字列を無害化する', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('@SUM')).toBe("'@SUM")
    expect(csvCell(-100)).toBe('-100')
  })
  it('カンマ・改行・引用符をエスケープし、BOM と CRLF を付ける', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(toCsv([['日付', '摘要'], ['2026-01-01', '改行\nあり']])).toBe('﻿日付,摘要\r\n2026-01-01,"改行\nあり"\r\n')
  })
})
