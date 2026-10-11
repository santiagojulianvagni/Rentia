import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '../../../components/site/product-detail';
import { findLandingProduct, landingProducts } from '../../../lib/landing-products';
import '../../landing-v2.css';

type ProductParams = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return landingProducts.map(product => ({ slug: product.slug })); }
export async function generateMetadata({ params }: ProductParams): Promise<Metadata> {
  const product = findLandingProduct((await params).slug);
  if (!product) notFound();
  return { title: `${product.title} — Rentia`, description: product.description };
}
export default async function ProductDetailPage({ params }: ProductParams) {
  const { slug } = await params;
  if (!findLandingProduct(slug)) notFound();
  return <ProductDetail slug={slug}/>;
}
