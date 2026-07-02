import { useState } from "react";


import LoginPage from "./pages/LoginPage";

import { useAuth } from "./contexts/AuthContext";

import usePayments from "./hooks/usePayments";
import useWorkers from "./hooks/useWorkers";
import useSites from "./hooks/useSites";
import useTenders from "./hooks/useTenders";
import useInvoices from "./hooks/useInvoices";
import useSiteLogs from "./hooks/useSiteLogs";
import useWorkerMoney from "./hooks/useWorkerMoney";

import { loginUser } from "./services/authService";
import { uploadSitePhoto } from "./services/siteLogService";

import AppRoutes from "./routes/AppRoutes";

function App() {
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("");
  const { user, setUser, logout } = useAuth();
  const [message, setMessage] = useState("");

  const {
    payments,
    addPayment: savePayment,
    removePayment: deletePaymentRecord,
    fetchPayments,
  } = usePayments(user);

  const {
    workers,
    addWorker: saveWorker,
    removeWorker: deleteWorkerRecord,
    fetchWorkers,
  } = useWorkers(user);

  const {
    sites,
    addSite: saveSite,
    removeSite: deleteSiteRecord,
    fetchSites,
  } = useSites(user);

  const {
    tenders,
    addTender: saveTender,
    removeTender: deleteTenderRecord,
    fetchTenders,
  } = useTenders(user);

  const {
    invoices,
    addInvoice: saveInvoice,
    removeInvoice: deleteInvoiceRecord,
    fetchInvoices,
  } = useInvoices(user);

  const {
    siteLogs,
    addSiteLog: saveSiteLog,
    removeSiteLog: deleteSiteLogRecord,
  } = useSiteLogs(user);

  const {
    allocations,
    expenses,
    addAllocation: saveAllocation,
    addExpense: saveExpense,
  } = useWorkerMoney(user);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const data = await loginUser({
        email,
        password,
      });

      setUser(data.user);

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );
      
      localStorage.setItem(
        "token",
        data.token
      );
      
      setMessage("");
      
      
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const addPayment = async (paymentData) => {
    try {
      console.log("Payment payload from App:", paymentData);
  
      await savePayment({
        company_id: null,
        payment_type: paymentData.payment_type,
        category: paymentData.category || paymentData.payment_sub_type,
        amount: Number(paymentData.amount || 0),
        description: paymentData.description || "",
        payment_date: paymentData.payment_date,
  
        payment_scope: paymentData.payment_scope || null,
        payment_sub_type: paymentData.payment_sub_type || null,
        tender_id: paymentData.tender_id || null,
        site_id: paymentData.site_id || null,
        material_name: paymentData.material_name || null,
        quantity: Number(paymentData.quantity || 0),
        gst_amount: Number(paymentData.gst_amount || 0),
        collected_gst: Number(paymentData.collected_gst || 0),
        payment_mode: paymentData.payment_mode || null,
        details: paymentData.details || null,
        worker_name: paymentData.worker_name || null,
        investor_name: paymentData.investor_name || null,
        interest_percent: Number(paymentData.interest_percent || 0),
        fd_site: paymentData.fd_site || null,
        created_by: user?.id || null,
      });
  
      await fetchPayments();
    } catch (err) {
      console.error("Failed to save payment", err.response?.data || err);
      throw err;
    }
  };

  const addWorker = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newWorker = {
      company_id: null,
      full_name: form.full_name.value,
      phone: form.phone.value,
      salary: Number(form.salary.value),
      role: form.role.value,
      status: form.status.value,
    };

    try {
      await saveWorker(newWorker);
      form.reset();
    } catch (err) {
      console.error("Failed to add worker", err);
    }
  };

  const deleteWorker = async (id) => {
    try {
      await deleteWorkerRecord(id);
    } catch (err) {
      console.error("Failed to delete worker", err);
    }
  };

  const addSite = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newSite = {
      company_id: null,
      site_type: form.site_type.value,
      site_name: form.site_name.value,
      address: form.address.value,
      status: form.status.value,
    };

    try {
      await saveSite(newSite);
      form.reset();
    } catch (err) {
      console.error("Failed to add site", err);
    }
  };

  const deleteSite = async (id) => {
    try {
      await deleteSiteRecord(id);
    } catch (err) {
      console.error("Failed to delete site", err);
    }
  };

  const addTender = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newTender = {
      company_id: null,
      site_id: form.site_id.value ? Number(form.site_id.value) : null,
      title: form.title.value,
      status: form.status.value,
      due_date: form.due_date.value,
      description: form.description.value,
      estimated_value: form.estimated_value.value
        ? Number(form.estimated_value.value)
        : 0,
    };

    try {
      await saveTender(newTender);
      form.reset();
    } catch (err) {
      console.error("Failed to add tender", err);
    }
  };

  const deleteTender = async (id) => {
    try {
      await deleteTenderRecord(id);
    } catch (err) {
      console.error("Failed to delete tender", err);
    }
  };

  const addInvoice = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newInvoice = {
      company_id: null,
      tender_id: null,
      invoice_number: form.invoice_number.value,
      amount: Number(form.amount.value),
      status: form.status.value,
    };

    try {
      await saveInvoice(newInvoice);
      form.reset();
    } catch (err) {
      console.error("Failed to add invoice", err);
    }
  };

  const deleteInvoice = async (id) => {
    try {
      await deleteInvoiceRecord(id);
    } catch (err) {
      console.error("Failed to delete invoice", err);
    }
  };

  const addAllocation = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newAllocation = {
      worker_id: Number(form.worker_id.value),
      allocated_amount: Number(form.allocated_amount.value),
      purpose: form.purpose.value,
      allocated_by: user.id,
    };

    try {
      await saveAllocation(newAllocation);
      form.reset();
    } catch (err) {
      console.error("Failed to add allocation", err);
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newExpense = {
      allocation_id: Number(form.allocation_id.value),
      expense_amount: Number(form.expense_amount.value),
      expense_description: form.expense_description.value,
      expense_date: form.expense_date.value,
      uploaded_photo: null,
    };

    try {
      await saveExpense(newExpense);
      form.reset();
    } catch (err) {
      console.error("Failed to add expense", err);
    }
  };

  const addSiteLog = async (e) => {
    e.preventDefault();
  
    const form = e.target;
    let photoUrl = null;

    const selectedDate = new Date(form.log_date.value);
    const today = new Date();

    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (today - selectedDate) / (1000 * 60 * 60 * 24)
    );

    if (diffDays > 3 && user?.role !== "admin") {
      alert(
        "You cannot add a photo/update older than 3 days. Please ask admin permission."
      );
      return;
    }

    if (diffDays < 0) {
      alert("You cannot add a daily update for a future date.");
      return;
    }
  
    try {
      const selectedPhoto =
        form.camera_photo.files[0] ||
        form.gallery_photo.files[0];
  
      if (selectedPhoto) {
        const formData = new FormData();
        formData.append("photo", selectedPhoto);
  
        const uploadRes = await uploadSitePhoto(formData);
        photoUrl = uploadRes.fileUrl;
      }
  
      const newLog = {
        site_id: Number(form.site_id.value),
        tender_id: form.tender_id.value ? Number(form.tender_id.value) : null,
        worker_id: Number(form.worker_id.value),
        log_date: form.log_date.value,
        notes: form.notes.value,
        photo_url: photoUrl,
      };
  
      await saveSiteLog(newLog);
      form.reset();
    } catch (err) {
      console.error("Failed to add site log", err.response?.data || err);
      alert(err.response?.data?.message || "Failed to add daily site update");
    }
  };

  return (
    <AppRoutes
      // AUTH
      user={user}
      logout={logout}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      message={message}
      handleLogin={handleLogin}

      // PAYMENTS
      payments={payments}
      addPayment={addPayment}
      deletePayment={deletePaymentRecord}
      fetchPayments={fetchPayments}

      // WORKERS
      workers={workers}
      addWorker={addWorker}
      deleteWorker={deleteWorker}
      fetchWorkers={fetchWorkers}

      // SITES
      sites={sites}
      addSite={addSite}
      deleteSite={deleteSite}
      fetchSites={fetchSites}

      // TENDERS
      tenders={tenders}
      addTender={addTender}
      deleteTender={deleteTender}
      fetchTenders={fetchTenders}

      // INVOICES
      invoices={invoices}
      addInvoice={addInvoice}
      deleteInvoice={deleteInvoice}
      fetchInvoices={fetchInvoices}

      // DAILY UPDATES
      siteLogs={siteLogs}
      addSiteLog={addSiteLog}
      deleteSiteLog={deleteSiteLogRecord}

      // WORKER MONEY
      allocations={allocations}
      expenses={expenses}
      addAllocation={addAllocation}
      addExpense={addExpense}
    />
  );
}

export default App;