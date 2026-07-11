import { useEffect, useState } from "react";
import { canLoadAdminData } from "../utils/roleAccess";

import {
  getAllocations,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
} from "../services/workerMoneyService";

export default function useWorkerMoney(user) {
  const [allocations, setAllocations] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const fetchAllocations = async () => {
    if (!canLoadAdminData(user)) {
      setAllocations([]);
      return [];
    }
    try {
      const data = await getAllocations();
      setAllocations(data || []);
    } catch (err) {
      console.error("Failed to load allocations", err);
      setAllocations([]);
    }
  };

  const fetchExpenses = async () => {
    if (!canLoadAdminData(user)) {
      setExpenses([]);
      return [];
    }
    try {
      const data = await getExpenses();
      setExpenses(data || []);
    } catch (err) {
      console.error("Failed to load expenses", err);
      setExpenses([]);
    }
  };

  useEffect(() => {
    if (canLoadAdminData(user)) {
      fetchAllocations();
      fetchExpenses();
    } else {
      setAllocations([]);
      setExpenses([]);
    }
  }, [user?.id, user?.role]);

  const addAllocation = async (allocation) => {
    await createAllocation(allocation);
    await fetchAllocations();
  };

  const addExpense = async (expense) => {
    await createExpense(expense);
    await fetchExpenses();
    await fetchAllocations();
  };

  return {
    allocations,
    expenses,

    addAllocation,
    addExpense,

    fetchAllocations,
    fetchExpenses,

    updateAllocation,
    deleteAllocation,

    updateExpense,
    deleteExpense,

    approveExpense,
    rejectExpense,
  };
}