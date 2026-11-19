import { notFound } from 'next/navigation';
import SampleProductDetail from '@/components/sample-product-detail';
import { sampleProducts } from '@/lib/storefront-products';
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const product=sampleProducts.find(p=>p.id===slug);if(!product)notFound();return <SampleProductDetail product={product}/>;}
