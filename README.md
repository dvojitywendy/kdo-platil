# Kdo platil?

Sdílený detektivní spis pro dva lidi, kteří se střídají v placení. Jedno klepnutí zapíše, kdo dneska platil (brunch, nebo kafe a dort), a appka ukáže, kdo je na řadě příště. Sarkasmus v ceně.

Je to PWA: běží v prohlížeči, na iPhonu se přidá na plochu a pak se chová jako appka, včetně offline režimu.

## Jak to funguje

- **Body:** brunch = 2 body, kafe a dort = 1 bod. Na řadě je ten, kdo je v bodech pozadu. Při remíze ten, kdo neplatil naposledy.
- **Appka** je statický web na GitHub Pages v tomhle repu (`index.html`, `app.css`, `app.js`).
- **Spis** je jeden soubor `spis.json` v samostatném **soukromém** repu `kdo-platil-data`. Každé placení je commit, takže historie spisu je celá v gitu.
- **Přístupový klíč** (fine-grained token) smí zapisovat jen do datového repa. Do kódu se nikdy nedává: každý ho jednou vloží do appky a zůstane jen v jeho telefonu.
- Když oba zapíšou ve stejnou chvíli, GitHub druhý zápis odmítne a appka ho sama zopakuje nad čerstvými daty.

## Nastavení (jednou)

1. **Datové repo.** Na GitHubu založ repo `kdo-platil-data` jako **Private**. Může být úplně prázdné, `spis.json` si appka založí sama.
2. **Přístupový klíč.** Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token:
   - *Repository access:* Only select repositories → `kdo-platil-data`
   - *Permissions → Repository permissions → Contents:* **Read and write**
   - *Expiration:* nejdelší platnost, kterou GitHub nabídne. Až vyprší, appka si řekne o nový.
3. Kdyby se datové repo jmenovalo jinak, uprav `dataRepo` v `config.js`.

## Instalace na iPhone

1. Otevři appku v Safari a dej **Sdílet → Přidat na plochu**.
2. Spusť ji z plochy a vlož přístupový klíč. (Appka na ploše má na iPhonu vlastní úložiště, proto klíč až tam.)
3. V sekci **Sdílení spisu** klepni na **Poslat pozvánku**. Kamarád dostane odkaz, návod a klíč v jedné zprávě. GitHub účet nepotřebuje.
4. Při prvním spuštění appka zjistí, kdo drží telefon. Pak už stačí jedno klepnutí.

## Kdyby klíč unikl

Na GitHubu ho smaž a vytvoř nový. Uniklý klíč umí přepsat jen spis, nic víc, a celou historii máš v commitech.

## Úpravy

Po změně souborů zvyš `VERSION` v `sw.js`, ať si telefony stáhnou novou verzi.
