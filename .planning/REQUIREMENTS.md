# Requirements: AI-Sanomat Yrityksille

**Defined:** 2026-03-04
**Core Value:** The AI-generated weekly digest must be genuinely useful and industry-relevant — content quality is the entire selling point.

## v1.2 Requirements

Requirements for v1.2 Newsletter Quality & Design. Each maps to roadmap phases.

### Sisältörakenne (Content Structure)

- [x] **CONTENT-01**: Uutisartikkeli sisältää lead-lauseen joka tiivistää uutisen ydinviestin
- [x] **CONTENT-02**: Uutisartikkeli sisältää 2-4 bullet-pointtia avainpointeista
- [x] **CONTENT-03**: Uutisartikkeli käyttää alaotsikointia, boldausta ja korostuksia luettavuuden parantamiseksi
- [x] **CONTENT-04**: Vanhat digestit (ilman uutta rakennetta) renderöityvät edelleen oikein

### Kuvat (Images)

- [x] **IMAGE-01**: Uutisartikkelin kuva haetaan ensisijaisesti lähdeartikkelin OG-metatiedoista
- [x] **IMAGE-02**: OG-kuvahaku käyttää timeoutia (3-5s) eikä estä digestin generointia
- [x] **IMAGE-03**: Jos OG-kuvaa ei löydy, generoidaan AI-infograafi joka selittää uutisen sisältöä
- [x] **IMAGE-04**: Jos AI-infograafikaan ei onnistu, uutinen näytetään ilman kuvaa

### Brändäys (Branding)

- [x] **BRAND-01**: Uutiskirjeen header sisältää AI-Sanomat logo-ikonin ja "AI-Sanomat" tekstin
- [x] **BRAND-02**: Logo on hosted PNG-kuva (ei base64, ei SVG) sähköpostiyhteensopivuuden vuoksi

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
| BRAND-01 | Phase 10 | Complete |
| BRAND-02 | Phase 10 | Complete |
| IMAGE-01 | Phase 11 | Complete |
| IMAGE-02 | Phase 11 | Complete |
| CONTENT-01 | Phase 12 | Complete |
| CONTENT-02 | Phase 12 | Complete |
| CONTENT-03 | Phase 12 | Complete |
| CONTENT-04 | Phase 12 | Complete |
| IMAGE-03 | Phase 13 | Complete |
| IMAGE-04 | Phase 13 | Complete |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 — traceability mapped to phases 10-13*
