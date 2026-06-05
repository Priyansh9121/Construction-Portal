import { useEffect, useState } from "react";

import {
  getAllocations,
  createAllocation,
  getExpenses,
  createExpense,
} from "../services/workerMoneyService";

export default function useWorkerMoney(user) {
  const [allocations, setAllocations] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const fetchAllocations = async () => {
    try {
      const data = await getAllocations();
      setAllocations(data);
    } catch (err) {
      console.error("Failed to load allocations", err);
    }
  };

  const fetchExpenses = async () => {
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error("Failed to load expenses", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllocations();
      fetchExpenses();
    }
  }, [user]);

  const addAllocation = async (allocation) => {
    await createAllocation(allocation);
    fetchAllocations();
  };

  const addExpense = async (expense) => {
    await createExpense(expense);
    fetchExpenses();
    fetchAllocations();
  };

  return {
    allocations,
    expenses,
    addAllocation,
    addExpense,
    fetchAllocations,
    fetchExpenses,
  };
}