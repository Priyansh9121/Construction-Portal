import { useEffect, useState } from "react";

import {
  getTenders,
  createTender,
  deleteTender,
} from "../services/tenderService";

export default function useTenders(user) {
  const [tenders, setTenders] = useState([]);

  const fetchTenders = async () => {
    try {
      const data = await getTenders();
      setTenders(data);
    } catch (err) {
      console.error("Failed to load tenders", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTenders();
    }
  }, [user]);

  const addTender = async (tender) => {
    await createTender(tender);
    fetchTenders();
  };

  const removeTender = async (id) => {
    await deleteTender(id);
    fetchTenders();
  };

  return {
    tenders,
    addTender,
    removeTender,
    fetchTenders,
  };
}