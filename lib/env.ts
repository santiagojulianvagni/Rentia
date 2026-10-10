// Runtime configuration: the deployment's environment variables
// (Vercel project settings in production, .env.local when running locally).
export const env=process.env as Record<string,string|undefined>;
