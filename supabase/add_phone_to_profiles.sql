-- Add phone column to profiles table for donation autofill
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
