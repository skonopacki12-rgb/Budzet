# Budżet domowy

PWA do planowania i kontroli wspólnego budżetu domowego — ręczne wydatki, limity
per kategoria, prognoza końca miesiąca, a docelowo skan paragonów z AI. Pełny
plan produktu i architektury: patrz opis w wątku, który zainicjował ten
projekt (sekcje 0–10).

Stack: Next.js (App Router) + Tailwind CSS, wdrażane na **Cloudflare Workers**
przez adapter [OpenNext](https://opennext.js.org/cloudflare). Baza danych to
**Cloudflare D1** (SQLite) przez [Drizzle ORM](https://orm.drizzle.team/),
logowanie to własna implementacja e-mail + hasło (sesje w D1, ciasteczko
httpOnly) — całość mieści się w jednym koncie Cloudflare, bez Supabase czy
innych usług trzecich.

## Stan projektu

Zaimplementowany fundament (Etap 0–3 z planu):

- Logowanie e-mailem i hasłem (własna implementacja — hash PBKDF2 przez Web
  Crypto, sesje w D1, ciasteczko httpOnly).
- Wspólne gospodarstwo domowe: zakładanie, zapraszanie partnera po e-mailu,
  dołączanie do zaproszenia.
- Zamknięty słownik 15 kategorii i ~94 podkategorii (`migrations/0001_seed_categories.sql`),
  z możliwością dodawania własnych podkategorii per gospodarstwo.
- Ręczne dodawanie wydatku.
- Pulpit: wydano vs. limit miesięczny, top kategorie, ostatnie wydatki,
  liniowa prognoza końca miesiąca.
- Ustawianie limitu globalnego i per kategoria.
- Instalacja jako PWA (manifest, ikony, service worker z app-shellem
  offline, podpowiedź instalacji na iOS).

Etap 4–7 (dobudowane po uruchomieniu na Cloudflare):

- **Wydatki cykliczne** (`/cykliczne`) — cykl miesięczny/kwartalny/roczny/co
  X dni, przycisk „Zapłacone” tworzy transakcję i sam przesuwa datę następnej
  płatności (i wygasza pozycję po `contract_end_date`), wstrzymywanie/wznawianie,
  usuwanie. Pulpit pokazuje nadchodzące/zaległe płatności.
- **Historia i wyszukiwanie wydatków** (`/historia`) — filtrowanie po
  sklepie/notatce, kategorii i zakresie dat, plus usuwanie błędnie dodanego
  wydatku (czego wcześniej nigdzie w aplikacji nie dało się zrobić). To
  zastępuje etap „archiwum i wyszukiwanie paragonów” z planu — sam skan
  paragonów jeszcze nie istnieje, więc dotyczy wszystkich wydatków, nie tylko
  zeskanowanych paragonów.
- **Eksport CSV** (`/historia/eksport`) — pobiera aktualnie przefiltrowaną
  (lub pełną) historię wydatków jako plik CSV.
- **Blokada PIN-em** — opcjonalny 4–6-cyfrowy PIN ustawiany w Ustawieniach;
  gdy ustawiony, aplikacja wymaga go ponownie za każdym razem, gdy przeglądarka
  zostanie otwarta od nowa (nie przy każdym przejściu między ekranami w tej
  samej sesji).

Jeszcze nie zaimplementowane (kolejne etapy planu): skan paragonów i
kategoryzacja AI, śledzenie cen produktów, asystent AI w czacie, powiadomienia
push. Plan mówi wprost, żeby przetestować prompt AI na 10–100 realnych
paragonach zanim zacznie się budować ekran skanowania (sekcja 4 i 10) — to
naturalny kolejny krok. Tabele `receipts` / `receipt_items` już istnieją w
schemacie, ale nie są jeszcze używane przez UI.

### Ważne ograniczenia tej architektury

- **Aplikacja działa tylko na Cloudflare** — D1 to baza dostępna wyłącznie
  jako binding Workera, więc (inaczej niż wcześniejsza wersja z Supabase) nie
  da się tego wdrożyć na Vercelu bez wymiany warstwy danych z powrotem na coś
  hostowanego niezależnie (Postgres/Supabase/PlanetScale itp.).
- **Brak `src/proxy.ts`.** Next.js 16 uruchamia `proxy.ts` (dawny
  `middleware.ts`) tylko w runtime Node.js i nie da się tego zmienić na Edge,
  a obecna wersja adaptera OpenNext dla Cloudflare (1.20.x) jeszcze nie
  obsługuje middleware/proxy w Node.js runtime. Ochrona tras (przekierowanie
  niezalogowanych na `/login`, sprawdzenie gospodarstwa domowego) dzieje się
  więc w `src/app/(app)/layout.tsx` i na stronie `/onboarding`, nie globalnie
  w middleware — efekt końcowy jest ten sam.
- **Brak Row Level Security.** D1/SQLite nie ma odpowiednika Postgresowego
  RLS, więc każde zapytanie samo filtruje po `household_id` wynikającym z
  sesji, a mutacje na cudzych zasobach (np. zaproszenie do gospodarstwa)
  sprawdzają przynależność ręcznie — patrz `assertHouseholdMember` w
  `src/lib/household.ts`. Przy dodawaniu nowych funkcji pamiętaj, żeby
  każde nowe zapytanie/mutację też jawnie ograniczać do gospodarstwa
  zalogowanego użytkownika.

## Uruchomienie lokalnie

### 1. Zainstaluj zależności

```bash
npm install
```

### 2. Załóż lokalną bazę D1 i wgraj migracje

Do developmentu **nie potrzebujesz konta Cloudflare** — `--local` używa
pliku SQLite trzymanego przez Wrangler w `.wrangler/state` (gitignored):

```bash
npm run db:migrate:local
```

To wgrywa schemat (`migrations/0000_*.sql`) i słownik kategorii
(`migrations/0001_seed_categories.sql`).

### 3. Odpal aplikację

```bash
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000) — `next.config.ts`
woła `initOpenNextCloudflareForDev()`, więc `next dev` ma dostęp do lokalnego
bindingu D1 tak samo jak `wrangler dev`.

Możesz też odpalić pełny podgląd przez sam Workerd (bliższy produkcji):

```bash
npm run cf:build && npx wrangler dev
```

## Wdrożenie na Cloudflare Workers

### 1. Zaloguj Wrangler

```bash
npx wrangler login
```

(otwiera przeglądarkę; w środowisku bez przeglądarki ustaw zamiast tego
zmienną `CLOUDFLARE_API_TOKEN` z tokenem o uprawnieniu **Edit Cloudflare
Workers**, utworzonym na [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)).

### 2. Utwórz produkcyjną bazę D1

```bash
npx wrangler d1 create budzet
```

Komenda wypisze `database_id` — wklej go w `wrangler.jsonc` w miejsce
`REPLACE_WITH_D1_DATABASE_ID`.

### 3. Wgraj migracje na produkcyjną bazę

```bash
npm run db:migrate:remote
```

### 4. Build i deploy

```bash
npm run cf:deploy
```

(to `opennextjs-cloudflare build && opennextjs-cloudflare deploy` — w
odróżnieniu od wcześniejszej wersji z Supabase, **nie trzeba** tu żadnych
zmiennych środowiskowych w `.env.local`: logowanie i baza danych są
bindingami Workera, nie publicznymi kluczami wklejanymi w build).

Po pierwszym deployu Wrangler wypisze adres `https://budzet.<twoj-subdomena>.workers.dev`.

### Automatyczny deploy przez GitHub Actions

Repo zawiera `.github/workflows/deploy.yml` — na każdy push do `main` (albo
ręcznie z zakładki *Actions* → *Run workflow*) buduje projekt, wgrywa
migracje D1 i robi `cf:deploy`.

Żeby to zadziałało:

1. Wykonaj kroki 1–2 powyżej ręcznie **raz** (baza D1 musi już istnieć,
   a `database_id` w `wrangler.jsonc` musi być prawdziwy, nie placeholder).
2. W ustawieniach repo: **Settings → Secrets and variables → Actions → New
   repository secret**, dodaj `CLOUDFLARE_API_TOKEN` z tokenem o uprawnieniu
   **Edit Cloudflare Workers** (ten sam co w kroku 1).

Token trzymaj wyłącznie jako sekret repo — nigdy w kodzie, commitach ani
w wiadomościach czy issue.

### 5. Własna domena (opcjonalnie)

W **Cloudflare Dashboard → Workers & Pages → budzet → Settings → Domains &
Routes** dodaj własną domenę/subdomenę obsługiwaną przez to samo konto
Cloudflare.

### Zmiana schematu bazy

Po edycji `src/db/schema.ts`:

```bash
npm run db:generate        # generuje nowy plik SQL w migrations/
npm run db:migrate:local   # stosuje go lokalnie
npm run db:migrate:remote  # stosuje go na produkcyjnej bazie D1
```

## Instalacja jako aplikacja na telefonie

- **iPhone (Safari):** otwórz stronę → **Udostępnij** → **Dodaj do ekranu
  początkowego**. Aplikacja pokaże tę podpowiedź automatycznie, jeśli jeszcze
  nie jest zainstalowana.
- **Android (Chrome):** menu (⋮) → **Zainstaluj aplikację** (lub Chrome sam
  zaproponuje instalację).

## Struktura projektu

```
src/app/(app)/        ekrany po zalogowaniu (pulpit, dodaj, budżet, cykliczne, historia, paragony, ustawienia)
src/app/login/        logowanie i rejestracja (e-mail + hasło)
src/app/onboarding/   zakładanie / dołączanie do gospodarstwa domowego
src/db/schema.ts      schemat Drizzle (źródło prawdy dla struktury bazy)
src/lib/db.ts         dostęp do D1 (getCloudflareContext + drizzle)
src/lib/auth.ts       hashowanie haseł, sesje, ciasteczka
src/lib/household.ts  ustalanie aktywnego gospodarstwa + assertHouseholdMember
migrations/           migracje SQL dla D1 (generowane przez drizzle-kit) + seed kategorii
public/manifest.json, public/sw.js, public/icons/  PWA
wrangler.jsonc, open-next.config.ts, drizzle.config.ts  konfiguracja Cloudflare/D1
```

Ochrona tras (przekierowanie niezalogowanych, sprawdzenie gospodarstwa
domowego) jest w `src/app/(app)/layout.tsx` i `src/app/onboarding/page.tsx` —
patrz „Ważne ograniczenia tej architektury” wyżej.

## Rozwój — sugerowane następne kroki

Zgodnie z planem (sekcja 10): przetestuj prompt kategoryzacji AI na 10
realnych paragonach (poza tym repo, np. w notebooku) zanim zaczniesz budować
ekran skanowania. Zdjęcia paragonów najlepiej trzymać w
[Cloudflare R2](https://developers.cloudflare.com/r2/) (dodaj binding w
`wrangler.jsonc`, analogicznie do `DB`).
