// the bridge — flat track roller derby reference

// apply theme before paint
(function() {
  var t = localStorage.getItem('rules-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
})();

// --- state ---
var data = { rules: [], casebook: [], glossary: [], penalties: [] };
var searchIndex = null;

// --- load data ---
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

// --- lookup helpers ---
function getRule(id) {
  return data.rules.find(r => r.id === id);
}
function getScenario(id) {
  return data.casebook.find(s => s.id === id);
}
function getGlossaryTerm(id) {
  return data.glossary.find(g => g.id === id);
}
function getPenalty(ruleRef) {
  return data.penalties.filter(p => p.rule_ref === ruleRef);
}
function getScenariosForRule(ruleId) {
  return data.casebook.filter(s => s.rule_ref === ruleId);
}

// --- sidebar ---
function buildSidebar() {
  const toc = document.getElementById('tocList');
  if (!toc) return;
  toc.innerHTML = '';

  // group rules by top-level section
  const sections = data.rules.filter(r => !r.id.includes('.'));

  sections.forEach(section => {
    const li = document.createElement('li');

    const topLink = document.createElement('a');
    topLink.href = `#rule-${section.id}`;
    topLink.className = 'nav-link top';
    topLink.textContent = `${section.id}. ${section.title}`;
    li.appendChild(topLink);

    // children - direct subsections only (one level deep for top sections)
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

        // indent deeper sub-subsections (e.g. 1.3.1)
        const depth = child.id.split('.').length;
        if (depth > 2) link.style.paddingLeft = '38px';

        link.textContent = `${child.id} ${child.title}`;
        cli.appendChild(link);

        // add grandchildren (e.g. 4.4.1, 4.4.2)
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

  // reference section links are static in the HTML, leave them
}

function setActiveNavLink(hash) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (!hash) return;

  // for scenarios, highlight the parent rule
  let target = hash;
  if (hash.startsWith('#scenario-')) {
    const id = hash.replace('#scenario-', '');
    const scenario = getScenario(id);
    if (scenario) target = `#rule-${scenario.rule_ref}`;
  }

  const link = document.querySelector(`a[href="${target}"]`);
  if (link) link.classList.add('active');
}

// --- render rule ---
function renderRule(id) {
  const rule = getRule(id);
  if (!rule) { renderNotFound(); return; }

  hideLanding();
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;

  // header
  document.getElementById('ruleNum').textContent = rule.id;
  document.getElementById('ruleName').textContent = rule.title;

  // breadcrumb
  setBreadcrumb(buildRuleBreadcrumb(rule));

  // body text
  const bodyEl = document.getElementById('ruleText');
  bodyEl.innerHTML = '';
  if (rule.text) {
    const p = document.createElement('p');
    p.textContent = rule.text;
    bodyEl.appendChild(p);
  }

  // named subsections
  const subsEl = document.getElementById('subBlocks');
  subsEl.innerHTML = '';
  if (rule.named_subsections && rule.named_subsections.length) {
    rule.named_subsections.forEach(sub => {
      const block = document.createElement('div');
      block.className = 'sub-block';
      block.innerHTML = `<div class="sub-block-title">${sub.name}</div><p>${sub.text}</p>`;
      subsEl.appendChild(block);
    });
  }

  // penalty reference
  const penaltyEl = document.getElementById('penaltyRef');
  penaltyEl.innerHTML = '';
  if (rule.penalty_ref) {
    const penalties = getPenalty(rule.penalty_ref);
    if (penalties.length) {
      penalties.forEach(p => {
        const tag = document.createElement('div');
        tag.className = 'penalty-tag';
        tag.innerHTML = `
          <span class="lbl">Penalty</span>
          <span class="code">${p.code}</span>
          <span class="name">${p.verbal_cue}</span>
        `;
        penaltyEl.appendChild(tag);
      });
    }
  }

  // casebook scenarios
  const scenarioListEl = document.getElementById('scenarioList');
  const scenarioChipsEl = document.getElementById('scenarioChips');
  scenarioChipsEl.innerHTML = '';
  const scenarios = getScenariosForRule(rule.id);
  scenarioListEl.hidden = scenarios.length === 0;
  scenarios.forEach(s => {
    const chip = document.createElement('a');
    chip.href = `#scenario-${s.id}`;
    chip.className = 'scenario-chip';
    chip.innerHTML = `
      <span class="chip-id">${s.id}</span>
      <span class="chip-preview">${s.summary}</span>
    `;
    scenarioChipsEl.appendChild(chip);
  });

  // glossary terms
  const termListEl = document.getElementById('termList');
  const termChipsEl = document.getElementById('termChips');
  termChipsEl.innerHTML = '';
  const terms = (rule.glossary_refs || [])
    .map(id => getGlossaryTerm(id))
    .filter(Boolean);
  termListEl.hidden = terms.length === 0;
  terms.forEach(term => {
    const chip = document.createElement('a');
    chip.href = `#glossary-${term.id}`;
    chip.className = 'term-chip';
    chip.textContent = term.term;
    termChipsEl.appendChild(chip);
  });

  // numbered child rules (listed below if section header)
  const childRulesEl = document.getElementById('childRules');
  if (childRulesEl) {
    childRulesEl.innerHTML = '';
    if (!rule.text) {
      // this is a section header — list its children
      const children = data.rules.filter(r => {
        const parts = r.id.split('.');
        const parentParts = rule.id.split('.');
        return r.id.startsWith(rule.id + '.') && parts.length === parentParts.length + 1;
      });
      children.forEach(child => {
        const link = document.createElement('a');
        link.href = `#rule-${child.id}`;
        link.className = 'child-rule-link';
        link.innerHTML = `<span class="child-rule-num">${child.id}</span> ${child.title}`;
        childRulesEl.appendChild(link);
      });
    }
  }

  document.title = `${rule.id} ${rule.title} — The Bridge`;
}

function buildRuleBreadcrumb(rule) {
  const parts = rule.id.split('.');
  const crumbs = [{ label: 'Rules', href: '#rule-1' }];

  // add parent section if we're in a subsection
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

// --- render scenario ---
function renderScenario(id) {
  const scenario = getScenario(id);
  if (!scenario) { renderNotFound(); return; }

  hideLanding();
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = false;
  document.getElementById('glossaryView').hidden = true;

  // header
  document.getElementById('scenarioNum').textContent = scenario.id;

  const originEl = document.getElementById('scenarioOrigin');
  const rule = getRule(scenario.rule_ref);
  originEl.innerHTML = `Origin: <a href="#rule-${scenario.rule_ref}">Section ${scenario.rule_ref}${rule ? ' — ' + rule.title : ''}</a>`;

  // scenario text
  document.getElementById('scenarioText').querySelector('p').textContent = scenario.scenario;

  // outcome
  const outcomeBlock = document.getElementById('scenarioOutcome');
  const badge = outcomeBlock.querySelector('.verdict-badge');
  const outcomeText = document.getElementById('scenarioOutcomeText');

  const isPenalty = scenario.outcome.toLowerCase().includes('penaliz') ||
                    scenario.outcome.toLowerCase().includes('expelled') ||
                    scenario.outcome.toLowerCase().includes('penalty');

  outcomeBlock.className = 'scenario-block outcome-block' + (isPenalty ? ' pen' : '');
  badge.className = 'verdict-badge ' + (isPenalty ? 'verdict-pen' : 'verdict-none');
  badge.textContent = isPenalty ? 'Penalty' : 'No penalty';
  outcomeText.textContent = scenario.outcome;

  // rationale
  document.getElementById('scenarioRationale').querySelector('p').textContent = scenario.rationale;

  // keep in mind
  const kimEl = document.getElementById('scenarioKIM');
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

  // prev / next scenario navigation
  const siblings = getScenariosForRule(scenario.rule_ref);
  const idx = siblings.findIndex(s => s.id === id);

  const prevEl = document.getElementById('prevScenario');
  const nextEl = document.getElementById('nextScenario');
  const backEl = document.getElementById('backToRule');

  backEl.href = `#rule-${scenario.rule_ref}`;
  backEl.textContent = `↑ Back to Rule ${scenario.rule_ref}`;

  if (idx > 0) {
    prevEl.href = `#scenario-${siblings[idx - 1].id}`;
    prevEl.textContent = `← ${siblings[idx - 1].id}`;
    prevEl.hidden = false;
  } else {
    prevEl.hidden = true;
  }

  if (idx < siblings.length - 1) {
    nextEl.href = `#scenario-${siblings[idx + 1].id}`;
    nextEl.textContent = `${siblings[idx + 1].id} →`;
    nextEl.hidden = false;
  } else {
    nextEl.hidden = true;
  }

  // breadcrumb
  const crumbs = [
    { label: 'Rules', href: '#rule-1' },
  ];
  if (rule) crumbs.push({ label: `${rule.id} ${rule.title}`, href: `#rule-${rule.id}` });
  crumbs.push({ label: scenario.id, href: null });
  setBreadcrumb(crumbs);

  document.title = `${scenario.id} — The Bridge`;
}

// --- render glossary term ---
function renderGlossaryTerm(id) {
  const term = getGlossaryTerm(id);
  const glossaryView = document.getElementById('glossaryView');
  if (!term || !glossaryView) { renderNotFound(); return; }

  hideLanding();
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = true;
  glossaryView.hidden = false;

  document.getElementById('glossaryTerm').textContent = term.term;
  document.getElementById('glossaryDef').textContent = term.definition;

  const refsEl = document.getElementById('glossaryRuleRefs');
  refsEl.innerHTML = '';
  (term.rule_refs || []).forEach(ref => {
    const rule = getRule(ref);
    const a = document.createElement('a');
    a.href = `#rule-${ref}`;
    a.className = 'term-chip';
    a.textContent = rule ? `${ref} ${rule.title}` : ref;
    refsEl.appendChild(a);
  });

  setBreadcrumb([
    { label: 'Glossary', href: '#glossary' },
    { label: term.term, href: null }
  ]);

  document.title = `${term.term} — The Bridge`;
}

// --- render glossary index ---
function renderGlossaryIndex() {
  const glossaryView = document.getElementById('glossaryView');
  if (!glossaryView) return;

  hideLanding();
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = true;
  glossaryView.hidden = false;

  document.getElementById('glossaryTerm').textContent = 'Glossary';
  document.getElementById('glossaryDef').textContent = '';

  const refsEl = document.getElementById('glossaryRuleRefs');
  refsEl.innerHTML = '';

  // render all terms as chips linking to their detail view
  data.glossary.forEach(term => {
    const a = document.createElement('a');
    a.href = `#glossary-${term.id}`;
    a.className = 'term-chip';
    a.textContent = term.term;
    refsEl.appendChild(a);
  });

  setBreadcrumb([{ label: 'Glossary', href: null }]);
  document.title = 'Glossary — The Bridge';
}

// --- render not found ---
function renderNotFound() {
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;
  document.getElementById('ruleNum').textContent = '?';
  document.getElementById('ruleName').textContent = 'Page not found';
  document.getElementById('ruleText').innerHTML = '<p>That rule, scenario, or term could not be found. Try searching or using the sidebar.</p>';
  document.getElementById('subBlocks').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';
  document.getElementById('scenarioChips').innerHTML = '';
  document.getElementById('termChips').innerHTML = '';
}

// --- breadcrumb ---
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

// --- landing page ---
function showLanding() {
  document.getElementById('landingView').hidden = false;
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;
  // hide sidebar on landing
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('mainContent').classList.add('wide');
  document.title = 'The Bridge — Flat Track Roller Derby Reference';
  setBreadcrumb([{ label: 'Home', href: null }]);
}

function hideLanding() {
  const landing = document.getElementById('landingView');
  if (!landing.hidden) {
    landing.hidden = true;
    // restore sidebar
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('mainContent').classList.remove('wide');
  }
}

// --- routing ---
function route() {
  const hash = window.location.hash || '';
  setActiveNavLink(hash);
  window.scrollTo(0, 0);

  if (!hash || hash === '#' || hash === '#home') {
    showLanding();
    return;
  }

  if (hash.startsWith('#rule-')) {
    renderRule(hash.replace('#rule-', ''));
  } else if (hash.startsWith('#scenario-')) {
    renderScenario(hash.replace('#scenario-', ''));
  } else if (hash === '#glossary') {
    renderGlossaryIndex();
  } else if (hash.startsWith('#glossary-')) {
    renderGlossaryTerm(hash.replace('#glossary-', ''));
  } else if (hash === '#casebook') {
    renderCasebookIndex();
  } else if (hash === '#penalties') {
    renderPenaltiesIndex();
  } else {
    renderNotFound();
  }
}

// --- casebook index ---
function renderCasebookIndex() {
  hideLanding();
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;

  document.getElementById('ruleNum').textContent = 'CB';
  document.getElementById('ruleName').textContent = 'Casebook Index';
  document.getElementById('ruleText').innerHTML = '<p>All casebook scenarios, grouped by rule section.</p>';
  document.getElementById('subBlocks').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';
  document.getElementById('termChips').innerHTML = '';

  const chipsEl = document.getElementById('scenarioChips');
  const listEl = document.getElementById('scenarioList');
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
  document.title = 'Casebook Index — The Bridge';
}

// --- penalties index ---
function renderPenaltiesIndex() {
  hideLanding();
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;

  document.getElementById('ruleNum').textContent = 'REF';
  document.getElementById('ruleName').textContent = 'Penalty Quick Reference';
  document.getElementById('ruleText').innerHTML = '';
  document.getElementById('scenarioList').hidden = true;
  document.getElementById('termList').hidden = true;

  const subsEl = document.getElementById('subBlocks');
  subsEl.innerHTML = '';

  const penaltyEl = document.getElementById('penaltyRef');
  penaltyEl.innerHTML = '';

  data.penalties.forEach(p => {
    const block = document.createElement('div');
    block.className = 'sub-block';
    block.innerHTML = `
      <div class="sub-block-title">
        <span class="penalty-code-inline">${p.code}</span>
        ${p.verbal_cue}
        ${p.sub_types ? p.sub_types.map(s => `<span class="subtype-tag">${s}</span>`).join('') : ''}
      </div>
      <p>${p.description}</p>
      <p style="margin-top:8px;font-size:var(--size-sm);color:var(--text-mid);">
        Rule: <a href="#rule-${p.rule_ref}">${p.rule_ref}</a>
      </p>
    `;
    subsEl.appendChild(block);
  });

  setBreadcrumb([{ label: 'Penalty Quick Reference', href: null }]);
  document.title = 'Penalty Quick Reference — The Bridge';
}

// --- search ---
function initSearch() {
  // build a flat list of all searchable items
  const items = [];

  data.rules.forEach(r => {
    items.push({
      type: 'rule',
      id: r.id,
      title: r.title,
      body: [r.text, ...(r.named_subsections || []).map(s => s.text)].filter(Boolean).join(' '),
      href: `#rule-${r.id}`
    });
  });

  data.casebook.forEach(s => {
    items.push({
      type: 'scenario',
      id: s.id,
      title: s.summary,
      body: [s.scenario, s.outcome, s.rationale].filter(Boolean).join(' '),
      href: `#scenario-${s.id}`
    });
  });

  data.glossary.forEach(g => {
    items.push({
      type: 'glossary',
      id: g.id,
      title: g.term,
      body: g.definition,
      href: `#glossary-${g.id}`
    });
  });

  // load fuse.js then init
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
  script.onload = () => {
    searchIndex = new Fuse(items, {
      keys: [
        { name: 'id',    weight: 0.4 },
        { name: 'title', weight: 0.35 },
        { name: 'body',  weight: 0.25 }
      ],
      threshold: 0.35,
      includeScore: true,
      minMatchCharLength: 2
    });
    initLandingSearch();
  };
  document.head.appendChild(script);

  const input  = document.getElementById('searchInput');
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

      const typeLabel = item.type === 'rule' ? 'Rule' :
                        item.type === 'scenario' ? 'Casebook' : 'Glossary';

      div.innerHTML = `
        <span class="result-id">${typeLabel} ${item.id}</span>
        <span class="result-title">${item.title}</span>
      `;
      div.addEventListener('click', () => {
        window.location.hash = item.href.replace('#', '');
        input.value = '';
        results.hidden = true;
      });
      results.appendChild(div);
    });

    results.hidden = false;
  });

  // close results when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) results.hidden = true;
  });

  // close on escape
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.hidden = true; input.blur(); }
  });
}

