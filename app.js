// the bridge - reference app

(function() {
  var t = localStorage.getItem('rules-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
})();

var data = { rules: [], casebook: [], glossary: [], penalties: [] };
var searchIndex = null;

async function loadData() {
  const [rules, casebook, glossary, penalties] = await Promise.all([
    fetch('data/rules.json').then(r => r.json()),
    fetch('data/casebook.json').then(r => r.json()),
    fetch('data/glossary.json').then(r => r.json()),
    fetch('data/penalties.json').then(r => r.json()),
  ]);
  data.rules     = rules.rules;
  data.casebook  = casebook.casebook;
  data.glossary  = glossary.glossary;
  data.penalties = penalties.penalties;
}

function getRule(id)        { return data.rules.find(r => r.id === id); }
function getScenario(id)    { return data.casebook.find(s => s.id === id); }
function getGlossaryTerm(id){ return data.glossary.find(g => g.id === id); }
function getPenalty(ref)    { return data.penalties.filter(p => p.rule_ref === ref); }
function getScenariosForRule(id) { return data.casebook.filter(s => s.rule_ref === id); }

// sidebar
function buildSidebar() {
  const toc = document.getElementById('tocList');
  if (!toc) return;
  toc.innerHTML = '';

  const sections = data.rules.filter(r => !r.id.includes('.'));
  sections.forEach(section => {
    const li = document.createElement('li');
    const topLink = document.createElement('a');
    topLink.href = `#rule-${section.id}`;
    topLink.className = 'nav-link top';
    topLink.textContent = `${section.id}. ${section.title}`;
    li.appendChild(topLink);

    const children = data.rules.filter(r => {
      if (r.id === section.id) return false;
      const parts = r.id.split('.');
      return parts[0] === section.id && parts.length <= 2;
    });

    if (children.length) {
      const ul = document.createElement('ul');
      children.forEach(child => {
        const cli = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#rule-${child.id}`;
        link.className = 'nav-link sub';
        const depth = child.id.split('.').length;
        if (depth > 2) link.style.paddingLeft = '38px';
        link.textContent = `${child.id} ${child.title}`;
        cli.appendChild(link);

        const grandchildren = data.rules.filter(r => {
          if (r.id === child.id) return false;
          const parts = r.id.split('.');
          const childParts = child.id.split('.');
          return r.id.startsWith(child.id + '.') && parts.length === childParts.length + 1;
        });
        if (grandchildren.length) {
          const gcul = document.createElement('ul');
          grandchildren.forEach(gc => {
            const gcli = document.createElement('li');
            const gclink = document.createElement('a');
            gclink.href = `#rule-${gc.id}`;
            gclink.className = 'nav-link sub';
            gclink.style.paddingLeft = '38px';
            gclink.textContent = `${gc.id} ${gc.title}`;
            gcli.appendChild(gclink);
            gcul.appendChild(gcli);
          });
          cli.appendChild(gcul);
        }
        ul.appendChild(cli);
      });
      li.appendChild(ul);
    }
    toc.appendChild(li);
  });
}

function setActiveNavLink(hash) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (!hash) return;
  let target = hash;
  if (hash.startsWith('#scenario-')) {
    target = '#casebook';
  }
  const link = document.querySelector(`a[href="${target}"]`);
  if (link) link.classList.add('active');
}

// views
function showView(id) {
  ['ruleView','scenarioView','glossaryView'].forEach(v => {
    document.getElementById(v).hidden = (v !== id);
  });
}

