import { createClient } from '@/lib/supabase/server';
import type { PublicMotorcycle } from '@/lib/catalog';
import Storefront from '@/components/storefront';

const CATALOG_COLUMNS = 'id,stock_code,brand,model,year,color,engine_cc,engine_type,price,description,status,created_at';

export default async function HomePage() {
  let motorcycles: PublicMotorcycle[] = [];
  let catalogAvailable = true;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('public_motorcycle_catalog')
      .select(CATALOG_COLUMNS).order('created_at', { ascending: false }).limit(8);
    if (error) catalogAvailable = false;
    else motorcycles = (data ?? []) as PublicMotorcycle[];
  } catch {
    catalogAvailable = false;
  }
  return <Storefront motorcycles={motorcycles} catalogAvailable={catalogAvailable} />;
}
