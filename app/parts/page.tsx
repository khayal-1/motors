import PartsCatalog from '@/components/parts-catalog';
export default async function PartsPage({searchParams}:{searchParams:Promise<{q?:string;category?:string}>}){const params=await searchParams;return <PartsCatalog initialQuery={typeof params.q==='string'?params.q:''} initialCategory={typeof params.category==='string'?params.category:''}/>;}
