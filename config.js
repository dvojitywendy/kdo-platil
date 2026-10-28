// Nastavení sdíleného backendu (Supabase). Postup je v README.md.
// Oba údaje najdeš v Supabase: Project Settings → API (Project URL a publishable/anon key).
// Klíč je veřejný z principu: data chrání kód spisu a databázové funkce v supabase.sql.
// Když jsou hodnoty prázdné, appka běží jen lokálně v jednom zařízení.
window.KDO_PLATIL_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
