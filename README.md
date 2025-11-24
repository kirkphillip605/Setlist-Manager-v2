# Bad Habits - Setlist Management

A comprehensive setlist and band management application built with React, TypeScript, Vite, Supabase, and Shadcn/UI.

## Features

- **Song Management**: Store lyrics, keys, tempo, notes, and Spotify links.
- **Setlists**: Create drag-and-drop setlists for gigs.
- **Performance Mode**: Distraction-free view for live performance with quick song switching and dark mode.
- **Metronome**: Built-in visual and audio metronome.
- **Spotify Integration**: Auto-fill song details (Key, BPM, Cover Art) from Spotify.
- **Role-Based Access**: Admin and Member roles.
- **Responsive Design**: Works on mobile, tablet, and desktop.

## Prerequisites

- Node.js (v18+)
- Supabase Account
- Spotify Developer Account (for auto-fill features)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Fill in your environment variables in `.env`.

## Supabase Setup (Important)

### 1. Database Schema
The database schema and RLS policies are handled via SQL migrations provided in the Dyad context. Ensure you have the following tables:
- `profiles` (extends auth.users)
- `songs`
- `setlists`
- `sets`
- `set_songs`

### 2. Authentication Configuration

**Google Login:**
1. Go to **Supabase Dashboard** -> **Authentication** -> **Providers**.
2. Enable **Google**.
3. You need a Google Cloud Project. Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create a project.
   - Go to **APIs & Services** -> **OAuth consent screen**. Set it up (External).
   - Go to **Credentials** -> **Create Credentials** -> **OAuth client ID** (Web application).
   - **Authorized JavaScript origins**: `https://your-project.supabase.co`
   - **Authorized redirect URIs**: `https://your-project.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret** into the Supabase Google Provider settings.

**URL Configuration (CORS for Auth):**
1. Go to **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
2. **Site URL**: Set this to your production URL (e.g., `https://setlist.kirknet.io`).
3. **Redirect URIs**: Add any other URLs where the app might be hosted (e.g., `http://localhost:8080`, `https://your-preview-url.vercel.app`).
   - *This is critical for the "Sign in with Google" redirect to work properly.*

### 3. Edge Functions
This project uses Supabase Edge Functions for admin actions (inviting users, deleting users).

1. Deploy the functions:
   ```bash
   supabase functions deploy admin-actions
   ```
2. Set Environment Variables in Supabase Dashboard -> **Edge Functions** -> **admin-actions** -> **Manage Secrets**:
   - `ALLOWED_ORIGINS`: Comma-separated list of your app domains (e.g. `https://setlist.kirknet.io,http://localhost:8080`).

## Deployment

### Docker / Nginx
This app is designed to be served as a static site.
1. Build the app:
   ```bash
   npm run build
   ```
2. The output will be in the `dist` folder.
3. Serve the `dist` folder using Nginx, Apache, or any static file server.
4. Ensure your Nginx config handles SPA routing (redirect all 404s to `index.html`).

**Example Nginx Location Block:**
```nginx
location / {
    root /path/to/dist;
    try_files $uri $uri/ /index.html;
}
```

### Vite Preview
You can also run the app using Vite's preview server (Node.js):
```bash
npm run start
```
This will listen on the port defined in your `.env` file (default 8080).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | The port the Vite server listens on (default 8080) |
| `HOST` | The host address to bind to (default 0.0.0.0) |
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key |
| `VITE_SPOTIFY_CLIENT_ID` | Spotify App Client ID |
| `VITE_SPOTIFY_CLIENT_SECRET` | Spotify App Client Secret |

---

Made with ❤️ by Dyad