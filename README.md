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

Etap 4–8 (dobudowane po uruchomieniu na Cloudflare):

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
- **Skan paragonów i kategoryzacja AI** (`/paragony/nowy`) — zdjęcie
  paragonu trafia do R2, [Claude](https://www.anthropic.com) (model
  `claude-haiku-4-5`, wołany przez zwykłe `fetch` do `api.anthropic.com` —
  nie przez binding Workers AI) czyta sklep, datę, sumę i wszystkie pozycje,
  dopasowując każdej pozycji kategorię i podkategorię z zamkniętego słownika,
  w jednym wywołaniu z wymuszonym schematem (`tool_choice`). Użytkownik
  przegląda wynik na `/paragony/[id]` — może odznaczyć błędnie rozpoznaną
  pozycję, poprawić kategorię/podkategorię/kwotę, zobaczyć sumę per
  kategoria — i dopiero potwierdzenie zapisuje pozycje jako osobne wydatki
  (każda ze swoją kategorią, nie jeden zbiorczy wydatek na cały paragon).

  **Historia decyzji o modelu** (zanim trafiono na Claude): plan (sekcja 4
  i 10) zalecał przetestować prompt na realnych paragonach przed budową
  ekranu skanowania. Najpierw wypróbowano darmowe modele wizyjne z
  Cloudflare Workers AI — `llama-3.2-11b-vision-instruct` odpadł (licencja
  Meta wyklucza użytkowników/firmy z UE, tak samo cała rodzina Llama 4),
  `llava-1.5-7b-hf` czytał realne paragony na poziomie halucynacji
  pojedynczej, zmyślonej linijki zamiast całego tekstu, a
  `uform-gen2-qwen-500m` okazał się wycofany z katalogu. Po wyczerpaniu
  darmowych opcji przełączono się na Claude, co od razu dało bezbłędny
  odczyt (kwoty co do grosza, trafne kategorie i podkategorie) na
  pierwszym realnym teście.

Etap 9 (dobudowane po pierwszych realnych testach z paragonami):

- **Poprawka Pulpitu** — sekcja „Ostatnie wydatki” pokazywała tylko wydatki
  z bieżącego miesiąca (tak jak suma miesięczna), więc świeżo potwierdzony
  paragon z datą sprzed zmiany miesiąca znikał z listy mimo poprawnego
  zapisu. Teraz „Ostatnie wydatki” pokazuje 8 najnowiej *dodanych* wydatków
  niezależnie od miesiąca ich daty; suma/limit miesięczny nadal liczą się
  tylko z bieżącego miesiąca.
- **Limity per kategoria z paskiem postępu** (`/budzet`) — limity per
  kategoria już istniały w bazie, dobudowano tylko kolorowy pasek postępu
  (jak na Pulpicie) i możliwość skasowania ustawionego limitu (wcześniej
  wyczyszczenie pola i zapisanie nic nie robiło).
- **Cele oszczędnościowe** (`/cele`) — cel z kwotą docelową i opcjonalnym
  terminem, ręczne wpłaty, pasek postępu, automatyczne oznaczenie jako
  osiągnięty.
- **Statystyki** (`/statystyki`) — bieżący miesiąc vs poprzedni, wykres
  słupkowy ostatnich 12 miesięcy, bieżący rok vs poprzedni, top kategorie w
  danym roku.
- **Wielu użytkowników w gospodarstwie** — to już działało od Etapu 0
  (zaproszenie e-mailem w Ustawieniach → „Zaproś partnera”, zaproszony
  loguje się tym samym adresem i dołącza do wspólnego budżetu); tylko
  zweryfikowano end-to-end, że współdzielenie transakcji faktycznie działa.
- **Powiadomienia push** (Ustawienia → „Włącz powiadomienia push”) —
  prawdziwy Web Push (RFC 8291/8292, VAPID), nie tylko alert w otwartej
  karcie. Cloudflare Cron Trigger odpala się co godzinę
  (`worker-entry.ts` → `src/lib/pushChecks.ts`), sprawdza płatności
  cykliczne zapadające w ciągu 3 dni i przekroczenie 80% budżetu
  miesięcznego, i wysyła co najwyżej jedno powiadomienie na
  zdarzenie/gospodarstwo (`push_notification_log` pilnuje deduplikacji).
  Szyfrowanie payloadu (`aes128gcm`) i podpis JWT VAPID (ES256) są
  zaimplementowane ręcznie przez Web Crypto w `src/lib/webPush.ts` — jedyna
  sprawdzona biblioteka do tego pod Cloudflare Workers
  (`@block65/webcrypto-web-push`) domyślnie koduje starym, wycofywanym
  schematem `aesgcm` zamiast obowiązującego `aes128gcm`, więc zamiast niej
  jest własna implementacja zweryfikowana lokalnym testem
  szyfruj-i-odszyfruj (round-trip) przed wdrożeniem. Dostarczenie
  prawdziwego powiadomienia na telefon wymaga jednak realnego urządzenia —
  to jedyna część, której nie dało się przetestować z tego środowiska, więc
  **przetestuj to sam po wdrożeniu** i zgłoś, jeśli coś nie zadziała.

