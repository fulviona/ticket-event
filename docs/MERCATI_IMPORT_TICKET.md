# Mercati import ticket — riferimento

Documento di confronto tra i **mercati riconosciuti dall’import** (testo OCR/HTML dello slip) e le **regole di refertazione** mostrate in app.  
Fonte codice: `backend/src/routes/tickets.js` — array `BET_TYPES`, oggetto `SETTLEMENT_RULES`, funzione `getSettlementInfo()`.

## Come funziona l’import

- Il testo della giocata viene analizzato in **ordine**: il **primo** pattern regex che matcha determina il tipo (`detectBetType`).
- Se nessun pattern corrisponde, il tipo è **`N/D`**.
- Le regex non coprono tutte le diciture commerciali dei book; servono esempi reali per estendere i pattern.

---

## Elenco tipi interni (unici)

| # | Tipo interno | Regola refertazione in app |
|---|----------------|----------------------------|
| 1 | **Cartellino** | Sì (anche varianti Plus/DUO in `getSettlementInfo`) |
| 2 | **Marcatore** | Sì (anche segna o palo/assist in `getSettlementInfo`) |
| 3 | **Palo/Traversa** | Sì |
| 4 | **Assist** | Sì |
| 5 | **Tiri** | Sì |
| 6 | **Under/Over 1T** | Sì (solo gol 1° tempo) |
| 7 | **Under/Over** | Sì (90′+recupero; U/O giocatore se contesto) |
| 8 | **Goal/No Goal** | Sì |
| 9 | **1X2** | Sì |
| 10 | **Doppia Chance** | Sì |
| 11 | **Draw No Bet** | Sì |
| 12 | **Handicap** | Sì |
| 13 | **Risultato Esatto** | Sì |
| 14 | **Parziale/Finale** | Sì |
| 15 | **Combo 1X2+U/O** | Sì |
| 16 | **Combo 1X2+GG/NG** | Sì |
| 17 | **Combo** | Sì (combo generiche / bet builder testuali) |
| 18 | **Somma Goal** | Sì |
| 19 | **Multigol** | Sì |
| 20 | **Pari/Dispari** | Sì |
| 21 | **Corner** | Sì |
| 22 | **Supplementari** | Sì |
| 23 | **Possesso** | Sì |
| 24 | **Falli** | Sì |
| 25 | **Rigore** | Sì |
| 26 | **Fuorigioco** | Sì |
| 27 | **Rimessa** | Sì |
| 28 | **Ribaltone** | Sì |
| 29 | **Autorete** | Sì |
| 30 | **Squadra Primo Gol** | Sì |
| 31 | **Porta inviolata** | Sì |
| 32 | **Testa a testa** | Sì |
| 33 | **Primo Tempo** | Sì (generico: dipende dal mercato sul book) |
| 34 | **Secondo Tempo** | Sì (idem) |
| 35 | **N/D** | Nessuna regola dedicata |

---

## Dettaglio per tipo — trigger testuali (indicativi)

Ordine di scansione = ordine in `BET_TYPES` (il primo match vince).