// --- ui controls ---
function initControls() {
  // sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('mainContent');
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('open');
    content.classList.toggle('wide');
  });

  // font size
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

  // theme
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
  // sync button text to already-applied theme
  setTheme(document.documentElement.getAttribute('data-theme') || 'light');

  // focus mode
  const focusBtn = document.getElementById('focusBtn');
  function setFocus(on) {
    document.body.classList.toggle('focus-mode', on);
    focusBtn.classList.toggle('on', on);
    focusBtn.setAttribute('aria-pressed', String(on));
    localStorage.setItem('rules-focus', on ? '1' : '0');
  }
  focusBtn.onclick = () => setFocus(!document.body.classList.contains('focus-mode'));
  if (localStorage.getItem('rules-focus') === '1') setFocus(true);
}

// --- boot ---
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
      '<p>Could not load the rules data. Make sure you are running this through Live Server, not by opening the file directly.</p>';
  }
});

// landing page search - wired up after fuse loads
function initLandingSearch() {
  const input   = document.getElementById('landingSearchInput');
  const results = document.getElementById('landingSearchResults');
  if (!input) return;

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
      const typeLabel = item.type === 'rule' ? 'Rule' :
                        item.type === 'scenario' ? 'Casebook' : 'Glossary';
      div.innerHTML = `
        <span class="result-id">${typeLabel} ${item.id}</span>
        <span class="result-title">${item.title}</span>
      `;
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
    if (!e.target.closest('.landing-search')) results.hidden = true;
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.hidden = true; input.blur(); }
  });
}// the bridge — flat track roller derby reference

