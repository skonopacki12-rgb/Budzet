# Budżet domowy

PWA do planowania i kontroli wspólnego budżetu domowego — ręczne wydatki, limity
per kategoria, prognoza końca miesiąca, a docelowo skan paragonów z AI. Pełny
plan produktu i architektury: patrz opis w wątku, który zainicjował ten
projekt (sekcje 0–10).

Stack: Next.js (App Router) + Tailwind CSS + Supabase (Postgres, Auth, Storage,
Row Level Security).

## Stan projektu

Zaimplementowany fundament (Etap 0–3 z planu):

- Logowanie e-mailem (magic link) + przyciski Google/Apple (wymagają włączenia
  providerów w Supabase — patrz niżej).
- Wspólne gospodarstwo domowe: zakładanie, zapraszanie partnera po e-mailu,
  dołączanie do zaproszenia.
- Zamknięty słownik 15 kategorii i ~94 podkategorii (`supabase/seed.sql`),
  z możliwością dodawania własnych podkategorii per gospodarstwo.
- Ręczne dodawanie wydatku.
- Pulpit: wydano vs. limit miesięczny, top kategorie, ostatnie wydatki,
  liniowa prognoza końca miesiąca.
- Ustawianie limitu globalnego i per kategoria.
- Instalacja jako PWA (manifest, ikony, service worker z app-shellem
  offline, podpowiedź instalacji na iOS).
- Row Level Security w Postgresie: każde gospodarstwo widzi wyłącznie własne
  dane.

Jeszcze nie zaimplementowane (kolejne etapy planu): skan paragonów i
kategoryzacja AI, wydatki stałe/cykliczne, archiwum i wyszukiwanie paragonów,
śledzenie cen produktów, asystent AI w czacie, eksporty, powiadomienia push,
PIN. Plan mówi wprost, żeby przetestować prompt AI na 10–100 realnych
paragonach zanim zacznie się budować ekran skanowania (sekcja 4 i 10) — to
naturalny kolejny krok.

## Uruchomienie lokalnie

### 1. Załóż projekt Supabase

