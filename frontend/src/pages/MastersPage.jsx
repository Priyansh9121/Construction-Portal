import {
  useCallback,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import useAsyncResource from "../hooks/useAsyncResource";

import {
  getInvestors,
  getSuppliers,
  getClients,
  createMaster,
  updateMaster,
  archiveMaster,
  getInvestorStatement,
} from "../services/masterService";

import { formatCurrency } from "../utils/currency";

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
| Investors, suppliers and clients. All three existed in the database with
| an API in front of them and nothing on screen, so a payment could only
| name an investor as free text — which makes "what do we owe this
| investor across every tender" unanswerable.
|
| The three share a shape, so one screen serves all of them. Investors get
| one extra thing: a statement pulling every payment to and from them
| across all tenders, with interest accrued to today.
|
*/

const TABS = [
  {
    key: "investors",
    label: "Investors",
    fetcher: getInvestors,
    blurb: "People who put money in. Their statement totals the interest owed.",
    hasGst: false,
  },
  {
    key: "suppliers",
    label: "Suppliers",
    fetcher: getSuppliers,
    blurb: "Where material comes from. Recorded against material entries.",
    hasGst: true,
  },
  {
    key: "clients",
    label: "Clients",
    fetcher: getClients,
    blurb: "Who the work is for. A tender points at one.",
    hasGst: true,
  },
];

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gst_number: "",
  notes: "",
  status: "active",
};

const money = formatCurrency;

