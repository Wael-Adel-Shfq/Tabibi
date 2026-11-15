/** Same rules as the database constraints, so forms fail early with a clear message. */
export const PHONE_PATTERN = /^[0-9+ ()-]{5,20}$/;
export const URL_PATTERN = /^https?:\/\/\S+$/i;
