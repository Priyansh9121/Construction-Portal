import { useEffect, useState } from "react";

import {
  getWorkers,
  createWorker,
  deleteWorker,
} from "../services/workerService";

export default function useWorkers(user) {
  const [workers, setWorkers] = useState([]);

  const fetchWorkers = async () => {
    try {
      const data = await getWorkers();
      setWorkers(data);
    } catch (err) {
      console.error("Failed to load workers", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkers();
    }
  }, [user]);

  const addWorker = async (worker) => {
    await createWorker(worker);
    fetchWorkers();
  };

  const removeWorker = async (id) => {
    await deleteWorker(id);
    fetchWorkers();
  };

  return {
    workers,
    addWorker,
    removeWorker,
    fetchWorkers,
  };
}