function MastersPage() {
  const [activeTab, setActiveTab] = useState("investors");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statement, setStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const tab = TABS.find((item) => item.key === activeTab) ?? TABS[0];

  const load = useCallback(() => tab.fetcher(), [tab]);

  const {
    data: records,
    loading,
    error,
    reload,
  } = useAsyncResource(load, { label: tab.label.toLowerCase() });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return records;
    }

    return records.filter((record) =>
      [record.name, record.phone, record.email, record.gst_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [records, search]);

  const totals = useMemo(
    () => ({
      total: records.length,
      active: records.filter(
        (record) => String(record.status || "active") === "active"
      ).length,
    }),
    [records]
  );

  const switchTab = (key) => {
    setActiveTab(key);
    setForm(EMPTY_FORM);
    setEditing(null);
    setSearch("");
    setStatement(null);
  };

  const startEdit = (record) => {
    setEditing(record);

    setForm({
      name: record.name || "",
      phone: record.phone || "",
      email: record.email || "",
      address: record.address || "",
      gst_number: record.gst_number || "",
      notes: record.notes || "",
      status: record.status || "active",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    const name = form.name.trim();

    if (!name) {
      toast.error("A name is required.");

      return;
    }

    const payload = {
      name,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      ...(tab.hasGst
        ? { gst_number: form.gst_number.trim() || null }
        : {}),
    };

    try {
      setSaving(true);

      if (editing) {
        await updateMaster(tab.key, editing.id, payload);
        toast.success(`${tab.label.slice(0, -1)} updated.`);
      } else {
        await createMaster(tab.key, payload);
        toast.success(`${tab.label.slice(0, -1)} added.`);
      }

      cancelEdit();
      await reload({ showLoader: false });
    } catch (caught) {
      toast.error(
        caught?.response?.data?.message ||
          caught?.message ||
          "Could not save the record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!deleteTarget || deleting) {
      return;
    }

    try {
      setDeleting(true);

      await archiveMaster(tab.key, deleteTarget.id);

      toast.success(`${deleteTarget.name} archived.`);

      if (editing?.id === deleteTarget.id) {
        cancelEdit();
      }

      setDeleteTarget(null);
      await reload({ showLoader: false });
    } catch (caught) {
      toast.error(
        caught?.response?.data?.message ||
          caught?.message ||
          "Could not archive the record."
      );
    } finally {
      setDeleting(false);
    }
  };

  const openStatement = async (investor) => {
    try {
      setStatementLoading(true);
      setStatement(null);

      const result = await getInvestorStatement(investor.id);

      setStatement(result);
    } catch (caught) {
      toast.error(
        caught?.response?.data?.message ||
          caught?.message ||
          "Could not load the statement."
      );
    } finally {
      setStatementLoading(false);
    }
  };

  const exportRows = filtered.map((record) => ({
    Name: record.name,
    Phone: record.phone || "-",
    Email: record.email || "-",
    ...(tab.hasGst ? { GST: record.gst_number || "-" } : {}),
    Address: record.address || "-",
    Status: record.status || "active",
  }));

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Master Data</h2>

            <p className="muted-text">
              Investors, suppliers and clients. Recording them here lets a
              payment reference a real record instead of a typed-in name.
            </p>
          </div>

          <ExportButtons
            filename={tab.key}
            title={`${tab.label} Register`}
            subtitle="Construction Portal master data"
            rows={exportRows}
            columns={Object.keys(exportRows[0] || { Name: "" })}
          />
        </div>

        <div className="tab-row">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                item.key === activeTab ? "tab-button active" : "tab-button"
              }
              onClick={() => switchTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="muted-text">{tab.blurb}</p>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total {tab.label}</p>
          <h2>{totals.total}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active</p>
          <h2>{totals.active}</h2>
        </div>

        <div className="card">
          <p>Showing</p>
          <h2>{filtered.length}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editing
                  ? `Edit ${tab.label.slice(0, -1)}`
                  : `Add ${tab.label.slice(0, -1)}`}
              </h2>
            </div>
          </div>

          <form className="payment-form" onSubmit={handleSubmit}>
            <label htmlFor="master-name">Name</label>
            <input
              id="master-name"
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Full name or business name"
              required
            />

            <label htmlFor="master-phone">Phone</label>
            <input
              id="master-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  phone: event.target.value,
                }))
              }
              placeholder="10-digit number"
            />

            <label htmlFor="master-email">Email</label>
            <input
              id="master-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />

            {tab.hasGst && (
              <>
                <label htmlFor="master-gst">GST Number</label>
                <input
                  id="master-gst"
                  value={form.gst_number}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      gst_number: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="24ABCDE1234F1Z5"
                />
              </>
            )}

            <label htmlFor="master-address">Address</label>
            <input
              id="master-address"
              value={form.address}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  address: event.target.value,
                }))
              }
            />

            <label htmlFor="master-notes">Notes</label>
            <textarea
              id="master-notes"
              rows={2}
              value={form.notes}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />

            <label htmlFor="master-status">Status</label>
            <select
              id="master-status"
              value={form.status}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  status: event.target.value,
                }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : `Add ${tab.label.slice(0, -1)}`}
              </button>

              {editing && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>{tab.label}</h2>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${tab.label.toLowerCase()}`}
              aria-label={`Search ${tab.label.toLowerCase()}`}
            />
          </div>

          {loading && <p className="muted-text">Loading {tab.label.toLowerCase()}...</p>}

          {error && !loading && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="muted-text">
              {records.length === 0
                ? `No ${tab.label.toLowerCase()} recorded yet.`
                : "Nothing matches that search."}
            </p>
          )}

          {filtered.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    {tab.hasGst && <th>GST</th>}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.name}</strong>

                        {record.address && (
                          <>
                            <br />
                            <small className="muted-text">
                              {record.address}
                            </small>
                          </>
                        )}
                      </td>

                      <td>
                        {record.phone || "-"}

                        {record.email && (
                          <>
                            <br />
                            <small className="muted-text">
                              {record.email}
                            </small>
                          </>
                        )}
                      </td>

                      {tab.hasGst && <td>{record.gst_number || "-"}</td>}

                      <td>
                        <span
                          className={
                            String(record.status || "active") === "active"
                              ? "badge green"
                              : "badge yellow"
                          }
                        >
                          {record.status || "active"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => startEdit(record)}
                        >
                          Edit
                        </button>

                        {activeTab === "investors" && (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => openStatement(record)}
                          >
                            Statement
                          </button>
                        )}

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => setDeleteTarget(record)}
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {(statementLoading || statement) && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Investor Statement
                {statement?.investor ? ` — ${statement.investor.name}` : ""}
              </h2>

              <p className="muted-text">
                Everything taken from and returned to this investor, across
                every tender, with interest accrued to today.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => setStatement(null)}
            >
              Close
            </button>
          </div>

          {statementLoading && <p className="muted-text">Loading statement...</p>}

          {statement?.summary && (
            <div className="summary-cards">
              <div className="card">
                <p>Taken In</p>
                <h2>{money(statement.summary.total_received)}</h2>
              </div>

              <div className="card">
                <p>Returned</p>
                <h2>{money(statement.summary.total_returned)}</h2>
              </div>

              <div className="card highlight-warning">
                <p>Interest Accrued</p>
                <h2>{money(statement.summary.interest_accrued)}</h2>
              </div>

              <div className="card highlight-danger">
                <p>Outstanding</p>
                <h2>{money(statement.summary.outstanding)}</h2>
              </div>
            </div>
          )}

          {statement?.entries?.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tender</th>
                    <th>Direction</th>
                    <th>Amount</th>
                    <th>Rate</th>
                    <th>Days</th>
                    <th>Interest</th>
                  </tr>
                </thead>

                <tbody>
                  {statement.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.payment_date || "-"}</td>
                      <td>{entry.tender_title || "-"}</td>
                      <td>
                        <span
                          className={
                            entry.payment_direction === "income"
                              ? "badge green"
                              : "badge yellow"
                          }
                        >
                          {entry.payment_direction === "income"
                            ? "Taken in"
                            : "Returned"}
                        </span>
                      </td>
                      <td>{money(entry.amount)}</td>
                      <td>
                        {entry.interest_percent
                          ? `${entry.interest_percent}%`
                          : "-"}
                      </td>
                      <td>{entry.days_accrued ?? "-"}</td>
                      <td>{money(entry.interest_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statement && !statementLoading && !statement.entries?.length && (
            <p className="muted-text">
              No payments recorded against this investor yet.
            </p>
          )}
        </section>
      )}

      <DeleteVerificationModal
        open={Boolean(deleteTarget)}
        itemName={deleteTarget?.name || ""}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleArchive}
      />
    </>
  );
}

export default MastersPage;
