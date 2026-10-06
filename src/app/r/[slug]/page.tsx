'use client';
import { RestaurantMenu } from '@/features/menu/RestaurantMenu';
export default function RestaurantHome({params}:{params:{slug:string}}){return <RestaurantMenu restaurantSlug={params.slug}/>}
