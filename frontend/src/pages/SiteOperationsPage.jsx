import { useState, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/authContext";
import { useSiteOperations, useLabourLedger } from "../hooks/useSiteOperations";
import { formatCurrency } from "../utils/currency";
import uploadService from "../services/uploadService";
import siteOperationsService from "../services/siteOperationsService";

/*
|--------------------------------------------------------------------------
| Site Operations
|--------------------------------------------------------------------------
|
| The supervisor's day-to-day screen, from the site notebook:
|
|   Material   what arrived today, with quantity, rate, bill and a photo
|   Labour     who worked, for how long, and what they were paid
|   Banking    money received and spent, and what should be in hand
|   Access     asking the office to unlock a backdated date
|
| Entries older than the allowed window are refused by the API with
| reason: "ACCESS_REQUIRED". That response is caught here and turned into a
| one-click access request, so the supervisor is never left at a dead end.
|
*/

const TABS = [
  { key: "material", label: "Material" },
  { key: "labour", label: "Labour" },
  { key: "banking", label: "Banking" },
  { key: "access", label: "Access Requests" },
];

/**
 * Today in the site's own timezone.
 *
 * Using the browser's local date rather than a UTC ISO slice, because east
 * of Greenwich those differ for part of every evening and the API compares
 * against the company timezone.
 */
const todayLocal = () =>
  new Intl.DateTimeFormat("en-CA").format(new Date());

function SiteOperationsPage() {
  const { user } = useAuth();

  const ops = useSiteOperations();

  const [tab, setTab] = useState("material");

  // Set when the API refuses a backdated entry, so the UI can offer to
  // request access for that exact date.
  const [blockedEntry, setBlockedEntry] = useState(null);

  const isOffice = useMemo(
    () =>
      ["admin", "manager"].includes(
        String(user?.role || "").toLowerCase()
      ),
    [user]
  );

  useEffect(() => {
    ops.loadCatalog().catch(() => {});
    ops.loadMaterials().catch(() => {});
    // Intentionally only on mount — each tab loads its own data below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "labour") {
      ops.loadLabour().catch(() => {});
      ops.loadLabourCategories().catch(() => {});
    }

    if (tab === "banking") {
      ops.loadBanking().catch(() => {});
    }

    if (tab === "access") {
      ops.loadAccessRequests().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /**
   * Turns an API refusal into a usable next step.
   *
   * Returns true when the error was handled here.
   */
  const handleBlocked = (error, module, date) => {
    const body = error?.response?.data;

    if (body?.reason === "ACCESS_REQUIRED") {
      setBlockedEntry({ module, date, message: body.message });
      toast.error(body.message);
      return true;
    }

    toast.error(body?.message || "Could not save that entry.");
    return false;
  };

  return (
    <div className="site-operations-page">
      <header className="page-header">
        <h1>Site Operations</h1>
        <p className="page-subtitle">
          Record material, labour and banking for the site.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? "tab--active" : ""}`}
            onClick={() => setTab(t.key)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      {ops.error && (
        <div className="alert alert--error" role="alert">
          {ops.error}
          <button
            type="button"
            onClick={ops.clearError}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {blockedEntry && (
        <AccessPrompt
          blocked={blockedEntry}
          onCancel={() => setBlockedEntry(null)}
          onRequest={async (reason) => {
            try {
              const result = await ops.requestAccess({
                module: blockedEntry.module,
                target_date: blockedEntry.date,
                reason,
              });

              toast.success(result.message);
              setBlockedEntry(null);
            } catch {
              toast.error("Could not submit the access request.");
            }
          }}
        />
      )}

      <div className="tab-panel">
        {tab === "material" && (
          <MaterialTab
            ops={ops}
            onBlocked={handleBlocked}
            isOffice={isOffice}
          />
        )}

        {tab === "labour" && (
          <LabourTab ops={ops} onBlocked={handleBlocked} />
        )}

        {tab === "banking" && (
          <BankingTab
            ops={ops}
            onBlocked={handleBlocked}
            isOffice={isOffice}
          />
        )}

        {tab === "access" && (
          <AccessTab ops={ops} isOffice={isOffice} />
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Access prompt
|--------------------------------------------------------------------------
*/

function AccessPrompt({ blocked, onCancel, onRequest }) {
  const [reason, setReason] = useState("");

  return (
    <div className="alert alert--warning" role="alert">
      <p>{blocked.message}</p>

      <div className="flex-between" style={{ gap: 8, marginTop: 8 }}>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this entry late? (e.g. bill received late)"
          className="full-width"
        />

        <button
          type="button"
          onClick={() => onRequest(reason)}
        >
          Request access
        </button>

        <button type="button" className="secondary-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Material
|--------------------------------------------------------------------------
*/

function MaterialTab({ ops, onBlocked, isOffice }) {
  const [deciding, setDeciding] = useState(null);

  const decide = async (id, decision) => {
    try {
      setDeciding(id);

      const result = await ops.decideMaterial(id, decision);

      toast.success(
        result?.message ||
          `Entry ${decision === "approve" ? "approved" : "rejected"}.`
      );
    } catch {
      toast.error("Could not update that entry.");
    } finally {
      setDeciding(null);
    }
  };

  const emptyForm = {
    material_id: "",
    entry_date: todayLocal(),
    quantity: "",
    rate: "",
    bill_number: "",
    supplier_name: "",
    vehicle_number: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  // Two inputs: one opens the camera directly, the other the gallery.
  // The notes require the office to be able to tell them apart, so which
  // one was used is recorded alongside the file.
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const selected = ops.catalog.materials.find(
    (m) => String(m.id) === String(form.material_id)
  );

  const gstPercent = Number(selected?.default_gst_percent || 0);
  const amount = Number(form.quantity || 0) * Number(form.rate || 0);
  const gstAmount = (amount * gstPercent) / 100;

  const pickPhoto = (event, source) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setPhoto({
      file,
      source,
      // A camera capture is happening now; a gallery file carries its own
      // (older) modified time. Sending this lets the server corroborate a
      // "taken just now" claim rather than take it on trust.
      capturedAt:
        source === "camera"
          ? new Date().toISOString()
          : new Date(file.lastModified).toISOString(),
      previewUrl: URL.createObjectURL(file),
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.material_id || !form.quantity) {
      toast.error("Select a material and enter a quantity.");
      return;
    }

    setSaving(true);

    try {
      let photoUrl = null;

      if (photo?.file) {
        photoUrl = await uploadService.uploadFile(photo.file, {
          folder: "materials",
          module: uploadService.FILE_MODULES.SITE,
        });
      }

      await ops.addMaterial({
        ...form,
        quantity: Number(form.quantity),
        rate: Number(form.rate || 0),
        photo_url: photoUrl,
        photo_source: photo?.source ?? "unknown",
        photo_captured_at: photo?.capturedAt ?? null,
      });

      toast.success("Material entry recorded.");
      setForm(emptyForm);
      setPhoto(null);
    } catch (error) {
      onBlocked(error, "material", form.entry_date);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid-2">
      <form onSubmit={submit} className="card">
        <h2>Record material received</h2>

        <label>
          Material
          <select
            value={form.material_id}
            onChange={(e) =>
              setForm({ ...form, material_id: e.target.value })
            }
            required
          >
            <option value="">Select material…</option>

            {Object.entries(ops.catalog.sections).map(
              ([section, items]) => (
                <optgroup key={section} label={section}>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.name_local ? ` (${m.name_local})` : ""}
                    </option>
                  ))}
                </optgroup>
              )
            )}
          </select>
        </label>

        <label>
          Date
          <input
            type="date"
            value={form.entry_date}
            max={todayLocal()}
            onChange={(e) =>
              setForm({ ...form, entry_date: e.target.value })
            }
            required
          />
        </label>

        <div className="grid-2">
          <label>
            Quantity {selected ? `(${selected.unit})` : ""}
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
              required
            />
          </label>

          <label>
            Rate
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Bill number
            <input
              type="text"
              value={form.bill_number}
              onChange={(e) =>
                setForm({ ...form, bill_number: e.target.value })
              }
              placeholder="e.g. BVN1460"
            />
          </label>

          <label>
            Supplier
            <input
              type="text"
              value={form.supplier_name}
              onChange={(e) =>
                setForm({ ...form, supplier_name: e.target.value })
              }
            />
          </label>
        </div>

        <label>
          Vehicle number
          <input
            type="text"
            value={form.vehicle_number}
            onChange={(e) =>
              setForm({ ...form, vehicle_number: e.target.value })
            }
          />
        </label>

        {amount > 0 && (
          <p className="preview">
            {formatCurrency(amount)} + GST {gstPercent}% (
            {formatCurrency(gstAmount)}) ={" "}
            <strong>{formatCurrency(amount + gstAmount)}</strong>
          </p>
        )}

        <fieldset className="photo-picker">
          <legend>Photo</legend>

          {/* capture="environment" opens the rear camera on a phone. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => pickPhoto(e, "camera")}
          />

          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickPhoto(e, "gallery")}
          />

          <button
            type="button"
            className="secondary-btn"
            onClick={() => cameraRef.current?.click()}
          >
            Take photo
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => galleryRef.current?.click()}
          >
            Choose from gallery
          </button>

          {photo && (
            <div className="photo-preview">
              <img src={photo.previewUrl} alt="Selected material" />
              <span className={`badge badge--${photo.source}`}>
                {photo.source === "camera"
                  ? "Taken now"
                  : "From gallery"}
              </span>
            </div>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving…" : "Record material"}
        </button>
      </form>

      <section className="card">
        <h2>Recent entries</h2>

        {ops.materials.length === 0 ? (
          <p className="empty">Nothing recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Photo</th>
                  <th>Status</th>
                  {isOffice && <th>Decision</th>}
                </tr>
              </thead>
              <tbody>
                {ops.materials.map((m) => (
                  <tr key={m.id}>
                    <td>{m.entry_date}</td>
                    <td>{m.material_name}</td>
                    <td>
                      {m.quantity} {m.unit}
                    </td>
                    <td>{formatCurrency(m.total_amount)}</td>
                    <td>
                      {m.photo_url ? (
                        <span
                          className={`badge badge--${m.photo_source}`}
                          title={
                            m.photo_is_verified
                              ? "Camera capture, timestamp corroborated"
                              : "Source not corroborated"
                          }
                        >
                          {m.photo_source}
                          {m.photo_is_verified ? " ✓" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`status status--${m.approval_status}`}>
                        {m.approval_status}
                      </span>
                    </td>

                    {isOffice && (
                      <td>
                        <DecideCell
                          status={m.approval_status}
                          busy={deciding === m.id}
                          onDecide={(decision) => decide(m.id, decision)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Labour
|--------------------------------------------------------------------------
*/

function LabourTab({ ops, onBlocked }) {
  const [selectedId, setSelectedId] = useState(null);
  const { ledger } = useLabourLedger(selectedId);

  const [newLabour, setNewLabour] = useState({
    full_name: "",
    category: "kadiya",
    daily_rate: "",
    phone: "",
  });

  const [work, setWork] = useState({
    work_date: todayLocal(),
    days_worked: 1,
    amount_paid: "",
    work_description: "",
  });

  const addPerson = async (event) => {
    event.preventDefault();

    if (!newLabour.full_name.trim()) {
      toast.error("Enter the labourer's name.");
      return;
    }

    try {
      await ops.addLabour({
        ...newLabour,
        daily_rate: Number(newLabour.daily_rate || 0),
      });

      toast.success("Labourer added.");
      setNewLabour({
        full_name: "",
        category: "kadiya",
        daily_rate: "",
        phone: "",
      });
    } catch {
      toast.error("Could not add that labourer.");
    }
  };

  const logWork = async (event) => {
    event.preventDefault();

    if (!selectedId) {
      toast.error("Select a labourer first.");
      return;
    }

    try {
      await ops.addLabourWork(selectedId, {
        ...work,
        days_worked: Number(work.days_worked),
        amount_paid: Number(work.amount_paid || 0),
      });

      toast.success("Work recorded.");
      setWork({ ...work, amount_paid: "", work_description: "" });

      // Refresh the open ledger.
      setSelectedId((id) => id);
    } catch (error) {
      onBlocked(error, "labour", work.work_date);
    }
  };

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Labour</h2>

        <form onSubmit={addPerson} className="inline-form">
          <input
            type="text"
            placeholder="Name"
            value={newLabour.full_name}
            onChange={(e) =>
              setNewLabour({ ...newLabour, full_name: e.target.value })
            }
          />

          <select
            value={newLabour.category}
            onChange={(e) =>
              setNewLabour({ ...newLabour, category: e.target.value })
            }
          >
            {ops.labourCategories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.name_local ? ` (${c.name_local})` : ""}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Daily rate"
            value={newLabour.daily_rate}
            onChange={(e) =>
              setNewLabour({ ...newLabour, daily_rate: e.target.value })
            }
          />

          <button type="submit">
            Add
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Work</th>
              <th>Days</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {ops.labour.map((l) => (
              <tr
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={selectedId === l.id ? "row--selected" : ""}
                style={{ cursor: "pointer" }}
              >
                <td>{l.full_name}</td>
                <td>{l.category_local || l.category}</td>
                <td>{l.total_days}</td>
                <td>{formatCurrency(l.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {ops.labour.length === 0 && (
          <p className="empty">No labourers added yet.</p>
        )}
      </section>

      <section className="card">
        {!selectedId ? (
          <p className="empty">
            Select a labourer to see their account.
          </p>
        ) : (
          <>
            <h2>{ledger?.labour?.full_name}</h2>

            {ledger?.summary && (
              <div className="grid-3 summary-row">
                <div>
                  <span>Total wage</span>
                  <strong>
                    {formatCurrency(ledger.summary.total_wage)}
                  </strong>
                </div>
                <div>
                  <span>Paid</span>
                  <strong>
                    {formatCurrency(ledger.summary.total_paid)}
                  </strong>
                </div>
                <div>
                  <span>Outstanding</span>
                  <strong>
                    {formatCurrency(ledger.summary.outstanding)}
                  </strong>
                </div>
              </div>
            )}

            <form onSubmit={logWork} className="inline-form">
              <input
                type="date"
                value={work.work_date}
                max={todayLocal()}
                onChange={(e) =>
                  setWork({ ...work, work_date: e.target.value })
                }
              />

              <select
                value={work.days_worked}
                onChange={(e) =>
                  setWork({ ...work, days_worked: e.target.value })
                }
              >
                <option value={0.5}>Half day</option>
                <option value={1}>Full day</option>
                <option value={1.5}>Day + overtime</option>
              </select>

              <input
                type="number"
                placeholder="Paid"
                value={work.amount_paid}
                onChange={(e) =>
                  setWork({ ...work, amount_paid: e.target.value })
                }
              />

              <button type="submit">
                Record
              </button>
            </form>

            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Days</th>
                  <th>Wage</th>
                  <th>Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {(ledger?.entries ?? []).map((e) => (
                  <tr key={e.id}>
                    <td>{e.work_date}</td>
                    <td>{e.days_worked}</td>
                    <td>{formatCurrency(e.wage_amount)}</td>
                    <td>{formatCurrency(e.amount_paid)}</td>
                    <td>{formatCurrency(e.balance_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Banking
|--------------------------------------------------------------------------
*/

function BankingTab({ ops, onBlocked, isOffice }) {
  const [deciding, setDeciding] = useState(null);

  const { loadExpenses } = ops;

  useEffect(() => {
    loadExpenses().catch(() => {});
  }, [loadExpenses]);

  const decide = async (id, decision) => {
    try {
      setDeciding(id);

      const result = await ops.decideExpense(id, decision);

      toast.success(
        result?.message ||
          `Expense ${decision === "approve" ? "approved" : "rejected"}.`
      );
    } catch {
      toast.error("Could not update that expense.");
    } finally {
      setDeciding(null);
    }
  };

  const [expense, setExpense] = useState({
    expense_date: todayLocal(),
    category: "material",
    amount: "",
    payment_mode: "cash",
    description: "",
  });

  const summary = ops.banking?.summary;

  const submit = async (event) => {
    event.preventDefault();

    if (!expense.amount) {
      toast.error("Enter an amount.");
      return;
    }

    try {
      await ops.addExpense({
        ...expense,
        amount: Number(expense.amount),
      });

      toast.success("Expense recorded.");
      setExpense({ ...expense, amount: "", description: "" });
    } catch (error) {
      onBlocked(error, "banking", expense.expense_date);
    }
  };

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Money in hand</h2>

        {summary ? (
          <>
            <div className="grid-3 summary-row">
              <div>
                <span>Bank</span>
                <strong>{formatCurrency(summary.received.bank)}</strong>
              </div>
              <div>
                <span>Cash</span>
                <strong>{formatCurrency(summary.received.cash)}</strong>
              </div>
              <div>
                <span>GST cash</span>
                <strong>
                  {formatCurrency(summary.received.gst_cash)}
                </strong>
              </div>
            </div>

            <div className="grid-3 summary-row">
              <div>
                <span>Received</span>
                <strong>
                  {formatCurrency(summary.received_total)}
                </strong>
              </div>
              <div>
                <span>Spent</span>
                <strong>{formatCurrency(summary.spent_total)}</strong>
              </div>
              <div>
                <span>Balance</span>
                <strong>{formatCurrency(summary.balance)}</strong>
              </div>
            </div>
          </>
        ) : (
          <p className="empty">Loading…</p>
        )}
      </section>

      <form onSubmit={submit} className="card">
        <h2>Record spending</h2>

        <label>
          Date
          <input
            type="date"
            value={expense.expense_date}
            max={todayLocal()}
            onChange={(e) =>
              setExpense({ ...expense, expense_date: e.target.value })
            }
          />
        </label>

        <label>
          Category
          <select
            value={expense.category}
            onChange={(e) =>
              setExpense({ ...expense, category: e.target.value })
            }
          >
            {[
              "material",
              "labour",
              "fuel",
              "fastag",
              "transport",
              "food",
              "tools",
              "other",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label>
            Amount
            <input
              type="number"
              step="0.01"
              min="0"
              value={expense.amount}
              onChange={(e) =>
                setExpense({ ...expense, amount: e.target.value })
              }
              required
            />
          </label>

          <label>
            Paid by
            <select
              value={expense.payment_mode}
              onChange={(e) =>
                setExpense({ ...expense, payment_mode: e.target.value })
              }
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="upi">UPI</option>
              <option value="gst_cash">GST cash</option>
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea
            value={expense.description}
            onChange={(e) =>
              setExpense({ ...expense, description: e.target.value })
            }
            rows={2}
          />
        </label>

        <button type="submit">
          Record expense
        </button>
      </form>

      <section className="card">
        <h2>Recorded expenses</h2>

        {ops.expenses.length === 0 ? (
          <p className="empty">Nothing recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Paid by</th>
                  <th>Description</th>
                  <th>Status</th>
                  {isOffice && <th>Decision</th>}
                </tr>
              </thead>

              <tbody>
                {ops.expenses.map((row) => (
                  <tr key={row.id}>
                    <td>{row.expense_date}</td>
                    <td>{row.category}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{row.payment_mode}</td>
                    <td>{row.description || "—"}</td>
                    <td>
                      <span
                        className={`status status--${row.approval_status}`}
                      >
                        {row.approval_status}
                      </span>
                    </td>

                    {isOffice && (
                      <td>
                        <DecideCell
                          status={row.approval_status}
                          busy={deciding === row.id}
                          onDecide={(decision) => decide(row.id, decision)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Approve / reject
|--------------------------------------------------------------------------
|
| Material entries and supervisor expenses are both recorded as pending.
| The API could always decide them; nothing on screen could, so they
| stayed pending for ever.
|
*/

function DecideCell({ status, onDecide, busy }) {
  if (status !== "pending") {
    return <span className="muted-text">—</span>;
  }

  return (
    <div className="row-actions">
      <button
        type="button"
        className="secondary-btn"
        disabled={busy}
        onClick={() => onDecide("approve")}
      >
        Approve
      </button>

      <button
        type="button"
        className="delete-btn"
        disabled={busy}
        onClick={() => onDecide("reject")}
      >
        Reject
      </button>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Access requests
|--------------------------------------------------------------------------
*/

function AccessTab({ ops, isOffice }) {
  const act = async (id, action) => {
    try {
      const result =
        action === "grant"
          ? await siteOperationsService.grantAccessRequest(id, {
              hours: 24,
            })
          : await siteOperationsService.denyAccessRequest(id);

      toast.success(result.message);
      ops.loadAccessRequests().catch(() => {});
    } catch {
      toast.error("Could not update that request.");
    }
  };

  return (
    <section className="card">
      <h2>Backdated entry access</h2>

      {ops.accessRequests.length === 0 ? (
        <p className="empty">No access requests.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Requested by</th>
                <th>Module</th>
                <th>For date</th>
                <th>Age</th>
                <th>Reason</th>
                <th>Status</th>
                {isOffice && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {ops.accessRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.requested_by_name}</td>
                  <td>{r.module}</td>
                  <td>{r.target_date}</td>
                  <td>{r.days_old} days</td>
                  <td>{r.reason || "—"}</td>
                  <td>
                    <span className={`status status--${r.status}`}>
                      {r.status}
                    </span>
                  </td>

                  {isOffice && (
                    <td>
                      {r.status === "pending" ? (
                        <>
                          <button
                            type="button"
                           
                            onClick={() => act(r.id, "grant")}
                          >
                            Grant
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => act(r.id, "deny")}
                          >
                            Deny
                          </button>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default SiteOperationsPage;