Jeszcze nie zaimplementowane (kolejne etapy planu): śledzenie cen produktów,
asystent AI w czacie.

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
- **Skan paragonów wymaga klucza Anthropic.** `ANTHROPIC_API_KEY` to sekret
  Workera (`wrangler secret put`), nie binding w `wrangler.jsonc` — patrz
  „Wdrożenie” niżej. Bez niego `/paragony/nowy` zwróci błąd przy analizie,
  reszta aplikacji działa normalnie.
- **`main` w `wrangler.jsonc` wskazuje na `worker-entry.ts`, nie prosto na
  `.open-next/worker.js`.** To cienki wrapper (poza katalogiem `src/`, więc
  celowo wykluczony z typecheckingu `next build` w `tsconfig.json`/lintingu
  w `eslint.config.mjs` — importuje plik, który dopiero powstaje w kroku
  builda) dodający handler `scheduled` (Cron Trigger co godzinę, sekcja
  `triggers.crons`) obok normalnego handlera `fetch` z OpenNext, żeby
  powiadomienia push mogły się wysyłać bez otwartej karty przeglądarki. Moduły
  współdzielone między Next.js a tym handlerem (`src/lib/webPush.ts`,
  `src/lib/pushChecks.ts`) celowo nie mają dyrektywy `"server-only"` — poza
  bundlem Next.js (czyli tu) ten pakiet rzuca błędem zamiast działać jak
  zwykły moduł.

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

### 2b. (Opcjonalnie) klucz Anthropic do testowania skanu paragonów

