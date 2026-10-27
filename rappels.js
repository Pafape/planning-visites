// Envoi des rappels de visite (exécuté chaque jour par GitHub Actions).
// - Une semaine avant une visite : notification au visiteur 1 (à défaut, au visiteur 2).
// - Trois jours après une visite sans compte rendu : notification aux visiteurs concernés.
const TZ = 'Europe/Paris';
const iso = d => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
const addDays = (j, n) => { const d = new Date(j + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000);
const longDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function selectionner({ visites, sites, appareils }, today) {
  const out = [];
  const dev = pid => appareils.filter(a => a.personne === pid).map(a => a.token);
  const nom = id => (sites.find(s => s.id === id) || {}).nom || 'le site';
  for (const v of visites) {
    const st = v.statut || 'prevue', vis = v.v || [];
    if (st === 'prevue' && v.date > today && v.date <= addDays(today, 7) && v.rappel7 !== v.date) {
      const n = diff(v.date, today);
      let to = dev(vis[0]);
      if (!to.length && vis[1]) to = dev(vis[1]);
      if (to.length) out.push({ visite: v, flag: 'rappel7', tokens: to, data: { t: 'prev', id: v.id, tag: 'p' + v.id,
        title: n === 1 ? 'Visite demain' : 'Visite dans ' + n + ' jours',
        body: nom(v.site) + ', ' + longDate(v.date) + '. Touchez pour prévenir la Direction.' } });
    }
    if ((st === 'prevue' || st === 'realisee') && !v.cr && v.date <= addDays(today, -3) && v.date >= addDays(today, -45) && v.rappelCR !== v.date) {
      const to = [...new Set(vis.flatMap(dev))];
      if (to.length) out.push({ visite: v, flag: 'rappelCR', tokens: to, data: { t: 'cr', id: v.id, tag: 'c' + v.id,
        title: 'Compte rendu à saisir',
        body: 'Visite du ' + longDate(v.date) + ', ' + nom(v.site) + '. Touchez pour le saisir.' } });
    }
  }
  return out;
}

async function main() {
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore(), today = iso(new Date());
  const espaces = await db.collection('espaces').listDocuments();
  let envoyes = 0;
  for (const sp of espaces) {
    const lire = async c => (await sp.collection(c).get()).docs.map(d => ({ ...d.data(), id: d.id, _ref: d.ref }));
    const [visites, sites, appareils] = await Promise.all([lire('visites'), lire('sites'), lire('appareils')]);
    for (const it of selectionner({ visites, sites, appareils }, today)) {
      const res = await admin.messaging().sendEachForMulticast({ tokens: it.tokens, data: it.data, webpush: { headers: { Urgency: 'high', TTL: '172800' } } });
      let ok = 0;
      res.responses.forEach((r, i) => {
        if (r.success) ok++;
        else if (/not-registered|invalid-argument|invalid-registration/.test((r.error && r.error.code) || '')) {
          const a = appareils.find(x => x.token === it.tokens[i]);
          if (a) a._ref.delete().catch(() => {});
        }
      });
      if (ok) { await it.visite._ref.update({ [it.flag]: it.visite.date }); envoyes += ok; }
      console.log(it.flag, it.visite.id, ok + '/' + it.tokens.length);
    }
  }
  console.log('Notifications envoyées :', envoyes);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { selectionner, addDays, diff, iso };
