import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWorkerProfile,
  getWorkerAssignments,
  getWorkerDailyUpdates,
  createWorkerDailyUpdate,
  getWorkerTenderDocuments,
} from "../services/workerPortalService";
import { uploadSitePhoto } from "../services/siteLogService";

function WorkerPortalPage({ logout }) {
  const navigate = useNavigate();

  const [worker, setWorker] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [logDate, setLogDate] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedAssignment = useMemo(() => {
    return assignments.find(
      (item) => String(item.assignment_id) === String(selectedAssignmentId)
    );
  }, [assignments, selectedAssignmentId]);

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
        setSelectedAssignmentId(
          String(assignmentData.assignments[0].assignment_id)
        );
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load worker portal");
    } finally {
      setLoading(false);
    }
  };

 

  useEffect(() => {
    setLogDate(new Date().toISOString().split("T")[0]);
    loadData();
  }, []);

  useEffect(() => {
    async function loadDocuments() {
      if (!selectedAssignment?.tender_id) return;
  
      try {
        const data = await getWorkerTenderDocuments(
          selectedAssignment.tender_id
        );
  
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

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const handleSubmit = async (e) => {
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
        const formData = new FormData();
        formData.append("photo", photoFile);

        const uploadRes = await uploadSitePhoto(formData);
        photoUrl = uploadRes.fileUrl;
      }

      const result = await createWorkerDailyUpdate({
        site_id: selectedAssignment.site_id,
        tender_id: selectedAssignment.tender_id,
        log_date: logDate,
        notes,
        photo_url: photoUrl,
      });
      
      console.log("DAILY UPDATE RESPONSE:", result);
      
      setNotes("");
      setPhotoFile(null);
      setPhotoPreview("");
      
      if (result.requiresApproval) {
        setMessage(
          result.message ||
            "This update has been sent to admin for approval."
        );
        return;
      }
      
      setMessage("Daily update submitted successfully.");
      
      const updatesData = await getWorkerDailyUpdates();
      setUpdates(updatesData.updates || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to submit daily update");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="payment-grid">
        <div className="panel">
          <h2>Worker Portal</h2>
          <p>Loading worker portal...</p>
        </div>
      </section>
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

      {message && (
        <p className="success-message">
          {message}
        </p>
      )}

      <section className="cards">
        <div className="card">
          <p>Worker</p>
          <h2>{worker?.full_name || "N/A"}</h2>
        </div>

        <div className="card">
          <p>Assigned Jobs</p>
          <h2>{assignments.length}</h2>
        </div>

        <div className="card">
          <p>Daily Updates</p>
          <h2>{updates.length}</h2>
        </div>

        <div className="card">
          <p>Status</p>
          <h2>{worker?.worker_status || "N/A"}</h2>
        </div>
      </section>

      <section className="worker-grid">
        <div className="panel">
          <h2>My Profile</h2>

          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>{worker?.full_name}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>{worker?.login_email}</td>
              </tr>
              <tr>
                <th>Role</th>
                <td>{worker?.worker_job_role}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>{worker?.worker_status}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Submit Daily Update</h2>

          <form className="payment-form" onSubmit={handleSubmit}>
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write today's work progress..."
              rows="4"
            />

            <label>Take Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
            />

            <label>Upload Existing Photo</label>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />

            {photoPreview && (
              <div>
                <p>Photo Preview</p>
                <img
                  src={photoPreview}
                  alt="Selected progress"
                  className="worker-photo-preview"
                />
                <button type="button" onClick={removePhoto}>
                  Remove Photo
                </button>
              </div>
            )}

            <button type="submit" disabled={submitLoading}>
              {submitLoading ? "Submitting..." : "Submit Update"}
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>My Assigned Work</h2>

          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Tender</th>
                <th>Status</th>
                <th>Address</th>
              </tr>
            </thead>

            <tbody>
              {assignments.map((item) => (
                <tr key={item.assignment_id}>
                  <td>{item.site_name}</td>
                  <td>
                    <strong>{item.tender_title}</strong>
                  </td>
                  <td>{item.tender_status}</td>
                  <td>{item.address}</td>
                </tr>
              ))}

              {assignments.length === 0 && (
                <tr>
                  <td colSpan="4">No assigned work found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
            <h2>Tender Documents</h2>

            <table>
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Download</th>
                </tr>
                </thead>

                <tbody>
                {documents.map((doc) => (
                    <tr key={doc.id}>
                    <td>{doc.document_name}</td>
                    <td>{doc.document_type}</td>

                    <td>
                    <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        >
                        Open
                        </a>

                        {" | "}

                        <a href={doc.file_url} download>
                        Download
                        </a>
                    </td>
                    </tr>
                ))}

                {documents.length === 0 && (
                    <tr>
                    <td colSpan="3">
                        No documents uploaded.
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>

        

        <div className="panel">
          <h2>My Daily Updates</h2>

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
              {updates.map((update) => (
                <tr key={update.id}>
                  <td>{update.log_date?.slice(0, 10)}</td>
                  <td>{update.site_name}</td>
                  <td>{update.tender_title}</td>
                  <td>{update.notes}</td>
                  <td>
                  {update.photo_url ? (
                    <>
                        <a href={update.photo_url} target="_blank" rel="noreferrer">
                        Open
                        </a>

                        <br />

                        <img
                        src={update.photo_url}
                        alt="Site Update"
                        className="worker-photo-thumb"
                        />
                    </>
                    ) : (
                    "No photo"
                    )}
                  </td>
                </tr>
              ))}

              {updates.length === 0 && (
                <tr>
                  <td colSpan="5">No daily updates yet.</td>
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