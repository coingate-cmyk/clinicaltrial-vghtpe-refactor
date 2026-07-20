(function (root) {
    'use strict';

    const app = root.ClinicalTrialApp;
    const core = app.core;
    const search = app.search;
    const parsing = app.parsing;
    const repositories = app.repositories;
    const STORAGE_KEY = 'clinicaltrial-vghtpe-refactor.trials.v2';
    const synthetic = (root.ClinicalTrialSyntheticData || []).map((trial) => parsing.prepareCandidate(trial).trial);

    const state = {
        repository: null,
        trials: [],
        query: '',
        cancer: '',
        line: '',
        status: '',
        activeOnly: false,
        selectedTrialKey: '',
        importPlan: null
    };

    const el = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const STATUS_LABELS = { recruiting: '收案中', pending: '準備中', temporarily_closed: '暫停收案', closed: '停止收案', unknown: '狀態未知' };

    function isActiveTrial(trial) {
        if (typeof trial.active === 'boolean') return trial.active;
        return ['recruiting', 'pending'].includes(trial.status);
    }

    function uniqueSorted(values) {
        return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    }

    function fillSelect(select, values, firstLabel) {
        const selected = select.value;
        select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        if (values.includes(selected)) select.value = selected;
    }

    function refreshFilterOptions() {
        fillSelect(el('cancerFilter'), uniqueSorted(state.trials.flatMap((trial) => (trial.cancerTypes || []).map((entry) => entry.type))), '全部癌別');
        fillSelect(el('lineFilter'), uniqueSorted(state.trials.flatMap((trial) => trial.treatmentLines || [])), '全部線別');
        fillSelect(el('statusFilter'), uniqueSorted(state.trials.map((trial) => trial.status)), '全部狀態');
    }

    function queryResults() {
        const searched = state.query.trim()
            ? search.searchTrials(state.trials, state.query)
            : state.trials.map((trial, index) => ({ trial, index, result: { score: 0, reasons: [] } }));
        return searched.filter(({ trial }) => {
            if (state.cancer && !(trial.cancerTypes || []).some((entry) => entry.type === state.cancer)) return false;
            if (state.line && !(trial.treatmentLines || []).includes(state.line)) return false;
            if (state.status && trial.status !== state.status) return false;
            if (state.activeOnly && !isActiveTrial(trial)) return false;
            return true;
        });
    }

    function biomarkerReason(reason) {
        if (!reason || reason.type !== 'biomarker') return '';
        const evidence = (reason.evidence || [])[0];
        if (!evidence) return `HER2：${escapeHtml(reason.summary || reason.status)}`;
        const roleLabel = { eligibility: '收案條件', exclusion: '排除條件', 'treatment-history': '治療史', descriptive: '描述' }[evidence.role] || evidence.role;
        return `${escapeHtml(roleLabel)}｜${escapeHtml(evidence.evidence)}`;
    }

    function textReason(reason) {
        if (!reason || reason.type !== 'text') return '';
        const labels = { code: '試驗代號', title: '試驗名稱', cancerType: '癌別', treatmentLines: '線別', interventions: '治療', sponsor: 'Sponsor', pi: 'PI', nurse: '研究護理師', summary: '摘要', notes: '備註', inclusion: '收案條件', exclusion: '排除條件' };
        return `${labels[reason.field] || reason.field}符合「${escapeHtml(reason.term)}」`;
    }

    function cardHtml(item) {
        const trial = item.trial;
        const key = core.trialIdentityKey(trial);
        const cancers = (trial.cancerTypes || []).map((entry) => `<span class="badge">${escapeHtml(entry.type)}</span>`).join('');
        const lines = (trial.treatmentLines || []).map((line) => `<span class="badge">${escapeHtml(line)}</span>`).join('');
        const reason = (item.result.reasons || []).map((entry) => entry.type === 'biomarker' ? biomarkerReason(entry) : textReason(entry)).filter(Boolean)[0];
        const contacts = [trial.contacts && trial.contacts.pi ? `PI：${trial.contacts.pi}` : '', trial.contacts && trial.contacts.nurse ? `Coordinator：${trial.contacts.nurse}` : ''].filter(Boolean).join('　');
        return `<article class="trial-card" data-key="${escapeHtml(key)}">
          <div>
            <div class="code">${escapeHtml(trial.code || 'NO CODE')}</div>
            <h2 class="card-title">${escapeHtml(trial.title || '未命名試驗')}</h2>
            <div class="badges"><span class="badge status-${escapeHtml(trial.status)}">${escapeHtml(STATUS_LABELS[trial.status] || trial.status)}</span>${cancers}${lines}</div>
            <p class="card-meta">${escapeHtml([trial.sponsor, trial.phase ? `Phase ${trial.phase}` : '', contacts].filter(Boolean).join('　｜　'))}</p>
            ${reason ? `<div class="match-box">搜尋命中原因：${reason}</div>` : ''}
          </div>
          <div class="card-side"><button class="ghost" data-action="view" data-key="${escapeHtml(key)}">查看</button><button class="secondary" data-action="edit" data-key="${escapeHtml(key)}">編輯</button></div>
        </article>`;
    }

    function render() {
        refreshFilterOptions();
        const results = queryResults();
        el('resultSummary').textContent = `顯示 ${results.length} / ${state.trials.length} 筆試驗`;
        const activeCount = state.trials.filter(isActiveTrial).length;
        el('statList').innerHTML = `<span class="stat">可收案／準備中 ${activeCount}</span><span class="stat">癌別 ${uniqueSorted(state.trials.flatMap((trial) => (trial.cancerTypes || []).map((entry) => entry.type))).length}</span>`;
        el('trialGrid').innerHTML = results.length ? results.map(cardHtml).join('') : '<div class="empty">沒有符合目前搜尋與篩選條件的試驗。</div>';
    }

    async function reload() {
        state.trials = await state.repository.list();
        render();
    }

    function findTrial(key) {
        return state.trials.find((trial) => core.trialIdentityKey(trial) === key) || null;
    }

    function openDetail(key) {
        const trial = findTrial(key);
        if (!trial) return;
        state.selectedTrialKey = key;
        el('detailTitle').textContent = trial.code || '試驗詳情';
        const classifications = trial.classifications || {};
        const classifierEvidence = [
            ...(classifications.cancerTypes || []).slice(0, 3).map((finding) => `${finding.value} (${Math.round(finding.confidence * 100)}%)`),
            ...(classifications.treatmentLines || []).slice(0, 4).map((finding) => `${finding.value} (${Math.round(finding.confidence * 100)}%)`)
        ].join('、');
        const row = (label, value) => value ? `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>` : '';
        el('detailBody').innerHTML = `<dl class="details-grid">
          ${row('試驗名稱', trial.title)}${row('Sponsor', trial.sponsor)}${row('Phase', trial.phase)}${row('收案狀態', STATUS_LABELS[trial.status] || trial.status)}
          ${row('癌別', (trial.cancerTypes || []).map((entry) => entry.type).join('、'))}${row('線別／情境', (trial.treatmentLines || []).join('、'))}${row('治療', (trial.interventions || []).join('、'))}
          ${row('PI', trial.contacts && trial.contacts.pi)}${row('研究護理師', trial.contacts && trial.contacts.nurse)}${row('Inclusion', trial.inclusion)}${row('Exclusion', trial.exclusion)}${row('備註', trial.notes)}${row('分類依據', classifierEvidence)}
        </dl>`;
        el('detailDialog').showModal();
    }

    function openEdit(key) {
        const trial = key ? findTrial(key) : null;
        el('editDialogTitle').textContent = trial ? `編輯 ${trial.code}` : '新增試驗';
        el('editOriginalKey').value = key || '';
        el('editCode').value = trial ? trial.code : '';
        el('editTitle').value = trial ? trial.title : '';
        el('editCancer').value = trial ? (trial.cancerTypes || []).map((entry) => entry.type).join(', ') : '';
        el('editLines').value = trial ? (trial.treatmentLines || []).join(', ') : '';
        el('editStatus').value = trial ? ({ recruiting: 'Recruiting', pending: 'Pending', temporarily_closed: 'Temporarily closed', closed: 'Closed', unknown: 'Unknown' }[trial.status] || 'Unknown') : 'Recruiting';
        el('editSponsor').value = trial ? trial.sponsor : '';
        el('editPhase').value = trial ? trial.phase : '';
        el('editPi').value = trial && trial.contacts ? trial.contacts.pi : '';
        el('editNurse').value = trial && trial.contacts ? trial.contacts.nurse : '';
        el('editInclusion').value = trial ? trial.inclusion : '';
        el('editExclusion').value = trial ? trial.exclusion : '';
        el('editNotes').value = trial ? trial.notes : '';
        el('editDialog').showModal();
    }

    async function saveForm(event) {
        event.preventDefault();
        const originalKey = el('editOriginalKey').value;
        const statusValue = el('editStatus').value;
        const raw = {
            code: el('editCode').value,
            title: el('editTitle').value,
            cancerType: el('editCancer').value,
            treatmentLines: el('editLines').value,
            status: statusValue,
            active: ['Recruiting', 'Pending'].includes(statusValue),
            sponsor: el('editSponsor').value,
            phase: el('editPhase').value,
            pi: el('editPi').value,
            nurse: el('editNurse').value,
            inclusion: el('editInclusion').value,
            exclusion: el('editExclusion').value,
            notes: el('editNotes').value,
            source: { type: 'manual', name: 'browser editor' }
        };
        const candidate = parsing.prepareCandidate(raw, { validation: { requireCode: true } });
        if (!candidate.validation.valid) {
            alert(candidate.validation.errors.map((error) => error.message).join('\n'));
            return;
        }
        if (originalKey && originalKey !== candidate.identityKey) await state.repository.remove(originalKey);
        await state.repository.save(candidate.trial);
        el('editDialog').close();
        await reload();
    }

    function guessFormat(text, fileName) {
        const selected = el('importFormat').value;
        if (selected !== 'auto') return selected;
        const name = String(fileName || '').toLowerCase();
        const trimmed = String(text || '').trim();
        if (name.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
        const firstLine = trimmed.split(/\r?\n/)[0] || '';
        if (name.endsWith('.csv') || name.endsWith('.tsv') || /\t|,/.test(firstLine)) return 'table';
        return 'document';
    }

    function parseImportContent(text, fileName) {
        const format = guessFormat(text, fileName);
        if (format === 'json') {
            const value = JSON.parse(text);
            const records = Array.isArray(value) ? value : (Array.isArray(value.trials) ? value.trials : [value]);
            return { format, records, diagnostics: { recordCount: records.length } };
        }
        if (format === 'table') {
            const parsed = parsing.parseDelimitedText(text, { sourceName: fileName || 'pasted table' });
            return { format, records: parsed.records, diagnostics: parsed.diagnostics };
        }
        const parsed = parsing.parseDocumentText(text, { sourceName: fileName || 'pasted document text' });
        return { format, records: parsed.records, diagnostics: parsed.diagnostics };
    }

    function renderImportPlan(parsed, plan) {
        const s = plan.summary;
        el('importStatus').textContent = `格式：${parsed.format}；解析 ${parsed.records.length} 筆。新增 ${s.add}、更新 ${s.update}、不變 ${s.unchanged}、需人工確認 ${s.review}、無效 ${s.invalid}、檔內重複 ${s.duplicate_in_file}。`;
        el('reviewList').innerHTML = plan.actions.map((action, index) => {
            const trial = action.candidate.trial;
            const defaultChecked = ['add', 'update'].includes(action.type);
            const details = action.conflicts && action.conflicts.length
                ? `衝突：${action.conflicts.map((conflict) => conflict.field).join('、')}`
                : (action.reasons && action.reasons.length ? action.reasons.map((reason) => reason.message).join('；') : '');
            return `<label class="review-row"><input class="import-choice" type="checkbox" data-action-index="${index}" ${defaultChecked ? 'checked' : ''} ${['unchanged','invalid','duplicate_in_file'].includes(action.type) ? 'disabled' : ''}><div><strong>${escapeHtml(trial.code || 'NO CODE')}</strong><div>${escapeHtml(trial.title || '未命名試驗')}</div>${details ? `<small>${escapeHtml(details)}</small>` : ''}</div><span class="review-action ${escapeHtml(action.type)}">${escapeHtml(action.type)}</span></label>`;
        }).join('');
        el('applyImportButton').disabled = !plan.actions.some((action) => ['add', 'update', 'review'].includes(action.type));
    }

    async function parseImport() {
        const text = el('importText').value.trim();
        if (!text) { el('importStatus').textContent = '請先選擇檔案或貼上內容。'; return; }
        try {
            const file = el('importFile').files[0];
            const parsed = parseImportContent(text, file && file.name);
            state.importPlan = parsing.planImport(parsed.records, state.trials, { sourceName: 'browser import' });
            renderImportPlan(parsed, state.importPlan);
        } catch (error) {
            state.importPlan = null;
            el('importStatus').textContent = `解析失敗：${error.message}`;
            el('reviewList').innerHTML = '';
            el('applyImportButton').disabled = true;
        }
    }

    async function applyImport() {
        if (!state.importPlan) return;
        const selections = {};
        document.querySelectorAll('.import-choice').forEach((checkbox) => { selections[checkbox.dataset.actionIndex] = checkbox.checked ? 'accept' : 'skip'; });
        const next = parsing.applyImportPlan(state.trials, state.importPlan, selections);
        await state.repository.replaceAll(next);
        state.importPlan = null;
        el('importDialog').close();
        await reload();
    }

    function exportJson() {
        const blob = new Blob([JSON.stringify(state.trials, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `clinical-trials-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async function resetSynthetic() {
        if (!confirm('確定要清除目前瀏覽器資料，重設為合成測試資料？')) return;
        await state.repository.replaceAll(synthetic);
        await reload();
    }

    function bindEvents() {
        el('searchInput').addEventListener('input', (event) => { state.query = event.target.value; render(); });
        el('clearSearchButton').addEventListener('click', () => { state.query = ''; el('searchInput').value = ''; render(); });
        document.querySelectorAll('[data-query]').forEach((button) => button.addEventListener('click', () => { state.query = button.dataset.query; el('searchInput').value = state.query; render(); }));
        el('cancerFilter').addEventListener('change', (event) => { state.cancer = event.target.value; render(); });
        el('lineFilter').addEventListener('change', (event) => { state.line = event.target.value; render(); });
        el('statusFilter').addEventListener('change', (event) => { state.status = event.target.value; render(); });
        el('activeOnlyFilter').addEventListener('change', (event) => { state.activeOnly = event.target.checked; render(); });
        el('trialGrid').addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            if (button.dataset.action === 'view') openDetail(button.dataset.key);
            if (button.dataset.action === 'edit') openEdit(button.dataset.key);
        });
        el('addButton').addEventListener('click', () => openEdit(''));
        el('editFromDetailButton').addEventListener('click', () => { el('detailDialog').close(); openEdit(state.selectedTrialKey); });
        el('trialForm').addEventListener('submit', saveForm);
        el('importButton').addEventListener('click', () => {
            state.importPlan = null;
            el('importStatus').textContent = '尚未解析。';
            el('reviewList').innerHTML = '';
            el('applyImportButton').disabled = true;
            el('importDialog').showModal();
        });
        el('parseImportButton').addEventListener('click', parseImport);
        el('applyImportButton').addEventListener('click', applyImport);
        el('importFile').addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) el('importText').value = await file.text(); });
        el('loadImportExampleButton').addEventListener('click', () => {
            el('importFormat').value = 'document';
            el('importText').value = 'Protocol Number: SYN-IMPORT-080\nOfficial Title:\nFirst-line Study in Advanced Gastric Cancer\nSponsor:\nSynthetic Import Pharma\nPhase:\nPhase II\nRecruitment Status:\nRecruiting\nInclusion Criteria:\nHER2-positive by IHC 3+ or IHC 2+/ISH+\nPreviously untreated metastatic disease\nExclusion Criteria:\nPrior anti-HER2 therapy';
        });
        el('exportButton').addEventListener('click', exportJson);
        el('resetButton').addEventListener('click', resetSynthetic);
        document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => el(button.dataset.closeDialog).close()));
    }

    async function init() {
        state.repository = repositories.createLocalStorageRepository({ key: STORAGE_KEY });
        const existing = await state.repository.list();
        if (!existing.length) await state.repository.replaceAll(synthetic);
        bindEvents();
        await reload();
    }

    document.addEventListener('DOMContentLoaded', init);
})(typeof globalThis !== 'undefined' ? globalThis : this);
