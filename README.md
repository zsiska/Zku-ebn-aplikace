# Foto iX

Webová aplikace pro partu: každý vybere v telefonu fotky a videa z akce, ty se nahrají
**v plné velikosti** na Disk Google organizátora a příjemce (kdo z nich bude dělat video)
dostane e-mail s odkazy ke stažení.

Aplikace: https://zsiska.github.io/Zku-ebn-aplikace/

## Jak to funguje

- `index.html` – aplikace (běží v Safari, nic se neinstaluje). Soubory posílá po částech
  po 4 MB, při výpadku spojení zjistí, kolik už Disk přijal, a pokračuje.
- `skript.gs` – serverová část pro Google Apps Script. Běží pod účtem organizátora, ukládá
  do složky `Fotky z akcí / <akce> / <jméno>` a posílá e-mail z jeho Gmailu.

## Nastavení (organizátor, jednou)

1. Na https://script.google.com vytvořte nový projekt a vložte obsah `skript.gs`.
2. Nasadit → Nové nasazení → Webová aplikace, Spustit jako: Já, Kdo má přístup: Kdokoli.
3. Adresu webové aplikace (končí `/exec`) vložte do Nastavení v aplikaci spolu s názvem
   akce a e-mailem příjemce.
4. Tlačítkem „Pozvat partu“ pošlete odkaz do skupiny; nastavení se z něj načte samo.

Podrobný návod je přímo v aplikaci v části „Pro organizátora“.

## Volné místo, fronta a duplicity

- Všichni v aplikaci vidí, kolik místa na Disku organizátora zbývá.
- Co se nevejde, čeká v telefonu ve frontě; aplikace každou minutu zkontroluje místo
  a po jeho uvolnění pokračuje sama (musí zůstat otevřená). Organizátor dostane
  e-mail, že je Disk plný (nejvýš jednou za 6 hodin).
- Skript si pamatuje, co kdo poslal (akce, jméno, název a velikost souboru), takže
  stejnou fotku od téhož člověka nepřijme dvakrát, ani když ji organizátor mezitím
  z Disku smazal.

## Přístup příjemce

Příjemce (může to být kdokoli, nemusí to být vlastník Disku) dostane přístup jen ke
složce své akce, k ničemu dalšímu. S adresou Gmail jako konkrétní účet, s jinou adresou
přes odkaz. Místo uvolní odkazem „Uvolnit místo“ v e-mailu: po potvrzení skript natrvalo
smaže jen soubory dané akce nahrané do okamžiku e-mailu.

## Omezení

- Bezplatný Disk Google má 15 GB, Gmail pošle nejvýše 100 e-mailů denně.
- Při odesílání musí aplikace zůstat otevřená a telefon odemčený.
- V iPhonu je v nabídce fotek potřeba zvolit Možnosti → formát Aktuální, jinak může iOS
  fotky převést a videa zmenšit. Aplikace u každého souboru ukazuje rozlišení a velikost.
- Kdo zná adresu skriptu nebo pozvánku, může na Disk nahrávat; sdílejte je jen s partou.

Složka `ios/` obsahuje starou zkušební nativní aplikaci a s touto aplikací nesouvisí.
