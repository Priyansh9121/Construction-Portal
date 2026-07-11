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

  const {
    user,
    setUser,
    logout,
  } = useAuth();

  /*
   * These shared hooks provide data used by the dashboard,
   * reports, layout counters and pages that still receive data
   * through AppRoutes.
   */
  const {
    workers = [],
  } = useWorkers(user);

  const {
    sites = [],
  } = useSites(user);

  const {
    tenders = [],
  } = useTenders(user);

  const {
    invoices = [],
  } = useInvoices(user);

  const {
    payments = [],
    addPayment: savePayment,
    removePayment: deletePaymentRecord,
    fetchPayments,
  } = usePayments(user);

  const {
    siteLogs = [],
    addSiteLog: saveSiteLog,
    removeSiteLog: deleteSiteLogRecord,
  } = useSiteLogs(user);

  const {
    allocations = [],
    expenses = [],
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

  /**
   * Clears authentication and login-form state.
   *
   * LoginPage uses controlled inputs, so clearing these values
   * ensures the previous credentials are not shown after logout.
   */
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setEmail("");
      setPassword("");
      setMessage("");
    }
  };

  /**
   * Authenticates the user.
   *
   * Errors are rethrown because LoginPage owns its local
   * submitting state and also needs to know when login failed.
   */
  const handleLogin = async (event) => {
    event.preventDefault();

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    try {
      setMessage("");

      const data = await loginUser({
        email: cleanEmail,
        password,
      });

      if (!data?.user || !data?.token) {
        throw new Error(
          "The login response did not contain valid account information."
        );
      }

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      localStorage.setItem(
        "token",
        data.token
      );

      setUser(data.user);

      /*
       * Clear both credentials immediately after login.
       * They are not needed after authentication succeeds.
       */
      setEmail("");
      setPassword("");
      setMessage("");

      return data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Login failed.";

      setMessage(errorMessage);

      throw error;
    }
  };

  /**
   * Normalises finance data before sending it to usePayments.
   *
   * PaymentsPage performs the refresh after add/update.
   * Do not call fetchPayments here, otherwise every add creates
   * duplicate API requests.
   */
  const addPayment = async (paymentData) => {
    if (!paymentData) {
      throw new Error(
        "Finance record data is required."
      );
    }

    try {
      return await savePayment({
        company_id:
          paymentData.company_id ??
          user?.company_id ??
          null,

        payment_type:
          paymentData.payment_type,

        category:
          paymentData.category ||
          paymentData.payment_sub_type ||
          "",

        amount: Number(
          paymentData.amount || 0
        ),

        description:
          paymentData.description ||
          paymentData.details ||
          "",

        payment_date:
          paymentData.payment_date,

        payment_scope:
          paymentData.payment_scope ||
          null,

        payment_sub_type:
          paymentData.payment_sub_type ||
          null,

        tender_id:
          paymentData.tender_id
            ? Number(paymentData.tender_id)
            : null,

        site_id:
          paymentData.site_id
            ? Number(paymentData.site_id)
            : null,

        material_name:
          paymentData.material_name ||
          null,

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
          paymentData.payment_mode ||
          null,

        details:
          paymentData.details ||
          paymentData.description ||
          null,

        worker_name:
          paymentData.worker_name ||
          null,

        investor_name:
          paymentData.investor_name ||
          null,

        interest_percent: Number(
          paymentData.interest_percent || 0
        ),

        fd_site:
          paymentData.fd_site ||
          null,

        created_by:
          paymentData.created_by ??
          user?.id ??
          null,
      });
    } catch (error) {
      console.error(
        "Failed to save finance record:",
        error.response?.data || error
      );

      throw error;
    }
  };

  /**
   * WorkerMoneyPage still sends the form event because it uses
   * the existing App-level allocation handler.
   */
  const addAllocation = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form) {
      throw new Error(
        "Allocation form is unavailable."
      );
    }

    const workerId = Number(
      form.worker_id?.value || 0
    );

    const allocatedAmount = Number(
      form.allocated_amount?.value || 0
    );

    if (!workerId) {
      throw new Error(
        "Please select a worker."
      );
    }

    if (
      Number.isNaN(allocatedAmount) ||
      allocatedAmount <= 0
    ) {
      throw new Error(
        "Allocated amount must be greater than zero."
      );
    }

    const newAllocation = {
      worker_id: workerId,

      allocated_amount:
        allocatedAmount,

      purpose: String(
        form.purpose?.value || ""
      ).trim(),

      allocated_by:
        user?.id || null,
    };

    try {
      const result =
        await saveAllocation(
          newAllocation
        );

      form.reset();

      return result;
    } catch (error) {
      console.error(
        "Failed to add allocation:",
        error.response?.data || error
      );

      /*
       * WorkerMoneyPage displays toast feedback.
       * Always rethrow so it cannot display false success.
       */
      throw error;
    }
  };

  /**
   * Creates a worker expense from the existing form-based flow.
   */
  const addExpense = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form) {
      throw new Error(
        "Expense form is unavailable."
      );
    }

    const allocationId = Number(
      form.allocation_id?.value || 0
    );

    const expenseAmount = Number(
      form.expense_amount?.value || 0
    );

    const expenseDate =
      form.expense_date?.value || "";

    if (!allocationId) {
      throw new Error(
        "Please select an allocation."
      );
    }

    if (
      Number.isNaN(expenseAmount) ||
      expenseAmount <= 0
    ) {
      throw new Error(
        "Expense amount must be greater than zero."
      );
    }

    if (!expenseDate) {
      throw new Error(
        "Expense date is required."
      );
    }

    const newExpense = {
      allocation_id:
        allocationId,

      expense_amount:
        expenseAmount,

      expense_description:
        String(
          form.expense_description
            ?.value || ""
        ).trim(),

      expense_date:
        expenseDate,

      uploaded_photo:
        null,
    };

    try {
      const result =
        await saveExpense(
          newExpense
        );

      form.reset();

      return result;
    } catch (error) {
      console.error(
        "Failed to add expense:",
        error.response?.data || error
      );

      throw error;
    }
  };

  /**
   * Creates an administrator/manager daily site update.
   *
   * Validation errors are thrown to DailySiteUpdatesPage,
   * where toast feedback and submitting state are managed.
   */
  const addSiteLog = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form) {
      throw new Error(
        "Daily update form is unavailable."
      );
    }

    const logDate =
      form.log_date?.value || "";

    if (!logDate) {
      throw new Error(
        "Update date is required."
      );
    }

    const selectedDate =
      new Date(`${logDate}T00:00:00`);

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      throw new Error(
        "Select a valid update date."
      );
    }

    const differenceInDays =
      Math.floor(
        (today.getTime() -
          selectedDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

    if (differenceInDays < 0) {
      throw new Error(
        "You cannot add a daily update for a future date."
      );
    }

    if (
      differenceInDays > 3 &&
      String(user?.role || "")
        .trim()
        .toLowerCase() !== "admin"
    ) {
      throw new Error(
        "You cannot add an update older than three days. Please ask an administrator."
      );
    }

    const siteId = Number(
      form.site_id?.value || 0
    );

    const workerId = Number(
      form.worker_id?.value || 0
    );

    if (!siteId) {
      throw new Error(
        "Please select a site."
      );
    }

    if (!workerId) {
      throw new Error(
        "Please select a worker."
      );
    }

    const cameraPhoto =
      form.camera_photo
        ?.files?.[0] ||
      null;

    const galleryPhoto =
      form.gallery_photo
        ?.files?.[0] ||
      null;

    const selectedPhoto =
      cameraPhoto ||
      galleryPhoto;

    let photoUrl = null;

    try {
      if (selectedPhoto) {
        photoUrl =
          await uploadFile(
            selectedPhoto
          );
      }

      const newLog = {
        company_id:
          user?.company_id ||
          null,

        site_id:
          siteId,

        tender_id:
          form.tender_id?.value
            ? Number(
                form.tender_id.value
              )
            : null,

        worker_id:
          workerId,

        log_date:
          logDate,

        notes: String(
          form.notes?.value || ""
        ).trim(),

        photo_url:
          photoUrl,
      };

      const result =
        await saveSiteLog(
          newLog
        );

      form.reset();

      return result;
    } catch (error) {
      console.error(
        "Failed to add daily site update:",
        error.response?.data || error
      );

      throw error;
    }
  };

  return (
    <AppRoutes
      /* Authentication */
      user={user}
      logout={handleLogout}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      message={message}
      handleLogin={handleLogin}

      /* Finance */
      payments={payments}
      addPayment={addPayment}
      deletePayment={
        deletePaymentRecord
      }
      fetchPayments={
        fetchPayments
      }

      /* Shared dashboard/report data */
      workers={workers}
      sites={sites}
      tenders={tenders}
      invoices={invoices}

      /* Daily site updates */
      siteLogs={siteLogs}
      addSiteLog={addSiteLog}
      deleteSiteLog={
        deleteSiteLogRecord
      }

      /* Worker money */
      allocations={allocations}
      expenses={expenses}
      addAllocation={
        addAllocation
      }
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