'use strict';
/* ================= LANGUAGES (v30) =================
   Menus, buttons, headings and settings in Dutch, German, Spanish or French (Settings → Language). Stories, names
   and descriptions stay in English. It works on what's on screen: any text that exactly matches an entry below is
   shown translated (and switched back when you choose English again), so nothing else in the game has to change.
   To add a language, add a column: a code in I18N_LANGS and one more string in each row. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
/* eslint-disable no-func-assign */
expose({
  I18N: [() => I18N],
  I18N_ATTRIBUTES: [() => I18N_ATTRIBUTES],
  I18N_LANGS: [() => I18N_LANGS],
  I18N_ORIGINALS: [() => I18N_ORIGINALS],
  I18N_TABLE_TEXT: [() => I18N_TABLE_TEXT],
  i18nAttribute: [() => i18nAttribute, v => (i18nAttribute = v)],
  i18nLanguage: [() => i18nLanguage, v => (i18nLanguage = v)],
  i18nNode: [() => i18nNode, v => (i18nNode = v)],
  i18nObserver: [() => i18nObserver, v => (i18nObserver = v)],
  i18nSet: [() => i18nSet, v => (i18nSet = v)],
  i18nText: [() => i18nText, v => ((i18nText = v), provide({ i18nText }))],
});
/* eslint-enable no-func-assign */
provide({ i18nText });
/* to-module: end */
export const I18N_LANGS = [
  ['en', 'English'],
  ['nl', 'Nederlands'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['fr', 'Français'],
];
/* English | Nederlands | Deutsch | Español | Français */
const I18N_TABLE_TEXT = `
Walk|Lopen|Gehen|Caminar|Marcher
Map|Kaart|Karte|Mapa|Carte
Team|Team|Team|Equipo|Équipe
Guide|Gids|Führer|Guía|Guide
Trainer|Trainer|Trainer|Entrenador|Dresseur
Actions|Acties|Aktionen|Acciones|Actions
Settings|Instellingen|Einstellungen|Ajustes|Réglages
Open map|Kaart openen|Karte öffnen|Abrir mapa|Ouvrir la carte
World map|Wereldkaart|Weltkarte|Mapa del mundo|Carte du monde
The Hollow Earth|De Holle Aarde|Die Hohle Erde|La Tierra Hueca|La Terre creuse
Keep walking|Blijf lopen|Weitergehen|Sigue caminando|Continuer
Change plans|Plannen wijzigen|Pläne ändern|Cambiar de planes|Changer de plan
Not now|Niet nu|Nicht jetzt|Ahora no|Pas maintenant
Done|Klaar|Fertig|Hecho|Terminé
Close|Sluiten|Schließen|Cerrar|Fermer
Back|Terug|Zurück|Atrás|Retour
Next|Volgende|Weiter|Siguiente|Suivant
Start|Start|Start|Empezar|Commencer
Save|Opslaan|Speichern|Guardar|Enregistrer
Clear|Wissen|Leeren|Borrar|Effacer
Claim|Ophalen|Abholen|Reclamar|Réclamer
Details|Details|Details|Detalles|Détails
Fight|Vechten|Kämpfen|Luchar|Combattre
Tax!|Belasten!|Besteuern!|¡Gravar!|Taxer !
Bag|Tas|Tasche|Bolsa|Sac
Run|Vluchten|Fliehen|Huir|Fuir
Heal|Genezen|Heilen|Curar|Soigner
Fish|Vissen|Angeln|Pescar|Pêcher
Strike!|Aanslaan!|Anschlagen!|¡Tira!|Ferrez !
Stop fishing|Stop met vissen|Angeln beenden|Dejar de pescar|Arrêter de pêcher
Decorate|Inrichten|Einrichten|Decorar|Décorer
Go outside|Naar buiten|Nach draußen|Salir|Sortir
Labels|Labels|Beschriftung|Etiquetas|Étiquettes
Requests you’re helping with|Verzoeken waar je mee helpt|Bitten, bei denen du hilfst|Peticiones en las que ayudas|Demandes en cours
Encounters|Ontmoetingen|Begegnungen|Encuentros|Rencontres
Eggs|Eieren|Eier|Huevos|Œufs
Empty incubator|Lege broedmachine|Leerer Brutkasten|Incubadora vacía|Couveuse vide
Buddy|Maatje|Kumpel|Compañero|Compagnon
Money|Geld|Geld|Dinero|Argent
Your team|Jouw team|Dein Team|Tu equipo|Ton équipe
Party|Groep|Gruppe|Grupo|Groupe
Storage|Opslag|Lager|Almacén|Stockage
Storage is empty.|De opslag is leeg.|Das Lager ist leer.|El almacén está vacío.|Le stockage est vide.
Add from storage|Toevoegen uit opslag|Aus dem Lager holen|Añadir del almacén|Ajouter depuis le stockage
Make lead|Voorop zetten|Anführen lassen|Poner en cabeza|Mettre en tête
Lead|Voorop|Anführer|Líder|En tête
Fainted|Flauwgevallen|Besiegt|Debilitado|K.O.
Items|Spullen|Gegenstände|Objetos|Objets
In your bag|In je tas|In deiner Tasche|En tu bolsa|Dans ton sac
No items yet.|Nog geen spullen.|Noch keine Gegenstände.|Aún no hay objetos.|Pas encore d’objets.
Field Guide|Veldgids|Feldführer|Guía de campo|Guide de terrain
All types|Alle typen|Alle Typen|Todos los tipos|Tous les types
Seen|Gezien|Gesehen|Vistos|Vus
Taxed|Belast|Besteuert|Gravados|Taxés
Unknown|Onbekend|Unbekannt|Desconocido|Inconnu
Tax one to see its stats.|Belast er een om zijn statistieken te zien.|Besteuere eins, um seine Werte zu sehen.|Grava uno para ver sus estadísticas.|Taxez-en un pour voir ses stats.
Your profile|Jouw profiel|Dein Profil|Tu perfil|Ton profil
Trainer card|Trainerkaart|Trainerkarte|Tarjeta de entrenador|Carte de dresseur
Records|Records|Rekorde|Récords|Records
Badges|Badges|Orden|Medallas|Badges
Edit look|Uiterlijk aanpassen|Aussehen ändern|Cambiar aspecto|Modifier l’apparence
Customize trainer|Trainer aanpassen|Trainer anpassen|Personalizar entrenador|Personnaliser le dresseur
Distance walked|Afgelegde afstand|Zurückgelegte Strecke|Distancia recorrida|Distance parcourue
Places visited|Bezochte plekken|Besuchte Orte|Lugares visitados|Lieux visités
Trainers beaten|Verslagen trainers|Besiegte Trainer|Entrenadores vencidos|Dresseurs battus
Eggs hatched|Uitgekomen eieren|Geschlüpfte Eier|Huevos eclosionados|Œufs éclos
Theme|Thema|Design|Tema|Thème
Animation|Animatie|Animation|Animación|Animation
Scene tilt|Kantelen|Neigung|Inclinación|Inclinaison
Battle stage|Gevechtsplek|Kampfbühne|Escenario de combate|Scène de combat
Frame rate|Beeldsnelheid|Bildrate|Fotogramas|Images par seconde
Sharp or smooth|Scherp of vloeiend|Scharf oder flüssig|Nítido o fluido|Net ou fluide
Sharpest|Scherpst|Am schärfsten|Más nítido|Plus net
Smoothest|Vloeiendst|Am flüssigsten|Más fluido|Plus fluide
Music|Muziek|Musik|Música|Musique
Sound effects|Geluidseffecten|Soundeffekte|Efectos de sonido|Effets sonores
World sounds|Geluiden van de wereld|Weltgeräusche|Sonidos del mundo|Sons du monde
Sound|Geluid|Ton|Sonido|Son
Volume|Volume|Lautstärke|Volumen|Volume
Ambience|Sfeergeluiden|Atmosphäre|Ambiente|Ambiance
Display|Weergave|Anzeige|Pantalla|Affichage
Controls|Besturing|Steuerung|Controles|Commandes
Accessibility|Toegankelijkheid|Barrierefreiheit|Accesibilidad|Accessibilité
Game|Spel|Spiel|Juego|Jeu
Help|Hulp|Hilfe|Ayuda|Aide
Report a problem|Een probleem melden|Problem melden|Informar de un problema|Signaler un problème
Start over|Opnieuw beginnen|Neu anfangen|Empezar de nuevo|Recommencer
Erases your team, Field Guide, money and the ranch. Settings stay.|Wist je team, veldgids, geld en de ranch. Instellingen blijven.|Löscht dein Team, den Feldführer, dein Geld und die Ranch. Einstellungen bleiben.|Borra tu equipo, la guía de campo, el dinero y el rancho. Los ajustes se quedan.|Efface ton équipe, ton guide de terrain, ton argent et le ranch. Les réglages restent.
Mute music|Muziek dempen|Musik stumm|Silenciar la música|Couper la musique
Mute sound effects|Geluidseffecten dempen|Soundeffekte stumm|Silenciar los efectos de sonido|Couper les effets sonores
Mute world sounds|Geluiden van de wereld dempen|Weltgeräusche stumm|Silenciar los sonidos del mundo|Couper les sons du monde
Mute ambience|Sfeergeluiden dempen|Atmosphäre stumm|Silenciar el ambiente|Couper l’ambiance
Mute|Dempen|Stumm|Silenciar|Couper le son
Sound on|Geluid aan|Ton an|Sonido activado|Son activé
Sound off|Geluid uit|Ton aus|Sonido desactivado|Son coupé
Music volume|Muziekvolume|Musiklautstärke|Volumen de la música|Volume de la musique
Sound effects volume|Volume van geluidseffecten|Lautstärke der Soundeffekte|Volumen de los efectos de sonido|Volume des effets sonores
World sounds volume|Volume van de geluiden van de wereld|Lautstärke der Weltgeräusche|Volumen de los sonidos del mundo|Volume des sons du monde
Ambience volume|Volume van de sfeergeluiden|Lautstärke der Atmosphäre|Volumen del ambiente|Volume de l’ambiance
Everything together. Mute keeps your levels for later.|Alles samen. Dempen bewaart je niveaus voor later.|Alles zusammen. Stumm behält deine Pegel für später.|Todo junto. Silenciar guarda tus niveles para después.|Tout ensemble. Couper le son garde tes niveaux pour plus tard.
Tunes for each place and battle.|Melodieën voor elke plek en elk gevecht.|Melodien für jeden Ort und jeden Kampf.|Melodías para cada lugar y cada combate.|Des airs pour chaque lieu et chaque combat.
Buttons, battles, coins, and the short tunes for a win or a level up.|Knoppen, gevechten, munten en de korte deuntjes bij een overwinning of een nieuw level.|Knöpfe, Kämpfe, Münzen und die kurzen Melodien bei einem Sieg oder einem Levelaufstieg.|Botones, combates, monedas y las melodías cortas al ganar o subir de nivel.|Boutons, combats, pièces, et les petits airs d’une victoire ou d’un niveau gagné.
Water, fountains, fire, rain, wind and animals near you.|Water, fonteinen, vuur, regen, wind en dieren bij je in de buurt.|Wasser, Brunnen, Feuer, Regen, Wind und Tiere in deiner Nähe.|Agua, fuentes, fuego, lluvia, viento y animales cerca de ti.|L’eau, les fontaines, le feu, la pluie, le vent et les animaux près de toi.
Birdsong by day, crickets at night, leaves, a town’s murmur, a room’s clock.|Vogelzang overdag, krekels ’s nachts, bladeren, het geroezemoes van een stad, de klok in een kamer.|Vogelgesang am Tag, Grillen in der Nacht, Blätter, das Murmeln einer Stadt, die Uhr eines Zimmers.|Pájaros de día, grillos de noche, hojas, el murmullo de un pueblo, el reloj de una habitación.|Les oiseaux le jour, les grillons la nuit, les feuilles, la rumeur d’une ville, l’horloge d’une pièce.
Low HP beep|Piep bij weinig HP|Piepton bei wenig KP|Pitido de PS bajos|Bip de PV faibles
The classic beep while your lead Billie is under a quarter of its HP. The battle music turns tense either way.|De klassieke piep zolang je voorste Billie minder dan een kwart van zijn HP heeft. De gevechtsmuziek wordt hoe dan ook gespannen.|Der klassische Piepton, solange dein vorderster Billie unter einem Viertel seiner KP ist. Die Kampfmusik wird so oder so angespannt.|El pitido clásico mientras tu Billie de cabeza tenga menos de una cuarta parte de sus PS. La música de combate se vuelve tensa de todos modos.|Le bip classique tant que ton Billie de tête a moins d’un quart de ses PV. La musique de combat devient tendue de toute façon.
Sounds fade in when you arrive somewhere.|Geluiden komen langzaam op als je ergens aankomt.|Geräusche werden langsam lauter, wenn du irgendwo ankommst.|Los sonidos suben poco a poco al llegar a un sitio.|Les sons montent doucement quand tu arrives quelque part.
Visual effects|Visuele effecten|Visuelle Effekte|Efectos visuales|Effets visuels
Vibration|Trillen|Vibration|Vibración|Vibration
Time of day|Tijd van de dag|Tageszeit|Hora del día|Moment de la journée
Weather|Weer|Wetter|Tiempo|Météo
Season|Seizoen|Jahreszeit|Estación|Saison
Text size|Tekstgrootte|Textgröße|Tamaño del texto|Taille du texte
Contrast|Contrast|Kontrast|Contraste|Contraste
Flashes|Flitsen|Blitze|Destellos|Flashs
Buttons|Knoppen|Knöpfe|Botones|Boutons
Language|Taal|Sprache|Idioma|Langue
Save slots|Opslagplaatsen|Speicherplätze|Ranuras de guardado|Emplacements de sauvegarde
Export save|Opslag exporteren|Spielstand exportieren|Exportar partida|Exporter la sauvegarde
Import save|Opslag importeren|Spielstand importieren|Importar partida|Importer une sauvegarde
How to play|Hoe speel je|Spielanleitung|Cómo jugar|Comment jouer
Run the full test|De volledige test uitvoeren|Den vollständigen Test starten|Ejecutar la prueba completa|Lancer le test complet
Export debug log|Foutlogboek exporteren|Debug-Protokoll exportieren|Exportar registro|Exporter le journal
Debug menu|Debugmenu|Debug-Menü|Menú de depuración|Menu de débogage
Play this one|Deze spelen|Diesen spielen|Jugar esta|Jouer celle-ci
New game here|Nieuw spel hier|Neues Spiel hier|Partida nueva aquí|Nouvelle partie ici
Copy mine here|Kopieer de mijne hierheen|Meinen hierher kopieren|Copiar la mía aquí|Copier la mienne ici
Empty|Leeg|Leer|Vacío|Vide
Normal|Normaal|Normal|Normal|Normal
Large|Groot|Groß|Grande|Grand
Larger|Groter|Größer|Más grande|Plus grand
High contrast|Hoog contrast|Hoher Kontrast|Alto contraste|Contraste élevé
No flashing|Geen flitsen|Kein Blinken|Sin destellos|Pas de flash
Normal size|Normale grootte|Normale Größe|Tamaño normal|Taille normale
Bigger, easier to tap|Groter, makkelijker aan te tikken|Größer, leichter zu tippen|Más grandes, más fáciles de pulsar|Plus grands, plus faciles à toucher
Follow my clock|Volg mijn klok|Meiner Uhr folgen|Seguir mi reloj|Suivre mon horloge
Always morning|Altijd ochtend|Immer Morgen|Siempre mañana|Toujours le matin
Always midday|Altijd middag|Immer Mittag|Siempre mediodía|Toujours midi
Always evening|Altijd avond|Immer Abend|Siempre tarde|Toujours le soir
Always night|Altijd nacht|Immer Nacht|Siempre noche|Toujours la nuit
Changes with the place and the hour|Wisselt met de plek en het uur|Wechselt mit Ort und Stunde|Cambia con el lugar y la hora|Change selon le lieu et l’heure
Always fair|Altijd mooi weer|Immer schön|Siempre buen tiempo|Toujours beau
Always rain|Altijd regen|Immer Regen|Siempre lluvia|Toujours la pluie
Always snow|Altijd sneeuw|Immer Schnee|Siempre nieve|Toujours la neige
Always fog|Altijd mist|Immer Nebel|Siempre niebla|Toujours le brouillard
Follow the calendar|Volg de kalender|Dem Kalender folgen|Seguir el calendario|Suivre le calendrier
Spring|Lente|Frühling|Primavera|Printemps
Summer|Zomer|Sommer|Verano|Été
Autumn|Herfst|Herbst|Otoño|Automne
Winter|Winter|Winter|Invierno|Hiver
Open the counter right away|Meteen de toonbank openen|Sofort die Theke öffnen|Abrir el mostrador directamente|Ouvrir le comptoir tout de suite
Match device|Zoals het apparaat|Wie das Gerät|Como el dispositivo|Comme l’appareil
Daylight|Daglicht|Tageslicht|Luz de día|Jour
Moonlight|Maanlicht|Mondlicht|Luz de luna|Nuit
Full animation|Volledige animatie|Volle Animation|Animación completa|Animation complète
Reduced motion|Minder beweging|Weniger Bewegung|Movimiento reducido|Mouvements réduits
Tilt with my phone|Kantelen met mijn telefoon|Mit dem Handy neigen|Inclinar con el móvil|Incliner avec le téléphone
Keep the scene still|Houd de scène stil|Szene ruhig halten|Mantener la escena quieta|Garder la scène fixe
On|Aan|An|Sí|Oui
Off|Uit|Aus|No|Non
Super effective|Supereffectief|Sehr effektiv|Muy eficaz|Super efficace
Not very effective|Niet erg effectief|Nicht sehr effektiv|Poco eficaz|Peu efficace
Back to the game|Terug naar het spel|Zurück zum Spiel|Volver al juego|Retour au jeu
Back to walking|Terug naar het lopen|Zurück zum Gehen|Volver a caminar|Reprendre la marche
Let’s go|Daar gaan we|Los geht’s|¡Vamos!|C’est parti
Leave the shop|De winkel verlaten|Laden verlassen|Salir de la tienda|Quitter la boutique
I’ll do it|Ik doe het|Mach ich|Lo haré|Je m’en occupe
Decorate your room|Richt je kamer in|Richte dein Zimmer ein|Decora tu habitación|Décore ta chambre
Nothing|Niets|Nichts|Nada|Rien
`;
const I18N = (() => {
  const M = {};
  I18N_LANGS.forEach(([c], i) => {
    if (i) M[c] = new Map();
  });
  for (const line of I18N_TABLE_TEXT.trim().split('\n')) {
    const p = line.split('|');
    if (p.length < I18N_LANGS.length) continue;
    I18N_LANGS.forEach(([c], i) => {
      if (i && p[i]) M[c].set(p[0], p[i]);
    });
  }
  return M;
})();
let i18nLanguage = 'en',
  i18nObserver = null;
const I18N_ORIGINALS = new WeakMap(),
  I18N_ATTRIBUTES = ['aria-label', 'title', 'placeholder'];
/* translate (or restore) one text node / element's attributes */
function i18nNode(n) {
  if (n.nodeType === 3) {
    let O = I18N_ORIGINALS.get(n);
    if (O && n.nodeValue !== O.out) {
      I18N_ORIGINALS.delete(n);
      O = null;
    }
    /* the game changed it since */ const raw = O ? O.raw : n.nodeValue,
      t = raw.trim();
    if (!t || t.length > 80) return;
    const tr = i18nLanguage === 'en' ? null : I18N[i18nLanguage] && I18N[i18nLanguage].get(t);
    if (tr) {
      const v = raw.replace(t, tr);
      I18N_ORIGINALS.set(n, { raw, out: v });
      if (n.nodeValue !== v) n.nodeValue = v;
    } else if (O) {
      n.nodeValue = O.raw;
      I18N_ORIGINALS.delete(n);
    }
    return;
  }
  if (n.nodeType !== 1 || n.closest('canvas,script,style,[data-noi18n]')) return;
  for (const a of I18N_ATTRIBUTES) {
    if (!n.hasAttribute(a)) continue;
    const key = 'data-en-' + a,
      raw = n.getAttribute(key) ?? n.getAttribute(a),
      tr = i18nLanguage === 'en' ? null : I18N[i18nLanguage] && I18N[i18nLanguage].get(raw.trim());
    if (tr) {
      if (!n.hasAttribute(key)) n.setAttribute(key, raw);
      n.setAttribute(a, tr);
    } else if (n.hasAttribute(key)) {
      n.setAttribute(a, n.getAttribute(key));
      n.removeAttribute(key);
    }
  }
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let c;
  while ((c = w.nextNode())) {
    if (c.nodeType === 3) {
      if (c.parentElement && !c.parentElement.closest('script,style,[data-noi18n]')) i18nNode(c);
    } else
      for (const a of I18N_ATTRIBUTES)
        if (c.hasAttribute && c.hasAttribute(a)) {
          i18nAttribute(c, a);
        }
  }
}
/* UI-5: a string in the chosen language, for text a kit part draws in its own shadow tree (the observer can't see
   it there) */
function i18nText(text) {
  const tr = i18nLanguage === 'en' ? null : I18N[i18nLanguage] && I18N[i18nLanguage].get(text);
  return tr || text;
}
function i18nAttribute(el, a) {
  const key = 'data-en-' + a,
    raw = el.getAttribute(key) ?? el.getAttribute(a),
    tr = i18nLanguage === 'en' ? null : I18N[i18nLanguage] && I18N[i18nLanguage].get(raw.trim());
  if (tr) {
    if (!el.hasAttribute(key)) el.setAttribute(key, raw);
    if (el.getAttribute(a) !== tr) el.setAttribute(a, tr);
  } else if (el.hasAttribute(key)) {
    el.setAttribute(a, el.getAttribute(key));
    el.removeAttribute(key);
  }
}
export function i18nSet(lang) {
  lang = I18N_LANGS.some(l => l[0] === lang) ? lang : 'en';
  if (lang === i18nLanguage && i18nObserver) return;
  i18nLanguage = lang;
  document.documentElement.lang = lang;
  if (!i18nObserver && lang !== 'en') {
    i18nObserver = new MutationObserver(ms => {
      if (i18nLanguage === 'en') return;
      for (const m of ms) {
        if (m.type === 'characterData') i18nNode(m.target);
        else for (const n of m.addedNodes) i18nNode(n);
      }
    });
    i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  i18nNode(document.body);
}
