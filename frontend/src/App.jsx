import { useState } from "react";

import { useAuth } from "./contexts/AuthContext";

import usePayments from "./hooks/usePayments";
import useSites from "./hooks/useSites";
import useTenders from "./hooks/useTenders";
import useInvoices from "./hooks/useInvoices";
import useSiteLogs from "./hooks/useSiteLogs";
import useWorkerMoney from "./hooks/useWorkerMoney";
import useWorkers from "./hooks/useWorkers";

import { loginUser } from "./services/authService";
import { uploadFile } from "./services/uploadService";

import AppRoutes from "./routes/AppRoutes";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const { user, setUser, logout } = useAuth();

  const { workers } = useWorkers(user);
  const { sites } = useSites(user);

  const {
    payments,
    addPayment: savePayment,
    removePayment: deletePaymentRecord,
    fetchPayments,
  } = usePayments(user);

  const { tenders } = useTenders(user);

  const { invoices } = useInvoices(user);

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
    fetchAllocations,
    fetchExpenses,
    updateAllocation,
    deleteAllocation,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
  } = useWorkerMoney(user);

  const handleLogout = () => {
    logout();
    setEmail("");
    setPassword("");
    setMessage("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setMessage("");

      const data = await loginUser({
        email: email.trim(),
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

      setPassword("");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Login failed"
      );
    }
  };

  const addPayment = async (paymentData) => {
    try {
      await savePayment({
        company_id: user?.company_id || null,
        payment_type:
          paymentData.payment_type,
        category:
          paymentData.category ||
          paymentData.payment_sub_type,
        amount: Number(
          paymentData.amount || 0
        ),
        description:
          paymentData.description || "",
        payment_date:
          paymentData.payment_date,

        payment_scope:
          paymentData.payment_scope || null,
        payment_sub_type:
          paymentData.payment_sub_type || null,
        tender_id:
          paymentData.tender_id || null,
        site_id:
          paymentData.site_id || null,
        material_name:
          paymentData.material_name || null,
        quantity: Number(
          paymentData.quantity || 0
        ),
        gst_amount: Number(
          paymentData.gst_amount || 0
        ),
        collected_gst: Number(
          paymentData.collected_gst || 0
        ),
        payment_mode:
          paymentData.payment_mode || null,
        details:
          paymentData.details || null,
        worker_name:
          paymentData.worker_name || null,
        investor_name:
          paymentData.investor_name || null,
        interest_percent: Number(
          paymentData.interest_percent || 0
        ),
        fd_site:
          paymentData.fd_site || null,
        created_by:
          user?.id || null,
      });

      await fetchPayments();
    } catch (error) {
      console.error(
        "Failed to save payment:",
        error.response?.data || error
      );

      throw error;
    }
  };

  const addAllocation = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    const newAllocation = {
      worker_id: Number(
        form.worker_id.value
      ),
      allocated_amount: Number(
        form.allocated_amount.value || 0
      ),
      purpose:
        form.purpose.value.trim(),
      allocated_by:
        user?.id || null,
    };

    try {
      await saveAllocation(
        newAllocation
      );

      form.reset();
    } catch (error) {
      console.error(
        "Failed to add allocation:",
        error.response?.data || error
      );
    }
  };

  const addExpense = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    const newExpense = {
      allocation_id: Number(
        form.allocation_id.value
      ),
      expense_amount: Number(
        form.expense_amount.value || 0
      ),
      expense_description:
        form.expense_description.value.trim(),
      expense_date:
        form.expense_date.value,
      uploaded_photo: null,
    };

    try {
      await saveExpense(newExpense);
      form.reset();
    } catch (error) {
      console.error(
        "Failed to add expense:",
        error.response?.data || error
      );
    }
  };

  const addSiteLog = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    let photoUrl = null;

    const selectedDate = new Date(
      form.log_date.value
    );

    const today = new Date();

    selectedDate.setHours(
      0,
      0,
      0,
      0
    );

    today.setHours(
      0,
      0,
      0,
      0
    );

    const diffDays = Math.floor(
      (today - selectedDate) /
        (1000 * 60 * 60 * 24)
    );

    if (
      diffDays > 3 &&
      user?.role !== "admin"
    ) {
      window.alert(
        "You cannot add an update older than 3 days. Please ask an administrator."
      );

      return;
    }

    if (diffDays < 0) {
      window.alert(
        "You cannot add a daily update for a future date."
      );

      return;
    }

    try {
      const cameraPhoto =
        form.camera_photo?.files?.[0];

      const galleryPhoto =
        form.gallery_photo?.files?.[0];

      const selectedPhoto =
        cameraPhoto || galleryPhoto;

      if (selectedPhoto) {
        photoUrl = await uploadFile(
          selectedPhoto
        );
      }

      const newLog = {
        site_id: Number(
          form.site_id.value
        ),
        tender_id:
          form.tender_id.value
            ? Number(
                form.tender_id.value
              )
            : null,
        worker_id: Number(
          form.worker_id.value
        ),
        log_date:
          form.log_date.value,
        notes:
          form.notes.value.trim(),
        photo_url:
          photoUrl,
      };

      await saveSiteLog(newLog);
      form.reset();
    } catch (error) {
      console.error(
        "Failed to add site log:",
        error.response?.data || error
      );

      window.alert(
        error.response?.data?.message ||
          "Failed to add daily site update"
      );
    }
  };

  return (
    <AppRoutes
      user={user}
      logout={handleLogout}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      message={message}
      handleLogin={handleLogin}

      payments={payments}
      addPayment={addPayment}
      deletePayment={
        deletePaymentRecord
      }
      fetchPayments={
        fetchPayments
      }

      workers={workers}
      sites={sites}

      tenders={tenders}

      invoices={invoices}

      siteLogs={siteLogs}
      addSiteLog={addSiteLog}
      deleteSiteLog={
        deleteSiteLogRecord
      }

      allocations={allocations}
      expenses={expenses}
      addAllocation={addAllocation}
      addExpense={addExpense}
      fetchAllocations={
        fetchAllocations
      }
      fetchExpenses={
        fetchExpenses
      }
      updateAllocation={
        updateAllocation
      }
      deleteAllocation={
        deleteAllocation
      }
      updateExpense={
        updateExpense
      }
      deleteExpense={
        deleteExpense
      }
      approveExpense={
        approveExpense
      }
      rejectExpense={
        rejectExpense
      }
    />
  );
}

export default App;