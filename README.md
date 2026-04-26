# Ravintoäly (Food Scan App)

Ravintoäly on Expo/React Native -sovellus, jolla voit skannata tuotteita, analysoida ravintoarvoja ja seurata päivittäistä etenemistä.

## Ominaisuudet

- OCR-skannaus kameralla (Gemini backendin kautta)
- AI-pohjainen analyysi backendin kautta
- Päiväkirja kaloreille ja makroille
- Terveysprofiili (paino, pituus, tavoite, BMI)
- Kalenteri päivittäiselle seurannalle
- Viikkoraportit ja analyysien suodatus

## Teknologiat

- Expo + React Native
- TypeScript
- Expo Router
- React Native Vision Camera

## Käynnistys lokaalisti

1. Asenna riippuvuudet:

```bash
npm install
```

2. Luo oma ympäristötiedosto:

```bash
copy .env.example .env
```

3. Täytä `.env`:

```env
EXPO_PUBLIC_BACKEND_URL=https://foodscanbackend.food
```

4. Käynnistä sovellus:

```bash
npx expo start
```

Huom: Kameraominaisuudet vaativat dev buildin (eivät toimi täydellisesti Expo Go:ssa).

## Kuvakaappaukset

<img src="docs/screenshots/01-kamera.png" alt="Kamera" width="320" />
*Kameranäkymä OCR-skannaukseen. Jos käytät Expo Go:ta, sovellus ohjaa dev buildin käyttöön kameraa varten.*

<img src="docs/screenshots/02-tavoite.png" alt="Tavoite" width="320" />
*Tavoitteen asetus: valittu tavoite, tavoitepaino ja aikajänne.*

<img src="docs/screenshots/03-treeni-bmi.png" alt="Treeni ja BMI" width="320" />
*Treeniaktiivisuus, intensiteetti ja BMI-visualisointi samassa näkymässä.*

<img src="docs/screenshots/04-terveysprofiili.png" alt="Terveysprofiili" width="320" />
*Terveysprofiilin perustiedot: paino, pituus, sukupuoli ja ikähaarukka.*

<img src="docs/screenshots/05-kalenteri-kuukausi.png" alt="Kalenteri - kuukausi" width="320" />
*Kalenterin kuukausinäkymä päiväkohtaiseen seurantaan.*

<img src="docs/screenshots/06-kalenteri-yhteenvedot.png" alt="Kalenteri - yhteenveto" width="320" />
*Kalenterin yhteenvetokortit: kalorit, makrot, tavoitekalorit ja painon kehitys.*

<img src="docs/screenshots/07-paivakirja-makrot.png" alt="Päiväkirja - makrot" width="320" />
*Päiväkirjan päivänäkymä: kalorit ja makrojen seuranta.*

<img src="docs/screenshots/08-paivakirja-lisaykset.png" alt="Päiväkirja - lisäykset" width="320" />
*Nopeat toiminnot päivän merkintöihin: paino, manuaalinen lisäys, analyysit ja reseptit.*

<img src="docs/screenshots/09-analyysit-viikkoraportti.png" alt="Analyysit" width="320" />
*Analyysit-vaihtilehti: viikkoraportit, haku, suodatus ja profiilianalyysit.*

## Turvallisuus

- Aitoja avaimia ei tallenneta git-repoon.
- `.env` on ignoroitu gitissä.
- Julkiseen repoon kuuluu vain `.env.example`.

## Lisädokumentaatio

- [GitHub + API-ohjeet](GITHUB_OHJEET.md)
- [Backend-ohje annosvarmennukseen](BACKEND_AI_KUVA_VARMISTETAAN_ANNOS_OHJE.md)
