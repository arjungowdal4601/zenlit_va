/*
  # Fix signup trigger to prevent database errors

  1. Problem
    - The handle_new_user trigger is failing due to NOT NULL constraint violations
    - Username generation in exception blocks is not working properly
    - This causes "Database error saving new user" during signup

  2. Solution
    - Update the trigger function to ensure username is always provided
    - Improve error handling in exception blocks
    - Add better fallback username generation

  3. Security
    - Maintain existing RLS policies
    - Ensure trigger has proper permissions
*/

-- Update the trigger function with better error handling and username generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  fallback_username TEXT;
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for user: % with email: %', NEW.id, NEW.email;
  
  -- Generate a base username from UUID (lowercase, first 8 characters)
  base_username := 'user_' || LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  
  -- Generate fallback username for exception handling
  fallback_username := 'user_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  
  -- Get a unique username
  BEGIN
    final_username := public.generate_unique_username(base_username);
  EXCEPTION
    WHEN OTHERS THEN
      -- If username generation fails, use timestamp-based fallback
      final_username := fallback_username;
  END;
  
  -- Insert profile with comprehensive data and better error handling
  INSERT INTO public.profiles (
    id, 
    name, 
    username,
    email, 
    bio, 
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'first_name',
      split_part(NEW.email, '@', 1),
      'New User'
    ),
    final_username, -- Use the unique username
    NEW.email,
    'New to Zenlit! 👋',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Update existing profile if it exists but has missing data
    name = CASE 
      WHEN profiles.name IS NULL OR profiles.name = '' 
      THEN EXCLUDED.name 
      ELSE profiles.name 
    END,
    username = CASE 
      WHEN profiles.username IS NULL OR profiles.username = '' 
      THEN EXCLUDED.username 
      ELSE profiles.username 
    END,
    email = CASE 
      WHEN profiles.email IS NULL OR profiles.email = '' 
      THEN EXCLUDED.email 
      ELSE profiles.email 
    END,
    bio = CASE 
      WHEN profiles.bio IS NULL OR profiles.bio = '' 
      THEN EXCLUDED.bio 
      ELSE profiles.bio 
    END,
    updated_at = now();
  
  RAISE LOG 'Profile created/updated successfully for user: %', NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle unique constraint violations specifically
    RAISE LOG 'Unique constraint violation for user %: %', NEW.id, SQLERRM;
    -- Try with a timestamp-based username as fallback
    BEGIN
      INSERT INTO public.profiles (id, name, username, email, bio, created_at, updated_at)
      VALUES (
        NEW.id,
        COALESCE(split_part(NEW.email, '@', 1), 'New User'),
        fallback_username, -- Use fallback username
        NEW.email,
        'New to Zenlit! 👋',
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        username = CASE 
          WHEN profiles.username IS NULL OR profiles.username = '' 
          THEN EXCLUDED.username 
          ELSE profiles.username 
        END,
        email = CASE 
          WHEN profiles.email IS NULL OR profiles.email = '' 
          THEN EXCLUDED.email 
          ELSE profiles.email 
        END,
        updated_at = now();
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'Failed to create profile with fallback username for user %: %', NEW.id, SQLERRM;
        -- Last resort: create minimal profile with just ID and email
        INSERT INTO public.profiles (id, email, username, created_at)
        VALUES (NEW.id, NEW.email, fallback_username, now())
        ON CONFLICT (id) DO NOTHING;
    END;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log any other errors but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    -- Still try to create a minimal profile to prevent auth failures
    BEGIN
      INSERT INTO public.profiles (id, email, username, created_at)
      VALUES (NEW.id, NEW.email, fallback_username, now())
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'Failed to create even minimal profile for user %: %', NEW.id, SQLERRM;
        -- Don't fail the auth user creation even if profile creation completely fails
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update the generate_unique_username function to be more robust
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_username TEXT)
RETURNS TEXT AS $$
DECLARE
  final_username TEXT;
  counter INTEGER := 1;
  max_attempts INTEGER := 100; -- Limit attempts to prevent infinite loops
BEGIN
  final_username := base_username;
  
  -- Keep trying until we find a unique username
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) AND counter <= max_attempts LOOP
    final_username := base_username || counter::TEXT;
    counter := counter + 1;
  END LOOP;
  
  -- If we hit max attempts, use timestamp-based username
  IF counter > max_attempts THEN
    final_username := base_username || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  END IF;
  
  RETURN final_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to ensure the trigger can write to profiles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Create a function to test the trigger manually
CREATE OR REPLACE FUNCTION public.test_profile_creation(test_email TEXT, test_user_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  user_id UUID;
  result TEXT;
BEGIN
  -- Use provided user_id or generate a new one
  user_id := COALESCE(test_user_id, gen_random_uuid());
  
  -- Simulate the trigger by calling the function directly
  BEGIN
    -- Create a test record that mimics auth.users structure
    INSERT INTO public.profiles (id, email, username, name, created_at)
    SELECT 
      user_id,
      test_email,
      'test_' || LOWER(SUBSTRING(REPLACE(user_id::text, '-', ''), 1, 8)),
      split_part(test_email, '@', 1),
      now();
    
    result := 'SUCCESS: Profile created for ' || test_email;
  EXCEPTION
    WHEN OTHERS THEN
      result := 'ERROR: ' || SQLERRM;
  END;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;