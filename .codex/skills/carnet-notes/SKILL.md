---
name: carnet-notes
description: Travailler sur l’application Carnet, une application Electron de suivi de classe, en respectant son architecture, le rafraîchissement local et le cycle commit/push du projet.
metadata:
  short-description: Développer l’application Carnet
---

# Carnet — règles de travail du projet

Ce skill s’applique à toute modification de ce projet. Le répertoire du projet est la racine qui contient `package.json`, `refresh.bat` et `src/`.

## Architecture

Le projet est une application Electron écrite en TypeScript, bundlée par Vite et gérée par Electron Forge.

- `src/main.ts` est le processus principal Electron. Il crée la fenêtre, configure le stockage et expose les handlers IPC.
- `src/preload.ts` est la frontière sécurisée entre Electron et l’interface. Il expose uniquement `window.storage` via `contextBridge`.
- `src/renderer.ts` est le point d’entrée du renderer et lance `startApp()` après avoir chargé `index.css`.
- `src/app-ui.ts` contient actuellement l’interface et la logique d’interaction : navigation Compétences/Élèves/Évaluation, rendu HTML, formulaires, grille AG Grid et autosauvegarde.
- `src/app-state.ts` définit `AppState`, les données initiales et les fonctions de chargement/sauvegarde. L’état regroupe `subjects`, `groups`, `competencies`, `students` et `competencyStatuses`.
- `src/domain/models.ts` contient les modèles métier et `src/domain/index.ts` les réexporte. Les identifiants sont des chaînes et les statuts d’évaluation sont représentés par `CompetencyStatus`.
- `src/storage-contract.ts` définit les canaux IPC et le contrat de `window.storage`.
- `src/sqlite-event-store.ts` persiste l’état dans SQLite sous forme de journal append-only : les suppressions sont des tombstones et `current_events` reconstruit l’état courant.
- `src/index.css` porte les styles de l’application, y compris ceux de la matrice d’évaluation et d’AG Grid.
- `main.ts` utilise un fichier SQLite dans le dossier `app.getPath('userData')`, nommé à partir du hostname. Ne pas ajouter de chemin de données utilisateur dans le dépôt.

Pour une nouvelle fonctionnalité, placer le code dans la couche la plus adaptée. Garder le renderer indépendant de Node/Electron : les accès système passent par `preload.ts` et le contrat IPC. Si le schéma de `AppState` évolue, mettre à jour ensemble les modèles, les validations de `main.ts`, le stockage et les données de repli.

## Boucle obligatoire après chaque modification

Après chaque modification de fichier, même petite :

1. Exécuter `refresh.bat` depuis la racine du projet.
2. Vérifier que l’application démarre correctement et que la modification est visible. Le script lance Electron Forge en mode développement avec HMR ; laisser sa fenêtre ouverte pendant les vérifications.
3. En cas d’échec, corriger l’erreur puis réexécuter `refresh.bat` avant de continuer.

`refresh.bat` est le point d’entrée de développement à utiliser. Il vérifie Node.js et les dépendances, puis lance le serveur Electron/Vite. `refresh.bat --check` peut servir à vérifier la disponibilité de l’environnement, mais ne remplace pas l’exécution normale de `refresh.bat` après une modification.

Pour les changements uniquement documentaires ou de configuration qui ne peuvent pas être rendus par l’application, exécuter tout de même `refresh.bat` si le script est disponible ; signaler seulement une impossibilité réelle de démarrer.

## Git : ne pas laisser la gestion au hasard

Gérer Git au fil de l’eau, sans attendre la fin d’une longue session :

- Après chaque idée cohérente, correction ou feature terminée et vérifiée, inspecter le diff puis créer un commit ciblé.
- Utiliser un message de commit court et explicite, par exemple `feat: add student notes` ou `fix: persist assessment status`.
- Pousser le commit régulièrement, idéalement immédiatement après chaque commit : `git push`.
- Avant de commencer, vérifier l’état du dépôt et éviter d’écraser les modifications existantes de l’utilisateur. Ne pas inclure dans un commit des changements sans rapport.
- Si Git, le remote ou l’authentification empêche le commit/push, continuer les vérifications locales si possible, puis signaler clairement le blocage et les commits qui restent à pousser. Ne jamais simuler un push réussi.
- Ne pas utiliser de commande destructive (`reset --hard`, checkout écrasant, suppression massive) sans demande explicite.

Le rythme attendu est donc : modifier → exécuter `refresh.bat` → vérifier → commit → push, puis reprendre la fonctionnalité suivante.

## Vérifications utiles

Après une modification TypeScript ou de comportement, lancer aussi les contrôles appropriés, notamment `npm run lint` lorsque l’environnement le permet. Tester particulièrement la sauvegarde/rechargement, les mutations d’état et les statuts de la matrice, car elles traversent renderer, preload, IPC et SQLite.
