-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  is_edu_account BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create chat_histories table
CREATE TABLE public.chat_histories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

-- Create policies for chat histories
CREATE POLICY "Users can view their own chat histories" 
ON public.chat_histories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat histories" 
ON public.chat_histories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat histories" 
ON public.chat_histories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat histories" 
ON public.chat_histories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admin policy for findhistory feature
CREATE POLICY "Allow findhistory access with special permission" 
ON public.chat_histories 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.email = 'admin@edisonschools.org'
  )
);

-- Create directory_contacts table for edu accounts
CREATE TABLE public.directory_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  department TEXT,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.directory_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for directory contacts
CREATE POLICY "Users can view their own directory contacts" 
ON public.directory_contacts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own directory contacts" 
ON public.directory_contacts 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_histories_updated_at
  BEFORE UPDATE ON public.chat_histories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, is_edu_account)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    (NEW.email LIKE '%.edu' OR NEW.email LIKE '%@edisonschools.org')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();