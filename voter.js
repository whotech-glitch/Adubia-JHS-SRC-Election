/* VOTER PAGE LOGIC */
let view = 'home', lastVote = 'home', me = null, step = 0, pick = {}, msg = '', sending = false, sig = '';
const app = $('#app'), nav = $('#nav');
const VOTING = ['home', 'login', 'ballot', 'review', 'thanks'];

const lists = () => ({
  cls: S.classes.length ? S.classes.map(c => c.name) : DEFAULT_CLASSES,
  dps: S.depts.length ? S.depts.map(d => d.name) : DEFAULT_DEPTS
});
function render() {
  $('#ttl').textContent = S.title;
  nav.innerHTML = `<button class="${VOTING.includes(view) ? 'on' : ''}" onclick="tabVote()">🗳️ Vote</button><button class="${view === 'results' ? 'on' : ''}" onclick="go('results')">🏆 Results</button>`;
  app.innerHTML = ({ home: vHome, login: vLogin, ballot: vBallot, review: vReview, thanks: vThanks, results: vResults })[view]();
}
function go(v) { view = v; msg = ''; if (VOTING.includes(v)) lastVote = v; render(); }
function tabVote() { go(lastVote === 'thanks' ? 'home' : lastVote); }
function retry() { netErr = ''; render(); tick(); }

/* ---------- connection / status screens ---------- */
function connecting() {
  return netErr
    ? `<div class="card status bad"><div class="big">⚠️</div><h2>Cannot connect</h2><p class="mut">${esc(netErr)} Please check your internet connection.</p><button class="btn" onclick="retry()">Try again</button></div>`
    : `<div class="card status"><div class="big">⏳</div><h2>Connecting…</h2><p class="mut">Please wait a moment.</p></div>`;
}

/* ---------- Home: shows clearly whether voting is open ---------- */
function vHome() {
  if (!loaded) return connecting();
  if (S.phase === 'open') return `<div class="card status open"><div class="big">🗳️</div><h2>Voting is open</h2>
    <p class="mut">Every student has one vote. Have your index number, class and department ready.</p>
    <span class="pill open">VOTING OPEN</span><br><button class="btn gold" onclick="go('login')">Start Voting →</button></div>`;
  if (S.phase === 'closed') return `<div class="card status shut"><div class="big">🔒</div><h2>Voting has ended</h2>
    <p class="mut">${S.published ? 'The results have been published.' : 'The results will appear here once the admin publishes them.'}</p>
    <span class="pill shut">VOTING CLOSED</span>${S.published ? '<br><button class="btn" onclick="go(\'results\')">View Results</button>' : ''}</div>`;
  return `<div class="card status wait"><div class="big">⏳</div><h2>Voting has not been opened yet</h2>
    <p>The admin has not opened voting. Please wait. This page updates by itself as soon as voting starts, so you do not need to refresh.</p>
    <span class="pill wait">NOT OPEN YET</span></div>`;
}

/* ---------- Step 1: verify ---------- */
function vLogin() {
  const L = lists();
  return `<div class="steps"><i class="on"></i><i></i><i></i></div><div class="card"><h2>Step 1: Verify yourself</h2><p class="mut">Enter your details to get your ballot.</p>
    <label class="f">Index Number</label><input id="ix" placeholder="e.g. 0123456789" autocomplete="off">
    <label class="f">Class</label><select id="cl">${L.cls.map(c => `<option>${esc(c)}</option>`).join('')}</select>
    <label class="f">Department</label><select id="dp">${L.dps.map(c => `<option>${esc(c)}</option>`).join('')}</select>
    <button class="btn gold" onclick="login()">Continue →</button><button class="btn ghost" onclick="go('home')">Back</button>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}</div>`;
}
async function login() {
  const idx = fbKey($('#ix').value), cl = $('#cl').value, dp = $('#dp').value;
  if (idx.length < 3) { msg = 'Please enter a valid index number.'; return render(); }
  try { await pull(); } catch (e) { msg = 'Cannot reach the server. Check your internet and try again.'; return render(); }
  if (S.phase !== 'open') { go('home'); return; }
  if (!positions().length) { msg = 'No candidates have been added yet.'; return render(); }
  if (await hasVoted(idx)) { msg = 'This index number has already voted. Each student can vote only once.'; return render(); }
  me = { idx, cls: cl, dept: dp }; pick = {}; step = 0; go('ballot');
}

