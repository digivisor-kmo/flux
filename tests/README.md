# FLUX-testsuite

Alles wat de app doet, staat hier vast in tests. Bij elke push draait GitHub Actions
deze suite; alleen als alles groen is wordt `main` (en dus de live site op Vercel)
bijgewerkt. Zo kan een uitbreiding nooit ongemerkt bestaande functionaliteit breken.

## Draaien

    cd tests
    npm install        # eenmalig (jsdom)
    npm test           # volledige suite (unit + integratie)

Snelle pre-push controle vanuit de repo-root: `node deploy-check.js`

## Opbouw

- `unit/` — pure spellogica, getest tegen `js/flux-core.js` en `js/flux-rules.js`
  (de modules die de app zelf laadt, dus geen kopieën):
  - `core.test.js` — solver/par/uniciteit, gecontroleerd tegen een onafhankelijke
    brute-force-referentie; lineariteit van de kernregel; gouden seed-waarden
  - `rules.test.js` — dagwissel om 09:00 Brussel (incl. DST-randen), streak,
    share-tekst (spoilervrij), formattering, XSS-escaping, Numbers-generator
  - `campaign.test.js` — alle 120 campagnepuzzels oplosbaar met exact de geclaimde
    par + niet-dalende curve; betterBest-merge commutatief/idempotent/sticky
  - `daily-parity.test.js` — voert de GEVENDORDE edge function-broncode
    (`fixtures/submit-daily.v3.ts`) echt uit en eist bit-voor-bit dezelfde daily
    als de client; gouden fixture legt 60 dagen generatie voor altijd vast
- `integration/` — de echte `index.html` geboot in jsdom (helpers/boot.js),
  flows via echte kliks: campagne spelen tot winst, tier-unlock, daily incl.
  countdown/hervatten/pending-submit, onboarding, tabs, settings
- `fixtures/` — gevendorde servercode + gouden daily-fixture

## Contracten (nooit eenzijdig wijzigen)

- Daily-generatie (seed, 3×3/2, k 3-4, reset 09:00 Brussel) is een contract met de
  edge function `submit-daily`. Wijzig je die, vendor dan de nieuwe versie in
  `fixtures/` en pas client + server SAMEN aan; de pariteitstest dwingt dit af.
- De campagneset (`CAMP_PUZZLES`) is identiek voor alle spelers; een nieuwe set
  vereist een CAMP_VER-bump (de tests controleren de reset).

## Testgedreven uitbreiden

Nieuwe feature? Eerst een falende test in `unit/` of `integration/`, dan pas code.
Pure logica hoort in `js/flux-rules.js` of `js/flux-core.js` (testbaar), alleen
UI/opslag/netwerk in `index.html`.
