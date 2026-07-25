import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createTender,
  deleteTender,
  getTenders,
} from "../services/tenderService";

export default function useTenders(
  user
) {
  const [
    tenders,
    setTenders,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

  const fetchTenders =
    useCallback(async () => {
      if (!user) {
        setTenders([]);
        return [];
      }

      try {
        setLoading(true);
        setError(null);

        const data =
          await getTenders();

        const tenderList =
          Array.isArray(data)
            ? data
            : [];

        setTenders(
          tenderList
        );

        return tenderList;
      } catch (err) {
        console.error(
          "Failed to load projects:",
          err
        );

        setError(
          err?.message ||
            "Failed to load projects."
        );

        setTenders([]);

        throw err;
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    if (user) {
      fetchTenders().catch(
        () => {}
      );
    } else {
      setTenders([]);
      setError(null);
    }
  }, [
    user,
    fetchTenders,
  ]);

  const addTender =
    useCallback(
      async (tenderData) => {
        try {
          setError(null);

          const createdTender =
            await createTender(
              tenderData
            );

          await fetchTenders();

          return createdTender;
        } catch (err) {
          console.error(
            "Failed to create project:",
            err
          );

          setError(
            err?.message ||
              "Failed to create project."
          );

          throw err;
        }
      },
      [fetchTenders]
    );

  const removeTender =
    useCallback(
      async (id) => {
        try {
          setError(null);

          const result =
            await deleteTender(
              id
            );

          setTenders(
            (previous) =>
              previous.filter(
                (tender) =>
                  Number(
                    tender.id
                  ) !==
                  Number(id)
              )
          );

          return result;
        } catch (err) {
          console.error(
            "Failed to delete project:",
            err
          );

          setError(
            err?.message ||
              "Failed to delete project."
          );

          throw err;
        }
      },
      []
    );

  return {
    tenders,
    loading,
    error,
    fetchTenders,
    addTender,
    removeTender,
    setTenders,
  };
}