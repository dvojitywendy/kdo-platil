# Kdo platil?

Sdílený detektivní spis pro dva lidi, kteří se střídají v placení. Jedno klepnutí zapíše, kdo dneska platil (brunch, nebo kafe a dort), a appka ukáže, kdo je na řadě příště. Sarkasmus v ceně.

Je to PWA: běží v prohlížeči, na iPhonu se přidá na plochu a pak se chová jako appka, včetně offline režimu.

## Jak to funguje

- **Frontend** je statický web na GitHub Pages (`index.html`, `app.css`, `app.js`).
- **Sdílená data** drží bezplatná databáze Supabase. Appka s ní mluví přes pár databázových funkcí ze souboru `supabase.sql`.
- **Spis** má náhodný kód o 20 znacích (např. `k7m2p-qx9ad-r4hwe-3nvzb`). Kdo kód zná, může do spisu zapisovat. Nikdo jiný se k datům nedostane.
- **Bez nastaveného backendu** appka funguje taky, jen si spis pamatuje jen jeden telefon.

## Nastavení backendu (cca 5 minut, jednou)

1. Založ si účet na [supabase.com](https://supabase.com) a vytvoř nový projekt (Free tarif stačí, region třeba Frankfurt).
2. V projektu otevři **SQL Editor → New query**, vlož celý obsah `supabase.sql` a klikni **Run**.
3. Otevři **Project Settings → API Keys** (nebo **API**) a zkopíruj:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_…`), případně starší **anon** klíč.
4. Obě hodnoty vlož do `config.js` a commitni. Klíč je veřejný z principu, data chrání kód spisu.

## Instalace na iPhone

1. Jeden z vás otevře appku a klikne **Založit nový spis**, pak **Poslat pozvánku**.
2. Druhý otevře pozvánku v Safari. Kód spisu je v adrese, takže se připojí sám.
3. Oba: **Sdílet → Přidat na plochu**. Kód se uloží i do ikony na ploše.
4. Při prvním spuštění appka zjistí, kdo drží telefon. Pak už stačí jedno klepnutí.

Když ikona na ploše kód ztratí, stačí ho zadat ručně. Najdeš ho v appce v sekci **Sdílení spisu**.

## Supabase neusne

Bezplatný projekt Supabase se po týdnu bez provozu uspí. Workflow `.github/workflows/keepalive.yml` ho každé 3 dny probudí. GitHub plánované workflow vypne po 60 dnech bez commitů, pak ho stačí v záložce **Actions** znovu zapnout.

## Úpravy

Po změně souborů zvyš `VERSION` v `sw.js`, ať si telefony stáhnou novou verzi.
