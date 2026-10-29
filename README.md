# Cache ton facho

Une extension de navigateur qui cache sur [Threads](https://www.threads.com) (version web) les posts des comptes et des mots-clés de ton choix, derrière un carré de la couleur que tu veux.

Version 0.2.2 · Chrome / Chromium et Firefox · licence GPL-3.0 · Threads sur ordinateur (pas l'application mobile) · rien n'est bloqué ni signalé, tout se passe sur ton ordinateur.

Pour bloquer, mettre en sourdine ou signaler, voir l'extension sœur [Bloque ton facho](https://github.com/fanchlegal/bloque-ton-facho).

## Installation

| Navigateur | Où l'obtenir | Guide |
|---|---|---|
| Chrome, Edge, Brave, Opera, Arc… | [Chrome Web Store](https://chromewebstore.google.com/detail/cache-ton-facho/kbdkjponofekblddnadghnbnmleoaokc) | [Installer sur Chrome](dist/chrome/README.md) |
| Firefox 142+ | [`dist/firefox/cache-ton-facho-firefox.xpi`](dist/firefox/cache-ton-facho-firefox.xpi) | [Installer sur Firefox](dist/firefox/README.md) |

Sur Chrome, l'extension s'installe depuis le Chrome Web Store et se met à jour toute seule. Elle n'est pas (encore) sur addons.mozilla.org : sur Firefox, elle s'installe à la main, en quelques clics.

## Ce que ça fait

- Les posts des comptes de ta liste, ou qui contiennent un de tes mots-clés, sont recouverts d'un carré de couleur. Leurs réponses dans les discussions des autres sont cachées aussi.
- **Clic sur le carré** : affiche le post quand même (si l'option est activée). Le bouton 🙈 à côté de l'heure le cache à nouveau.
- **Bouton 🙈** à côté du nom de chaque personne : un clic et tous ses posts sont cachés.
- **Bouton 👁** : il apparaît sur les posts d'un compte caché, une fois affiché. Un clic pour ne plus le cacher.

Rien n'est bloqué ni signalé : les posts sont seulement cachés chez toi. Personne n'est prévenu.

## Réglages

Clique sur l'icône de l'extension (l'œil barré) :

| Réglage | Rôle |
|---|---|
| **Comptes** | Un pseudo par ligne, avec ou sans @, ou l'adresse d'un profil Threads. |
| **Importer / Exporter** | Partager ta liste de comptes avec d'autres personnes, ou récupérer la leur (fichier texte). |
| **Mots-clés** | Mots, hashtags ou emojis, un par ligne. Majuscules et accents ne comptent pas. Cherchés dans le pseudo, le nom et le texte du post. |
| **Couleur du carré** | Une couleur proposée ou la tienne. |
| **Texte sur le carré** | Aucun texte, ton texte, ou ton texte suivi de la raison (le compte ou le mot-clé en cause). |
| **Cliquer pour afficher** | Autoriser ou non l'affichage d'un post caché d'un simple clic. |
| **Bouton 🙈** | L'afficher ou non sur chaque post. |

Un aperçu du carré se met à jour pendant que tu règles. Pense à cliquer sur **Enregistrer**.

## Liste partagée

Une liste de comptes est tenue à jour dans ce dépôt : [`liste.txt`](liste.txt). Elle est **désactivée par défaut** : tu choisis de l'utiliser ou non.

- Pour l'activer, coche **Cacher aussi les comptes de la liste partagée** dans les réglages.
- Elle se met à jour toute seule toutes les 6 heures ; le bouton **Mettre à jour** le fait tout de suite.
- Si tu n'es pas d'accord avec un compte de la liste, affiche un de ses posts et clique sur 👁 : il ne sera plus caché chez toi. Ces exceptions sont dans **Comptes à ne jamais cacher**.
- Décoche la case à tout moment : tout redevient visible, sauf tes propres comptes et mots-clés.
- **Autres listes (adresses)** : tu peux ajouter l'adresse de n'importe quel fichier texte du même format. Le navigateur te demande alors l'autorisation d'accéder à ce site.

Format de la liste : un pseudo par ligne, avec ou sans @, ou l'adresse du profil ; tout ce qui suit un `#` est un commentaire. Pour proposer un ajout ou un retrait, ouvre une issue ou une pull request sur `liste.txt`.

## Vie privée

L'extension lit les pages `threads.com` / `threads.net` pour y poser les carrés. Tes listes et réglages restent dans le stockage local du navigateur. Seule requête réseau : le téléchargement de la liste partagée (et des autres listes que tu ajoutes), uniquement si tu l'as activée. Rien n'est envoyé nulle part.

## Si ça ne marche plus

Threads change régulièrement son interface. Si des posts ne sont plus cachés, ouvre une issue en précisant ce que tu vois (sur le fil, dans une discussion, sur un profil). Le repérage des posts est dans `src/content.js`.

## Code source

Le code est le même pour Chrome et Firefox, dans [`src/`](src) :

```
src/
├── manifest.json   déclaration de l'extension (Manifest V3)
├── content.js      repérage des posts et carrés sur Threads
├── background.js   téléchargement des listes partagées (toutes les 6 h)
├── popup.html/js   fenêtre de réglages
├── styles.css      style des carrés et des boutons
└── icons/
```

Pour tester une modification sans rien empaqueter :

- **Firefox** : `about:debugging#/runtime/this-firefox` → **Charger un module complémentaire temporaire…** → `src/manifest.json`.
- **Chrome** : passe par `./build.sh` puis charge le dossier décompressé du zip, car Chrome n'accepte pas le `background.scripts` de Firefox.

Pour regénérer les deux paquets après une modification (pense à monter `version` dans `src/manifest.json`) :

```bash
./build.sh
```

Le script produit `dist/firefox/cache-ton-facho-firefox.xpi` et `dist/chrome/cache-ton-facho.zip` (sans la clé Firefox, avec un service worker à la place des scripts de fond). Il demande `zip` et `python3`.

## Licence

[GPL-3.0](LICENSE) © 2026 Fanch. Tu peux utiliser, modifier et redistribuer ce code, à condition que les versions modifiées que tu diffuses restent sous la même licence, avec leur code source.
