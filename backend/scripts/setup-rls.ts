import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL as string)

await sql.unsafe(`
  -- Function that creates a profile row when a new auth user is created
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id)
    VALUES (new.id);
    RETURN new;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Trigger that fires after insert on auth.users
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  -- Enable Row Level Security
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  -- Policy: users can read their own profile
  DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
  CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

  -- Policy: users can update their own profile
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
`)

console.log('Trigger and RLS policies created successfully')
await sql.end()