1. Wejdź na [supabase.com](https://supabase.com) i utwórz nowy projekt.
2. W **Project Settings → API** skopiuj `Project URL` i `anon public` key.
3. Skopiuj `.env.example` do `.env.local` i wklej te wartości:

   ```bash
   cp .env.example .env.local
   ```

### 2. Wgraj schemat i słownik kategorii

Najprościej przez **SQL Editor** w Supabase Studio — wklej po kolei zawartość
plików:

1. `supabase/migrations/0001_init.sql` (tabele)
2. `supabase/migrations/0002_rls.sql` (Row Level Security + bucket na
   paragony)
3. `supabase/seed.sql` (kategorie i podkategorie)

Albo, jeśli używasz [Supabase CLI](https://supabase.com/docs/guides/cli) i
masz zalinkowany projekt:

```bash
npx supabase link --project-ref <twoj-project-ref>
npx supabase db push
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2)" -f supabase/seed.sql
```

### 3. Włącz logowanie e-mailem

W **Authentication → URL Configuration** dodaj `http://localhost:3000/auth/callback`
do Redirect URLs (a docelowo też adres produkcyjny z Vercela). Magic link
działa od razu; logowanie Google/Apple wymaga dodatkowej konfiguracji w
**Authentication → Providers**.

### 4. Zainstaluj zależności i odpal aplikację

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

## Wdrożenie na Vercel

1. Zaimportuj repozytorium w [Vercel](https://vercel.com/new).
2. Ustaw zmienne środowiskowe `NEXT_PUBLIC_SUPABASE_URL` i
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (te same co w `.env.local`).
3. Po pierwszym deployu dodaj domenę produkcyjną (`https://twoja-domena/auth/callback`)
   do Redirect URLs w Supabase.

## Wdrożenie na Cloudflare (Workers)

Aplikacja jest też przygotowana pod [Cloudflare Workers](https://developers.cloudflare.com/workers/)
przez adapter [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`,
konfiguracja w `wrangler.jsonc` i `open-next.config.ts`).

**Ważne ograniczenie:** Next.js 16 domyślnie uruchamia `proxy.ts` (dawny
`middleware.ts`) w runtime Node.js i nie da się tego zmienić na Edge —
a obecna wersja adaptera OpenNext dla Cloudflare (1.20.x) jeszcze nie
obsługuje middleware/proxy w Node.js runtime. Dlatego w tym repo **nie ma
pliku `src/proxy.ts`** — ochrona tras (przekierowanie niezalogowanych na
`/login`, sprawdzenie gospodarstwa domowego) dzieje się w
`src/app/(app)/layout.tsx` oraz na stronie `/onboarding`, a nie globalnie
w middleware. Efekt end-user jest taki sam, ale odświeżanie sesji Supabase
(silent refresh tokenu) nie dzieje się już na każdym requeście — przy
długim braku aktywności może się zdarzyć wylogowanie wymagające ponownego
kliknięcia linku logowania. Jeśli w przyszłości OpenNext doda wsparcie dla
Node.js middleware (albo zdecydujesz się wdrażać na Vercel zamiast
Cloudflare), `proxy.ts` można odtworzyć z historii commitów.

### 1. Załóż konto i pobierz dane dostępowe

1. Załóż konto na [dash.cloudflare.com](https://dash.cloudflare.com) (jeśli
   jeszcze go nie masz).
2. Zaloguj CLI: `npx wrangler login` (otworzy przeglądarkę) **albo** — jeśli
   pracujesz w środowisku bez przeglądarki (np. to zdalne środowisko Claude
   Code) — utwórz [API Token](https://dash.cloudflare.com/profile/api-tokens)
   z uprawnieniem **Edit Cloudflare Workers** i ustaw go jako zmienną
   środowiskową:

   ```bash
   export CLOUDFLARE_API_TOKEN=twoj-token
   export CLOUDFLARE_ACCOUNT_ID=twoje-account-id   # z dashboardu, prawa kolumna
   ```

### 2. Ustaw prawdziwe dane Supabase przed buildem

`NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` są wklejane do
kodu **w momencie builda** (nie czytane w runtime Workera), więc muszą być
w `.env.local` z prawdziwymi wartościami produkcyjnego projektu Supabase
zanim zbudujesz Workera pod deploy — inaczej aplikacja na Cloudflare będzie
gadać z nieistniejącym projektem.

### 3. Build i podgląd lokalny

```bash
npm run cf:build     # next build + adaptacja OpenNext → .open-next/
npx wrangler dev      # lokalny podgląd Workera na http://localhost:8787
```

### 4. Deploy

```bash
npm run cf:deploy
```

Po pierwszym deployu Wrangler wypisze adres `*.workers.dev`. Dodaj go
(`https://twoj-worker.workers.dev/auth/callback`) do Redirect URLs w
Supabase (**Authentication → URL Configuration**), tak jak przy Vercelu.

### 5. Własna domena (opcjonalnie)

W **Cloudflare Dashboard → Workers & Pages → budzet → Settings → Domains &
Routes** dodaj własną domenę/subdomenę obsługiwaną przez to samo konto
Cloudflare.

## Instalacja jako aplikacja na telefonie

- **iPhone (Safari):** otwórz stronę → **Udostępnij** → **Dodaj do ekranu
  początkowego**. Aplikacja pokaże tę podpowiedź automatycznie, jeśli jeszcze
  nie jest zainstalowana.
- **Android (Chrome):** menu (⋮) → **Zainstaluj aplikację** (lub Chrome sam
  zaproponuje instalację).

## Struktura projektu

```
src/app/(app)/        ekrany po zalogowaniu (pulpit, dodaj, budżet, paragony, ustawienia)
src/app/login/        logowanie (magic link + OAuth)
src/app/onboarding/   zakładanie / dołączanie do gospodarstwa domowego
src/app/auth/callback zamiana kodu Supabase na sesję
src/lib/supabase/     klienci Supabase (przeglądarka / serwer)
src/lib/database.types.ts  typy tabel (ręcznie odzwierciedlają migracje SQL)
supabase/migrations/  schemat SQL + RLS
supabase/seed.sql     słownik kategorii i podkategorii
public/manifest.json, public/sw.js, public/icons/  PWA
wrangler.jsonc, open-next.config.ts  konfiguracja wdrożenia na Cloudflare Workers
```

Ochrona tras (przekierowanie niezalogowanych, sprawdzenie gospodarstwa
domowego) jest w `src/app/(app)/layout.tsx` i `src/app/onboarding/page.tsx`
zamiast w `src/proxy.ts` — patrz wyjaśnienie w sekcji „Wdrożenie na
Cloudflare” wyżej.

## Rozwój — sugerowane następne kroki

Zgodnie z planem (sekcja 10): przetestuj prompt kategoryzacji AI na 10
realnych paragonach (poza tym repo, np. w notebooku) zanim zaczniesz budować
ekran skanowania i tabele `receipts` / `receipt_items` (już przygotowane w
schemacie, ale nieużywane przez UI).
