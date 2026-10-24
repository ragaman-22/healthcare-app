-- 第6段階: 年末予測の手入力補正（年末までの残りの売上・経費の見込み）
alter table public.tax_year_settings add column forecast_adjustment jsonb;
