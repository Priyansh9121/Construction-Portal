import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getWorkerProfile,
  getWorkerAssignments,
  getWorkerDailyUpdates,
  createWorkerDailyUpdate,
  getWorkerTenderDocuments,
  getWorkerMoney,
  createWorkerPortalExpense,
} from "../services/workerPortalService";

import { uploadFile } from "../services/uploadService";

function WorkerPortalPage({ logout }) {
  const navigate = useNavigate();

  const [worker, setWorker] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [allocations, setAllocations] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [logDate, setLogDate] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    allocation_id: "",
    expense_amount: "",
    expense_date: "",
    expense_description: "",
  });

  const [expensePhoto, setExpensePhoto] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedAssignment = useMemo(() => {
    return assignments.find(
      (item) => String(item.assignment_id) === String(selectedAssignmentId)
    );
  }, [assignments, selectedAssignmentId]);

  const loadMoney = async () => {
    const moneyData = await getWorkerMoney();
    setAllocations(moneyData.allocations || []);
    setExpenses(moneyData.expenses || []);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const profileData = await getWorkerProfile();
      const assignmentData = await getWorkerAssignments();
      const updatesData = await getWorkerDailyUpdates();

      setWorker(profileData.worker);
      setAssignments(assignmentData.assignments || []);
      setUpdates(updatesData.updates || []);

      if (assignmentData.assignments?.length === 1) {
        setSelectedAssignmentId(String(assignmentData.assignments[0].assignment_id));
      }

      await loadMoney();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load worker portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLogDate(new Date().toISOString().split("T")[0]);
    setExpenseForm((prev) => ({
      ...prev,
      expense_date: new Date().toISOString().split("T")[0],
    }));
    loadData();
  }, []);

  useEffect(() => {
    async function loadDocuments() {
      if (!selectedAssignment?.tender_id) {
        setDocuments([]);
        return;
      }

      try {
        const data = await getWorkerTenderDocuments(selectedAssignment.tender_id);
        setDocuments(data.documents || []);
      } catch (err) {
        console.error("Failed to load documents", err);
      }
    }

    loadDocuments();
  }, [selectedAssignment]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleDailySubmit = async (e) => {
    e.preventDefault();

    if (!selectedAssignment) {
      setMessage("Please select an assigned site/tender.");
      return;
    }

    try {
      setSubmitLoading(true);
      setMessage("");

      let photoUrl = null;

      if (photoFile) {
        photoUrl = await uploadFile(photoFile, "worker-updates");
      }

      const result = await createWorkerDailyUpdate({
        site_id: selectedAssignment.site_id,
        tender_id: selectedAssignment.tender_id,
        log_date: logDate,
        notes,
        photo_url: photoUrl,
      });

      setNotes("");
      setPhotoFile(null);
      setPhotoPreview("");

      setMessage(
        result.message || "Daily update submitted successfully."
      );

      const updatesData = await getWorkerDailyUpdates();
      setUpdates(updatesData.updates || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to submit daily update");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleExpenseChange = (e) => {
    setExpenseForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    try {
      setExpenseLoading(true);
      setMessage("");

      let uploadedPhoto = null;

      if (expensePhoto) {
        uploadedPhoto = await uploadFile(expensePhoto, "worker-expenses");
      }

      const result = await createWorkerPortalExpense({
        ...expenseForm,
        uploaded_photo: uploadedPhoto,
      });

      setMessage(result.message || "Expense submitted for approval.");

      setExpenseForm({
        allocation_id: "",
        expense_amount: "",
        expense_date: new Date().toISOString().split("T")[0],
        expense_description: "",
      });

      setExpensePhoto(null);
      await loadMoney();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to submit expense.");
    } finally {
      setExpenseLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="worker-portal-page">
        <div className="panel">Loading worker portal...</div>
      </main>
    );
  }

  return (
    <main className="worker-portal-page">
      <section className="worker-header">
        <div>
          <h1>Worker Portal</h1>
          <p>Welcome back, {worker?.full_name}</p>
        </div>

        <button type="button" className="delete-btn" onClick={handleLogout}>
          Logout
        </button>
      </section>

      {message && <p className="success-message">{message}</p>}

      <section className="cards">
        <div className="card">
          <p>Worker</p>
          <h2>{worker?.full_name || "N/A"}</h2>
        </div>

        <div className="card">
          <p>Assignments</p>
          <h2>{assignments.length}</h2>
        </div>

        <div className="card">
          <p>Allocations</p>
          <h2>{allocations.length}</h2>
        </div>

        <div className="card">
          <p>Expenses</p>
          <h2>{expenses.length}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>Submit Daily Update</h2>

          <form className="payment-form" onSubmit={handleDailySubmit}>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              required
            >
              <option value="">Select Assigned Site / Tender</option>
              {assignments.map((item) => (
                <option key={item.assignment_id} value={item.assignment_id}>
                  {item.site_name} - {item.tender_title}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              required
            />

            <textarea
              placeholder="Daily work notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <input type="file" accept="image/*" onChange={handlePhotoChange} />

            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                style={{ width: "120px", borderRadius: "8px" }}
              />
            )}

            <button type="submit" disabled={submitLoading}>
              {submitLoading ? "Submitting..." : "Submit Update"}
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Submit Expense</h2>

          <form className="payment-form" onSubmit={handleExpenseSubmit}>
            <select
              name="allocation_id"
              value={expenseForm.allocation_id}
              onChange={handleExpenseChange}
              required
            >
              <option value="">Select Allocation</option>
              {allocations
                .filter((item) => item.approval_status === "approved")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    ${Number(item.allocated_amount || 0).toFixed(2)} -{" "}
                    {item.purpose || "No purpose"}
                  </option>
                ))}
            </select>

            <input
              name="expense_amount"
              type="number"
              placeholder="Expense Amount"
              value={expenseForm.expense_amount}
              onChange={handleExpenseChange}
              required
            />

            <input
              name="expense_date"
              type="date"
              value={expenseForm.expense_date}
              onChange={handleExpenseChange}
              required
            />

            <textarea
              name="expense_description"
              placeholder="Expense details"
              value={expenseForm.expense_description}
              onChange={handleExpenseChange}
            />

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setExpensePhoto(e.target.files?.[0] || null)}
            />

            <button type="submit" disabled={expenseLoading}>
              {expenseLoading ? "Submitting..." : "Submit Expense"}
            </button>
          </form>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>My Documents</h2>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>File</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.document_name}</td>
                  <td>{doc.document_type}</td>
                  <td>
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {documents.length === 0 && (
                <tr>
                  <td colSpan="3">No documents found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>My Recent Updates</h2>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Tender</th>
                <th>Notes</th>
                <th>Photo</th>
              </tr>
            </thead>

            <tbody>
              {updates.map((item) => (
                <tr key={item.id}>
                  <td>{item.log_date?.slice(0, 10)}</td>
                  <td>{item.site_name}</td>
                  <td>{item.tender_title}</td>
                  <td>{item.notes}</td>
                  <td>
                    {item.photo_url ? (
                      <a href={item.photo_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {updates.length === 0 && (
                <tr>
                  <td colSpan="5">No updates found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>My Allocations</h2>

          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {allocations.map((item) => (
                <tr key={item.id}>
                  <td>${Number(item.allocated_amount || 0).toFixed(2)}</td>
                  <td>{item.purpose}</td>
                  <td>{item.approval_status}</td>
                  <td>{item.created_at?.slice(0, 10)}</td>
                </tr>
              ))}

              {allocations.length === 0 && (
                <tr>
                  <td colSpan="4">No allocations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>My Expenses</h2>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td>{item.expense_date?.slice(0, 10)}</td>
                  <td>${Number(item.expense_amount || 0).toFixed(2)}</td>
                  <td>{item.expense_description}</td>
                  <td>{item.approval_status}</td>
                  <td>
                    {item.uploaded_photo ? (
                      <a href={item.uploaded_photo} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td colSpan="5">No expenses found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default WorkerPortalPage;