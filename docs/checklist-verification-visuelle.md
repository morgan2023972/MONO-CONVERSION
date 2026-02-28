# Checklist de vérification visuelle — Tunnel Crone (Shopify Dev)

Date: \_**\_ / \_\_** / **\_\_**
Environnement: Dev store preview
Testeur: ********\_\_********

## 1) Landing (Home funnel)

- [ ] Le chargement de la page est correct (pas d’erreur visible, pas de bloc vide)
- [ ] Le titre principal (headline) est lisible et cohérent avec l’offre
- [ ] Le sous-titre (subheadline) est présent et compréhensible
- [ ] Les 3 blocs de preuve s’affichent correctement
- [ ] Le bloc offre (titre + texte) est visible
- [ ] Le CTA principal est visible au-dessus de la ligne de flottaison (desktop)
- [ ] Le CTA principal fonctionne et redirige vers la bonne page produit
- [ ] Le rendu mobile est propre (espacements, retours ligne, CTA cliquable)

## 2) Page Produit (funnel product)

- [ ] Les images produit s’affichent correctement
- [ ] Le titre + prix sont visibles et sans décalage visuel
- [ ] La description produit / intro funnel est affichée comme prévu
- [ ] Le bloc réassurance est visible
- [ ] Le bloc objection handling est visible
- [ ] Le sélecteur de variante est utilisable
- [ ] Le champ quantité est utilisable
- [ ] Le bouton ajouter au panier est visible et compréhensible
- [ ] L’ajout au panier fonctionne sans erreur
- [ ] Le rendu mobile est propre (aucun overlap)

## 3) Panier (funnel cart)

- [ ] Les items du panier s’affichent correctement
- [ ] La mise à jour de quantité fonctionne
- [ ] Le lien de suppression fonctionne
- [ ] Le texte de réassurance panier est visible
- [ ] Le bouton checkout est visible et libellé correctement
- [ ] Le clic checkout redirige vers le checkout Shopify
- [ ] Le rendu mobile est propre

## 4) Header / Footer (mode tunnel)

- [ ] Le header est simplifié sur les pages tunnel (pas de distraction inutile)
- [ ] Le footer est simplifié sur les pages tunnel
- [ ] Le branding reste cohérent (logo/nom boutique)

## 5) SEO visuel de base (front)

- [ ] Le `<title>` est cohérent sur Landing
- [ ] Le `<title>` est cohérent sur Produit
- [ ] La meta description est présente sur Landing
- [ ] La meta description est présente sur Produit
- [ ] La page panier suit la règle robots attendue (noindex si activé)
- [ ] L’aperçu social (OG/Twitter) utilise image/titre/description attendus

## 6) Analytics visuel/console rapide

- [ ] Aucun message d’erreur JS bloquant dans la console
- [ ] Les interactions clés (landing view, add to cart, begin checkout) déclenchent les events attendus
- [ ] Avec consentement refusé, les événements marketing ne partent pas
- [ ] Avec consentement accepté, les événements sont bien relayés

## 7) Cross-device / responsive

- [ ] Desktop (>= 1280px) validé
- [ ] Tablet (~768px) validé
- [ ] Mobile (~390px) validé
- [ ] Aucun bug de superposition, overflow horizontal ou CTA inaccessible

## 8) Go/No-Go

- [ ] GO visuel Landing
- [ ] GO visuel Produit
- [ ] GO visuel Panier
- [ ] GO SEO front
- [ ] GO tracking de base

Décision finale:

- [ ] GO en test élargi
- [ ] NO-GO (corrections requises)

Notes / anomalies:

- ***
- ***
- ***
