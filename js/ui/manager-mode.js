(function (root) {
    'use strict';

    const app = root.ClinicalTrialApp || {};
    const core = app.core || {};
    const parsing = app.parsing || {};
    const release = app.release || {};
    const MANAGER_CLASS = 'local-manager-active';
    let lastSelectedKey = '';

    const el = (id) => document.getElementById(id);
    const valueOf = (id) => {
        const node = el(id);
        return node ? String(node.value || '').trim() : '';
    };
    const escapeHtml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    function managerActive() {
        return release.isManagerSessionActive ? release.isManagerSessionActive() : false;
    }

    function applyManagerState() {
        const active = managerActive();
        document.body.classList.toggle(MANAGER_CLASS, active);
        const button = el('managerToggleButton');
        if (button) {
            button.textContent = active ? '結束本機管理工作階段' : '啟用本機管理工作階段';
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
        const status = el('managerStatus');
        if (status) {
            status.textContent = active
                ? '本機管理已啟用：變更只寫入這個瀏覽器。這不是身分驗證或多人權限控管。'
                : '目前為唯讀查找模式。要新增、修改、匯入或還原資料，需明確啟用本機管理工作階段。';
        }
        decorateTrialGrid();
    }

    function toggleManager() {
        if (managerActive()) {
            release.setManagerSession(false);
            applyManagerState();
            return;
        }
        const accepted = confirm('本機管理工作階段只控制此瀏覽器畫面，不是安全登入，也不會把資料同步到伺服器。確定要啟用新增、編輯、匯入與還原功能？');
        if (!accepted) return;
        release.setManagerSession(true);
        applyManagerState();
    }

    function managerRequired(event) {
        if (managerActive()) return false;
        const target = event.target.closest('[data-manager-required], [data-action="edit"]');
        if (!target) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        alert('目前是唯讀查找模式。請先啟用「本機管理工作階段」。');
        return true;
    }

    function currentTrials() {
        return release.readTrials ? release.readTrials() : [];
    }

    function findTrial(key) {
        const trials = currentTrials();
        if (!key || typeof core.trialIdentityKey !== 'function') return null;
        return trials.find((trial) => core.trialIdentityKey(trial) === key) || null;
    }

    function clearOperationalFields() {
        ['editLineId', 'editContactRaw', 'editTargetCount', 'editEnrolledCount', 'editRemainingSlots',
            'editMonthlySignedCount', 'editMonthlyEnrolledCount', 'editContactVerifiedAt',
            'editContactVerifiedBy', 'editEnrollmentVerifiedAt', 'editEnrollmentVerifiedBy',
            'editSourceName'].forEach((id) => { const node = el(id); if (node) node.value = ''; });
    }

    function fillOperationalFields(key) {
        clearOperationalFields();
        const trial = findTrial(key);
        if (!trial) return;
        const contacts = trial.contacts || {};
        const enrollment = trial.siteEnrollment || {};
        const set = (id, value) => { const node = el(id); if (node) node.value = value == null ? '' : value; };
        set('editLineId', contacts.lineId);
        set('editContactRaw', contacts.raw);
        set('editTargetCount', enrollment.targetCount);
        set('editEnrolledCount', enrollment.enrolledCount);
        set('editRemainingSlots', enrollment.remainingSlots);
        set('editMonthlySignedCount', enrollment.monthlySignedCount);
        set('editMonthlyEnrolledCount', enrollment.monthlyEnrolledCount);
        set('editContactVerifiedAt', contacts.verifiedAt);
        set('editContactVerifiedBy', contacts.verifiedBy);
        set('editEnrollmentVerifiedAt', enrollment.lastVerifiedAt);
        set('editEnrollmentVerifiedBy', enrollment.verifiedBy);
        set('editSourceName', (trial.source && trial.source.name) || contacts.sourceName || enrollment.sourceName || '');
    }

    function buildManualTrial(existing) {
        const statusValue = valueOf('editStatus');
        const now = new Date().toISOString();
        const actor = valueOf('editContactVerifiedBy') || valueOf('editEnrollmentVerifiedBy') || 'local manager';
        const sourceName = valueOf('editSourceName') || 'browser editor';
        return Object.assign({}, existing || {}, {
            code: valueOf('editCode'),
            title: valueOf('editTitle'),
            cancerType: valueOf('editCancer'),
            treatmentLines: valueOf('editLines'),
            status: statusValue,
            availability: valueOf('editAvailability'),
            active: ['Recruiting', 'Pending'].includes(statusValue),
            sponsor: valueOf('editSponsor'),
            phase: valueOf('editPhase'),
            inclusion: valueOf('editInclusion'),
            exclusion: valueOf('editExclusion'),
            notes: valueOf('editNotes'),
            contacts: Object.assign({}, existing && existing.contacts || {}, {
                pi: valueOf('editPi'),
                nurse: valueOf('editNurse'),
                phone: valueOf('editPhone'),
                email: valueOf('editEmail'),
                lineId: valueOf('editLineId'),
                raw: valueOf('editContactRaw'),
                verifiedAt: valueOf('editContactVerifiedAt'),
                verifiedBy: valueOf('editContactVerifiedBy'),
                sourceName
            }),
            siteEnrollment: Object.assign({}, existing && existing.siteEnrollment || {}, {
                targetCount: valueOf('editTargetCount'),
                enrolledCount: valueOf('editEnrolledCount'),
                remainingSlots: valueOf('editRemainingSlots'),
                monthlySignedCount: valueOf('editMonthlySignedCount'),
                monthlyEnrolledCount: valueOf('editMonthlyEnrolledCount'),
                lastVerifiedAt: valueOf('editEnrollmentVerifiedAt'),
                verifiedBy: valueOf('editEnrollmentVerifiedBy'),
                sourceName
            }),
            source: Object.assign({}, existing && existing.source || {}, { type: 'manual', name: sourceName }),
            createdAt: existing && existing.createdAt || now,
            updatedAt: now,
            changeLog: (existing && Array.isArray(existing.changeLog) ? existing.changeLog : []).concat([{ at: now, actor, action: existing ? 'manual-update' : 'manual-create' }])
        });
    }

    function saveFormalTrial(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!managerActive()) {
            alert('請先啟用本機管理工作階段。');
            return;
        }
        try {
            const originalKey = valueOf('editOriginalKey');
            const trials = currentTrials();
            const existing = originalKey ? findTrial(originalKey) : null;
            const candidate = parsing.prepareCandidate(buildManualTrial(existing), { validation: { requireCode: true } });
            if (!candidate.validation.valid) {
                alert(candidate.validation.errors.map((error) => error.message).join('\n'));
                return;
            }
            const nextKey = core.trialIdentityKey(candidate.trial);
            let replaced = false;
            const next = trials.reduce((list, trial) => {
                const key = core.trialIdentityKey(trial);
                if (key === originalKey || key === nextKey) {
                    if (!replaced) list.push(candidate.trial);
                    replaced = true;
                } else list.push(trial);
                return list;
            }, []);
            if (!replaced) next.push(candidate.trial);
            release.writeTrials(next, { snapshotReason: existing ? `before editing ${existing.code}` : `before adding ${candidate.trial.code}` });
            const dialog = el('editDialog');
            if (dialog && dialog.open) dialog.close();
            location.reload();
        } catch (error) {
            alert(`儲存失敗：${error.message}`);
        }
    }

    function deleteSelectedTrial() {
        if (!managerActive()) return;
        const trial = findTrial(lastSelectedKey);
        if (!trial) return;
        if (!confirm(`確定要從這個瀏覽器刪除 ${trial.code || trial.title}？刪除前會自動保留一份可復原快照。`)) return;
        const next = currentTrials().filter((item) => core.trialIdentityKey(item) !== lastSelectedKey);
        release.writeTrials(next, { snapshotReason: `before deleting ${trial.code || lastSelectedKey}` });
        location.reload();
    }

    function detailRow(label, value, className) {
        const text = release.formatValue ? release.formatValue(value) : String(value || '');
        if (!text) return '';
        return `<dt class="${className || ''}">${escapeHtml(label)}</dt><dd class="${className || ''}">${escapeHtml(text)}</dd>`;
    }

    function decorateDetail(key) {
        const trial = findTrial(key);
        const body = el('detailBody');
        if (!trial || !body) return;
        const grid = body.querySelector('.details-grid');
        if (!grid || grid.querySelector('[data-release-detail]')) return;
        const contacts = trial.contacts || {};
        const enrollment = trial.siteEnrollment || {};
        const source = trial.source || {};
        const html = [
            detailRow('LINE ID', contacts.lineId, 'release-detail'),
            detailRow('原始聯絡欄', contacts.raw, 'release-detail'),
            detailRow('聯絡資料確認', [contacts.verifiedAt, contacts.verifiedBy].filter(Boolean).join('／'), 'release-detail'),
            detailRow('Target／已收案／剩餘', [enrollment.targetCount, enrollment.enrolledCount, enrollment.remainingSlots].map((v) => v == null ? '-' : v).join('／'), 'release-detail'),
            detailRow('本月簽署／入案', [enrollment.monthlySignedCount, enrollment.monthlyEnrolledCount].map((v) => v == null ? '-' : v).join('／'), 'release-detail'),
            detailRow('名額資料確認', [enrollment.lastVerifiedAt, enrollment.verifiedBy].filter(Boolean).join('／'), 'release-detail'),
            detailRow('來源', [source.name, source.pageNumber ? `p.${source.pageNumber}${source.endPageNumber && source.endPageNumber !== source.pageNumber ? `-${source.endPageNumber}` : ''}` : ''].filter(Boolean).join('／'), 'release-detail')
        ].join('');
        if (html) grid.insertAdjacentHTML('beforeend', `<dt data-release-detail hidden></dt>${html}`);
    }

    function decorateTrialGrid() {
        const trials = currentTrials();
        const byKey = new Map(trials.map((trial) => [core.trialIdentityKey(trial), trial]));
        document.querySelectorAll('#trialGrid .trial-card').forEach((card) => {
            const edit = card.querySelector('[data-action="edit"]');
            if (edit) edit.classList.add('manager-only');
            const trial = byKey.get(card.dataset.key);
            if (!trial || card.querySelector('.release-card-extra')) return;
            const contacts = trial.contacts || {};
            const enrollment = trial.siteEnrollment || {};
            const pieces = [];
            if (contacts.lineId) pieces.push(`LINE ID：${contacts.lineId}`);
            if (enrollment.targetCount != null || enrollment.enrolledCount != null || enrollment.remainingSlots != null) {
                pieces.push(`Target／已收案／剩餘：${enrollment.targetCount ?? '-'}／${enrollment.enrolledCount ?? '-'}／${enrollment.remainingSlots ?? '-'}`);
            }
            if (!pieces.length) return;
            const side = card.querySelector('.card-side');
            const node = document.createElement('p');
            node.className = 'contact-line release-card-extra';
            node.textContent = pieces.join('　｜　');
            if (side && side.parentNode) side.parentNode.insertBefore(node, side);
            else card.appendChild(node);
        });
    }

    function bindSelectionTracking() {
        document.addEventListener('click', (event) => {
            const actionButton = event.target.closest('[data-action="view"], [data-action="edit"]');
            if (actionButton) {
                lastSelectedKey = actionButton.dataset.key || '';
                setTimeout(() => {
                    if (actionButton.dataset.action === 'edit') fillOperationalFields(lastSelectedKey);
                    if (actionButton.dataset.action === 'view') decorateDetail(lastSelectedKey);
                }, 0);
            }
            if (event.target.closest('#addButton')) {
                lastSelectedKey = '';
                setTimeout(clearOperationalFields, 0);
            }
            if (event.target.closest('#editFromDetailButton')) setTimeout(() => fillOperationalFields(lastSelectedKey), 0);
        }, true);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const toggle = el('managerToggleButton');
        if (toggle) toggle.addEventListener('click', toggleManager);
        const form = el('trialForm');
        if (form) form.addEventListener('submit', saveFormalTrial, true);
        const remove = el('deleteTrialButton');
        if (remove) remove.addEventListener('click', deleteSelectedTrial);
        document.addEventListener('click', managerRequired, true);
        bindSelectionTracking();
        applyManagerState();
        setTimeout(decorateTrialGrid, 0);
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