function renderRule(id) {
  const rule = getRule(id);
  if (!rule) { renderNotFound(); return; }
  showView('ruleView');

  document.getElementById('ruleNum').textContent = rule.id;
  document.getElementById('ruleName').textContent = rule.title;
  setBreadcrumb(buildRuleBreadcrumb(rule));

  const bodyEl = document.getElementById('ruleText');
  bodyEl.innerHTML = '';
  if (rule.text) {
    const p = document.createElement('p');
    p.textContent = rule.text;
    bodyEl.appendChild(p);
  }

  const subsEl = document.getElementById('subBlocks');
  subsEl.innerHTML = '';
  (rule.named_subsections || []).forEach(sub => {
    const block = document.createElement('div');
    block.className = 'sub-block';
    // detect numbered list: text starting with "1. "
    const isNumberedList = /\d+\.\s/.test(sub.text.trim());
    let content;
    if (isNumberedList) {
      const listStart = sub.text.search(/\d+\.\s/);
      const intro = sub.text.slice(0, listStart).trim();
      const listText = sub.text.slice(listStart);
      const items = listText.split(/(?=\d+\.\s)/).filter(s => s.trim());
      const ol = '<ol class="sub-block-list">' + items.map(item =>
        `<li>${item.replace(/^\d+\.\s/, '').trim()}</li>`
      ).join('') + '</ol>';
      content = (intro ? `<p>${intro}</p>` : '') + ol;
    } else {
      content = sub.text.split('\n\n').map(p => `<p style="margin-bottom:10px">${p.trim()}</p>`).join('');
    }
    block.innerHTML = `<div class="sub-block-title">${sub.name}</div>${content}`;
    subsEl.appendChild(block);
  });

  const penaltyEl = document.getElementById('penaltyRef');
  penaltyEl.innerHTML = '';
  if (rule.penalty_ref) {
    getPenalty(rule.penalty_ref).forEach(p => {
      const tag = document.createElement('a');
      tag.href = `#penalties`;
      tag.className = 'penalty-tag';
      tag.innerHTML = `<span class="lbl">Penalty</span><span class="code">${p.code}</span><span class="name">${p.verbal_cue}</span>`;
      tag.addEventListener('click', () => {
        setTimeout(() => {
          const el = document.getElementById(`penalty-${p.id}`);
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }, 50);
      });
      penaltyEl.appendChild(tag);
    });
  }

  const chipsEl = document.getElementById('scenarioChips');
  const listEl  = document.getElementById('scenarioList');
  chipsEl.innerHTML = '';
  const scenarios = getScenariosForRule(rule.id);
  listEl.hidden = scenarios.length === 0;
  scenarios.forEach(s => {
    const chip = document.createElement('a');
    chip.href = `#scenario-${s.id}`;
    chip.className = 'scenario-chip';
    chip.innerHTML = `<span class="chip-id">${s.id}</span><span class="chip-preview">${s.summary}</span>`;
    chipsEl.appendChild(chip);
  });

  const termChipsEl = document.getElementById('termChips');
  const termListEl  = document.getElementById('termList');
  termChipsEl.innerHTML = '';
  const terms = (rule.glossary_refs || []).map(id => getGlossaryTerm(id)).filter(Boolean);
  termListEl.hidden = terms.length === 0;
  terms.forEach(term => {
    const chip = document.createElement('a');
    chip.href = `#glossary-${term.id}`;
    chip.className = 'term-chip';
    chip.textContent = term.term;
    termChipsEl.appendChild(chip);
  });

  const childRulesEl = document.getElementById('childRules');
  childRulesEl.innerHTML = '';
  if (!rule.text) {
    const children = data.rules.filter(r => {
      const parts = r.id.split('.');
      const parentParts = rule.id.split('.');
      return r.id.startsWith(rule.id + '.') && parts.length === parentParts.length + 1;
    });
    children.forEach(child => {
      const a = document.createElement('a');
      a.href = `#rule-${child.id}`;
      a.className = 'child-rule-link';
      a.innerHTML = `<span class="child-rule-num">${child.id}</span>${child.title}`;
      childRulesEl.appendChild(a);
    });
  }

  document.title = `${rule.id} ${rule.title} - The Bridge`;
}

function buildRuleBreadcrumb(rule) {
  const parts = rule.id.split('.');
  const crumbs = [{ label: 'Rules', href: '#rule-1' }];
  if (parts.length > 1) {
    const parent = getRule(parts[0]);
    if (parent) crumbs.push({ label: parent.title, href: `#rule-${parent.id}` });
  }
  if (parts.length > 2) {
    const mid = getRule(parts.slice(0, 2).join('.'));
    if (mid) crumbs.push({ label: mid.title, href: `#rule-${mid.id}` });
  }
  crumbs.push({ label: `${rule.id} ${rule.title}`, href: null });
  return crumbs;
}

