# Phase 3 — Mapping Brevo V1 (backend-ready)

Date: 27/02/2026
Version: 1.0
Périmètre: tunnel Crone V1 (Landing → Product → Cart → Checkout)

## 1) Objectif

Définir un contrat d’ingestion unique pour l’endpoint relay, puis la transformation de chaque événement frontend vers:

1. événements Brevo,
2. attributs contact Brevo,
3. déclencheurs d’automatisation (workflow CRM).

## 2) Contrat d’entrée relay (depuis le thème)

Méthode: `POST`
Header: `Content-Type: application/json`

Spécification API formelle (Phase 4): `docs/relay-api-openapi-v1.yaml`

### 2.1 Payload minimal attendu

```json
{
  "event": "add_to_cart",
  "shop": "example.myshopify.com",
  "template": "product",
  "timestamp": "2026-02-27T10:15:10.123Z",
  "funnel_step": "product",
  "session_id": "optional-session-id",
  "visitor_id": "optional-visitor-id"
}
```

### 2.2 Champs standards (normalisation backend)

- `event` (string, requis)
- `shop` (string, requis)
- `template` (string, requis)
- `timestamp` (ISO-8601, requis)
- `funnel_step` (string, requis)
- `request_id` (string, ajouté côté backend)
- `ingested_at` (ISO-8601, ajouté côté backend)
- `consent_analytics` (bool, inféré côté backend si transmis)

## 3) Taxonomie d’événements V1

- `funnel_page_view`
- `landing_view`
- `view_item`
- `add_to_cart`
- `view_cart`
- `begin_checkout`

## 4) Mapping événement → Brevo

## 4.1 `funnel_page_view`

Source frontend:

- `page_title`
- `page_path`

Transformation Brevo:

- Event name Brevo: `funnel_page_view`
- Event data:
  - `shop`
  - `template`
  - `funnel_step`
  - `page_title`
  - `page_path`
  - `timestamp`

Attributs contact à upsert si contact identifiable:

- `LAST_FUNNEL_STEP = funnel_step`
- `LAST_PAGE_PATH = page_path`
- `LAST_ACTIVITY_AT = timestamp`

## 4.2 `landing_view`

Source frontend:

- `section_id`

Transformation Brevo:

- Event name Brevo: `landing_view`
- Event data:
  - `shop`
  - `funnel_step`
  - `section_id`
  - `timestamp`

Attributs contact:

- `FIRST_LANDING_AT` (set once)
- `LAST_FUNNEL_STEP`

## 4.3 `view_item`

Source frontend:

- `product_id`
- `product_title`
- `product_price`

Transformation Brevo:

- Event name Brevo: `view_item`
- Event data:
  - `shop`
  - `product_id`
  - `product_title`
  - `product_price`
  - `currency` (ajout backend, ex: `EUR`)
  - `timestamp`

Attributs contact:

- `LAST_VIEWED_PRODUCT_ID`
- `LAST_VIEWED_PRODUCT_TITLE`
- `LAST_VIEWED_PRODUCT_PRICE`
- `LAST_FUNNEL_STEP`

## 4.4 `add_to_cart`

Source frontend:

- `product_id`
- `product_title`

Transformation Brevo:

- Event name Brevo: `add_to_cart`
- Event data:
  - `shop`
  - `product_id`
  - `product_title`
  - `timestamp`

Attributs contact:

- `LAST_ADDED_PRODUCT_ID`
- `LAST_ADDED_PRODUCT_TITLE`
- `LAST_FUNNEL_STEP`
- `ADD_TO_CART_COUNT_30D` (compteur calculé backend)

## 4.5 `view_cart`

Source frontend:

- `cart_item_count`
- `cart_total`

Transformation Brevo:

- Event name Brevo: `view_cart`
- Event data:
  - `shop`
  - `cart_item_count`
  - `cart_total`
  - `currency`
  - `timestamp`

Attributs contact:

- `LAST_CART_ITEMS`
- `LAST_CART_TOTAL`
- `LAST_FUNNEL_STEP`

