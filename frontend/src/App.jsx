import { useState } from "react";
import "./App.css";

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
  const { user, setUser } = useAuth();
  const [message, setMessage] = useState("");

  const {
    payments,
    addPayment: savePayment,
    removePayment: deletePaymentRecord,
  } = usePayments(user);

  const {
    workers,
    addWorker: saveWorker,
    removeWorker: deleteWorkerRecord,
  } = useWorkers(user);

  const {
    sites,
    addSite: saveSite,
    removeSite: deleteSiteRecord,
  } = useSites(user);

  const {
    tenders,
    addTender: saveTender,
    removeTender: deleteTenderRecord,
  } = useTenders(user);

  const {
    invoices,
    addInvoice: saveInvoice,
    removeInvoice: deleteInvoiceRecord,
  } = useInvoices(user);

  const {
    siteLogs,
    addSiteLog: saveSiteLog,
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
      
      window.location.reload();
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const addPayment = async (e) => {
    e.preventDefault();

    const form = e.target;

    const newPayment = {
      company_id: null,
      payment_type: form.payment_type.value,
      category: form.category.value,
      amount: Number(form.amount.value),
      description: form.description.value,
      payment_date: form.payment_date.value,
      created_by: user.id,
    };

    try {
      await savePayment(newPayment);
      form.reset();
    } catch (err) {
      console.error("Failed to save payment", err.response?.data || err);
    }
  };

  const deletePayment = async (id) => {
    try {
      await deletePaymentRecord(id);
    } catch (err) {
      console.error("Failed to delete payment", err);
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
      worker_id: Number(form.worker_id.value),
      log_date: form.log_date.value,
      notes: form.notes.value,
      photo_url: photoUrl,
    };

    try {
      await saveSiteLog(newLog);
      form.reset();
    } catch (err) {
      console.error("Failed to add site log", err);
    }
  };

  return (
    <AppRoutes
      user={user}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      message={message}
      handleLogin={handleLogin}
      payments={payments}
      addPayment={addPayment}
      deletePayment={deletePayment}
      workers={workers}
      addWorker={addWorker}
      deleteWorker={deleteWorker}
      sites={sites}
      addSite={addSite}
      deleteSite={deleteSite}
      tenders={tenders}
      addTender={addTender}
      deleteTender={deleteTender}
      invoices={invoices}
      addInvoice={addInvoice}
      deleteInvoice={deleteInvoice}
      siteLogs={siteLogs}
      addSiteLog={addSiteLog}
      allocations={allocations}
      expenses={expenses}
      addAllocation={addAllocation}
      addExpense={addExpense}
    />
  );
}

export default App;