function renderScenario(id) {
  const scenario = getScenario(id);
  if (!scenario) { renderNotFound(); return; }
  showView('scenarioView');

  document.getElementById('scenarioNum').textContent = scenario.id;
  const rule = getRule(scenario.rule_ref);
  document.getElementById('scenarioOrigin').innerHTML =
    `Origin: <a href="#rule-${scenario.rule_ref}">Section ${scenario.rule_ref}${rule ? ' - ' + rule.title : ''}</a>`;

  document.getElementById('scenarioText').querySelector('p').textContent = scenario.scenario;

  const outcomeBlock = document.getElementById('scenarioOutcome');
  const badge = outcomeBlock.querySelector('.verdict-badge');
  const isPenalty = /penaliz|expelled|expulsion/i.test(scenario.outcome) ||
    (/penalty/i.test(scenario.outcome) && !/no penalty/i.test(scenario.outcome));
  outcomeBlock.className = 'scenario-block outcome-block' + (isPenalty ? ' pen' : '');
  const outcomeTextEl = document.getElementById('scenarioOutcomeText');
  outcomeTextEl.textContent = scenario.outcome;

  document.getElementById('scenarioRationale').querySelector('p').textContent = scenario.rationale;

  const kimEl   = document.getElementById('scenarioKIM');
  const kimList = document.getElementById('scenarioKIMList');
  kimList.innerHTML = '';
  if (scenario.keep_in_mind && scenario.keep_in_mind.length) {
    kimEl.hidden = false;
    scenario.keep_in_mind.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      kimList.appendChild(li);
    });
  } else {
    kimEl.hidden = true;
  }

  const siblings = getScenariosForRule(scenario.rule_ref);
  const idx = siblings.findIndex(s => s.id === id);
  const prevEl = document.getElementById('prevScenario');
  const nextEl = document.getElementById('nextScenario');
  const backEl = document.getElementById('backToRule');
  backEl.href = `#rule-${scenario.rule_ref}`;
  backEl.textContent = `↑ Back to Rule ${scenario.rule_ref}`;
  prevEl.hidden = idx <= 0;
  nextEl.hidden = idx >= siblings.length - 1;
  if (idx > 0) { prevEl.href = `#scenario-${siblings[idx-1].id}`; prevEl.textContent = `← ${siblings[idx-1].id}`; }
  if (idx < siblings.length - 1) { nextEl.href = `#scenario-${siblings[idx+1].id}`; nextEl.textContent = `${siblings[idx+1].id} →`; }

  const crumbs = [{ label: 'Rules', href: '#rule-1' }];
  if (rule) crumbs.push({ label: `${rule.id} ${rule.title}`, href: `#rule-${rule.id}` });
  crumbs.push({ label: scenario.id, href: null });
  setBreadcrumb(crumbs);
  document.title = `${scenario.id} - The Bridge`;
}

function renderGlossaryTerm(id) {
  const term = getGlossaryTerm(id);
  const glossaryView = document.getElementById('glossaryView');
  if (!term || !glossaryView) { renderNotFound(); return; }
  showView('glossaryView');

  document.getElementById('glossaryTerm').textContent = term.term;
  document.getElementById('glossaryDef').textContent = term.definition;
  const termListEl = document.getElementById('glossaryView').querySelector('.term-list');
  if (termListEl) termListEl.querySelector('.block-label').style.display = '';
  const refsEl = document.getElementById('glossaryRuleRefs');
  refsEl.style.display = '';
  refsEl.innerHTML = '';
  (term.rule_refs || []).forEach(ref => {
    const rule = getRule(ref);
    const a = document.createElement('a');
    a.href = `#rule-${ref}`;
    a.className = 'term-chip';
    a.textContent = rule ? `${ref} ${rule.title}` : ref;
    refsEl.appendChild(a);
  });

  setBreadcrumb([{ label: 'Glossary', href: '#glossary' }, { label: term.term, href: null }]);
  document.title = `${term.term} - The Bridge`;
}

