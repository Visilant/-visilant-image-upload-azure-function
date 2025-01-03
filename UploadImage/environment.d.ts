declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BASE_URL: string;
      AZURE_CONTAINER: string;
      CONTAINER_NAME: string;
      AZURE_STORAGE_CONNECTION_STRING: string;
      KEY: string;
    }
  }
}

export {};
