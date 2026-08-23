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

## Architecture de la base de données

La persistance est locale à chaque machine, dans un fichier SQLite situé dans `app.getPath('userData')`. Le stockage n’est pas un ensemble de tables métier classiques : il s’agit d’un journal d’événements append-only, qui constitue la source d’autorité de toutes les données.

- La table `events` contient `sequence` (clé primaire auto-incrémentée), `stream_type`, `stream_key`, `event_type`, `payload` JSON, et `occurred_at`.
- `stream_type` vaut `subject`, `group`, `competency`, `student` ou `assessment`.
- `stream_key` identifie l’objet métier ; pour une cellule d’évaluation, la clé est le JSON `[studentId, competencyId]`.
- `event_type` vaut `upsert` pour créer/remplacer une valeur ou `tombstone` pour représenter une suppression. Un tombstone n’a pas de payload.
- L’index `events_by_stream` accélère la recherche du dernier événement par flux.
- La vue `current_events` ne conserve logiquement que le dernier événement de chaque couple `(stream_type, stream_key)` ; `current_assessments` filtre les événements du flux d’évaluation.
- À l’ouverture, `SqliteEventStore` reconstruit un `AppState` à partir de `current_events`. Lors d’une sauvegarde, `replaceSnapshot` compare l’ancien et le nouvel état, écrit uniquement les changements dans une transaction `BEGIN IMMEDIATE`/`COMMIT`, puis met à jour le snapshot mémoire.
- SQLite est configuré avec le journal WAL et les clés étrangères activées. Ne pas supprimer ou réécrire l’historique pour implémenter une suppression métier.
- Les synchronisations futures se feront par fusion temporelle des event logs, selon une logique `last writer wins`. Chaque modification qui doit survivre à une synchronisation doit donc être représentée dans l’event log avec les informations temporelles nécessaires ; une table ou un snapshot dérivé ne peut jamais devenir la source d’autorité.
- Des vues, index ou snapshots de lecture transitoires sont permis pour accélérer l’interface. Ils doivent être reconstruisibles à partir de l’event log et recalculés ou réconciliés pendant les synchronisations ; ne jamais dépendre d’une vue dérivée comme unique copie d’une donnée métier.

Une évolution de donnée doit donc préserver la reconstruction depuis les événements existants et la fusion temporelle future. Si un nouveau flux est ajouté, mettre à jour le type `StreamType`, les contraintes SQLite, `mapsFor`, `eventsBetween` et `rebuildSnapshot` ensemble. Si une projection est ajoutée, documenter son caractère transitoire et prévoir explicitement son recalcul depuis l’event log.

## Types de données principaux

Les types sont définis dans `src/domain/models.ts` et tous les identifiants métier sont des `string` :

- `Subject` : `id`, `name`. Une matière regroupe les compétences et les groupes.
- `CompetencyGroup` : `id`, `subjectId`, `name`, et éventuellement `parentGroupId` pour former une hiérarchie de groupes.
- `Competency` : `id`, `subjectId`, éventuellement `groupId`, `name` et `nationalEducationNumber`.
- `Student` : `id`, `firstName` et `manualNotes`, une liste de `ManualNote` avec `id`, `text`, `createdAt` et éventuellement `updatedAt`.
- `StudentCompetencyStatus` : couple `studentId`/`competencyId`, `status` et `updatedAt`. C’est le type actuellement utilisé par la matrice de suivi.
- `Assessment` : `id`, `subjectId`, `name`, `competencyIds` et éventuellement `scheduledAt`, pour une évaluation nommée portant sur une ou plusieurs compétences.
- `CompetencyEvaluation` : observation historique reliant `studentId`, `assessmentId` et `competencyId`, avec un `status` et `updatedAt`. Il est distinct du statut courant de la matrice.
- `CompetencyStatus` : `validated`, `failed`, `in_progress`, `not_taken` ou `absent`. Les libellés affichés en français sont centralisés dans `COMPETENCY_STATUS_LABELS`.
- `AppState` : agrégat sérialisable contenant `subjects`, `groups`, `competencies`, `students` et `competencyStatuses`.

Les dates sont des chaînes ISO-8601. Lorsqu’un type est ajouté à `AppState`, prendre en compte la validation `isAppState` dans `src/main.ts`, le contrat de stockage, la migration éventuelle des anciennes données et la reconstruction SQLite.

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
