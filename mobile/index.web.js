// Version web : expo-sqlite y exécute la base dans un « worker » et les appels synchrones attendent sa réponse
// par une boucle d'attente.
//
// 1. Sans `Atomics.pause` (Safari, donc iPhone, ne l'a pas), cette boucle tolère jusqu'à un milliard de tours ;
//    avec (Chrome récent) elle abandonne après un million, trop peu pour créer les tables : on l'écarte pour que
//    tous les navigateurs se comportent comme Safari.
// 2. Le worker doit avoir DÉJÀ démarré avant le premier appel synchrone (il ne démarre pas tant que la page est
//    bloquée) : on ouvre donc la base en asynchrone, puis seulement on charge l'application.
import { openDatabaseAsync } from 'expo-sqlite';

if (typeof Atomics !== 'undefined' && 'pause' in Atomics) {
  Atomics.pause = undefined;
}

openDatabaseAsync('assistant-personnel.db')
  .then((database) => database.closeAsync())
  .catch(() => {})
  .then(() => import('expo-router/entry'));
