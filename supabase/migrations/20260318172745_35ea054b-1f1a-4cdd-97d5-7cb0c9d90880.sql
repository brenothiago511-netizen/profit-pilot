
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'financeiro'::app_role
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    'financeiro'::app_role
  );
  
  RETURN NEW;
END;
$function$;
