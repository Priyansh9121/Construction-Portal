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
  
  let supabaseClient = null;
  
  /**
   * Returns whether Supabase Storage is fully configured.
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
   * Returns the configured storage bucket.
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
   * Returns a reference to the configured Supabase Storage bucket.
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
   * Checks whether the configured storage bucket is accessible.
   *
   * This can be used by a health-check route or during diagnostics.
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
   * Uploads a file buffer to the configured bucket.
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
   * Deletes one or more files from the configured bucket.
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
   * Creates a signed URL for a private stored file.
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