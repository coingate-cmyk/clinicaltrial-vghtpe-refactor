(function (root) {
    'use strict';

    const app = root.ClinicalTrialApp || {};
    const parsing = app.parsing || {};
    const release = app.release || {};
    const state = { plan: null, parsed: null };
    const el = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const ACTION_LABELS = {
        add: '新增', update: '更新', unchanged: '不變', review: '人工確認',
        invalid: '無效', duplicate_in_file: '檔內重複'
    };
    const FIELD_LABELS = {
        title: '試驗名稱', sponsor: 'Sponsor', phase: 'Phase', status: '試驗狀態', availability: '院內名額',
        'contacts.pi': 'PI', 'contacts.nurse': '研究護理師', 'contacts.phone': '電話', 'contacts.email': 'Email',
        'contacts.lineId': 'LINE ID', 'contacts.raw': '原始聯絡欄',
        'siteEnrollment.targetCount': 'Target 人數', 'siteEnrollment.enrolledCount': '已收案',
        'siteEnrollment.remainingSlots': '剩餘名額', 'siteEnrollment.monthlySignedCount': '當月簽署',
        'siteEnrollment.monthlyEnrolledCount': '當月入案', inclusion: '主要收案條件', exclusion: '排除條件', notes: '備註'
    };

    function guessFormat(text, fileName) {
        const selected = el('importFormat') && el('importFormat').value || 'auto';
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

    function formatValue(value) {
        const text = release.formatValue ? release.formatValue(value) : String(value == null ? '' : value);
        return text || '（空白）';
    }

    function reasonText(action) {
        return (action.reasons || []).map((reason) => reason.message || reason.code).filter(Boolean).join('；');
    }

    function conflictHtml(conflict, actionIndex, conflictIndex) {
        const field = conflict.field || `field-${conflictIndex}`;
        const groupName = `resolution-${actionIndex}-${conflictIndex}`;
        const recommended = conflict.recommendedChoice || 'existing';
        return `<fieldset class="release-conflict ${conflict.protected ? 'protected' : ''}" data-conflict-field="${escapeHtml(field)}">
          <legend>${escapeHtml(FIELD_LABELS[field] || field)}${conflict.protected ? '（受保護欄位，必須選擇）' : ''}</legend>
          <label class="conflict-choice"><input type="radio" name="${groupName}" data-action-index="${actionIndex}" data-resolution-field="${escapeHtml(field)}" value="existing" ${!conflict.protected && recommended === 'existing' ? 'checked' : ''}><span><strong>保留目前資料</strong><small>${escapeHtml(formatValue(conflict.existing))}</small></span></label>
          <label class="conflict-choice"><input type="radio" name="${groupName}" data-action-index="${actionIndex}" data-resolution-field="${escapeHtml(field)}" value="incoming" ${!conflict.protected && recommended === 'incoming' ? 'checked' : ''}><span><strong>採用匯入資料</strong><small>${escapeHtml(formatValue(conflict.incoming))}</small></span></label>
          <p class="conflict-recommendation">建議：${recommended === 'incoming' ? '採用匯入資料' : '保留目前資料'}；${escapeHtml(conflict.recommendationReason || '')}</p>
        </fieldset>`;
    }

    function sourceSummary(raw) {
        const source = raw && raw.source || {};
        const pages = source.pageNumber
            ? `PDF p.${source.pageNumber}${source.endPageNumber && source.endPageNumber !== source.pageNumber ? `-${source.endPageNumber}` : ''}`
            : '';
        const issues = (raw && raw._parseIssues || []).map((issue) => `${issue.field || issue.code}: ${issue.code}`).join('；');
        const contactRaw = raw && (raw.contactRaw || raw.contacts && raw.contacts.raw) || '';
        return [pages, issues, contactRaw ? `原始聯絡欄：${contactRaw}` : ''].filter(Boolean).join('\n');
    }

    function actionHtml(action, index) {
        const candidate = action.candidate || {};
        const trial = candidate.trial || {};
        const selectable = ['add', 'update', 'review'].includes(action.type);
        const defaultChecked = ['add', 'update'].includes(action.type);
        const disabled = !selectable;
        const details = reasonText(action);
        const conflicts = (action.conflicts || []).map((conflict, conflictIndex) => conflictHtml(conflict, index, conflictIndex)).join('');
        const rawSummary = sourceSummary(candidate.raw);
        return `<article class="formal-review-card action-${escapeHtml(action.type)}">
          <header><label><input class="formal-import-choice" type="checkbox" data-action-index="${index}" ${defaultChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span><strong>${escapeHtml(trial.code || 'NO CODE')}</strong><span>${escapeHtml(trial.title || '未命名試驗')}</span></span></label><span class="review-action ${escapeHtml(action.type)}">${escapeHtml(ACTION_LABELS[action.type] || action.type)}</span></header>
          ${details ? `<p class="review-warning">${escapeHtml(details)}</p>` : ''}
          ${conflicts ? `<div class="formal-conflicts">${conflicts}</div>` : ''}
          <details><summary>查看匯入內容與解析來源</summary><pre>${escapeHtml(JSON.stringify(trial, null, 2))}</pre>${rawSummary ? `<pre>${escapeHtml(rawSummary)}</pre>` : ''}</details>
        </article>`;
    }

    function renderPlan(parsed, plan) {
        const summary = plan.summary;
        const status = el('importStatus');
        if (status) {
            status.textContent = `格式：${parsed.format}；候選 ${parsed.records.length} 筆。新增 ${summary.add}、更新 ${summary.update}、不變 ${summary.unchanged}、人工確認 ${summary.review}、無效 ${summary.invalid}、檔內重複 ${summary.duplicate_in_file}。`;
        }
        const list = el('reviewList');
        if (list) list.innerHTML = plan.actions.map(actionHtml).join('');
        const apply = el('applyImportButton');
        if (apply) apply.disabled = !plan.actions.some((action) => ['add', 'update', 'review'].includes(action.type));
    }

    function parseImport(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const text = String(el('importText') && el('importText').value || '').trim();
        if (!text) {
            el('importStatus').textContent = '請先選擇檔案或貼上內容。';
            return;
        }
        try {
            const file = el('importFile') && el('importFile').files && el('importFile').files[0];
            const parsed = parseImportContent(text, file && file.name);
            const existing = release.readTrials();
            const plan = parsing.planImport(parsed.records, existing, { sourceName: file && file.name || 'browser import' });
            state.parsed = parsed;
            state.plan = plan;
            renderPlan(parsed, plan);
        } catch (error) {
            state.parsed = null;
            state.plan = null;
            el('importStatus').textContent = `解析失敗：${error.message}`;
            el('reviewList').innerHTML = '';
            el('applyImportButton').disabled = true;
        }
    }

    function collectSelections() {
        const selections = {};
        document.querySelectorAll('.formal-import-choice').forEach((checkbox) => {
            selections[checkbox.dataset.actionIndex] = {
                decision: checkbox.checked ? 'accept' : 'skip',
                resolutions: {},
                actor: String(el('importActor') && el('importActor').value || '').trim()
            };
        });
        document.querySelectorAll('[data-resolution-field]:checked').forEach((radio) => {
            const index = radio.dataset.actionIndex;
            selections[index] = selections[index] || { decision: 'skip', resolutions: {}, actor: '' };
            selections[index].resolutions[radio.dataset.resolutionField] = radio.value;
        });
        return selections;
    }

    function applyImport(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!state.plan) return;
        try {
            const selections = collectSelections();
            const next = parsing.applyImportPlan(release.readTrials(), state.plan, selections)
                .map((trial) => parsing.attachAvailability ? parsing.attachAvailability(trial, trial) : trial);
            release.writeTrials(next, { snapshotReason: `before importing ${state.parsed && state.parsed.records.length || 0} candidate records` });
            const dialog = el('importDialog');
            if (dialog && dialog.open) dialog.close();
            location.reload();
        } catch (error) {
            const status = el('importStatus');
            if (status) status.textContent = `尚未套用：${error.message}`;
            alert(`匯入尚未套用：${error.message}`);
        }
    }

    function resetReview() {
        state.plan = null;
        state.parsed = null;
        if (el('reviewList')) el('reviewList').innerHTML = '';
        if (el('importStatus')) el('importStatus').textContent = '尚未解析。';
        if (el('applyImportButton')) el('applyImportButton').disabled = true;
    }

    function init() {
        const parseButton = el('parseImportButton');
        const applyButton = el('applyImportButton');
        if (parseButton) parseButton.addEventListener('click', parseImport, true);
        if (applyButton) applyButton.addEventListener('click', applyImport, true);
        const importButton = el('importButton');
        if (importButton) importButton.addEventListener('click', () => setTimeout(resetReview, 0));
    }

    document.addEventListener('DOMContentLoaded', init);
})(typeof globalThis !== 'undefined' ? globalThis : this);