// apply theme before paint
(function() {
  var t = localStorage.getItem('rules-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
})();

// --- state ---
var data = { rules: [], casebook: [], glossary: [], penalties: [] };
var searchIndex = null;

// --- load data ---
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

// --- lookup helpers ---
function getRule(id) {
  return data.rules.find(r => r.id === id);
}
function getScenario(id) {
  return data.casebook.find(s => s.id === id);
}
function getGlossaryTerm(id) {
  return data.glossary.find(g => g.id === id);
}
function getPenalty(ruleRef) {
  return data.penalties.filter(p => p.rule_ref === ruleRef);
}
function getScenariosForRule(ruleId) {
  return data.casebook.filter(s => s.rule_ref === ruleId);
}

// --- sidebar ---
function buildSidebar() {
  const toc = document.getElementById('tocList');
  if (!toc) return;
  toc.innerHTML = '';

  // group rules by top-level section
  const sections = data.rules.filter(r => !r.id.includes('.'));

  sections.forEach(section => {
    const li = document.createElement('li');

    const topLink = document.createElement('a');
    topLink.href = `#rule-${section.id}`;
    topLink.className = 'nav-link top';
    topLink.textContent = `${section.id}. ${section.title}`;
    li.appendChild(topLink);

    // children - direct subsections only (one level deep for top sections)
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

        // indent deeper sub-subsections (e.g. 1.3.1)
        const depth = child.id.split('.').length;
        if (depth > 2) link.style.paddingLeft = '38px';

        link.textContent = `${child.id} ${child.title}`;
        cli.appendChild(link);

        // add grandchildren (e.g. 4.4.1, 4.4.2)
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

  // reference section links are static in the HTML, leave them
}

function setActiveNavLink(hash) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (!hash) return;

  // for scenarios, highlight the parent rule
  let target = hash;
  if (hash.startsWith('#scenario-')) {
    const id = hash.replace('#scenario-', '');
    const scenario = getScenario(id);
    if (scenario) target = `#rule-${scenario.rule_ref}`;
  }

  const link = document.querySelector(`a[href="${target}"]`);
  if (link) link.classList.add('active');
}

// --- render rule ---
function renderRule(id) {
  const rule = getRule(id);
  if (!rule) { renderNotFound(); return; }

  hideLanding();
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;

  // header
  document.getElementById('ruleNum').textContent = rule.id;
  document.getElementById('ruleName').textContent = rule.title;

  // breadcrumb
  setBreadcrumb(buildRuleBreadcrumb(rule));

  // body text
  const bodyEl = document.getElementById('ruleText');
  bodyEl.innerHTML = '';
  if (rule.text) {
    const p = document.createElement('p');
    p.textContent = rule.text;
    bodyEl.appendChild(p);
  }

  // named subsections
  const subsEl = document.getElementById('subBlocks');
  subsEl.innerHTML = '';
  if (rule.named_subsections && rule.named_subsections.length) {
    rule.named_subsections.forEach(sub => {
      const block = document.createElement('div');
      block.className = 'sub-block';
      block.innerHTML = `<div class="sub-block-title">${sub.name}</div><p>${sub.text}</p>`;
      subsEl.appendChild(block);
    });
  }

  // penalty reference
  const penaltyEl = document.getElementById('penaltyRef');
  penaltyEl.innerHTML = '';
  if (rule.penalty_ref) {
    const penalties = getPenalty(rule.penalty_ref);
    if (penalties.length) {
      penalties.forEach(p => {
        const tag = document.createElement('div');
        tag.className = 'penalty-tag';
        tag.innerHTML = `
          <span class="lbl">Penalty</span>
          <span class="code">${p.code}</span>
          <span class="name">${p.verbal_cue}</span>
        `;
        penaltyEl.appendChild(tag);
      });
    }
  }

  // casebook scenarios
  const scenarioListEl = document.getElementById('scenarioList');
  const scenarioChipsEl = document.getElementById('scenarioChips');
  scenarioChipsEl.innerHTML = '';
  const scenarios = getScenariosForRule(rule.id);
  scenarioListEl.hidden = scenarios.length === 0;
  scenarios.forEach(s => {
    const chip = document.createElement('a');
    chip.href = `#scenario-${s.id}`;
    chip.className = 'scenario-chip';
    chip.innerHTML = `
      <span class="chip-id">${s.id}</span>
      <span class="chip-preview">${s.summary}</span>
    `;
    scenarioChipsEl.appendChild(chip);
  });

  // glossary terms
  const termListEl = document.getElementById('termList');
  const termChipsEl = document.getElementById('termChips');
  termChipsEl.innerHTML = '';
  const terms = (rule.glossary_refs || [])
    .map(id => getGlossaryTerm(id))
    .filter(Boolean);
  termListEl.hidden = terms.length === 0;
  terms.forEach(term => {
    const chip = document.createElement('a');
    chip.href = `#glossary-${term.id}`;
    chip.className = 'term-chip';
    chip.textContent = term.term;
    termChipsEl.appendChild(chip);
  });

  // numbered child rules (listed below if section header)
  const childRulesEl = document.getElementById('childRules');
  if (childRulesEl) {
    childRulesEl.innerHTML = '';
    if (!rule.text) {
      // this is a section header — list its children
      const children = data.rules.filter(r => {
        const parts = r.id.split('.');
        const parentParts = rule.id.split('.');
        return r.id.startsWith(rule.id + '.') && parts.length === parentParts.length + 1;
      });
      children.forEach(child => {
        const link = document.createElement('a');
        link.href = `#rule-${child.id}`;
        link.className = 'child-rule-link';
        link.innerHTML = `<span class="child-rule-num">${child.id}</span> ${child.title}`;
        childRulesEl.appendChild(link);
      });
    }
  }

  document.title = `${rule.id} ${rule.title} — The Bridge`;
}

function buildRuleBreadcrumb(rule) {
  const parts = rule.id.split('.');
  const crumbs = [{ label: 'Rules', href: '#rule-1' }];

  // add parent section if we're in a subsection
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

// --- render scenario ---
function renderScenario(id) {
  const scenario = getScenario(id);
  if (!scenario) { renderNotFound(); return; }

  hideLanding();
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = false;
  document.getElementById('glossaryView').hidden = true;

  // header
  document.getElementById('scenarioNum').textContent = scenario.id;

  const originEl = document.getElementById('scenarioOrigin');
  const rule = getRule(scenario.rule_ref);
  originEl.innerHTML = `Origin: <a href="#rule-${scenario.rule_ref}">Section ${scenario.rule_ref}${rule ? ' — ' + rule.title : ''}</a>`;

  // scenario text
  document.getElementById('scenarioText').querySelector('p').textContent = scenario.scenario;

  // outcome
  const outcomeBlock = document.getElementById('scenarioOutcome');
  const badge = outcomeBlock.querySelector('.verdict-badge');
  const outcomeText = document.getElementById('scenarioOutcomeText');

  const isPenalty = scenario.outcome.toLowerCase().includes('penaliz') ||
                    scenario.outcome.toLowerCase().includes('expelled') ||
                    scenario.outcome.toLowerCase().includes('penalty');

  outcomeBlock.className = 'scenario-block outcome-block' + (isPenalty ? ' pen' : '');
  badge.className = 'verdict-badge ' + (isPenalty ? 'verdict-pen' : 'verdict-none');
  badge.textContent = isPenalty ? 'Penalty' : 'No penalty';
  outcomeText.textContent = scenario.outcome;

  // rationale
  document.getElementById('scenarioRationale').querySelector('p').textContent = scenario.rationale;

  // keep in mind
  const kimEl = document.getElementById('scenarioKIM');
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

  // prev / next scenario navigation
  const siblings = getScenariosForRule(scenario.rule_ref);
  const idx = siblings.findIndex(s => s.id === id);

  const prevEl = document.getElementById('prevScenario');
  const nextEl = document.getElementById('nextScenario');
  const backEl = document.getElementById('backToRule');

  backEl.href = `#rule-${scenario.rule_ref}`;
  backEl.textContent = `↑ Back to Rule ${scenario.rule_ref}`;

  if (idx > 0) {
    prevEl.href = `#scenario-${siblings[idx - 1].id}`;
    prevEl.textContent = `← ${siblings[idx - 1].id}`;
    prevEl.hidden = false;
  } else {
    prevEl.hidden = true;
  }

  if (idx < siblings.length - 1) {
    nextEl.href = `#scenario-${siblings[idx + 1].id}`;
    nextEl.textContent = `${siblings[idx + 1].id} →`;
    nextEl.hidden = false;
  } else {
    nextEl.hidden = true;
  }

  // breadcrumb
  const crumbs = [
    { label: 'Rules', href: '#rule-1' },
  ];
  if (rule) crumbs.push({ label: `${rule.id} ${rule.title}`, href: `#rule-${rule.id}` });
  crumbs.push({ label: scenario.id, href: null });
  setBreadcrumb(crumbs);

  document.title = `${scenario.id} — The Bridge`;
}

// --- render glossary term ---
function renderGlossaryTerm(id) {
  const term = getGlossaryTerm(id);
  const glossaryView = document.getElementById('glossaryView');
  if (!term || !glossaryView) { renderNotFound(); return; }

  hideLanding();
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = true;
  glossaryView.hidden = false;

  document.getElementById('glossaryTerm').textContent = term.term;
  document.getElementById('glossaryDef').textContent = term.definition;

  const refsEl = document.getElementById('glossaryRuleRefs');
  refsEl.innerHTML = '';
  (term.rule_refs || []).forEach(ref => {
    const rule = getRule(ref);
    const a = document.createElement('a');
    a.href = `#rule-${ref}`;
    a.className = 'term-chip';
    a.textContent = rule ? `${ref} ${rule.title}` : ref;
    refsEl.appendChild(a);
  });

  setBreadcrumb([
    { label: 'Glossary', href: '#glossary' },
    { label: term.term, href: null }
  ]);

  document.title = `${term.term} — The Bridge`;
}

// --- render glossary index ---
function renderGlossaryIndex() {
  const glossaryView = document.getElementById('glossaryView');
  if (!glossaryView) return;

  hideLanding();
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = true;
  glossaryView.hidden = false;

  document.getElementById('glossaryTerm').textContent = 'Glossary';
  document.getElementById('glossaryDef').textContent = '';

  const refsEl = document.getElementById('glossaryRuleRefs');
  refsEl.innerHTML = '';

  // render all terms as chips linking to their detail view
  data.glossary.forEach(term => {
    const a = document.createElement('a');
    a.href = `#glossary-${term.id}`;
    a.className = 'term-chip';
    a.textContent = term.term;
    refsEl.appendChild(a);
  });

  setBreadcrumb([{ label: 'Glossary', href: null }]);
  document.title = 'Glossary — The Bridge';
}

// --- render not found ---
function renderNotFound() {
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;
  document.getElementById('ruleNum').textContent = '?';
  document.getElementById('ruleName').textContent = 'Page not found';
  document.getElementById('ruleText').innerHTML = '<p>That rule, scenario, or term could not be found. Try searching or using the sidebar.</p>';
  document.getElementById('subBlocks').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';
  document.getElementById('scenarioChips').innerHTML = '';
  document.getElementById('termChips').innerHTML = '';
}

// --- breadcrumb ---
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

// --- landing page ---
function showLanding() {
  document.getElementById('landingView').hidden = false;
  document.getElementById('ruleView').hidden = true;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;
  // hide sidebar on landing
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('mainContent').classList.add('wide');
  document.title = 'The Bridge — Flat Track Roller Derby Reference';
  setBreadcrumb([{ label: 'Home', href: null }]);
}

function hideLanding() {
  const landing = document.getElementById('landingView');
  if (!landing.hidden) {
    landing.hidden = true;
    // restore sidebar
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('mainContent').classList.remove('wide');
  }
}

// --- routing ---
function route() {
  const hash = window.location.hash || '';
  setActiveNavLink(hash);
  window.scrollTo(0, 0);

  if (!hash || hash === '#' || hash === '#home') {
    showLanding();
    return;
  }

  if (hash.startsWith('#rule-')) {
    renderRule(hash.replace('#rule-', ''));
  } else if (hash.startsWith('#scenario-')) {
    renderScenario(hash.replace('#scenario-', ''));
  } else if (hash === '#glossary') {
    renderGlossaryIndex();
  } else if (hash.startsWith('#glossary-')) {
    renderGlossaryTerm(hash.replace('#glossary-', ''));
  } else if (hash === '#casebook') {
    renderCasebookIndex();
  } else if (hash === '#penalties') {
    renderPenaltiesIndex();
  } else {
    renderNotFound();
  }
}

// --- casebook index ---
function renderCasebookIndex() {
  hideLanding();
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;

  document.getElementById('ruleNum').textContent = 'CB';
  document.getElementById('ruleName').textContent = 'Casebook Index';
  document.getElementById('ruleText').innerHTML = '<p>All casebook scenarios, grouped by rule section.</p>';
  document.getElementById('subBlocks').innerHTML = '';
  document.getElementById('penaltyRef').innerHTML = '';
  document.getElementById('termChips').innerHTML = '';

  const chipsEl = document.getElementById('scenarioChips');
  const listEl = document.getElementById('scenarioList');
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
  document.title = 'Casebook Index — The Bridge';
}

// --- penalties index ---
function renderPenaltiesIndex() {
  hideLanding();
  document.getElementById('ruleView').hidden = false;
  document.getElementById('scenarioView').hidden = true;
  document.getElementById('glossaryView').hidden = true;

  document.getElementById('ruleNum').textContent = 'REF';
  document.getElementById('ruleName').textContent = 'Penalty Quick Reference';
  document.getElementById('ruleText').innerHTML = '';
  document.getElementById('scenarioList').hidden = true;
  document.getElementById('termList').hidden = true;

  const subsEl = document.getElementById('subBlocks');
  subsEl.innerHTML = '';

  const penaltyEl = document.getElementById('penaltyRef');
  penaltyEl.innerHTML = '';

  data.penalties.forEach(p => {
    const block = document.createElement('div');
    block.className = 'sub-block';
    block.innerHTML = `
      <div class="sub-block-title">
        <span class="penalty-code-inline">${p.code}</span>
        ${p.verbal_cue}
        ${p.sub_types ? p.sub_types.map(s => `<span class="subtype-tag">${s}</span>`).join('') : ''}
      </div>
      <p>${p.description}</p>
      <p style="margin-top:8px;font-size:var(--size-sm);color:var(--text-mid);">
        Rule: <a href="#rule-${p.rule_ref}">${p.rule_ref}</a>
      </p>
    `;
    subsEl.appendChild(block);
  });

  setBreadcrumb([{ label: 'Penalty Quick Reference', href: null }]);
  document.title = 'Penalty Quick Reference — The Bridge';
}

// --- search ---
function initSearch() {
  // build a flat list of all searchable items
  const items = [];

  data.rules.forEach(r => {
    items.push({
      type: 'rule',
      id: r.id,
      title: r.title,
      body: [r.text, ...(r.named_subsections || []).map(s => s.text)].filter(Boolean).join(' '),
      href: `#rule-${r.id}`
    });
  });

  data.casebook.forEach(s => {
    items.push({
      type: 'scenario',
      id: s.id,
      title: s.summary,
      body: [s.scenario, s.outcome, s.rationale].filter(Boolean).join(' '),
      href: `#scenario-${s.id}`
    });
  });

  data.glossary.forEach(g => {
    items.push({
      type: 'glossary',
      id: g.id,
      title: g.term,
      body: g.definition,
      href: `#glossary-${g.id}`
    });
  });

  // load fuse.js then init
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
  script.onload = () => {
    searchIndex = new Fuse(items, {
      keys: [
        { name: 'id',    weight: 0.4 },
        { name: 'title', weight: 0.35 },
        { name: 'body',  weight: 0.25 }
      ],
      threshold: 0.35,
      includeScore: true,
      minMatchCharLength: 2
    });
    initLandingSearch();
  };
  document.head.appendChild(script);

  const input  = document.getElementById('searchInput');
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

      const typeLabel = item.type === 'rule' ? 'Rule' :
                        item.type === 'scenario' ? 'Casebook' : 'Glossary';

      div.innerHTML = `
        <span class="result-id">${typeLabel} ${item.id}</span>
        <span class="result-title">${item.title}</span>
      `;
      div.addEventListener('click', () => {
        window.location.hash = item.href.replace('#', '');
        input.value = '';
        results.hidden = true;
      });
      results.appendChild(div);
    });

    results.hidden = false;
  });

  // close results when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) results.hidden = true;
  });

  // close on escape
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.hidden = true; input.blur(); }
  });
}

// --- ui controls ---
function initControls() {
  // sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('mainContent');
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('open');
    content.classList.toggle('wide');
  });

  // font size
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

  // theme
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
  // sync button text to already-applied theme
  setTheme(document.documentElement.getAttribute('data-theme') || 'light');


}

// --- boot ---
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
      '<p>Could not load the rules data. Make sure you are running this through Live Server, not by opening the file directly.</p>';
  }
});

// landing page search - wired up after fuse loads
function initLandingSearch() {
  const input   = document.getElementById('landingSearchInput');
  const results = document.getElementById('landingSearchResults');
  if (!input) return;

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
      const typeLabel = item.type === 'rule' ? 'Rule' :
                        item.type === 'scenario' ? 'Casebook' : 'Glossary';
      div.innerHTML = `
        <span class="result-id">${typeLabel} ${item.id}</span>
        <span class="result-title">${item.title}</span>
      `;
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
    if (!e.target.closest('.landing-search')) results.hidden = true;
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.hidden = true; input.blur(); }
  });
}