## 4.6 `begin_checkout`

Source frontend:

- `cart_item_count`
- `cart_total`

Transformation Brevo:

- Event name Brevo: `begin_checkout`
- Event data:
  - `shop`
  - `cart_item_count`
  - `cart_total`
  - `currency`
  - `timestamp`

Attributs contact:

- `LAST_CHECKOUT_STARTED_AT`
- `LAST_CART_TOTAL`
- `LAST_FUNNEL_STEP = checkout`

## 5) Identité contact (priorité)

Ordre de résolution recommandé côté backend:

1. email hashé/session enrichie (si disponible via collecte consentie)
2. customer_id Shopify (si connecté)
3. visitor_id first-party
4. session_id temporaire

Règle:

- Ne pas créer de contact Brevo non identifiable de manière stable.
- Bufferiser les événements anonymes et les rattacher après identification.

## 6) Idempotence & qualité de données

Clé d’idempotence recommandée:

`idempotency_key = sha256(shop + event + timestamp + session_id + product_id + cart_total)`

Règles:

- Rejet des doublons stricts sur 24h.
- Validation schéma avant push Brevo.
- Dead-letter queue pour payload invalide.

## 7) Matrice RGPD (strict)

Envoi Brevo autorisé uniquement si consentement analytics valide.

- Consentement refusé:
  - pas de push event Brevo,
  - log technique minimal sans identifiant personnel.
- Consentement accepté:
  - push events autorisé,
  - upsert attributs contact autorisé selon base légale.

## 8) Codes réponse endpoint relay

- `202 Accepted`: événement reçu et mis en file
- `400 Bad Request`: schéma invalide
- `401 Unauthorized`: signature/token invalide
- `409 Conflict`: doublon (idempotence)
- `500 Internal Server Error`: incident serveur

## 9) Exemple transformation backend

Entrée thème:

```json
{
  "event": "begin_checkout",
  "shop": "mono-conversion.myshopify.com",
  "template": "cart",
  "timestamp": "2026-02-27T14:12:00.000Z",
  "funnel_step": "cart",
  "cart_item_count": 2,
  "cart_total": 149.9
}
```

Sortie Brevo (event):

```json
{
  "event_name": "begin_checkout",
  "identifiers": {
    "email": "resolved-if-available"
  },
  "event_data": {
    "shop": "mono-conversion.myshopify.com",
    "funnel_step": "cart",
    "cart_item_count": 2,
    "cart_total": 149.9,
    "currency": "EUR",
    "timestamp": "2026-02-27T14:12:00.000Z"
  }
}
```

Upsert attributs contact:

```json
{
  "attributes": {
    "LAST_CHECKOUT_STARTED_AT": "2026-02-27T14:12:00.000Z",
    "LAST_CART_TOTAL": 149.9,
    "LAST_FUNNEL_STEP": "checkout"
  }
}
```

## 10) Automatisations Brevo recommandées (V1)

1. Workflow `Abandon panier`:
   - Trigger: `begin_checkout`
   - Condition: pas d’achat détecté sous X heures
   - Action: email de relance (J+0 / J+1)

2. Workflow `Intention forte produit`:
   - Trigger: `add_to_cart`
   - Condition: pas de `begin_checkout` sous 2h
   - Action: séquence objection handling

3. Workflow `Warm lead landing`:
   - Trigger: `landing_view`
   - Condition: consentement + opt-in
   - Action: nurturing orienté preuve sociale

## 11) Checklist mise en prod

- Endpoint relay HTTPS actif et monitoré
- Validation schéma + idempotence active
- Logs et DLQ actifs
- Consentement testé (accept/refuse)
- Workflows Brevo publiés
- Dashboard KPI funnel branché

## 12) KPI d’exploitation (minimum)

- `landing_view -> view_item` conversion
- `view_item -> add_to_cart` conversion
- `add_to_cart -> begin_checkout` conversion
- taux d’erreur relay
- latence médiane relay
