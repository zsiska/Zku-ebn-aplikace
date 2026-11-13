# Zkouška

Zvukový otisk: změří, jak něco zní, a při další kontrole vyhodnotí, co se na zvuku změnilo.

Lze zvolit, co se poslouchá:

- **Stroj** (10 s): spektrum, otáčky, tóny, rázy.
- **Hlas** (až 35 s, rovné „ááá“ co nejdéle): výdrž tónu, výška hlasu, jitter a shimmer měřené po jednotlivých kmitech, čistota hlasu.
- **Dech** (40 s): dechová frekvence, pravidelnost, tóny při dechu.
- **Kašel** (15 s): počet a délka zakašlání. Typ kašle (suchý / vlhký) a varovné příznaky zadává uživatel sám; aplikace k nim ukáže obecné informace, ne doporučení léčby.
- **Srdce** (20 s, pokusné): tep a pravidelnost z mikrofonu přiloženého na hruď.

Režimy pro lidi nejsou zdravotnický prostředek a neslouží k diagnóze; ukazují jen změny proti vlastnímu výchozímu měření. Ověřené jsou pouze na umělých signálech.

U výdrže tónu, dechové a tepové frekvence aplikace ukazuje i obvyklá rozmezí dospělých. Jitter, shimmer a čistota hlasu závisejí na telefonu, proto se hodnotí jen proti vlastnímu výchozímu měření.

Část „Ověření výpočtů“ vyrobí umělé signály se známými hodnotami (kmitočet, rázy, jitter, shimmer, dech, tep, vážení A podle normy) a zkontroluje, že je aplikace změří v toleranci.

Pro stroj platí:

Z desetisekundového měření zjišťuje:

- kmitočtový otisk po 1/6 oktávy (50 Hz – 11 kHz) a jeho odchylky od výchozího stavu,
- základní kmitočet a odhad otáček, výrazné tóny a jejich násobky,
- rázovitost (klepání), pravidelné rázy a jejich rytmus,
- rovnoměrnost chodu, tónový podíl, těžiště zvuku a rozložení energie,
- kvalitu měření (přebuzení, slabý signál, jiné otáčky),
- shodu s výchozím otiskem v procentech a její vývoj v čase.

Zvuk se zpracuje v telefonu a nikam se neodesílá. Vyhodnocení je orientační.

Nativní verze ve složce `ios/` je původní zkušební aplikace (počítadlo a poznámka).

## Webová aplikace (iPhone bez počítače)

1. V Safari otevřete https://zsiska.github.io/Zku-ebn-aplikace/
2. Sdílet → **Přidat na plochu**.

## Nativní verze (.ipa)

Po každé změně ve složce `ios/` sestaví GitHub Actions soubor `Zkouska.ipa`
(Releases → `ios-latest`). Instalace vyžaduje AltStore Classic.
