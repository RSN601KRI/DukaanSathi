CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text NOT NULL DEFAULT '', shop_name text NOT NULL DEFAULT '', avatar_url text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY own_profile_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, key text NOT NULL, name text NOT NULL, qty numeric NOT NULL DEFAULT 0 CHECK (qty >= 0 AND qty < 100000000), unit text NOT NULL, price numeric NOT NULL CHECK (price > 0 AND price < 100000000), low numeric NOT NULL DEFAULT 0 CHECK (low >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,key));
GRANT SELECT ON public.products TO authenticated; GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_products ON public.products FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.sales_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), product text NOT NULL, qty numeric NOT NULL CHECK (qty > 0), unit_price numeric NOT NULL CHECK (unit_price > 0), total numeric NOT NULL CHECK (total > 0), transaction_type text NOT NULL DEFAULT 'sale' CHECK (transaction_type = 'sale'), at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL, UNIQUE(user_id,request_id));
GRANT SELECT ON public.sales_transactions TO authenticated; GRANT ALL ON public.sales_transactions TO service_role;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_sales ON public.sales_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.customer_credit_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, customer text NOT NULL, amount numeric NOT NULL CHECK (amount > 0), transaction_type text NOT NULL DEFAULT 'credit' CHECK (transaction_type = 'credit'), at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL, UNIQUE(user_id,request_id));
GRANT SELECT ON public.customer_credit_entries TO authenticated; GRANT ALL ON public.customer_credit_entries TO service_role;
ALTER TABLE public.customer_credit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_credits ON public.customer_credit_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.activity_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, at timestamptz NOT NULL DEFAULT now(), transcript text NOT NULL, source text NOT NULL, action text NOT NULL, status text NOT NULL, result text NOT NULL, request_id uuid NOT NULL, UNIQUE(user_id,request_id));
GRANT SELECT ON public.activity_logs TO authenticated; GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_logs ON public.activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX sales_owner_date ON public.sales_transactions(user_id,at);
CREATE INDEX credits_owner ON public.customer_credit_entries(user_id);
CREATE INDEX logs_owner_date ON public.activity_logs(user_id,at);
CREATE FUNCTION public.create_shop_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.profiles(id,display_name) VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name',''),100));
 INSERT INTO public.products(user_id,key,name,qty,unit,price,low) VALUES
 (NEW.id,'chawal','चावल Chawal',0,'kg',60,10),(NEW.id,'atta','आटा Atta',0,'kg',45,10),(NEW.id,'cheeni','चीनी Cheeni',0,'kg',45,8),(NEW.id,'doodh','दूध Doodh',0,'L',56,10),(NEW.id,'tel','तेल Tel',0,'L',160,5),(NEW.id,'dal','दाल Dal',0,'kg',120,5),(NEW.id,'namak','नमक Namak',0,'packet',25,10),(NEW.id,'biscuit','बिस्किट Biscuit',0,'packet',10,20),(NEW.id,'sabun','साबुन Sabun',0,'pc',35,10),(NEW.id,'chai','चाय Chai',0,'packet',140,5);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_shop_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER create_dukaan_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_shop_profile();
CREATE FUNCTION public.shop_operation(p_request uuid,p_action text,p_product text,p_qty numeric,p_unit text,p_customer text,p_amount numeric,p_transcript text,p_source text,p_status text DEFAULT 'confirmed',p_note text DEFAULT '',p_expected_price numeric DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); p public.products; prior public.activity_logs; result text; total numeric;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM id FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
 IF p_request IS NULL OR length(p_transcript)>1000 OR length(p_source)>100 THEN RAISE EXCEPTION 'Invalid request'; END IF;
 SELECT * INTO prior FROM public.activity_logs WHERE user_id=u AND request_id=p_request;
 IF FOUND THEN
  IF prior.transcript<>p_transcript OR prior.action<>p_action THEN RAISE EXCEPTION 'Request already used'; END IF;
  RETURN prior.result;
 END IF;
 IF p_status IN ('cancelled','needs_info','answered') THEN
  result := left(p_note,1000);
 ELSIF p_status='confirmed' THEN
  IF p_action IN ('add_stock','record_sale') THEN
   IF p_qty IS NULL OR p_qty<=0 OR p_qty>=1000000 OR p_qty::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
   SELECT * INTO p FROM public.products WHERE user_id=u AND key=p_product FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Product list mein nahi hai'; END IF;
   IF p_unit IS NOT NULL AND p_unit<>p.unit THEN RAISE EXCEPTION 'Unit unclear; use the product unit'; END IF;
   IF p_action='record_sale' THEN
    IF p.qty<p_qty THEN RAISE EXCEPTION 'Stock insufficient; bikri nahi likhi'; END IF;
    IF p_expected_price IS NULL OR p_expected_price<>p.price THEN RAISE EXCEPTION 'Price changed; confirm again'; END IF;
    total := round(p_qty*p.price,2);
    IF total<=0 THEN RAISE EXCEPTION 'Sale amount too small'; END IF;
    UPDATE public.products SET qty=qty-p_qty,updated_at=now() WHERE id=p.id;
    INSERT INTO public.sales_transactions(user_id,product_id,product,qty,unit_price,total,request_id) VALUES(u,p.id,p.key,p_qty,p.price,total,p_request);
    result := p_qty||' '||p.unit||' '||p.name||' ki bikri ₹'||total||' likh di. Bacha: '||(p.qty-p_qty)||' '||p.unit||'.';
   ELSE
    UPDATE public.products SET qty=qty+p_qty,updated_at=now() WHERE id=p.id;
    result := p_qty||' '||p.unit||' '||p.name||' jod diya. Ab stock: '||(p.qty+p_qty)||' '||p.unit||'.';
   END IF;
  ELSIF p_action='add_credit' THEN
   IF p_amount IS NULL OR p_amount<=0 OR p_amount>=100000000 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_customer IS NULL OR length(trim(p_customer)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Customer aur positive amount chahiye'; END IF;
   INSERT INTO public.customer_credit_entries(user_id,customer,amount,request_id) VALUES(u,trim(p_customer),p_amount,p_request);
   SELECT sum(amount) INTO total FROM public.customer_credit_entries WHERE user_id=u AND lower(customer)=lower(trim(p_customer));
   result := p_customer||' ka ₹'||p_amount||' udhaar likh diya. Kul baaki: ₹'||total||'.';
  ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 ELSE RAISE EXCEPTION 'Invalid status'; END IF;
 INSERT INTO public.activity_logs(user_id,transcript,source,action,status,result,request_id) VALUES(u,p_transcript,p_source,p_action,p_status,result,p_request);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.shop_operation(uuid,text,text,numeric,text,text,numeric,text,text,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shop_operation(uuid,text,text,numeric,text,text,numeric,text,text,text,text,numeric) TO authenticated;
CREATE FUNCTION public.shop_snapshot() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT jsonb_build_object('products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY created_at,key) FROM public.products p WHERE user_id=auth.uid()),'[]'::jsonb),'sales',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY at) FROM public.sales_transactions s WHERE user_id=auth.uid()),'[]'::jsonb),'credits',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY at) FROM public.customer_credit_entries c WHERE user_id=auth.uid()),'[]'::jsonb),'log',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY at DESC) FROM (SELECT * FROM public.activity_logs WHERE user_id=auth.uid() ORDER BY at DESC LIMIT 50) l),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.shop_snapshot() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.shop_snapshot() TO authenticated;