| Tipo | Esempi di parole / forme riconosciute (non esaustivo) |
|------|--------------------------------------------------------|
| **Cartellino** | `cartellino`, `ammonito/a`, `ammonizioni`, `espulso/a`, `espulsioni` |
| **Marcatore** | `segna`, `marcatore`, `marc.`, `goleador`, `primo gol`, `ultimo gol`, `anytime`, `doppietta`, `segna o colpisce` / `segna o fa assist`, `hat-trick`, `tripletta` |
| **Palo/Traversa** | `palo/traversa`, varianti con slash |
| **Assist** | `assist`, `fa assist` |
| **Tiri** | `tiri in porta/totali/fuori`, `shots on target` |
| **Under/Over 1T** | U/O con soglia e riferimento al **1° tempo** / `1T` |
| **Under/Over** | `under/over` + soglia, `u/o` + soglia (match / 90′ se non 1T) |
| **Goal/No Goal** | `goal/no goal`, `gol/no gol`, `GG`, `NG` |
| **1X2** | `esito finale`, `1 x 2` |
| **Doppia Chance** | `doppia chance`, `dc` + contesto (`1t`, `2t`, …) |
| **Draw No Bet** | `draw no bet`, `dnb` |
| **Handicap** | `handicap`, `hcap`, `h. 1/x/2`, `ah 1/2` |
| **Risultato Esatto** | `risultato esatto`, `ris. es` |
| **Parziale/Finale** | `parziale/finale`, `1T/2T`, `HT/FT`, `intervallo/finale`, `int/f` |
| **Combo 1X2+U/O** | es. `1+over`, `2-under` (pattern 1/2/X + over/under) |
| **Combo 1X2+GG/NG** | es. `1+goal`, `x-gol` |
| **Combo** | `DC+U/O`, `multigol`/`U/O` + `1X2`, pattern `1&3+`, `combo`/`combinata` + numero o bet |
| **Somma Goal** | `somma gol`, `totale gol` |
| **Multigol** | `multigol` |
| **Pari/Dispari** | `pari/dispari`, `P/D` con corner/cart/1t/2t |
| **Corner** | `corner`, `angoli`, `calci d’angolo` |
| **Supplementari** | `supplementari`, `overtime`, `extra time` |
| **Possesso** | `possesso` |
| **Falli** | `falli commessi/subiti`, `falli` + numero |
| **Rigore** | `rigore` |
| **Fuorigioco** | `fuorigioco` |
| **Rimessa** | `rimessa` |
| **Ribaltone** | `ribaltone` |
| **Autorete** | `autorete` |
| **Squadra Primo Gol** | `squadra 1° gol`, `squadra primo gol` |
| **Porta inviolata** | `porta inviolata`, `clean sheet`, `zero gol subiti`, … |
| **Testa a testa** | `testa a testa`, `head to head` |
| **Primo Tempo** | `esito 1T`, `1X2 1T`, `1X2 primo tempo`, `primo tempo` |
| **Secondo Tempo** | `secondo tempo` |

---

## Refertazione automatica (`backend/src/services/autoSettlement.js`)

Con `AUTO_SETTLEMENT` attivo e API-Football, oggi vengono valutati solo (sul **totale gol 90′** dalla fixture):

| Coperto | Note |
|---------|------|
| **1X2** | Selezione `1`, `X`, `2` (anche da testo tipo esito finale) |
| **Goal/No Goal** | `GG` / `NG` da tipo o testo |
| **Under/Over** | Linea estratta da testo (`U/O`, `OVER`, `UNDER`); default linea 2.5 se non trovata |

Tutti gli altri tipi della tabella sopra → **non** refertati in automatico (`skip`: tipo non gestito), ma restano classificati e con testo `SETTLEMENT_RULES` dove presente.

---

## Note operative

- **Conflitti**: pattern più specifici (es. U/O 1T, falli con numero) sono **prima** di quelli generici per ridurre errori.
- **Classificazione vs. chiusura automatica**: riconoscere il mercato sull’import è indipendente dall’auto-settlement; estendere quest’ultimo richiede logica dedicata per ogni famiglia di mercato.
- **Varianti book** (Plus, DUO, Ultra, sostituto, panchina): gestite in parte tramite `getSettlementInfo` sul testo della **predizione**, non solo sul tipo.

---

## Spazio per i tuoi suggerimenti

Compila la tabella con i mercati che vuoi aggiungere o migliorare e, se possibile, **un esatto estratto di testo** dallo slip (come appare dopo OCR).

| Priorità | Mercato desiderato | Esempio testo slip / note | Import? (sì/no) |
|----------|--------------------|----------------------------|-----------------|
| | | | |
| | | | |
| | | | |

Quando aggiorni questo file, indica al team quali righe sono nuove così si possono tradurre in nuovi elementi di `BET_TYPES` / regole.

---

*Ultimo allineamento al codice: generato da `tickets.js` (BET_TYPES + SETTLEMENT_RULES).*
