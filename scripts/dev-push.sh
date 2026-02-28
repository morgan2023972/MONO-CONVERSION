#!/usr/bin/env bash

set -e

echo "🌿 Branche actuelle : $(git branch --show-current)"

# Vérifie qu'on est sur main
if [ "$(git branch --show-current)" != "main" ]; then
  echo "❌ Tu dois être sur la branche 'main' pour utiliser ce script."
  exit 1
fi

# Vérifie s'il y a des changements
if [ -z "$(git status --porcelain)" ]; then
  echo "ℹ️ Aucun changement détecté."
  exit 0
fi

# Demande message
echo ""
read -p "📝 Message de commit : " commit_message

if [ -z "$commit_message" ]; then
  echo "❌ Message vide. Commit annulé."
  exit 1
fi

echo ""
echo "➕ Ajout des fichiers..."
git add -A

echo "📦 Commit..."
git commit -m "$commit_message"

echo "🚀 Push vers origin/main..."
git push origin main

echo ""
echo "✅ Push terminé sur main"
echo "➡️ Ouvre une PR main → master quand prêt pour la prod"#!/bin/bash