function renderGlossaryIndex() {
  const glossaryView = document.getElementById('glossaryView');
  if (!glossaryView) return;
  showView('glossaryView');

  document.getElementById('glossaryTerm').textContent = 'Glossary';
  document.getElementById('glossaryDef').textContent = '';
  const termListEl = document.getElementById('glossaryView').querySelector('.term-list');
  if (termListEl) termListEl.querySelector('.block-label').style.display = 'none';

  const refsEl = document.getElementById('glossaryRuleRefs');
  refsEl.innerHTML = '';
  refsEl.style.display = 'block';

  const grouped = {};
  data.glossary.forEach(term => {
    const letter = term.term[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(term);
  });

  Object.keys(grouped).sort().forEach(letter => {
    const section = document.createElement('div');
    section.className = 'glossary-group';

    const header = document.createElement('div');
    header.className = 'glossary-letter';
    header.textContent = letter;
    section.appendChild(header);

    const chips = document.createElement('div');
    chips.className = 'term-chips';
    grouped[letter].forEach(term => {
      const a = document.createElement('a');
      a.href = `#glossary-${term.id}`;
      a.className = 'term-chip';
      a.textContent = term.term;
      chips.appendChild(a);
    });
    section.appendChild(chips);
    refsEl.appendChild(section);
  });

  setBreadcrumb([{ label: 'Glossary', href: null }]);
  document.title = 'Glossary - The Bridge';
}

function renderCasebookIndex() {
  showView('ruleView');
  document.getElementById('ruleNum').textContent = 'CB';
  document.getElementById('ruleName').textContent = 'Casebook Index';
  document.getElementById('ruleText').innerHTML = '';
  document.getElementById('subBlocks').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';
  document.getElementById('termChips').innerHTML = '';
  document.getElementById('termList').hidden = true;
  document.getElementById('childRules').innerHTML = '';

  const chipsEl = document.getElementById('scenarioChips');
  const listEl  = document.getElementById('scenarioList');
  chipsEl.innerHTML = '';
  listEl.hidden = false;
  data.casebook.forEach(s => {
    const chip = document.createElement('a');
    chip.href = `#scenario-${s.id}`;
    chip.className = 'scenario-chip';
    chip.innerHTML = `<span class="chip-id">${s.id}</span><span class="chip-preview">${s.summary}</span>`;
    chipsEl.appendChild(chip);
  });

  setBreadcrumb([{ label: 'Casebook Index', href: null }]);
  document.title = 'Casebook Index - The Bridge';
}

function renderPenaltiesIndex() {
  showView('ruleView');
  document.getElementById('ruleNum').textContent = 'REF';
  document.getElementById('ruleName').textContent = 'Penalty Quick Reference';
  document.getElementById('ruleText').innerHTML = '';
  document.getElementById('scenarioList').hidden = true;
  document.getElementById('termList').hidden = true;
  document.getElementById('childRules').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';

  const subsEl = document.getElementById('subBlocks');
  subsEl.innerHTML = '';
  data.penalties.forEach(p => {
    const block = document.createElement('div');
    block.className = 'sub-block';
    block.id = `penalty-${p.id}`;
    block.innerHTML = `
      <div class="sub-block-title">
        <span class="penalty-code-inline">${p.code}</span>
        ${p.verbal_cue}
        ${(p.sub_types || []).map(s => `<span class="subtype-tag">${s}</span>`).join('')}
      </div>
      <div class="penalty-block-body${p.image ? ' has-image' : ''}">
        <div class="penalty-block-text">
          <p style="font-size:var(--size-sm);color:var(--text-mid);margin-bottom:8px">
            Rule: <a href="#rule-${p.rule_ref}">${p.rule_ref}</a>
          </p>
          <p>${p.description}</p>
          ${p.signal ? `
            <p class="signal-label" style="margin-top:12px">Hand Signal</p>
            <p class="signal-text">${p.signal}</p>
          ` : ''}
        </div>
        ${p.image ? `<div class="signal-img-wrap"><img src="${p.image}" alt="${p.verbal_cue} hand signal" class="signal-img"></div>` : ''}
      </div>
    `;
    subsEl.appendChild(block);
  });

  setBreadcrumb([{ label: 'Penalty Quick Reference', href: null }]);
  document.title = 'Penalty Quick Reference - The Bridge';
}

function renderNotFound() {
  showView('ruleView');
  document.getElementById('ruleNum').textContent = '?';
  document.getElementById('ruleName').textContent = 'Not found';
  document.getElementById('ruleText').innerHTML = '<p>That rule, scenario, or term could not be found.</p>';
  document.getElementById('subBlocks').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';
  document.getElementById('scenarioChips').innerHTML = '';
  document.getElementById('termChips').innerHTML = '';
  document.getElementById('childRules').innerHTML = '';
}

function setBreadcrumb(crumbs) {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = '';
  crumbs.forEach((crumb, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.textContent = '›';
      sep.style.color = 'var(--text-faint)';
      el.appendChild(sep);
    }
    if (crumb.href) {
      const a = document.createElement('a');
      a.href = crumb.href;
      a.textContent = crumb.label;
      el.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.textContent = crumb.label;
      el.appendChild(span);
    }
  });
}

