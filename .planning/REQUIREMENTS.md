# Requirements: AI-Sanomat Yrityksille

**Defined:** 2026-03-04
**Core Value:** The AI-generated weekly digest must be genuinely useful and industry-relevant — content quality is the entire selling point.

## v1.2 Requirements

Requirements for v1.2 Newsletter Quality & Design. Each maps to roadmap phases.

### Sisältörakenne (Content Structure)

- [ ] **CONTENT-01**: Uutisartikkeli sisältää lead-lauseen joka tiivistää uutisen ydinviestin
- [ ] **CONTENT-02**: Uutisartikkeli sisältää 2-4 bullet-pointtia avainpointeista
- [ ] **CONTENT-03**: Uutisartikkeli käyttää alaotsikointia, boldausta ja korostuksia luettavuuden parantamiseksi
- [ ] **CONTENT-04**: Vanhat digestit (ilman uutta rakennetta) renderöityvät edelleen oikein

### Kuvat (Images)

- [ ] **IMAGE-01**: Uutisartikkelin kuva haetaan ensisijaisesti lähdeartikkelin OG-metatiedoista
- [ ] **IMAGE-02**: OG-kuvahaku käyttää timeoutia (3-5s) eikä estä digestin generointia
- [ ] **IMAGE-03**: Jos OG-kuvaa ei löydy, generoidaan AI-infograafi joka selittää uutisen sisältöä
- [ ] **IMAGE-04**: Jos AI-infograafikaan ei onnistu, uutinen näytetään ilman kuvaa

### Brändäys (Branding)

- [ ] **BRAND-01**: Uutiskirjeen header sisältää AI-Sanomat logo-ikonin ja "AI-Sanomat" tekstin
- [ ] **BRAND-02**: Logo on hosted PNG-kuva (ei base64, ei SVG) sähköpostiyhteensopivuuden vuoksi

## Future Requirements

### Deferred from v1.2

- **EMAIL-01**: Gmail 102KB HTML-rajan monitorointi ja varoitus
- **EMAIL-02**: Litmus/Email on Acid -integraatio automaattiseen testaukseen

## Out of Scope

| Feature | Reason |
|---------|--------|
| Click tracking kuvissa | Opens + feedback riittävät toistaiseksi |
| Video-upotukset uutiskirjeessä | Sähköposti-yhteensopivuus liian heikko |
| Useita kuvia per uutinen | Yksi kuva per artikkeli riittää, pitää HTML-koon pienenä |
| A/B testaus sisältörakenteelle | Liian vähän dataa pienellä asiakaskunnalla |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONTENT-01 | — | Pending |
| CONTENT-02 | — | Pending |
| CONTENT-03 | — | Pending |
| CONTENT-04 | — | Pending |
| IMAGE-01 | — | Pending |
| IMAGE-02 | — | Pending |
| IMAGE-03 | — | Pending |
| IMAGE-04 | — | Pending |
| BRAND-01 | — | Pending |
| BRAND-02 | — | Pending |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10 ⚠️

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
