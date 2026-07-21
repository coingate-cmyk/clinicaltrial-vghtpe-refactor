(function (root) {
    'use strict';

    const app = root.ClinicalTrialApp || {};
    const release = app.release || {};
    const backup = app.backup || {};
    const parsing = app.parsing || {};
    const el = (id) => document.getElementById(id);

    function managerActive() {
        return release.isManagerSessionActive ? release.isManagerSessionActive() : false;
    }

    function backupEnvelope(reason) {
        return backup.createBackupEnvelope(release.readTrials(), { reason: reason || 'manual backup', appVersion: release.APP_VERSION });
    }

    function downloadBackup(event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        if (!managerActive()) return;
        const envelope = backupEnvelope('manual download');
        release.downloadJson(envelope, backup.backupFileName());
        updateStatus('已下載正式備份。備份可能包含院內聯絡資料，請依院內規範保存。');
    }

    async function restoreBackup(event) {
        const input = event.target;
        const file = input.files && input.files[0];
        input.value = '';
        if (!file || !managerActive()) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('備份檔超過 10 MB，未匯入。');
            return;
        }
        try {
            const text = await file.text();
            const result = backup.validateBackupEnvelope(text, { maximumTrials: 5000 });
            if (!result.valid) {
                alert(`備份含重複 trial identity：${result.duplicateKeys.slice(0, 10).join('、')}`);
                return;
            }
            const envelope = result.envelope;
            const message = `備份版本：${envelope.appVersion || '舊格式'}\n資料筆數：${envelope.trialCount}\n匯出時間：${envelope.exportedAt || '未知'}\n\n還原會取代目前瀏覽器資料；系統會先自動保留目前資料快照。確定繼續？`;
            if (!confirm(message)) return;
            release.writeTrials(envelope.trials, { snapshotReason: `before restoring backup from ${envelope.exportedAt || 'unknown date'}` });
            location.reload();
        } catch (error) {
            alert(`備份還原失敗：${error.message}`);
        }
    }

    function undoLastWrite() {
        if (!managerActive()) return;
        const snapshot = release.readSnapshot();
        if (!snapshot) {
            alert('目前沒有可復原的本機快照。');
            return;
        }
        if (!confirm(`要復原至上一份快照嗎？快照含 ${snapshot.trialCount} 筆，建立時間 ${snapshot.exportedAt || '未知'}。目前資料也會先保存成快照。`)) return;
        try {
            release.restoreSnapshot();
            location.reload();
        } catch (error) {
            alert(`無法復原：${error.message}`);
        }
    }

    function resetSynthetic(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!managerActive()) return;
        if (!confirm('確定要把目前瀏覽器資料重設為合成示範資料？重設前會自動建立快照。')) return;
        const synthetic = (root.ClinicalTrialSyntheticData || []).map((trial) => parsing.prepareCandidate(trial).trial);
        release.writeTrials(synthetic, { snapshotReason: 'before resetting to synthetic demo data' });
        location.reload();
    }

    function clearWorkspace() {
        if (!managerActive()) return;
        if (!confirm('確定要清除目前瀏覽器中的臨床試驗資料？清除前會自動建立快照。重新整理後仍可用「復原上一版」取回。')) return;
        release.writeTrials([], { snapshotReason: 'before clearing local workspace' });
        sessionStorage.setItem('clinicaltrial-vghtpe-refactor.keep-empty.v1', 'true');
        location.reload();
    }

    function updateStatus(message) {
        const trials = release.readTrials ? release.readTrials() : [];
        const snapshot = release.readSnapshot ? release.readSnapshot() : null;
        const status = el('releaseHealth');
        if (!status) return;
        const manager = managerActive() ? '本機管理啟用' : '唯讀查找';
        const snapshotText = snapshot ? `${snapshot.trialCount} 筆／${snapshot.exportedAt || '未知時間'}` : '尚無';
        status.innerHTML = `<strong>v${release.APP_VERSION || '1.0.0'}｜${manager}</strong><span>目前 ${trials.length} 筆；上一份可復原快照：${snapshotText}</span>${message ? `<span class="release-health-message">${message}</span>` : ''}`;
    }

    function keepEmptyWorkspace() {
        if (sessionStorage.getItem('clinicaltrial-vghtpe-refactor.keep-empty.v1') !== 'true') return;
        sessionStorage.removeItem('clinicaltrial-vghtpe-refactor.keep-empty.v1');
        localStorage.setItem(release.TRIAL_KEY, '[]');
    }

    function init() {
        keepEmptyWorkspace();
        const exportButton = el('exportButton');
        if (exportButton) exportButton.addEventListener('click', downloadBackup, true);
        const backupButton = el('backupButton');
        if (backupButton) backupButton.addEventListener('click', downloadBackup);
        const restoreInput = el('restoreInput');
        if (restoreInput) restoreInput.addEventListener('change', restoreBackup);
        const undoButton = el('undoButton');
        if (undoButton) undoButton.addEventListener('click', undoLastWrite);
        const resetButton = el('resetButton');
        if (resetButton) resetButton.addEventListener('click', resetSynthetic, true);
        const clearButton = el('clearWorkspaceButton');
        if (clearButton) clearButton.addEventListener('click', clearWorkspace);
        updateStatus();
        window.addEventListener('storage', () => updateStatus('偵測到另一個分頁更新本機資料。'));
        document.addEventListener('click', (event) => {
            if (event.target.closest('#managerToggleButton')) setTimeout(updateStatus, 0);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})(typeof globalThis !== 'undefined' ? globalThis : this);
