CREATE TABLE public.clerk_profiles (clerk_id text PRIMARY KEY, profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.clerk_profiles TO service_role;
ALTER TABLE public.clerk_profiles ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.clerk_profiles IS 'Maps external Clerk sign-in identities to shop profiles; server-side access only.';

CREATE FUNCTION public.seed_shop_products(p_profile uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.products(user_id,key,name,qty,unit,price,low)
  SELECT p_profile,'chawal','चावल Chawal',0,'kg',60,10 UNION ALL SELECT p_profile,'atta','आटा Atta',0,'kg',45,10 UNION ALL SELECT p_profile,'cheeni','चीनी Cheeni',0,'kg',45,8 UNION ALL SELECT p_profile,'doodh','दूध Doodh',0,'L',56,10 UNION ALL SELECT p_profile,'tel','तेल Tel',0,'L',160,5 UNION ALL SELECT p_profile,'dal','दाल Dal',0,'kg',120,5 UNION ALL SELECT p_profile,'namak','नमक Namak',0,'packet',25,10 UNION ALL SELECT p_profile,'biscuit','बिस्किट Biscuit',0,'packet',10,20 UNION ALL SELECT p_profile,'sabun','साबुन Sabun',0,'pc',35,10 UNION ALL SELECT p_profile,'chai','चाय Chai',0,'packet',140,5
  WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE user_id = p_profile);
$$;

CREATE FUNCTION public.ensure_shop_profile(p_clerk_id text, p_display_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid;
BEGIN
  IF p_clerk_id IS NULL OR length(trim(p_clerk_id)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid identity'; END IF;
  SELECT profile_id INTO v_profile FROM public.clerk_profiles WHERE clerk_id = p_clerk_id;
  IF v_profile IS NOT NULL THEN RETURN v_profile; END IF;
  INSERT INTO public.profiles(id,display_name) VALUES (gen_random_uuid(), left(coalesce(trim(p_display_name),''),100)) RETURNING id INTO v_profile;
  PERFORM public.seed_shop_products(v_profile);
  INSERT INTO public.clerk_profiles(clerk_id,profile_id) VALUES (p_clerk_id,v_profile) ON CONFLICT (clerk_id) DO UPDATE SET profile_id = EXCLUDED.profile_id;
  RETURN v_profile;
END $$;

CREATE FUNCTION public.shop_operation_for(p_user uuid,p_request uuid,p_action text,p_product text,p_qty numeric,p_unit text,p_customer text,p_amount numeric,p_transcript text,p_source text,p_status text DEFAULT 'confirmed',p_note text DEFAULT '',p_expected_price numeric DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := p_user; p public.products; prior public.activity_logs; result text; total numeric;
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

CREATE FUNCTION public.shop_snapshot_for(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT jsonb_build_object('products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY created_at,key) FROM public.products p WHERE user_id=p_user),'[]'::jsonb),'sales',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY at) FROM public.sales_transactions s WHERE user_id=p_user),'[]'::jsonb),'credits',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY at) FROM public.customer_credit_entries c WHERE user_id=p_user),'[]'::jsonb),'log',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY at DESC) FROM (SELECT * FROM public.activity_logs WHERE user_id=p_user ORDER BY at DESC LIMIT 50) l),'[]'::jsonb));
$$;

REVOKE ALL ON FUNCTION public.seed_shop_products(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ensure_shop_profile(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shop_operation_for(uuid,uuid,text,text,numeric,text,text,numeric,text,text,text,text,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shop_snapshot_for(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seed_shop_products(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_shop_profile(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_operation_for(uuid,uuid,text,text,numeric,text,text,numeric,text,text,text,text,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_snapshot_for(uuid) TO service_role;
COMMENT ON FUNCTION public.shop_operation(uuid,text,text,numeric,text,text,numeric,text,text,text,text,numeric) IS 'DEPRECATED: Supabase-auth RPC; kept for history. External deployments use shop_operation_for with a verified Clerk identity resolved server-side.';
COMMENT ON FUNCTION public.shop_snapshot() IS 'DEPRECATED: Supabase-auth RPC; kept for history. External deployments use shop_snapshot_for with a verified Clerk identity resolved server-side.';