/* ---------- Step 2: ballot, one position at a time ---------- */
function vBallot() {
  const ps = positions(), p = ps[step], cs = S.cands.filter(c => c.pos === p);
  return `<div class="steps"><i class="on"></i><i class="on"></i><i></i></div><div class="card">
    <p class="mut">Step 2: Position ${step + 1} of ${ps.length} · Index ${esc(me.idx)}</p><h2>${esc(p)}</h2><p class="mut">Tap one candidate.</p>
    <div class="grid">${cs.map(c => `<div class="pick ${pick[p] === c.id ? 'sel' : ''}" onclick="choose('${c.id}')">${av(c)}<div class="nm">${esc(c.name)}</div>${pick[p] === c.id ? '<div class="ok">✔ Selected</div>' : ''}</div>`).join('')}</div>
    <button class="btn ghost" onclick="${step ? 'step--;msg=\'\';render()' : "go('login')"}">← Back</button>
    <button class="btn gold" onclick="next()">${step === ps.length - 1 ? 'Review →' : 'Next →'}</button>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}</div>`;
}
function choose(id) { pick[positions()[step]] = id; msg = ''; render(); }
function next() {
  const ps = positions();
  if (!pick[ps[step]]) { msg = 'Please select a candidate to continue.'; return render(); }
  msg = ''; if (step < ps.length - 1) { step++; render(); } else go('review');
}

/* ---------- Step 3: review & submit ---------- */
function vReview() {
  return `<div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i></div><div class="card"><h2>Step 3: Review your vote</h2>
    ${positions().map(p => { const c = S.cands.find(x => x.id === pick[p]); return `<div class="rev"><span class="mut">${esc(p)}</span><b>${esc(c ? c.name : '-')}</b></div>`; }).join('')}
    <p class="mut">You cannot change your vote after submitting.</p>
    <button class="btn gold" onclick="submitVote()" ${sending ? 'disabled' : ''}>${sending ? 'Submitting…' : 'Confirm & Submit'}</button>
    <button class="btn ghost" onclick="step=0;go('ballot')" ${sending ? 'disabled' : ''}>Change</button>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}</div>`;
}
async function submitVote() {
  if (sending) return; sending = true; msg = ''; render();
  const ballot = {}; positions().forEach(p => ballot[p] = pick[p]);
  try {
    const ok = await castVote(me.idx, { cls: me.cls, dept: me.dept, t: Date.now() }, ballot);
    if (!ok) msg = 'This index number has already voted.';
    else { me = null; sending = false; go('thanks'); return; }
  } catch (e) {
    msg = e.closed ? 'Voting has been closed.' : 'Could not submit your vote. Check your internet and try again.';
    if (e.closed) tick();
  }
  sending = false; render();
}
function vThanks() {
  return `<div class="card status open"><div class="big">🎉</div><h2>Thank you for voting!</h2>
    <p class="mut">Your vote has been recorded. Check the Results tab after the admin publishes the results.</p>
    <button class="btn" onclick="go('home')">Done</button></div>`;
}

/* ---------- Results ---------- */
function vResults() {
  if (!loaded) return connecting();
  if (!S.published) return `<div class="card status wait"><div class="big">📭</div><h2>Results not published yet</h2>
    <p class="mut">The admin will publish the results after the votes are counted.</p></div>`;
  return `<div class="card status open"><h2>Official Results</h2><p class="mut">Total voters: ${Object.keys(S.voted).length}</p></div>` +
    positions().map(p => {
      const { cs, t } = tally(p), top = cs[0] ? cs[0].n : 0, ties = cs.filter(c => c.n === top).length;
      return `<div class="card"><h3>${esc(p)}</h3>` + cs.map(c => {
        const pc = t ? Math.round(c.n * 100 / t) : 0, win = top > 0 && c.n === top;
        return `<div class="res ${win ? 'win' : ''}">${av(c)}<div class="g"><div class="nm">${esc(c.name)}${win ? `<span class="crown">👑 ${ties > 1 ? 'TIE' : 'WINNER'}</span>` : ''}</div>
          <div class="track"><i style="width:${pc}%"></i></div></div><b>${c.n}<br><small class="mut">${pc}%</small></b></div>`;
      }).join('') + `</div>`;
    }).join('');
}

/* the page updates itself; it never wipes a form someone is filling in */
function onChange() {
  const s = JSON.stringify([loaded, netErr, S.phase, S.published, S.title, S.cands.length, view === 'results' ? S.votes.length : 0]);
  if (s === sig) return; sig = s;
  if (view === 'home' || view === 'results' || view === 'thanks') render();
}
render();
