/*
|--------------------------------------------------------------------------
| Supabase Storage
|--------------------------------------------------------------------------
|
| File storage only. The database is reached directly through node-postgres
| in database/pool.js — this client never issues a query, and Supabase's
| PostgREST layer is not used at all.
|
| Authenticates with the SERVICE ROLE key, which bypasses row-level
| security completely. That is acceptable here because the key never leaves
| the server and every caller has already been authenticated and
| company-scoped by the upload module before reaching these functions. It
| is also why that key must never appear in a VITE_ variable: anything
| prefixed VITE_ is compiled into public JavaScript.
|
| Storage is optional. A local or test environment with no Supabase project
| still boots; the functions here throw a 503 with a user-facing message
| the moment something actually tries to store a file, rather than failing
| at startup.
|
| Every failure is rethrown as a 502 carrying `publicMessage`, which the
| global error handler shows the user, and `storageError`, which it does
| not. 502 rather than 500 because the fault is in an upstream service, not
| in this API.
|
*/

const {
    createClient,
  } = require(
    "@supabase/supabase-js"
  );
  
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_BUCKET,
    STORAGE_CONFIGURED,
  } = require("./env");
  
  /*
   * Module-level singleton. Created on first use and reused thereafter, so
   * one HTTP agent and connection pool serve every upload rather than a new
   * client per request.
   */
  let supabaseClient = null;
  
  /**
   * Returns whether Supabase Storage is fully configured.
   *
   * STORAGE_CONFIGURED is computed in config/env.js and is true only when
   * the URL, the service-role key and the bucket name are all present.
   * Callers use this to degrade gracefully — the health endpoint reports
   * storage as unavailable rather than erroring.
   */
  const isStorageConfigured = () =>
    STORAGE_CONFIGURED;
  
  /**
   * Creates the Supabase service client only when it is first needed.
   *
   * This prevents the backend from failing during startup when storage
   * is intentionally unavailable in a local or test environment.
   */
  const getSupabaseClient = () => {
    if (!STORAGE_CONFIGURED) {
      const error = new Error(
        "Supabase Storage is not configured."
      );
  
      error.statusCode = 503;
      error.publicMessage =
        "File storage is currently unavailable.";
  
      throw error;
    }
  
    if (!supabaseClient) {
      supabaseClient =
        createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
  
            global: {
              headers: {
                "X-Client-Info":
                  "construction-portal-backend",
              },
            },
          }
        );
    }
  
    return supabaseClient;
  };
  
  /**
   * Returns the configured storage bucket name.
   *
   * Separate from getSupabaseClient because the client can be valid while
   * the bucket name is missing, and the two produce different diagnostics.
   */
  const getStorageBucket = () => {
    if (!SUPABASE_BUCKET) {
      const error = new Error(
        "Supabase Storage bucket is not configured."
      );
  
      error.statusCode = 503;
      error.publicMessage =
        "File storage is currently unavailable.";
  
      throw error;
    }
  
    return SUPABASE_BUCKET;
  };
  
  /**
   * A bucket-scoped storage handle — supabase.storage.from(bucket).
   *
   * Every operation below goes through this rather than reaching for the
   * raw client, so the bucket name is resolved and validated in one place.
   */
  const getStorageBucketClient =
    () => {
      const supabase =
        getSupabaseClient();
  
      const bucket =
        getStorageBucket();
  
      return supabase.storage.from(
        bucket
      );
    };
  
  /**
   * Checks whether the configured storage bucket is actually reachable.
   *
   * Unlike the functions below this never throws: it reports. Three
   * outcomes, so a health check can tell them apart —
   *
   *   configured: false               storage was never set up
   *   configured: true, available: false   set up but the call failed,
   *                                        e.g. a wrong key or a deleted
   *                                        bucket; `error` says which
   *   available: true                 reachable, with the bucket's limits
   *
   * The returned file_size_limit and allowed_mime_types are Supabase's own
   * server-side limits, which sit behind this API's MAX_UPLOAD_SIZE_MB and
   * MIME allowlist. Worth comparing if an upload is rejected upstream
   * despite passing local validation.
   */
  const checkStorageConnection =
    async () => {
      if (!STORAGE_CONFIGURED) {
        return {
          configured: false,
          available: false,
          bucket:
            SUPABASE_BUCKET ||
            null,
        };
      }
  
      const supabase =
        getSupabaseClient();
  
      const {
        data,
        error,
      } =
        await supabase.storage
          .getBucket(
            SUPABASE_BUCKET
          );
  
      if (error) {
        return {
          configured: true,
          available: false,
          bucket:
            SUPABASE_BUCKET,
          error:
            error.message,
        };
      }
  
      return {
        configured: true,
        available: true,
        bucket:
          data?.name ||
          SUPABASE_BUCKET,
        public:
          Boolean(data?.public),
        fileSizeLimit:
          data?.file_size_limit ||
          null,
        allowedMimeTypes:
          data?.allowed_mime_types ||
          null,
      };
    };
  
  /**
   * Uploads a buffer to the bucket and returns its public URL.
   *
   * The buffer comes from multer's memory storage — nothing is written to
   * local disk, which matters on a host with an ephemeral filesystem.
   *
   * filePath is the key within the bucket. The upload module builds it with
   * the company id as the leading segment, so one tenant's files cannot
   * collide with or overwrite another's.
   *
   * upsert defaults to false, so an upload to an existing key fails rather
   * than silently replacing a file.
   *
   * cacheControl is seconds, passed to the CDN in front of the bucket. One
   * hour by default.
   *
   * The content type falls back to application/octet-stream, which makes a
   * browser download the file rather than try to render it — the safe
   * default for something whose type could not be determined.
   */
  const uploadStorageFile =
    async ({
      filePath,
      buffer,
      contentType,
      cacheControl = "3600",
      upsert = false,
    }) => {
      if (!filePath) {
        const error = new Error(
          "Storage file path is required."
        );
  
        error.statusCode = 400;
        throw error;
      }
  
      if (!buffer) {
        const error = new Error(
          "Storage file buffer is required."
        );
  
        error.statusCode = 400;
        throw error;
      }
  
      const bucketClient =
        getStorageBucketClient();
  
      const {
        data,
        error,
      } =
        await bucketClient.upload(
          filePath,
          buffer,
          {
            contentType:
              contentType ||
              "application/octet-stream",
  
            cacheControl,
  
            upsert,
          }
        );
  
      if (error) {
        const uploadError =
          new Error(
            error.message ||
              "File upload failed."
          );
  
        uploadError.statusCode =
          502;
  
        uploadError.publicMessage =
          "The file could not be uploaded.";
  
        uploadError.storageError =
          error;
  
        throw uploadError;
      }
  
      const {
        data: publicUrlData,
      } =
        bucketClient.getPublicUrl(
          filePath
        );
  
      return {
        path:
          data?.path ||
          filePath,
  
        fullPath:
          data?.fullPath ||
          null,
  
        publicUrl:
          publicUrlData
            ?.publicUrl ||
          null,
      };
    };
  
  /**
   * Removes one or more files from the bucket.
   *
   * Accepts a single path or an array, and drops falsy entries — so a
   * caller mapping over records where some have no stored file does not
   * have to filter first.
   *
   * An empty list is a no-op rather than an error, which keeps "delete the
   * attachments for this record" working when there are none.
   *
   * Note Supabase's remove() does not report a missing key as an error, so
   * a successful return does not prove the files existed.
   */
  const deleteStorageFiles =
    async (filePaths) => {
      const paths =
        Array.isArray(filePaths)
          ? filePaths.filter(
              Boolean
            )
          : [filePaths].filter(
              Boolean
            );
  
      if (paths.length === 0) {
        return {
          deleted: [],
        };
      }
  
      const bucketClient =
        getStorageBucketClient();
  
      const {
        data,
        error,
      } =
        await bucketClient.remove(
          paths
        );
  
      if (error) {
        const deleteError =
          new Error(
            error.message ||
              "File deletion failed."
          );
  
        deleteError.statusCode =
          502;
  
        deleteError.publicMessage =
          "The stored file could not be deleted.";
  
        deleteError.storageError =
          error;
  
        throw deleteError;
      }
  
      return {
        deleted:
          data || [],
      };
    };
  
  /**
   * Creates a time-limited URL for a file in a private bucket.
   *
   * Only meaningful when the bucket is private — for a public bucket the
   * permanent URL from uploadStorageFile is already readable by anyone.
   *
   * expiresIn is seconds; one hour by default. The link carries its own
   * signature, so anyone holding it has access for that window regardless
   * of whether they are signed in.
   */
  const createSignedFileUrl =
    async ({
      filePath,
      expiresIn = 3600,
    }) => {
      if (!filePath) {
        const error = new Error(
          "Storage file path is required."
        );
  
        error.statusCode = 400;
        throw error;
      }
  
      const bucketClient =
        getStorageBucketClient();
  
      const {
        data,
        error,
      } =
        await bucketClient.createSignedUrl(
          filePath,
          expiresIn
        );
  
      if (error) {
        const signedUrlError =
          new Error(
            error.message ||
              "Signed URL generation failed."
          );
  
        signedUrlError.statusCode =
          502;
  
        signedUrlError.publicMessage =
          "The file link could not be generated.";
  
        signedUrlError.storageError =
          error;
  
        throw signedUrlError;
      }
  
      return {
        signedUrl:
          data?.signedUrl ||
          null,
      };
    };
  
  module.exports = {
    isStorageConfigured,
    getSupabaseClient,
    getStorageBucket,
    getStorageBucketClient,
  
    checkStorageConnection,
  
    uploadStorageFile,
    deleteStorageFiles,
    createSignedFileUrl,
  };