# 所得税の照合表（国税庁「確定申告書等作成コーナー」等との照合用）

`WRITE_VERIFICATION=1 npx vitest run src/lib/tax/verification.test.ts` で再生成します。
各ケースを国税庁の作成コーナーで同じ条件で入力し、「国税庁の結果」欄に記入してください。差がある場合は原因を調べ、ルールを修正するか未対応として明示します。

| ID | 年分 | ケース | 合計所得 | 所得控除 | 課税所得 | 所得税等 | 申告時（＋納付/−還付） | 住民税（参考） | 国税庁の結果 | 確認者・日付 |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| R7-01 | 2025 | 白色・事業のみ・社会保険料30万円 | 2,200,000 | 1,180,000 | 1,020,000 | 52,071 | 52,000 | 149,500 |  |  |
| R7-02 | 2025 | 青色65万円・社会保険料60万円・源泉徴収あり | 3,850,000 | 1,280,000 | 2,570,000 | 162,849 | -143,451 | 284,500 |  |  |
| R7-03 | 2025 | 青色55万円・配偶者（所得0）・特定扶養1人 | 5,450,000 | 2,440,000 | 3,010,000 | 207,773 | 207,700 | 346,500 |  |  |
| R7-04 | 2025 | 事業の赤字＋給与500万円（損益通算） | 3,060,000 | 1,580,000 | 1,480,000 | 75,554 | -44,446 | 195,500 |  |  |
| R7-05 | 2025 | 医療費・生命保険料・ふるさと納税 | 3,350,000 | 1,648,000 | 1,702,000 | 86,887 | 86,800 | 178,700 |  |  |
| R8-01 | 2026 | 白色・事業のみ（基礎控除104万円の区分） | 2,200,000 | 1,340,000 | 860,000 | 43,903 | 43,900 | 149,500 |  |  |
| R8-02 | 2026 | 青色65万円・所得500万円台（基礎控除67万円の区分） | 5,350,000 | 1,470,000 | 3,880,000 | 355,818 | 105,800 | 414,500 |  |  |
| R8-03 | 2026 | 配偶者の所得62万円（配偶者控除の上限） | 3,350,000 | 1,920,000 | 1,430,000 | 73,001 | 73,000 | 211,500 |  |  |
| R8-04 | 2026 | 給与220万円＋事業（給与所得控除74万円） | 2,660,000 | 1,440,000 | 1,220,000 | 62,281 | 32,200 | 185,500 |  |  |
| R8-05 | 2026 | 高所得（税率33%の区分） | 19,350,000 | 1,820,000 | 17,530,000 | 4,338,126 | 4,338,100 | 1,774,500 |  |  |

税務ルール: 2025年分 2025.2 / 2026年分 2026.1-provisional

## ケースの入力条件

- **R7-01** 白色・事業のみ・社会保険料30万円: `{"blueDeduction":"none","socialInsurance":300000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":0,"estimatedTaxPrepaid":0,"revenue":3000000,"expenses":800000}`
- **R7-02** 青色65万円・社会保険料60万円・源泉徴収あり: `{"blueDeduction":"e_tax_65","socialInsurance":600000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":306300,"estimatedTaxPrepaid":0,"revenue":6000000,"expenses":1500000}`
- **R7-03** 青色55万円・配偶者（所得0）・特定扶養1人: `{"blueDeduction":"paper_55","socialInsurance":800000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":0,"estimatedTaxPrepaid":0,"revenue":8000000,"expenses":2000000,"details":{"self":{"disability":"none","widow":false,"singleParent":"none"},"spouse":{"birthDate":"1985-01-01","totalIncome":0,"disability":"none"},"dependents":[{"label":"長男","birthDate":"2005-04-01","totalIncome":0,"cohabitingParent":false,"disability":"none"}],"lifeInsurance":null,"earthquakeInsurance":null,"medical":null,"donations":null}}`
- **R7-04** 事業の赤字＋給与500万円（損益通算）: `{"blueDeduction":"none","socialInsurance":700000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":120000,"estimatedTaxPrepaid":0,"revenue":1000000,"expenses":1500000,"salaryRevenue":5000000}`
- **R7-05** 医療費・生命保険料・ふるさと納税: `{"blueDeduction":"e_tax_65","socialInsurance":500000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":0,"estimatedTaxPrepaid":0,"revenue":5000000,"expenses":1000000,"details":{"self":{"disability":"none","widow":false,"singleParent":"none"},"spouse":null,"dependents":[],"lifeInsurance":{"general":100000,"medicalCare":40000,"pension":0},"earthquakeInsurance":null,"medical":{"mode":"normal","paid":300000,"reimbursed":50000},"donations":{"furusato":50000,"other":0}}}`
- **R8-01** 白色・事業のみ（基礎控除104万円の区分）: `{"blueDeduction":"none","socialInsurance":300000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":0,"estimatedTaxPrepaid":0,"revenue":3000000,"expenses":800000}`
- **R8-02** 青色65万円・所得500万円台（基礎控除67万円の区分）: `{"blueDeduction":"e_tax_65","socialInsurance":800000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":200000,"estimatedTaxPrepaid":50000,"revenue":8000000,"expenses":2000000}`
- **R8-03** 配偶者の所得62万円（配偶者控除の上限）: `{"blueDeduction":"e_tax_65","socialInsurance":500000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":0,"estimatedTaxPrepaid":0,"revenue":5000000,"expenses":1000000,"details":{"self":{"disability":"none","widow":false,"singleParent":"none"},"spouse":{"birthDate":"1990-01-01","totalIncome":620000,"disability":"none"},"dependents":[],"lifeInsurance":null,"earthquakeInsurance":null,"medical":null,"donations":null}}`
- **R8-04** 給与220万円＋事業（給与所得控除74万円）: `{"blueDeduction":"none","socialInsurance":400000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":30000,"estimatedTaxPrepaid":0,"revenue":1500000,"expenses":300000,"salaryRevenue":2200000}`
- **R8-05** 高所得（税率33%の区分）: `{"blueDeduction":"e_tax_65","socialInsurance":1200000,"smallBusinessMutualAid":0,"lifeInsuranceDeduction":0,"otherDeductions":0,"withholdingTax":0,"estimatedTaxPrepaid":0,"revenue":25000000,"expenses":5000000}`
