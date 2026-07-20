import AdminLayout from "@/Layouts/AdminLayout";
import { useState, useEffect, useCallback, useRef } from "react";
import { router, usePage } from "@inertiajs/react";
import toast from "react-hot-toast";
import {
  Database,
  Download,
  RotateCcw,
  Trash2,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  HardDrive,
  Clock,
  FileArchive,
  RefreshCw,
  X,
  ChevronRight,
  Info,
  Save,
  Check,
  AlertCircle,
  Loader,
} from "lucide-react";

const CONFIRMATION_TEXT = "RESTORE DATABASE";
const BASE = "/admin/utilities/backup";

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
}

function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { Accept: "application/json", ...options.headers };
  if (options.method && options.method !== "GET") {
    headers["X-CSRF-TOKEN"] = csrf();
  }
  if (options.json) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.json);
    delete options.json;
  }
  return fetch(url, { ...options, headers })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || `Request failed (${r.status})`);
      return data;
    });
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n || n < 1024) return (n || 0) + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function BackupStatusBadge({ status }) {
  const map = {
    created: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    restoring: "bg-amber-100 text-amber-700",
    restored: "bg-blue-100 text-blue-700",
    deleted: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-500"}`}>
      {status === "created" && <CheckCircle className="w-3 h-3" />}
      {status === "failed" && <AlertCircle className="w-3 h-3" />}
      {status === "restoring" && <Loader className="w-3 h-3 animate-spin" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const PROGRESS_STEPS_CREATE = ["Preparing database...", "Exporting tables...", "Compressing...", "Saving..."];
const PROGRESS_STEPS_RESTORE = ["Stopping operations...", "Preparing restore...", "Importing SQL...", "Finalizing..."];

export default function Backup() {
  const { flash } = usePage().props;

  const [overview, setOverview] = useState(null);
  const [backups, setBackups] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(-1);
  const [creating, setCreating] = useState(false);
  const [createDone, setCreateDone] = useState(false);
  const [createdBackup, setCreatedBackup] = useState(null);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreStep, setRestoreStep] = useState(0);
  const [restoreBackup, setRestoreBackup] = useState(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoreProgressStep, setRestoreProgressStep] = useState(-1);
  const [restoreDone, setRestoreDone] = useState(false);
  const [compatibilityWarnings, setCompatibilityWarnings] = useState([]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDone, setDeleteDone] = useState(false);

  const createTimerRef = useRef(null);
  const restoreTimerRef = useRef(null);

  useEffect(() => {
    if (flash?.success) toast.success(flash.success);
    if (flash?.error) toast.error(flash.error);
  }, [flash]);

  useEffect(() => {
    return () => {
      if (createTimerRef.current) clearInterval(createTimerRef.current);
      if (restoreTimerRef.current) clearInterval(restoreTimerRef.current);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [ov, hist] = await Promise.all([
        api("/overview"),
        api("/history"),
      ]);
      setOverview(ov);
      setBackups(hist);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const animateProgress = (steps, setStepFn, onComplete) => {
    let step = 0;
    setStepFn(0);
    const timer = setInterval(() => {
      step++;
      if (step < steps.length) {
        setStepFn(step);
      } else {
        clearInterval(timer);
        onComplete();
      }
    }, 900);
    return timer;
  };

  const handleCreateBackup = () => {
    setCreateOpen(true);
    setCreateStep(-1);
    setCreateDone(false);
    setCreatedBackup(null);
    setCreating(true);

    const progressTimer = animateProgress(PROGRESS_STEPS_CREATE, setCreateStep, () => {});

    api("/create", { method: "POST" })
      .then((data) => {
        clearInterval(progressTimer);
        if (createTimerRef.current) clearInterval(createTimerRef.current);
        for (let i = 0; i < PROGRESS_STEPS_CREATE.length; i++) {
          setCreateStep(i);
        }
        setTimeout(() => {
          setCreatedBackup(data.backup);
          setCreateDone(true);
          setBackups((prev) => [data.backup, ...prev]);
          setOverview((prev) => ({
            ...prev,
            last_backup: data.backup.created_at,
            backup_count: (prev?.backup_count || 0) + 1,
          }));
          toast.success("Backup created successfully");
        }, 400);
      })
      .catch((e) => {
        clearInterval(progressTimer);
        if (createTimerRef.current) clearInterval(createTimerRef.current);
        toast.error(e.message || "Backup failed");
        handleCloseCreate();
      })
      .finally(() => setCreating(false));
  };

  const handleCloseCreate = () => {
    if (createTimerRef.current) clearInterval(createTimerRef.current);
    setCreateOpen(false);
    setCreateStep(-1);
    setCreateDone(false);
    setCreatedBackup(null);
    setCreating(false);
  };

  const handleStartRestore = async (backup) => {
    setRestoreBackup(backup);
    setRestoreStep(0);
    setRestoreConfirmText("");
    setRestoreProgressStep(-1);
    setRestoreDone(false);
    setCompatibilityWarnings([]);
    setRestoreOpen(true);

    try {
      const warnings = await api(`/${backup.id}/compatibility`);
      setCompatibilityWarnings(warnings);
    } catch {}
  };

  const handleRestoreNext = () => {
    if (restoreStep < 2) setRestoreStep((p) => p + 1);
  };

  const handleRestoreBack = () => {
    if (restoreStep > 0) {
      setRestoreStep((p) => p - 1);
      setRestoreConfirmText("");
    }
  };

  const handleExecuteRestore = () => {
    setRestoreStep(3);
    setRestoreProgressStep(0);

    const progressTimer = animateProgress(PROGRESS_STEPS_RESTORE, setRestoreProgressStep, () => {});

    api(`/${restoreBackup.id}/restore`, { method: "POST" })
      .then(() => {
        clearInterval(progressTimer);
        if (restoreTimerRef.current) clearInterval(restoreTimerRef.current);
        for (let i = 0; i < PROGRESS_STEPS_RESTORE.length; i++) {
          setRestoreProgressStep(i);
        }
        setTimeout(() => {
          setRestoreDone(true);
          toast.success("Database restored successfully");
        }, 400);
      })
      .catch((e) => {
        clearInterval(progressTimer);
        toast.error(e.message || "Restore failed");
        handleCloseRestore();
      });
  };

  const handleCloseRestore = () => {
    if (restoreTimerRef.current) clearInterval(restoreTimerRef.current);
    setRestoreOpen(false);
    setRestoreStep(0);
    setRestoreBackup(null);
    setRestoreConfirmText("");
    setRestoreProgressStep(-1);
    setRestoreDone(false);
    setCompatibilityWarnings([]);
  };

  const handleDeleteClick = (backup) => {
    setDeleteTarget(backup);
    setDeleting(false);
    setDeleteDone(false);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleting(true);
    api(`/${deleteTarget.id}`, { method: "DELETE" })
      .then(() => {
        setBackups((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setOverview((prev) => ({
          ...prev,
          backup_count: Math.max(0, (prev?.backup_count || 1) - 1),
        }));
        setDeleting(false);
        setDeleteDone(true);
        toast.success(`Backup deleted`);
      })
      .catch((e) => {
        setDeleting(false);
        toast.error(e.message || "Delete failed");
      });
  };

  const handleCloseDelete = () => {
    setDeleteOpen(false);
    setDeleteTarget(null);
    setDeleting(false);
    setDeleteDone(false);
  };

  const handleDownload = (backup) => {
    window.open(`${BASE}/${backup.id}/download`, "_blank");
  };

  const hasBackups = backups.length > 0;

  if (pageLoading) {
    return (
      <AdminLayout title="Database Backup & Restore">
        <div className="flex items-center justify-center py-20">
          <Loader className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading...</span>
        </div>
      </AdminLayout>
    );
  }

  if (error && !overview) {
    return (
      <AdminLayout title="Database Backup & Restore">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800">Failed to Load</h3>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Database Backup & Restore">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Database Backup & Restore</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create, download, and restore database backups. File uploads and storage are not included.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Create Backup
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {overview && (
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-5 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overview</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <OverviewStat icon={<HardDrive className="w-4 h-4" />} label="Database Size" value={overview.db_size_formatted || formatBytes(overview.db_size)} />
              <OverviewStat icon={<Clock className="w-4 h-4" />} label="Last Backup" value={overview.last_backup || "Never"} />
              <OverviewStat icon={<FileArchive className="w-4 h-4" />} label="Backups Stored" value={String(overview.backup_count)} />
              <OverviewStat icon={<Database className="w-4 h-4" />} label="Est. Restore Time" value={overview.estimated_restore_time} />
            </div>
          </div>
        )}

        {!hasBackups ? (
          <EmptyState onCreateBackup={handleCreateBackup} />
        ) : (
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Backup History</h2>
              <span className="text-xs text-gray-400">{backups.length} backup(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Filename</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created By</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">DB Size</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Backup Size</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileArchive className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-mono text-xs text-gray-700">{backup.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{backup.created_at}</td>
                      <td className="px-4 py-3 text-gray-600">{backup.created_by}</td>
                      <td className="px-4 py-3 text-gray-600">{backup.db_size}</td>
                      <td className="px-4 py-3 text-gray-600">{backup.backup_size}</td>
                      <td className="px-4 py-3"><BackupStatusBadge status={backup.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <ActionButton icon={<Download className="w-3.5 h-3.5" />} label="Download" onClick={() => handleDownload(backup)} color="blue" />
                          <ActionButton icon={<RotateCcw className="w-3.5 h-3.5" />} label="Restore" onClick={() => handleStartRestore(backup)} color="amber" />
                          <ActionButton icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={() => handleDeleteClick(backup)} color="red" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">What gets backed up</p>
              <p className="mt-1 text-blue-700">Students, parents, classes, sections, enrollments, attendance, fees, payments, users, roles & permissions, school settings, reports metadata, and academic data.</p>
              <p className="mt-2 font-medium">What is NOT backed up</p>
              <p className="mt-1 text-blue-700">Uploaded files, storage folders, generated PDFs, and server configuration files.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Backup Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={!creating ? handleCloseCreate : undefined}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {createDone ? (
              <div className="p-6 space-y-5">
                <div className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800">Backup Created Successfully</h2>
                  <p className="text-sm text-gray-500 mt-1">Your database backup is ready.</p>
                </div>
                {createdBackup && (
                  <div className="bg-gray-50 rounded-lg border p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Filename</span>
                      <span className="font-mono text-xs text-gray-800">{createdBackup.filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Size</span>
                      <span className="text-gray-800">{createdBackup.backup_size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created</span>
                      <span className="text-gray-800">{createdBackup.created_at}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => createdBackup && handleDownload(createdBackup)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button onClick={handleCloseCreate} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">Close</button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Creating Backup</h2>
                  {!creating && <button onClick={handleCloseCreate} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}
                </div>
                <div className="space-y-3">
                  {PROGRESS_STEPS_CREATE.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {i < createStep ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : i === createStep ? (
                        <Loader className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                      )}
                      <span className={`text-sm ${i < createStep ? "text-emerald-700" : i === createStep ? "text-blue-700 font-medium" : "text-gray-400"}`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                {creating && createStep >= PROGRESS_STEPS_CREATE.length - 1 && (
                  <div className="flex justify-center"><Loader className="w-5 h-5 text-blue-500 animate-spin" /></div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore Dialog */}
      {restoreOpen && restoreBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={restoreStep < 3 ? handleCloseRestore : undefined}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {restoreStep === 0 && (
              <div className="p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Restore Database</h2>
                    <p className="text-sm text-gray-500 mt-1">This operation will replace all current data with the selected backup.</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2 text-sm text-red-800">
                  <p className="font-medium">Please understand the following:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>This will <strong>completely replace</strong> the current database.</li>
                    <li>Everything currently stored will be <strong>lost permanently</strong>.</li>
                    <li>Uploaded files and storage folders are <strong>NOT</strong> restored.</li>
                    <li>You may need to log in again after restoration.</li>
                  </ul>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={handleCloseRestore} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={handleRestoreNext} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {restoreStep === 1 && (
              <div className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-gray-800">Backup Details</h2>
                <div className="bg-gray-50 rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Filename</span><span className="font-mono text-xs text-gray-800">{restoreBackup.filename}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Backup Date</span><span className="text-gray-800">{restoreBackup.created_at}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Backup Size</span><span className="text-gray-800">{restoreBackup.backup_size}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Created By</span><span className="text-gray-800">{restoreBackup.created_by}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Est. Restore Time</span><span className="text-gray-800">{overview?.estimated_restore_time}</span></div>
                </div>
                {compatibilityWarnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Compatibility Warnings</p>
                    {compatibilityWarnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{w.message}</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">These warnings do not block restore, but please review before proceeding.</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={handleRestoreBack} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleRestoreNext} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {restoreStep === 2 && (
              <div className="p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Final Confirmation</h2>
                    <p className="text-sm text-gray-500 mt-1">This action is irreversible. Please type the confirmation phrase below.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Type <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-bold text-red-600 select-all">{CONFIRMATION_TEXT}</code> to confirm
                  </label>
                  <input
                    type="text"
                    value={restoreConfirmText}
                    onChange={(e) => setRestoreConfirmText(e.target.value)}
                    placeholder={CONFIRMATION_TEXT}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={handleRestoreBack} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50 transition-colors">Back</button>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={restoreConfirmText !== CONFIRMATION_TEXT}
                    className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Restore Database
                  </button>
                </div>
              </div>
            )}

            {restoreStep === 3 && (
              <div className="p-6 space-y-5">
                {restoreDone ? (
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">Database Restored Successfully</h2>
                      <p className="text-sm text-gray-500 mt-1">The database has been restored from the selected backup.</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 text-left space-y-1">
                      <p className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> Database restored successfully</p>
                      <p className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> Please refresh the application</p>
                      <p className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> Log in again if necessary</p>
                    </div>
                    <button onClick={handleCloseRestore} className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">Done</button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-gray-800">Restoring Database</h2>
                    <div className="space-y-3">
                      {PROGRESS_STEPS_RESTORE.map((step, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {i < restoreProgressStep ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                          ) : i === restoreProgressStep ? (
                            <Loader className="w-5 h-5 text-red-500 animate-spin shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                          )}
                          <span className={`text-sm ${i < restoreProgressStep ? "text-emerald-700" : i === restoreProgressStep ? "text-red-700 font-medium" : "text-gray-400"}`}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                    {restoreProgressStep >= PROGRESS_STEPS_RESTORE.length - 1 && (
                      <div className="flex justify-center"><Loader className="w-5 h-5 text-red-500 animate-spin" /></div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={!deleting ? handleCloseDelete : undefined}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {deleteDone ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Backup Deleted</h2>
                  <p className="text-sm text-gray-500 mt-1"><span className="font-mono text-xs">{deleteTarget.filename}</span> has been permanently deleted.</p>
                </div>
                <button onClick={handleCloseDelete} className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">Done</button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Delete Backup</h2>
                    <p className="text-sm text-gray-500 mt-1">Are you sure you want to delete this backup? This action cannot be undone.</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg border p-3 text-sm">
                  <span className="font-mono text-xs text-gray-700">{deleteTarget.filename}</span>
                  <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                    <span>{deleteTarget.backup_size}</span>
                    <span>{deleteTarget.created_at}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={handleCloseDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50 transition-colors">Cancel</button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 transition-colors"
                  >
                    {deleting ? <><Loader className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function OverviewStat({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/80">
      <div className="w-9 h-9 rounded-lg bg-white border flex items-center justify-center text-gray-500 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-base font-semibold text-gray-800 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color = "blue" }) {
  const colors = { blue: "text-blue-600 hover:bg-blue-50", amber: "text-amber-600 hover:bg-amber-50", red: "text-red-600 hover:bg-red-50" };
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${colors[color] || colors.blue}`} title={label}>
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function EmptyState({ onCreateBackup }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-10 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-5">
        <Database className="w-9 h-9 text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800">No Backups Yet</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
        Database backups protect your school data from accidental loss, hardware failures, and data corruption. Create your first backup to get started.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-500" /> Students & Parents</span>
        <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-500" /> Attendance & Fees</span>
        <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-500" /> Users & Settings</span>
      </div>
      <button onClick={onCreateBackup} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
        <Save className="w-4 h-4" /> Create First Backup
      </button>
    </div>
  );
}