// routing
function route() {
  const hash = window.location.hash || '';
  setActiveNavLink(hash);
  window.scrollTo(0, 0);

  if (!hash || hash === '#') {
    renderRule('1');
    return;
  }
  if (hash.startsWith('#rule-'))          renderRule(hash.replace('#rule-', ''));
  else if (hash.startsWith('#scenario-')) renderScenario(hash.replace('#scenario-', ''));
  else if (hash === '#glossary')          renderGlossaryIndex();
  else if (hash.startsWith('#glossary-')) renderGlossaryTerm(hash.replace('#glossary-', ''));
  else if (hash === '#casebook')          renderCasebookIndex();
  else if (hash === '#penalties')         renderPenaltiesIndex();
  else renderNotFound();
}

// search
function initSearch() {
  const items = [];
  data.rules.forEach(r => items.push({
    type: 'rule', id: r.id, title: r.title,
    body: [r.text, ...(r.named_subsections || []).map(s => s.text)].filter(Boolean).join(' '),
    href: `#rule-${r.id}`
  }));
  data.casebook.forEach(s => items.push({
    type: 'scenario', id: s.id, title: s.summary,
    body: [s.scenario, s.outcome, s.rationale].filter(Boolean).join(' '),
    href: `#scenario-${s.id}`
  }));
  data.glossary.forEach(g => items.push({
    type: 'glossary', id: g.id, title: g.term,
    body: g.definition, href: `#glossary-${g.id}`
  }));

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
  script.onload = () => {
    searchIndex = new Fuse(items, {
      keys: [{ name: 'id', weight: 0.4 }, { name: 'title', weight: 0.35 }, { name: 'body', weight: 0.25 }],
      threshold: 0.35,
      includeScore: true,
      minMatchCharLength: 2
    });
  };
  document.head.appendChild(script);

  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q || !searchIndex) { results.hidden = true; return; }
    const hits = searchIndex.search(q).slice(0, 8);
    results.innerHTML = '';
    if (!hits.length) {
      results.innerHTML = '<div class="search-empty">No results found.</div>';
      results.hidden = false;
      return;
    }
    hits.forEach(hit => {
      const item = hit.item;
      const div = document.createElement('div');
      div.className = 'search-result-item';
      const label = item.type === 'rule' ? 'Rule' : item.type === 'scenario' ? 'Casebook' : 'Glossary';
      div.innerHTML = `<span class="result-id">${label} ${item.id}</span><span class="result-title">${item.title}</span>`;
      div.addEventListener('click', () => {
        window.location.hash = item.href.replace('#', '');
        input.value = '';
        results.hidden = true;
      });
      results.appendChild(div);
    });
    results.hidden = false;
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) results.hidden = true;
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.hidden = true; input.blur(); }
  });
}

// ui controls
function initControls() {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('mainContent');

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
  });

  const fontBtns = {
    small:  document.getElementById('fontSmall'),
    medium: document.getElementById('fontMed'),
    large:  document.getElementById('fontLarge')
  };
  function setSize(sz) {
    document.documentElement.setAttribute('data-fontsize', sz);
    Object.keys(fontBtns).forEach(k => fontBtns[k].classList.toggle('on', k === sz));
    localStorage.setItem('rules-sz', sz);
  }
  fontBtns.small.onclick  = () => setSize('small');
  fontBtns.medium.onclick = () => setSize('medium');
  fontBtns.large.onclick  = () => setSize('large');
  setSize(localStorage.getItem('rules-sz') || 'medium');

  const themeBtn = document.getElementById('themeBtn');
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.textContent = t === 'dark' ? '☀' : '☾';
    themeBtn.classList.toggle('on', t === 'dark');
    localStorage.setItem('rules-theme', t);
  }
  themeBtn.onclick = () => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };
  setTheme(document.documentElement.getAttribute('data-theme') || 'light');
}

// boot
document.addEventListener('DOMContentLoaded', async () => {
  initControls();
  try {
    await loadData();
    buildSidebar();
    initSearch();
    route();
    window.addEventListener('hashchange', route);
  } catch(err) {
    console.error('Failed to load data:', err);
    document.getElementById('ruleName').textContent = 'Error loading data';
    document.getElementById('ruleText').innerHTML =
      '<p>Could not load data. Make sure you are running this through Live Server, not opening the file directly.</p>';
  }
});