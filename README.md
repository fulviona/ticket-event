# Ticket Event

Webapp per il tracciamento e la competizione sulle scommesse sportive.

## Funzionalita

1. **Registrazione utenti** - Email, telefono, verifica maggiore eta (18+)
2. **Consensi** - Newsletter, Cookie Policy, Privacy Policy
3. **Upload ticket** - Carica foto della scommessa, OCR automatico per estrarre partite, esiti e date
4. **Classifica** - 1 punto per ogni ticket vincente
5. **Admin Panel** - Gestione utenti, eventi sportivi e refertazione ticket

## Tech Stack

- **Frontend**: React 18, React Router, Axios
- **Backend**: Node.js, Express, MongoDB/Mongoose
- **OCR**: Tesseract.js
- **Auth**: JWT + bcrypt

## Setup

### Backend
```bash
cd backend
cp .env.example .env   # configura le variabili
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

### Variabili d'ambiente (backend/.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ticket-event
JWT_SECRET=your_secret
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Registrazione
- `POST /api/auth/login` - Login

### Users
- `GET /api/users/me` - Profilo utente
- `GET /api/users/leaderboard` - Classifica
- `GET /api/users/all` - Tutti gli utenti (admin)

### Tickets
- `POST /api/tickets/upload` - Upload foto ticket con OCR
- `GET /api/tickets/my` - I miei ticket
- `GET /api/tickets/all` - Tutti i ticket (admin)
- `PATCH /api/tickets/:id/status` - Aggiorna stato (admin)

### Events
- `GET /api/events` - Lista eventi
- `POST /api/events` - Crea evento (admin)
- `PUT /api/events/:id` - Aggiorna evento (admin)
- `DELETE /api/events/:id` - Elimina evento (admin)
- `POST /api/events/import` - Import batch (admin)
