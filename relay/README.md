# Relay Backend (Phase 12)

Backend Node.js minimal pour ingérer les events du thème Shopify et préparer le push Brevo.

## Table des matières

- [Couverture des phases](#couverture-des-phases)
- [Lancer en local](#lancer-en-local)
- [Comportement V1](#comportement-v1)
- [Variables d’environnement (Phases 5 à 12)](#variables-denvironnement-phases-5-à-12)
- [Procédure Phase 5 — Bootstrap API Relay](#procédure-phase-5--bootstrap-api-relay)
- [Procédure Phase 6 — Push Brevo live + tests d’intégration](#procédure-phase-6--push-brevo-live--tests-dintégration)
- [Procédure Phase 7 — Idempotence Redis + DLQ minimale](#procédure-phase-7--idempotence-redis--dlq-minimale)
- [Procédure Phase 8 — Replay DLQ](#procédure-phase-8--replay-dlq)
- [Procédure Phase 9 — Planification](#procédure-phase-9--planification)
- [Rapport d’exploitation quotidien](#rapport-dexploitation-quotidien)
- [Procédure Phase 10 — KPI journalier](#procédure-phase-10--kpi-journalier)
- [Procédure Phase 11 — KPI hebdomadaire et CSV](#procédure-phase-11--kpi-hebdomadaire-et-csv)
- [Procédure Phase 12 — Executive Summary (Markdown)](#procédure-phase-12--executive-summary-markdown)
- [SEO setup](#seo-setup)
- [Mini dashboard ops (lecture rapide)](#mini-dashboard-ops-lecture-rapide)
- [Stratégie de retry](#stratégie-de-retry)
- [Limitation actuelle](#limitation-actuelle)

## Couverture des phases

Ce README couvre les phases backend Relay **5 à 12**.

- Phases 1 à 4: cadrage tunnel, architecture thème et mapping CRM (docs racine du projet).
- Phases 5 à 12: implémentation et exploitation du backend relay (ce document).

## Lancer en local

1. Copier `.env.example` en `.env`
2. Installer les dépendances:
   - `npm install`
3. Démarrer:
   - `npm run dev`
4. Lancer les tests:
   - `npm test`
5. Générer le KPI journalier:
   - `npm run report:daily`
6. Générer le KPI hebdomadaire:
   - `npm run report:weekly`
7. Exporter le KPI en CSV:
   - `npm run report:csv`
8. Générer la synthèse exécutive Markdown:
   - `npm run report:summary`

API: `POST /v1/events`
Header requis: `Authorization: Bearer <RELAY_API_TOKEN>`

## Comportement V1

- Validation payload avec AJV (aligné OpenAPI V1)
- Idempotence persistante optionnelle via Redis (`USE_REDIS_IDEMPOTENCY=true`)
- Fallback idempotence mémoire si Redis désactivé
- Réponse `202 Accepted` si event accepté
- Push Brevo réel si `BREVO_ENABLED=true` et `BREVO_API_KEY` présent
- Endpoint Brevo configurable via `BREVO_EVENTS_URL`
- DLQ minimale fichier si push Brevo échoue (`DLQ_ENABLED=true`)
- Replay DLQ via CLI avec backoff exponentiel (`npm run replay:dlq`)

## Variables d’environnement (Phases 5 à 12)

- `USE_REDIS_IDEMPOTENCY`: active le store Redis
- `REDIS_URL`: URL de connexion Redis
- `DLQ_ENABLED`: active l’écriture DLQ
- `DLQ_FILE_PATH`: chemin du fichier DLQ
- `DLQ_REPLAY_MAX_ATTEMPTS`: nombre d’essais par entrée lors d’un replay
- `DLQ_REPLAY_BASE_DELAY_MS`: délai de base du backoff exponentiel
- `DLQ_REPORT_ENABLED`: active le rapport d’exploitation replay
- `DLQ_REPORT_FILE_PATH`: chemin du journal de rapport replay
- `DLQ_DAILY_REPORT_FILE_PATH`: chemin du journal KPI journalier
- `DLQ_DAILY_REPORT_TIMEZONE`: timezone d’agrégation (ex: `UTC`, `Europe/Paris`)
- `DLQ_WEEKLY_REPORT_FILE_PATH`: chemin du journal KPI hebdomadaire
- `DLQ_CSV_EXPORT_FILE_PATH`: chemin du fichier CSV exporté
- `DLQ_EXEC_SUMMARY_FILE_PATH`: chemin du rapport executive summary (Markdown)
- `DLQ_TARGET_REPLAY_RATE`: cible replay rate (ex: `0.95`)
- `DLQ_TARGET_FAILURE_RATE`: cible failure rate (ex: `0.03`)

## Procédure Phase 5 — Bootstrap API Relay

Objectif:

- mettre en place l’API `POST /v1/events` avec validation payload,
- sécuriser par Bearer token,
- ajouter une idempotence de base,
- préparer la transformation des events vers Brevo.

Commandes de base:

- `npm install`
- `npm run dev`
- test de santé: `GET /health`

Comportement attendu:

- `401` si token manquant/invalide,
- `400` si payload invalide,
- `202` si event accepté,
- `409` si doublon idempotence.

## Procédure Phase 6 — Push Brevo live + tests d’intégration

Objectif:

- activer l’envoi réel vers Brevo,
- stabiliser le contrat API avec tests automatiques.

Pré-requis:

- `BREVO_ENABLED=true`
- `BREVO_API_KEY` renseigné
- `BREVO_EVENTS_URL` valide

Validation recommandée:

- `npm test`
- vérifier que les tests `brevoClient` et `app` passent.

## Procédure Phase 7 — Idempotence Redis + DLQ minimale

Objectif:

- rendre l’idempotence persistante via Redis,
- stocker en DLQ les envois Brevo échoués.

Activation Redis:

- `USE_REDIS_IDEMPOTENCY=true`
- `REDIS_URL=redis://...`

Activation DLQ:

- `DLQ_ENABLED=true`
- `DLQ_FILE_PATH=./dlq-events.log`

Résultat attendu:

- la duplication est gérée cross-run via Redis,
- les erreurs d’envoi Brevo sont conservées en DLQ pour replay ultérieur.

## Procédure Phase 8 — Replay DLQ

1. Vérifier que Brevo est joignable et que `BREVO_ENABLED=true`.
2. Vérifier `BREVO_API_KEY` et `BREVO_EVENTS_URL`.
3. Lancer le replay:
   - `npm run replay:dlq`
4. Lire le résumé en sortie (`dlq_replay_summary`).
5. Contrôler le fichier DLQ:
   - les entrées réussies sont supprimées,
   - les entrées encore en échec restent avec `replay_meta`.
6. Contrôler le rapport replay:
   - fichier `DLQ_REPORT_FILE_PATH`
   - une ligne JSON par exécution (`dlq_replay_summary`)

## Procédure Phase 9 — Planification

### Windows Task Scheduler

Créer une tâche planifiée quotidienne (ex: toutes les 15 minutes):

- Programme/script: `powershell.exe`
- Arguments:
  - `-NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'C:\\Users\\yannm\\MONO-CONVERSION\\relay'; npm run replay:dlq"`

### Cron (Linux)

Exemple toutes les 15 minutes:

- `*/15 * * * * cd /path/to/MONO-CONVERSION/relay && npm run replay:dlq >> replay-cron.log 2>&1`

## Rapport d’exploitation quotidien

Le fichier `DLQ_REPORT_FILE_PATH` contient une entrée JSON par run avec:

- `total`, `replayed`, `failed`, `malformed`, `remaining`
- `started_at`, `finished_at`, `duration_ms`

Lecture rapide (PowerShell):

- `Get-Content .\dlq-replay-report.log | Select-Object -Last 20`

Lecture agrégée (exemple Node):

- parser les lignes JSON pour produire taux de replay journalier et volume d’échec résiduel.

## Procédure Phase 10 — KPI journalier

Commande:

- `npm run report:daily`

Comportement:

- lit `DLQ_REPORT_FILE_PATH` (source replay),
- agrège les runs de la journée selon `DLQ_DAILY_REPORT_TIMEZONE`,
- écrit une ligne NDJSON dans `DLQ_DAILY_REPORT_FILE_PATH`.

Date spécifique (backfill):

- PowerShell:
  - `$env:DLQ_DAILY_REPORT_DATE="2026-02-27"; npm run report:daily`

KPI calculés:

- `runs`, `total`, `replayed`, `failed`, `malformed`, `remaining_last`
- `avg_duration_ms`, `replay_rate`, `failure_rate`

## Procédure Phase 11 — KPI hebdomadaire et CSV

### KPI hebdomadaire

Commande:

- `npm run report:weekly`

Comportement:

- lit `DLQ_DAILY_REPORT_FILE_PATH`,
- agrège une fenêtre glissante de 7 jours,
- écrit une ligne NDJSON dans `DLQ_WEEKLY_REPORT_FILE_PATH`.

Métriques hebdo:

- `window_days`, `days_with_data`
- `total`, `replayed`, `failed`, `malformed`
- `avg_replay_rate`, `avg_failure_rate`, `avg_duration_ms`
- `remaining_last`

### Export CSV

Commande:

- `npm run report:csv`

Comportement:

- lit `DLQ_DAILY_REPORT_FILE_PATH`,
- exporte les lignes KPI journalières en CSV dans `DLQ_CSV_EXPORT_FILE_PATH`.

Colonnes CSV:

- `date`, `timezone`, `runs`, `total`, `replayed`, `failed`, `malformed`
- `remaining_last`, `avg_duration_ms`, `replay_rate`, `failure_rate`, `generated_at`

## Procédure Phase 12 — Executive Summary (Markdown)

Commande:

- `npm run report:summary`

Comportement:

- lit `DLQ_DAILY_REPORT_FILE_PATH`,
- calcule la synthèse hebdomadaire,
- compare aux cibles `DLQ_TARGET_REPLAY_RATE` et `DLQ_TARGET_FAILURE_RATE`,
- génère un rapport Markdown dans `DLQ_EXEC_SUMMARY_FILE_PATH`.

Contenu du rapport:

- scorecard (replay rate, failure rate, remaining),
- volumes agrégés,
- cibles,
- recommandations automatiques.

## SEO setup

Cette section récapitule la configuration SEO du tunnel côté thème Shopify (hors backend relay).

### Réglages à renseigner dans l’éditeur de thème

Dans `SEO Funnel`:

- `seo_funnel_home_title`
- `seo_funnel_home_description`
- `seo_funnel_product_title_suffix`
- `seo_funnel_product_description`
- `seo_noindex_cart` (recommandé: `true`)
- `seo_funnel_og_image`

### Comportement SEO implémenté

- Home funnel: titre + description personnalisables.
- Product: suffixe de titre + fallback de description.
- Cart: `meta robots` noindex piloté par setting.
- Social: OG/Twitter avec fallback image funnel.
- Canonical: conservé via `canonical_url`.

### Vérification rapide avant mise en prod

1. Ouvrir la home, une fiche produit et le panier.
2. Vérifier `<title>` et `<meta name="description">` sur chaque page.
3. Vérifier `<meta name="robots">` sur le panier (`noindex,nofollow` si activé).
4. Vérifier `og:title`, `og:description`, `og:image`, `twitter:image`.
5. Vérifier l’URL canonical de chaque page.

## Mini dashboard ops (lecture rapide)

Derniers KPI journaliers:

- `Get-Content .\dlq-daily-report.log | Select-Object -Last 7`

Objectifs recommandés:

- `replay_rate >= 0.95`
- `failure_rate <= 0.03`
- `remaining_last` en baisse sur 7 jours

## Stratégie de retry

- Backoff exponentiel: `baseDelay * 2^(attempt-1)`
- Les erreurs persistantes restent en DLQ pour un prochain passage.
- Les entrées malformées sont conservées (pas de perte silencieuse).

## Limitation actuelle

La DLQ est un fichier local append-only. Pour production, privilégier une queue dédiée (SQS/RabbitMQ/Kafka) et rotation des logs.