Skan paragonów lokalnie wymaga klucza Claude. Załóż plik `.dev.vars`
(gitignored) w katalogu głównym:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Klucz weź z [console.anthropic.com](https://console.anthropic.com) →
Settings → API Keys. Bez tego pliku reszta aplikacji działa normalnie,
tylko `/paragony/nowy` zwróci błąd przy próbie analizy.

### 2c. (Opcjonalnie) klucze VAPID do testowania powiadomień push

Wygeneruj raz parę kluczy (nie trzeba dodawać `web-push` do zależności —
`npx` ściąga go tymczasowo tylko po to):

```bash
npx web-push generate-vapid-keys
```

Dopisz do tego samego `.dev.vars`:

```
VAPID_SUBJECT=mailto:twoj@email.pl
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

Bez tego reszta aplikacji działa normalnie, tylko przycisk „Włącz
powiadomienia push” w Ustawieniach się nie pojawi, a lokalny Cron Trigger
(`npx wrangler dev --test-scheduled`, potem `curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"`)
nic nie wyśle.

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

### 2b. Utwórz bucket R2 na zdjęcia paragonów

```bash
npx wrangler r2 bucket create budzet-receipts
```

Nazwa musi być dokładnie taka jak w `wrangler.jsonc` (`budzet-receipts`) —
w przeciwieństwie do `database_id` powyżej to nie jest placeholder do
podmiany, tylko stała nazwa do utworzenia.

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

### 4b. Ustaw klucz Anthropic na Workerze

Skan paragonów woła Claude, więc Worker potrzebuje klucza jako **sekretu**
(nie zmiennej w `wrangler.jsonc` — sekrety nie trafiają do repo):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Wklej klucz z [console.anthropic.com](https://console.anthropic.com) →
Settings → API Keys, kiedy zapyta. Trzeba to zrobić raz — sekret zostaje
zapisany po stronie Cloudflare między deployami.

### 4c. Ustaw klucze VAPID na Workerze (powiadomienia push)

```bash
npx web-push generate-vapid-keys
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT   # np. mailto:twoj@email.pl
```

Bez tego Ustawienia pokażą „Ta przeglądarka nie obsługuje powiadomień
push” (bo `VAPID_PUBLIC_KEY` będzie puste po stronie serwera), reszta
aplikacji działa normalnie. Cron Trigger (`triggers.crons` w
`wrangler.jsonc`, co godzinę) włącza się automatycznie po deployu — nie
trzeba nic dodatkowo aktywować w dashboardzie.

### Automatyczny deploy przez GitHub Actions

Repo zawiera `.github/workflows/deploy.yml` — na każdy push do `main` (albo
ręcznie z zakładki *Actions* → *Run workflow*) buduje projekt, wgrywa
migracje D1, robi `cf:deploy` i ustawia sekrety `ANTHROPIC_API_KEY` oraz
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` na Workerze.

Żeby to zadziałało:

1. Wykonaj kroki 1–2b powyżej ręcznie **raz** (baza D1 i bucket R2 muszą już
   istnieć, a `database_id` w `wrangler.jsonc` musi być prawdziwy, nie
   placeholder).
2. W ustawieniach repo: **Settings → Secrets and variables → Actions → New
   repository secret**, dodaj:
   - `CLOUDFLARE_API_TOKEN` — Custom Token (nie gotowy szablon) z
     uprawnieniami: **Account → D1 → Edit**, **Account → Workers Scripts →
     Edit**, **Account → Workers R2 Storage → Edit**.
   - `ANTHROPIC_API_KEY` — klucz z console.anthropic.com (patrz krok 4b
     wyżej — CI ustawia go na Workerze automatycznie z tego sekretu).
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — para z
     `npx web-push generate-vapid-keys` (krok 4c wyżej).
   - `VAPID_SUBJECT` — np. `mailto:twoj@email.pl` (kontakt wymagany przez
     protokół Web Push, nie musi być realną skrzynką odbiorczą).

Wszystkie sekrety trzymaj wyłącznie jako sekrety repo — nigdy w kodzie,
commitach ani w wiadomościach czy issue.

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
src/app/(app)/        ekrany po zalogowaniu (pulpit, dodaj, budżet, cele, statystyki, cykliczne, historia, paragony, ustawienia)
src/app/login/        logowanie i rejestracja (e-mail + hasło)
src/app/onboarding/   zakładanie / dołączanie do gospodarstwa domowego
src/db/schema.ts      schemat Drizzle (źródło prawdy dla struktury bazy)
src/lib/db.ts         dostęp do D1 (getCloudflareContext + drizzle)
src/lib/auth.ts       hashowanie haseł, sesje, ciasteczka
src/lib/household.ts  ustalanie aktywnego gospodarstwa + assertHouseholdMember
src/lib/pin.ts         blokada PIN-em (hash, cookie odblokowania)
src/lib/receiptAi.ts   wywołanie Claude (fetch + tool_choice) dla skanu paragonów
src/lib/webPush.ts     szyfrowanie Web Push (aes128gcm) + podpis JWT VAPID, samo przez Web Crypto
src/lib/pushChecks.ts  logika "co warto wypchnąć" (płatności cykliczne, próg budżetu) + deduplikacja
src/types/cloudflare-secrets.d.ts  typy sekretów (ANTHROPIC_API_KEY, VAPID_*) dopisane ręcznie, bo to sekrety, nie bindingi
src/lib/transactions.ts etykieta wydatku na listach (sklep vs. nazwa pozycji z paragonu)
worker-entry.ts        wrapper wokół .open-next/worker.js dodający handler `scheduled` (Cron Trigger)
migrations/           migracje SQL dla D1 (generowane przez drizzle-kit) + seed kategorii
public/manifest.json, public/sw.js, public/icons/  PWA (sw.js obsługuje też zdarzenia `push`/`notificationclick`)
wrangler.jsonc, open-next.config.ts, drizzle.config.ts  konfiguracja Cloudflare/D1
```

Ochrona tras (przekierowanie niezalogowanych, sprawdzenie gospodarstwa
domowego) jest w `src/app/(app)/layout.tsx` i `src/app/onboarding/page.tsx` —
patrz „Ważne ograniczenia tej architektury” wyżej.

## Rozwój — sugerowane następne kroki

Ze skanu paragonów zostały: śledzenie cen produktów (tabela `receipt_items`
ma już pola do tego), asystent AI w czacie. Po pierwszych realnych skanach
warto też ocenić jakość promptu w `src/lib/receiptAi.ts` — zdjęcia pod złym
kątem/światłem albo bardzo długie paragony to naturalne przypadki do
doprecyzowania.
