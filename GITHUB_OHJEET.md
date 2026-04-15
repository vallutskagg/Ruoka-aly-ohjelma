# GitHub + API-ohjeet (Food Scan App)

Tama tiedosto on valmis jaettava ohje tiimille, kun projekti julkaistaan GitHubiin.

## 1) Projektin pushaus GitHubiin

### A. Luo uusi repository GitHubissa
1. Mene GitHubiin ja valitse **New repository**.
2. Anna nimi, esim. `food-scan-app`.
3. Ala valitse tassa vaiheessa lisaa `README`, `.gitignore` tai lisenssia (jos paikallisessa projektissa on jo oma historia).
4. Luo repository.

### B. Pushaa nykyinen projekti (PowerShell)
Suorita projektin juuressa:

```bash
git add .
git commit -m "Initial project setup"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

Jos `origin` on jo olemassa:

```bash
git remote set-url origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 2) API-kayton turvallinen asennus

Tassa projektissa kaytetaan ymparistomuuttujia:
- `EXPO_PUBLIC_BACKEND_URL`
- `EXPO_PUBLIC_GOOGLE_VISION_API_KEY`

### A. Luo oma `.env` tiedosto
1. Kopioi mallipohja:

```bash
copy .env.example .env
```

2. Tayta oikeat arvot tiedostoon `.env`.

### B. Tarkista, ettei salaisuuksia commitoida
- `.env` on ignoroitu gitissa.
- `.env.example` saa olla julkinen, koska se sisaltaa vain malliarvot.
- Aitoja API-avaimia ei koskaan laiteta suoraan koodiin tai README:hen.

### C. Google Vision API -avaimen suojaus
- Rajaa avain Google Cloudissa mahdollisimman tarkasti.
- Ota kayttoon API restrictions (vain Vision API).
- Ota kayttoon app/web restrictions aina kun mahdollista.
- Kierrata (rotate) avain heti, jos se on voinut vuotaa.

### D. Backendin luotettavuus
- OpenAI- tai muut salaiset avaimet kuuluvat vain backendiin, ei mobiiliappiin.
- Backend validoi pyyntodata ennen AI-kutsuja.
- Lokitukseen ei kirjoiteta API-avaimia tai koko kuvasisaltoa.

## 3) Tiimin nopeat komennot

```bash
npm install
npx expo start
```

## 4) Suositeltu PR-tarkistuslista

- [ ] Ei kovakoodattuja avaimia
- [ ] `.env` ei nay `git status` -listassa
- [ ] `.env.example` paivitetty jos uusia muuttujia lisatty
- [ ] README tai tama ohje paivitetty tarvittaessa
