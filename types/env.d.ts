declare namespace NodeJS {
  interface ProcessEnv {
    MONGODB_URI: string;
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
  }
}

export {};
