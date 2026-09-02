/**
 * Pure helpers for the Libraries & scans poller.
 *
 * The page used to wipe `#jobsTableBody` (and the unmatched table) on every
 * status tick. A live scan changes processed/percentage every few seconds, so
 * the “skip identical payload” guard never fired and the main thread rebuilt
 * every row — buttons and tab switches queued behind that work.
 *
 * Structure vs progress: only a structure change needs a full rebuild
 * (status, actions, which jobs are listed). Progress patches the bar in place.
 */

export function scanJobProgressCounts(job) {
    const success = Number(job && job.folders_success) || 0;
    const failed = Number(job && job.folders_failed) || 0;
    const total = Number(job && job.total_folders) || 0;
    const processed = success + failed;
    const percentage = total > 0
        ? (Number(job && job.progress_percentage) || Math.round((processed / total) * 1000) / 10)
        : 0;
    return { success, failed, total, processed, percentage };
}

export function scanJobsStructureSignature(jobs, { busy = false } = {}) {
    const rows = (Array.isArray(jobs) ? jobs : []).map((job) => [
        job && job.id,
        job && job.status,
        job && job.cancelled_by_user ? 1 : 0,
        job && job.library_uuid || '',
        job && job.scan_folder || '',
        job && job.queue_position != null ? job.queue_position : '',
    ].join('|'));
    return `${busy ? 1 : 0};${rows.join(';')}`;
}

export function scanJobsProgressSignature(jobs) {
    return (Array.isArray(jobs) ? jobs : []).map((job) => {
        const { processed, total, percentage } = scanJobProgressCounts(job);
        return [
            job && job.id,
            processed,
            total,
            percentage,
            job && job.current_processing || '',
            job && job.elapsed_label || '',
            job && job.eta_label || '',
            job && job.stalled ? 1 : 0,
        ].join('|');
    }).join(';');
}

export function unmatchedFoldersSignature(folders) {
    return (Array.isArray(folders) ? folders : []).map((folder) => [
        folder && folder.id,
        folder && folder.status || '',
        folder && folder.folder_path || '',
        folder && (folder.search_name || folder.custom_search_name || ''),
        folder && folder.bad_match_reason || '',
        folder && folder.suggested_kind || '',
        folder && folder.why_unmatched || '',
    ].join('|')).join(';');
}

/** 3s only while a job is running *and* the jobs pane is on screen. */
export function scanJobsPollMs({ busy = false, jobsPaneVisible = false } = {}) {
    return busy && jobsPaneVisible ? 3000 : 12000;
}
