# Backend-ohje: AI-kuva + "Varmistetaan annos" tiedot varmasti AI:lle

Tavoite: varmistaa, etta backend valittaa **samassa AI-kutsussa** seka kuvan etta kayttajan valitsemat annostiedot.

## 1) Frontendin lahettama payload (nykyinen sopimus)

AI-kuva-analyysissa frontend lahettaa `POST`-pyynnon, jossa on:

```json
{
  "imageBase64": "<base64-kuva>",
  "profile": { "...": "..." },
  "mealAdjustments": {
    "portionMultiplier": 1.2,
    "oilAdded": true,
    "servingContext": "restaurant",
    "adjustmentPercent": 10,
    "mealDescription": "Esim. annos nayttaa pienelta"
  },
  "mealDescription": "Esim. annos nayttaa pienelta"
}
```

Huom:
- `profile` on valinnainen.
- `mealDescription` voi tulla seka `mealAdjustments.mealDescription` etta top-levelina. Kayta ensisijaisesti `mealAdjustments.mealDescription`.
- `mealDescription` puuttuu, jos kayttaja jattaa kentan tyhjaksi.

## 2) Backend-validointi (pakollinen)

Tee ennen AI-kutsua vahintaan nama tarkistukset:

1. `imageBase64` pakollinen ja ei-tyhja.
2. `mealAdjustments` valinnainen, mutta jos loytyy:
   - `portionMultiplier`: numero, sallitut arvot `0.5 | 0.7 | 1 | 1.2 | 1.4` (tai fallback `1`).
   - `oilAdded`: boolean (fallback `false`).
   - `servingContext`: `"home" | "restaurant" | "readymeal"` (fallback `"home"`).
   - `adjustmentPercent`: numero, clamp `-20...20` (fallback `0`).
   - `mealDescription`: trimattu string, max esim. 180 merkkia.

Jos data on virheellinen, palauta `400` selkealla virhesanalla.

## 3) Rakenna yksi yhtenainen AI-input

Ala tee erillisia AI-kutsuja kuvalle ja annostiedoille. Tee yksi pyynto, jossa:

1. Kuva liitetaan mallille image-inputina.
2. Annostiedot annetaan tekstimuotoisena rakenteisena kontekstina.
3. Mallia ohjeistetaan kayttamaan annostietoja lopullisessa kalori- ja makroarviossa.

Esimerkki "annoskonteksti"-tekstista mallille:

```text
Kayttajan annosvalinnat:
- portionMultiplier: 1.2
- oilAdded: true
- servingContext: restaurant
- adjustmentPercent: 10
- mealDescription: "annos nayttaa pienelta"

Sovella nama valinnat arvioon nain:
1) Tunnista ruoka ensisijaisesti kuvasta.
2) Saada annoskokoportion arvio portionMultiplierin mukaan.
3) Huomioi oljylisa, jos oilAdded=true.
4) Huomioi servingContext epavarmuus- ja kaloritiheyskorjauksena.
5) Sovella adjustmentPercent lopulliseen kokonaisenergia-arvioon.
```

## 4) Node/Express-esimerkkirunko

```ts
app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, mealAdjustments, profile } = req.body ?? {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    const portionMultiplierRaw = mealAdjustments?.portionMultiplier;
    const allowedPortions = new Set([0.5, 0.7, 1, 1.2, 1.4]);
    const portionMultiplier =
      typeof portionMultiplierRaw === "number" && allowedPortions.has(portionMultiplierRaw)
        ? portionMultiplierRaw
        : 1;

    const oilAdded = Boolean(mealAdjustments?.oilAdded);

    const servingContextRaw = mealAdjustments?.servingContext;
    const servingContext =
      servingContextRaw === "home" ||
      servingContextRaw === "restaurant" ||
      servingContextRaw === "readymeal"
        ? servingContextRaw
        : "home";

    const adjustmentPercentRaw = Number(mealAdjustments?.adjustmentPercent ?? 0);
    const adjustmentPercent = Math.max(-20, Math.min(20, Number.isFinite(adjustmentPercentRaw) ? adjustmentPercentRaw : 0));

    const mealDescriptionRaw =
      typeof mealAdjustments?.mealDescription === "string"
        ? mealAdjustments.mealDescription
        : typeof req.body?.mealDescription === "string"
          ? req.body.mealDescription
          : "";
    const mealDescription = mealDescriptionRaw.trim().slice(0, 180);

    const mealContext = {
      portionMultiplier,
      oilAdded,
      servingContext,
      adjustmentPercent,
      ...(mealDescription ? { mealDescription } : {}),
    };

    const instructionText =
      "Arvioi ruoka kuvasta. Kayta annoskontekstia kalori- ja makroarvion saatamiseen.";

    // Esimerkki: muodosta AI-kutsu niin, etta mukana on seka image etta teksti.
    // Vaihda tama oman AI-SDK:n ja mallin mukaiseen formaattiin.
    const aiResponse = await callYourModel({
      instructionText,
      profile,
      mealContext,
      imageBase64,
    });

    return res.json(aiResponse);
  } catch (err) {
    return res.status(500).json({ error: "analysis failed" });
  }
});
```

## 5) Varmistus: lokit ja testit

Lisaa backendiin ennen AI-kutsua loki, joka EI tulosta koko kuvaa:

- `hasImageBase64: true/false`
- `imageLength: imageBase64.length`
- `mealContext` (sanitoitu)
- `hasProfile: true/false`

Testaa vahintaan nama:

1. Kuva + kaikki annostiedot -> AI-kutsu sisaltaa kaikki kentat.
2. Kuva ilman mealAdjustments -> kaytetaan oletuksia.
3. Virheellinen `adjustmentPercent` -> clamp toimii.
4. Tyhja `imageBase64` -> `400`.

## 6) Yhteensopivuus frontendin kanssa

Frontendin AI-kuva-flow rakentaa nyt nama kentat:

- `imageBase64`
- `profile` (jos kaytossa)
- `mealAdjustments.portionMultiplier`
- `mealAdjustments.oilAdded`
- `mealAdjustments.servingContext`
- `mealAdjustments.adjustmentPercent`
- `mealAdjustments.mealDescription` (valinnainen)
- `mealDescription` (valinnainen, varakentta)

Kun backend kayttaa ylla olevaa sopimusta ja yhta yhteista AI-kutsua, kuva + "Varmistetaan annos" tieto menee varmasti mallille arvioitavaksi.
